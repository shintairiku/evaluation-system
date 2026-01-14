from __future__ import annotations
import logging
from typing import Optional, Dict, Any, Set
from uuid import UUID
from datetime import date
from cachetools import TTLCache
import asyncio

from .clerk_service import ClerkService
from ..database.repositories.user_repo import UserRepository
from ..database.repositories.department_repo import DepartmentRepository
from ..database.repositories.stage_repo import StageRepository
from ..database.repositories.role_repo import RoleRepository
from ..security.rbac_helper import RBACHelper
from ..security.decorators import require_permission
from ..security.rbac_types import ResourceType
from ..database.models.user import User as UserModel, UserSupervisor
from ..schemas.user import (
    UserCreate, UserUpdate, UserStageUpdate, User, UserDetailResponse, UserInDB, SimpleUser,
    Department, Stage, Role, UserStatus, UserExistsResponse, UserClerkIdUpdate,
    BulkUserStatusUpdateItem, BulkUserStatusUpdateResult, BulkUserStatusUpdateResponse,
    UserGoalWeightUpdate, UserGoalWeightHistoryEntry, GoalWeightBudget
)
from ..schemas.common import PaginationParams, PaginatedResponse
from ..security.context import AuthContext
from ..security.permissions import Permission
from ..core.exceptions import (
    NotFoundError, ConflictError, PermissionDeniedError, BadRequestError
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete

logger = logging.getLogger(__name__)

# Cache for user search results (100 items, 30-second TTL for faster hierarchy updates)
user_search_cache = TTLCache(maxsize=100, ttl=30)
# Cache for user detail responses to reduce repeated detail lookups in dashboards
user_detail_cache = TTLCache(maxsize=256, ttl=30)



class UserService:
    """Service layer for user-related business logic and operations"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.clerk_service = ClerkService()
        self.user_repo = UserRepository(session)
        self.department_repo = DepartmentRepository(session)
        self.stage_repo = StageRepository(session)
        self.role_repo = RoleRepository(session)
        
        # Initialize RBACHelper with user repository for standardized permissions
        RBACHelper.initialize_with_repository(self.user_repo)
    
    async def get_users(
        self, 
        current_user_context: AuthContext, 
        search_term: str = "",
        statuses: Optional[list[UserStatus]] = None,
        department_ids: Optional[list[UUID]] = None,
        stage_ids: Optional[list[UUID]] = None,
        role_ids: Optional[list[UUID]] = None,
        supervisor_id: Optional[UUID] = None,
        pagination: Optional[PaginationParams] = None
    ) -> PaginatedResponse[UserDetailResponse]:
        """
        Get users based on current user's permissions, with explicit multi-select filters.
        Uses permission-based access control from security module.
        """
        try:
            
            # Use RBACHelper for standardized permission-based access control
            user_ids_to_filter = await RBACHelper.get_accessible_user_ids(
                current_user_context
            )
            
            # Generate cache key including role information for proper caching
            cache_key_params = {
                "search_term": search_term,
                "statuses": sorted(statuses) if statuses else None,
                "department_ids": sorted([str(d) for d in department_ids]) if department_ids else None,
                "stage_ids": sorted([str(s) for s in stage_ids]) if stage_ids else None,
                "role_ids": sorted([str(r) for r in role_ids]) if role_ids else None,
                "supervisor_id": str(supervisor_id) if supervisor_id else None, 
                "user_ids": sorted([str(u) for u in user_ids_to_filter]) if user_ids_to_filter else None,
                "pagination": f"{pagination.page}_{pagination.limit}" if pagination else None,
                "requesting_user_roles": sorted(current_user_context.role_names)
            }
            cache_key = self._generate_cache_key("get_users", cache_key_params)
            
            # Check cache
            cached_result = user_search_cache.get(cache_key)
            if cached_result:
                return PaginatedResponse.model_validate_json(cached_result)
            
            # Get organization ID from current user context for automatic filtering
            org_id = current_user_context.organization_id
            
            # Handle supervisor_id filtering specifically
            final_user_ids_to_filter = user_ids_to_filter
            if supervisor_id:
                # Get subordinates of the specified supervisor (org-scoped)
                subordinate_users = await self.user_repo.get_subordinates(supervisor_id, org_id)
                subordinate_ids = [user.id for user in subordinate_users]
                
                # If we already have user_ids_to_filter, intersect them
                if final_user_ids_to_filter:
                    final_user_ids_to_filter = list(set(final_user_ids_to_filter) & set(subordinate_ids))
                else:
                    final_user_ids_to_filter = subordinate_ids
            
            # Get data from repository with organization filtering
            users = await self.user_repo.search_users(
                search_term=search_term,
                statuses=statuses,
                department_ids=department_ids,
                stage_ids=stage_ids,
                role_ids=role_ids,
                user_ids=final_user_ids_to_filter,
                pagination=pagination,
                org_id=org_id  # Automatic organization filtering
            )
            
            total_count = await self.user_repo.count_users(
                search_term=search_term,
                statuses=statuses,
                department_ids=department_ids,
                stage_ids=stage_ids,
                role_ids=role_ids,
                user_ids=final_user_ids_to_filter,
                org_id=org_id  # Automatic organization filtering
            )
            
            # Enrich users with detailed data including supervisor/subordinates
            enriched_users = []
            for user_model in users:
                enriched_user = await self._enrich_detailed_user_data(user_model)
                enriched_users.append(enriched_user)
            
            # Create paginated response
            total_pages = (total_count + pagination.limit - 1) // pagination.limit if pagination else 1
            
            result = PaginatedResponse(
                items=enriched_users,
                total=total_count,
                page=pagination.page if pagination else 1,
                limit=pagination.limit if pagination else len(enriched_users),
                pages=total_pages
            )
            
            # Cache the result
            user_search_cache[cache_key] = result.model_dump_json()
            
            return result
            
        except Exception as e:
            logger.error(f"Error in get_users: {e}")
            raise
    
    async def get_users_for_org_chart(
        self,
        current_user_context: AuthContext,
        department_ids: Optional[list[UUID]] = None,
        role_ids: Optional[list[UUID]] = None,
        supervisor_id: Optional[UUID] = None
    ) -> list[SimpleUser]:
        """
        Get users for organization chart display - requires authentication but NO RBAC permission checks.
        Always filters to active users only.
        Returns a simple list of SimpleUser objects (no stage info).
        
        Args:
            current_user_context: Authentication context (required but no permissions checked)
            department_ids: Optional filter by department IDs
            role_ids: Optional filter by role IDs  
            supervisor_id: Optional filter by supervisor ID to get subordinates
            
        Returns:
            List of SimpleUser objects for active users matching filters
        """
        try:
            # Get organization context
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")
            
            # Handle supervisor_id filtering
            user_ids_to_filter = None
            if supervisor_id:
                subordinate_users = await self.user_repo.get_subordinates(supervisor_id, org_id)
                user_ids_to_filter = [user.id for user in subordinate_users]
            
            # Use efficient repository method with joins
            users = await self.user_repo.get_users_for_org_chart(
                org_id,
                department_ids=department_ids,
                role_ids=role_ids,
                user_ids=user_ids_to_filter
            )
            
            return users
            
        except Exception as e:
            logger.error(f"Error in get_users_for_organization_chart: {e}")
            raise
    
    async def get_user_by_id(
        self, 
        user_id: UUID, 
        current_user_context: AuthContext
    ) -> UserDetailResponse:
        """
        Get a specific user by ID and return UserDetailResponse with supervisor/subordinates
        """
        try:
            cache_key = f"user_detail::{current_user_context.organization_id}::{user_id}::{','.join(sorted(current_user_context.role_names))}"
            if cached := user_detail_cache.get(cache_key):
                return cached
            # Check if user exists
            # Enforce organization scope on read
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")
            user = await self.user_repo.get_user_by_id(user_id, org_id)
            if not user:
                raise NotFoundError(f"User with ID {user_id} not found")
            
            # Use RBACHelper for standardized permission-based access control
            can_access = await RBACHelper.can_access_resource(
                current_user_context,
                user_id,
                ResourceType.USER,
                owner_user_id=user_id
            )
            
            if not can_access:
                raise PermissionDeniedError(f"You do not have permission to access user {user_id}")
            
            # Organization consistency check: ensure target user belongs to same organization
            if current_user_context.organization_id and user.clerk_organization_id:
                if user.clerk_organization_id != current_user_context.organization_id:
                    raise PermissionDeniedError(f"User {user_id} belongs to a different organization")
            
            # Enrich user data for detail response with supervisor/subordinates
            enriched_user = await self._enrich_detailed_user_data(user)
            user_detail_cache[cache_key] = enriched_user
            return enriched_user
            
        except Exception as e:
            logger.error(f"Error getting user {user_id}: {str(e)}")
            raise
    
    async def create_user(
        self, 
        user_data: UserCreate, 
        current_user_context: AuthContext
    ) -> UserDetailResponse:
        """
        Create a new user with validation and business rules
        
        Business Logic:
        - Only admin can create users
        - Validate all required relationships exist
        - Check for conflicts (email, employee_code, clerk_id)
        - Set default status to active
        - Assign roles and supervisor relationships
        """
        try:
            # Permission-based access control - Allow admin creation or self-registration
            is_admin = current_user_context.has_permission(Permission.USER_MANAGE)
            is_self_registration = (user_data.clerk_user_id == current_user_context.clerk_user_id)
            
            if not (is_admin or is_self_registration):
                raise PermissionDeniedError("You can only create your own user profile or be an admin")
            
            # For self-registration, set status to PENDING_APPROVAL
            if is_self_registration and not is_admin:
                user_data.status = UserStatus.PENDING_APPROVAL
            
            # Get organization context
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")
            
            # Business validation
            logger.info(f"🔍 VALIDATION: Starting validation for user creation in org {org_id}")
            try:
                await self._validate_user_creation(user_data, org_id)
                logger.info("✅ VALIDATION: User creation validation passed")
            except Exception as validation_error:
                logger.error(f"❌ VALIDATION FAILED: {validation_error}")
                raise
            
            # Create user through repository
            created_user = await self.user_repo.create_user(user_data, org_id)
            
            # Flush to get the user ID for relationships
            await self.session.flush()
            await self.session.refresh(created_user)
            
            # Get the actual user ID value
            user_id = created_user.id
            logger.info(f"Created user with ID: {str(user_id)[:10]}...")
            
            # Assign roles if provided
            if user_data.role_ids:
                logger.info(f"🎯 ROLE ASSIGNMENT: Starting assignment of {len(user_data.role_ids)} roles to user {user_id}")
                logger.info(f"🎯 ROLE ASSIGNMENT: User ID type: {type(user_id)}, value: {user_id}")
                logger.info(f"🎯 ROLE ASSIGNMENT: Role IDs type: {type(user_data.role_ids)}, value: {user_data.role_ids}")

                try:
                    await self.user_repo.assign_roles_to_user(user_id, user_data.role_ids)
                    logger.info(f"✅ ROLE ASSIGNMENT: Successfully completed role assignment for user {user_id}")
                except Exception as role_error:
                    logger.error(f"❌ ROLE ASSIGNMENT FAILED: Error assigning roles to user {user_id}: {role_error}")
                    logger.error(f"❌ ROLE ASSIGNMENT FAILED: Exception type: {type(role_error)}")
                    raise  # Re-raise to maintain transaction rollback behavior
            else:
                logger.info(f"🎯 ROLE ASSIGNMENT: No role_ids provided for user {user_id}")
            
            # Add supervisor relationship if provided
            if user_data.supervisor_id:
                logger.info(f"Adding supervisor relationship: user {user_id} -> supervisor {user_data.supervisor_id}")
                relationship = UserSupervisor(
                    user_id=user_id,
                    supervisor_id=user_data.supervisor_id,
                    valid_from=date.today(),
                    valid_to=None
                )
                self.session.add(relationship)
            
            # Add subordinate relationships if provided
            if user_data.subordinate_ids:
                logger.info(f"Adding subordinate relationships for supervisor {user_id}: {user_data.subordinate_ids}")
                for subordinate_id in user_data.subordinate_ids:
                    relationship = UserSupervisor(
                        user_id=subordinate_id,
                        supervisor_id=user_id,
                        valid_from=date.today(),
                        valid_to=None
                    )
                    self.session.add(relationship)
            
            # Commit the transaction (Service controls the Unit of Work)
            logger.info(f"💾 TRANSACTION: About to commit transaction for user {user_id}")
            await self.session.commit()
            logger.info(f"✅ TRANSACTION: Transaction committed successfully for user {user_id}")
            
            # Get user's role names for Clerk metadata
            user_roles = await self.user_repo.get_user_roles(user_id)
            role_names = [role.name for role in user_roles]

            # Update Clerk publicMetadata with Users.id, profile completion, and roles
            metadata = {
                'users_table_id': str(user_id),
                'profile_completed': True,
                'roles': role_names
            }
            
            # ClerkService methods are SYNCHRONOUS, do not use await
            success = self.clerk_service.update_user_metadata(
                clerk_user_id=user_data.clerk_user_id,
                metadata=metadata
            )
            
            if not success:
                logger.error(f"Failed to update Clerk metadata for user {user_id}")
                # Note: We don't rollback here since the user was successfully created
                # The metadata failure is logged but doesn't break the user creation
            
            # Verify roles were actually persisted after commit
            if user_data.role_ids:
                roles_check = await self.user_repo.get_user_roles(user_id)
                logger.info(f"Post-commit verification: User {user_id} has {len(roles_check)} roles: {[r.name for r in roles_check]}")
                if len(roles_check) != len(user_data.role_ids):
                    logger.error(f"Role assignment verification failed! Expected {len(user_data.role_ids)} roles, got {len(roles_check)}")
            
            # Fetch the user fresh from database with all relationships
            fresh_user = await self.user_repo.get_user_by_id_with_details(user_id, org_id)
            if not fresh_user:
                # This should not happen since we just created the user successfully
                logger.error(f"Created user {user_id} not found after commit - this indicates a serious database issue")
                raise NotFoundError("User was created successfully but could not be retrieved from database")
            
            # Enrich user data for detailed response
            enriched_user = await self._enrich_detailed_user_data(fresh_user)
            
            logger.info(f"User created successfully with relationships: {created_user.id}")
            return enriched_user
            
        except Exception as e:
            logger.error("💥 TRANSACTION: Exception occurred during user creation, rolling back transaction")
            logger.error(f"💥 TRANSACTION: Exception type: {type(e)}")
            logger.error(f"💥 TRANSACTION: Exception message: {str(e)}")
            await self.session.rollback()
            logger.error("💥 TRANSACTION: Transaction rolled back")
            logger.error(f"Error creating user with relationships: {str(e)}")
            raise
    
    async def update_user(
        self, 
        user_id: UUID, 
        user_data: UserUpdate, 
        current_user_context: AuthContext
    ) -> UserDetailResponse:
        """
        Update user information with permission checks
        
        Business Logic:
        - Users can update their own profile
        - Admin can update any user
        - Validate relationships if being updated
        - Check for conflicts
        """
        try:
            # Get organization context
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")
            
            # Check if user exists
            existing_user = await self.user_repo.get_user_by_id(user_id, org_id)
            if not existing_user:
                raise NotFoundError(f"User with ID {user_id} not found")
            
            # Use RBACHelper for granular field-level permission checking
            RBACHelper.validate_user_update_fields(
                current_user_context, 
                user_data.model_dump(), 
                user_id
            )
            
            # Business validation
            await self._validate_user_update(user_data, existing_user, org_id)
            
            # Capture previous roles before any change for delta detection
            prev_role_names: list[str] = []
            if user_data.role_ids is not None:
                try:
                    prev_roles = await self.user_repo.get_user_roles(user_id)
                    prev_role_names = [r.name.lower() for r in prev_roles]
                except Exception:
                    prev_role_names = []

            # Update user through repository using UserUpdate schema
            updated_user = await self.user_repo.update_user(user_id, user_data, org_id)
            if not updated_user:
                raise NotFoundError(f"User with ID {user_id} not found")
            
            # Update roles if provided
            if user_data.role_ids is not None:
                logger.info(f"Updating roles for user {user_id}: {user_data.role_ids}")
                await self.user_repo.update_user_roles(user_id, user_data.role_ids)
            
            # Update hierarchy relationships if provided (requires HIERARCHY_MANAGE permission)
            if user_data.supervisor_id is not None or user_data.subordinate_ids is not None:
                # Check hierarchy management permission once
                if not current_user_context.has_permission(Permission.HIERARCHY_MANAGE):
                    raise PermissionDeniedError("You do not have permission to manage hierarchy relationships")
                
                
                # Update supervisor relationship if provided
                if user_data.supervisor_id is not None:
                    logger.info(f"Processing supervisor update for user {user_id}: supervisor_id = {user_data.supervisor_id}")
                    
                    # Remove existing supervisor relationships
                    delete_result = await self.session.execute(
                        delete(UserSupervisor).where(UserSupervisor.user_id == user_id)
                    )
                    logger.info(f"Deleted {delete_result.rowcount} existing supervisor relationships for user {user_id}")
                    
                    # Add new supervisor if specified
                    if user_data.supervisor_id:
                        logger.info(f"Adding new supervisor relationship: user {user_id} -> supervisor {user_data.supervisor_id}")
                        relationship = UserSupervisor(
                            user_id=user_id,
                            supervisor_id=user_data.supervisor_id,
                            valid_from=date.today(),
                            valid_to=None
                        )
                        self.session.add(relationship)
                        logger.info("Added UserSupervisor relationship to session")
                    else:
                        logger.info(f"supervisor_id is None, removing supervisor for user {user_id}")
                
                # Update subordinate relationships if provided
                if user_data.subordinate_ids is not None:
                    # Remove existing subordinate relationships where this user is supervisor
                    await self.session.execute(
                        delete(UserSupervisor).where(UserSupervisor.supervisor_id == user_id)
                    )
                    
                    # Add new subordinate relationships
                    if user_data.subordinate_ids:
                        logger.info(f"Updating subordinate relationships for supervisor {user_id}: {user_data.subordinate_ids}")
                        for subordinate_id in user_data.subordinate_ids:
                            relationship = UserSupervisor(
                                user_id=subordinate_id,
                                supervisor_id=user_id,
                                valid_from=date.today(),
                                valid_to=None
                            )
                            self.session.add(relationship)
            
            # Commit the transaction
            logger.info(f"Committing transaction for user {user_id}")
            await self.session.commit()
            logger.info(f"Transaction committed successfully for user {user_id}")
            
            await self.session.refresh(updated_user)
            logger.info(f"User {user_id} refreshed from database")
            
            # Enrich user data for detailed response
            enriched_user = await self._enrich_detailed_user_data(updated_user)
            
            # After commit, handle Clerk sync asynchronously
            try:
                # Fetch latest role names for metadata sync and admin delta
                latest_roles = await self.user_repo.get_user_roles(user_id)
                latest_role_names = [r.name for r in latest_roles]

                # Fire-and-forget: update public_metadata.roles
                if updated_user.clerk_user_id:
                    async def _update_metadata_roles():
                        try:
                            await asyncio.to_thread(
                                self.clerk_service.update_user_metadata,
                                updated_user.clerk_user_id,
                                {"roles": latest_role_names},
                            )
                            logger.info(f"Clerk public_metadata.roles updated for user {user_id}")
                        except Exception as e:
                            logger.error(f"Failed to update Clerk metadata roles for {user_id}: {e}")
                    asyncio.create_task(_update_metadata_roles())

                # If roles changed and admin toggled, update organization membership role
                if user_data.role_ids is not None and updated_user.clerk_user_id and updated_user.clerk_organization_id:
                    prev_is_admin = 'admin' in prev_role_names
                    new_is_admin = any(r.lower() == 'admin' for r in latest_role_names)
                    if prev_is_admin != new_is_admin:
                        async def _update_org_role():
                            ok = await asyncio.to_thread(
                                self.clerk_service.set_organization_role,
                                updated_user.clerk_organization_id,
                                updated_user.clerk_user_id,
                                new_is_admin,
                            )
                            if ok:
                                logger.info(f"Clerk org role set to {'admin' if new_is_admin else 'member'} for user {user_id}")
                            else:
                                logger.error(f"Clerk org role update failed for user {user_id}")
                        asyncio.create_task(_update_org_role())
            except Exception as e:
                logger.error(f"Post-update Clerk sync scheduling failed for user {user_id}: {e}")

            logger.info(f"User updated successfully: {user_id}")
            return enriched_user
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error updating user {user_id}: {str(e)}")
            raise
    
    @require_permission(Permission.STAGE_MANAGE)
    async def update_user_stage(
        self, 
        user_id: UUID, 
        stage_update: UserStageUpdate, 
        current_user_context: AuthContext
    ) -> UserDetailResponse:
        """
        Update user's stage (admin only)
        
        Business Logic:
        - Only admin can update user stages (enforced via Permission.STAGE_MANAGE)
        - Validate that stage exists
        - Update user's stage_id directly
        """
        try:
            # Get organization context
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")

            # Check if user exists
            existing_user = await self.user_repo.get_user_by_id(user_id, org_id)
            if not existing_user:
                raise NotFoundError(f"User with ID {user_id} not found")

            # Validate stage exists
            stage = await self.stage_repo.get_by_id(stage_update.stage_id, org_id)
            if not stage:
                raise NotFoundError(f"Stage with ID {stage_update.stage_id} not found")

            # Update user's stage through repository
            updated_user = await self.user_repo.update_user_stage(user_id, stage_update.stage_id, org_id)
            if not updated_user:
                raise NotFoundError(f"User with ID {user_id} not found")
            
            # Commit the transaction
            await self.session.commit()
            await self.session.refresh(updated_user)
            
            # Enrich user data for detailed response
            enriched_user = await self._enrich_detailed_user_data(updated_user)
            
            logger.info(f"User stage updated successfully: {user_id} -> stage {stage_update.stage_id}")
            return enriched_user
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error updating user stage {user_id}: {str(e)}")
            raise

    @require_permission(Permission.USER_MANAGE)
    async def set_user_goal_weight_override(
        self,
        user_id: UUID,
        weight_update: UserGoalWeightUpdate,
        current_user_context: AuthContext
    ) -> UserDetailResponse:
        """Set user-specific goal weight overrides and log history."""
        try:
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")

            existing_user = await self.user_repo.get_user_by_id(user_id, org_id)
            if not existing_user:
                raise NotFoundError(f"User with ID {user_id} not found")

            previous_weights = {
                "quantitative_weight": float(existing_user.quantitative_weight_override) if existing_user.quantitative_weight_override is not None else None,
                "qualitative_weight": float(existing_user.qualitative_weight_override) if existing_user.qualitative_weight_override is not None else None,
                "competency_weight": float(existing_user.competency_weight_override) if existing_user.competency_weight_override is not None else None,
            }

            updated_user = await self.user_repo.set_user_goal_weight_override(
                user_id,
                org_id,
                quantitative=weight_update.quantitative_weight,
                qualitative=weight_update.qualitative_weight,
                competency=weight_update.competency_weight,
            )
            if not updated_user:
                raise NotFoundError(f"User with ID {user_id} not found")

            await self.user_repo.add_user_goal_weight_history_entry(
                user_id=user_id,
                org_id=org_id,
                actor_user_id=current_user_context.user_id,
                before_weights=previous_weights,
                after_weights={
                    "quantitative_weight": weight_update.quantitative_weight,
                    "qualitative_weight": weight_update.qualitative_weight,
                    "competency_weight": weight_update.competency_weight,
                }
            )

            await self.session.commit()
            await self.session.refresh(updated_user)

            self._invalidate_user_caches(org_id, user_id)
            self._invalidate_v2_user_caches(org_id)

            logger.info(f"User goal weight overrides updated for user {user_id} by {current_user_context.user_id}")
            return await self._enrich_detailed_user_data(updated_user)
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error updating goal weight overrides for user {user_id}: {str(e)}")
            raise

    @require_permission(Permission.USER_MANAGE)
    async def clear_user_goal_weight_override(
        self,
        user_id: UUID,
        current_user_context: AuthContext
    ) -> UserDetailResponse:
        """Clear user-specific goal weight overrides and log history."""
        try:
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")

            existing_user = await self.user_repo.get_user_by_id(user_id, org_id)
            if not existing_user:
                raise NotFoundError(f"User with ID {user_id} not found")

            previous_weights = {
                "quantitative_weight": float(existing_user.quantitative_weight_override) if existing_user.quantitative_weight_override is not None else None,
                "qualitative_weight": float(existing_user.qualitative_weight_override) if existing_user.qualitative_weight_override is not None else None,
                "competency_weight": float(existing_user.competency_weight_override) if existing_user.competency_weight_override is not None else None,
            }

            updated_user = await self.user_repo.clear_user_goal_weight_override(user_id, org_id)
            if not updated_user:
                raise NotFoundError(f"User with ID {user_id} not found")

            await self.user_repo.add_user_goal_weight_history_entry(
                user_id=user_id,
                org_id=org_id,
                actor_user_id=current_user_context.user_id,
                before_weights=previous_weights,
                after_weights={
                    "quantitative_weight": None,
                    "qualitative_weight": None,
                    "competency_weight": None,
                }
            )

            await self.session.commit()
            await self.session.refresh(updated_user)

            self._invalidate_user_caches(org_id, user_id)
            self._invalidate_v2_user_caches(org_id)

            logger.info(f"User goal weight overrides cleared for user {user_id} by {current_user_context.user_id}")
            return await self._enrich_detailed_user_data(updated_user)
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error clearing goal weight overrides for user {user_id}: {str(e)}")
            raise
    
    @require_permission(Permission.USER_MANAGE)
    async def delete_user(
        self,
        user_id: UUID,
        current_user_context: AuthContext,
        mode: str = "soft",
    ) -> bool:
        """
        Delete a user. 'soft' marks as inactive, 'hard' removes from DB.
        NOTE: Hard delete is permanent and irreversible.
        """
        try:
            # Get organization context
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")
            
            # Check if user exists
            existing_user = await self.user_repo.get_user_by_id(user_id, org_id)
            if not existing_user:
                raise NotFoundError(f"User with ID {user_id} not found")

            if mode == "soft":
                # Self-deletion check
                if current_user_context.user_id == user_id:
                    raise BadRequestError("You cannot inactivate your own account")

                # Check if user is a supervisor of active users
                subordinates = await self.user_repo.get_subordinates(user_id, org_id)
                if subordinates:
                    raise BadRequestError("Cannot inactivate user who is currently supervising active users")
                
                # Perform soft delete by updating status
                success = await self.user_repo.update_user_status(user_id, UserStatus.INACTIVE)
                
                if success:
                    await self.session.commit()
                    logger.info(f"User {user_id} inactivated successfully.")
                else:
                    logger.warning(f"Failed to inactivate user {user_id}.")
                    
                return success
                
            elif mode == "hard":
                # Add any necessary pre-deletion logic here
                # (e.g., reassigning resources, logging, etc.)
                
                success = await self.user_repo.hard_delete_user_by_id(user_id)
                
                if success:
                    await self.session.commit()
                    logger.info(f"User {user_id} permanently deleted.")
                else:
                    logger.warning(f"Failed to permanently delete user {user_id}.")
                    
                return success
            else:
                raise BadRequestError("Invalid delete mode. Use 'soft' or 'hard'.")
                
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error deleting user {user_id}: {str(e)}")
            raise
    
    async def update_last_login(self, clerk_user_id: str) -> bool:
        """Update user's last login timestamp"""
        try:
            user = await self.user_repo.get_user_by_clerk_id(clerk_user_id)
            if not user:
                logger.warning(f"User not found for last login update: {clerk_user_id}")
                return False
            
            success = await self.user_repo.update_last_login(user.id)
            if success:
                logger.info(f"Last login updated for user: {user.id}")
            return success
            
        except Exception as e:
            logger.error(f"Error updating last login for {clerk_user_id}: {str(e)}")
            return False

    async def check_user_exists_by_clerk_id(self, clerk_user_id: str) -> UserExistsResponse:
        """Check if user exists in database with enhanced fallback lookup."""
        try:
            # Use enhanced lookup with Clerk fallback
            user = await self.get_user_with_clerk_fallback(clerk_user_id)
            
            if user:
                return UserExistsResponse(
                    exists=True,
                    user_id=user.id,
                    name=user.name,
                    email=user.email,
                    status=UserStatus(user.status)
                )
            else:
                return UserExistsResponse(exists=False)
                
        except Exception as e:
            logger.error(f"Error in enhanced user existence check for {clerk_user_id}: {e}")
            return UserExistsResponse(exists=False)

    async def get_user_with_clerk_fallback(self, clerk_user_id: str) -> Optional[UserModel]:
        """
        Get user by clerk_id with fallback to metadata lookup
        If clerk_id changed, update it in database
        """
        try:
            # 1. Try direct clerk_id lookup
            user = await self.user_repo.get_user_by_clerk_id(clerk_user_id)
            if user:
                return user
            
            # 2. Fallback: Get user info from Clerk to check metadata
            # ClerkService methods are SYNCHRONOUS, do not use await
            clerk_user = self.clerk_service.get_user_by_id(clerk_user_id)
            if not clerk_user:
                return None
            
            # 3. Check if we have users_table_id in metadata
            metadata = clerk_user.get('public_metadata', {})
            users_table_id = metadata.get('users_table_id')
            
            if not users_table_id:
                return None
            
            # 4. Lookup user by Users.id
            # Note: We need org_id but don't have it in this context
            # This is a fallback lookup, so we'll need to get it from the clerk user's org
            org_id = clerk_user.get('organization_memberships', [{}])[0].get('organization', {}).get('id')
            if not org_id:
                logger.error(f"Cannot determine organization for user lookup: {users_table_id}")
                return None
            
            user = await self.user_repo.get_user_by_id(UUID(users_table_id), org_id)
            if not user:
                logger.error(f"Metadata points to non-existent user: {users_table_id}")
                return None
            
            # 5. Update clerk_id in database (it has changed)
            old_clerk_id = user.clerk_user_id
            logger.info(f"🔄 CLERK ID MISMATCH DETECTED! User {user.id}: DB has '{old_clerk_id}' but current is '{clerk_user_id}'")
            
            try:
                # Update the clerk_user_id using dedicated internal method
                clerk_update = UserClerkIdUpdate(clerk_user_id=clerk_user_id)
                logger.info(f"📝 Calling user_repo.update_user_clerk_id with clerk_user_id='{clerk_user_id}'")
                updated_user = await self.user_repo.update_user_clerk_id(user.id, clerk_update)
                
                if updated_user:
                    logger.info("📄 Repository returned updated user, committing transaction...")
                    await self.session.commit()
                    logger.info("✅ Transaction committed! Refreshing user...")
                    # Refresh the user to get the latest data from database
                    await self.session.refresh(updated_user)
                    logger.info(f"🎉 SUCCESS! Updated user {user.id} clerk_id from '{old_clerk_id}' to '{updated_user.clerk_user_id}'")
                    return updated_user
                else:
                    logger.error(f"❌ Repository returned None - update failed for user {user.id}")
                    return user
                    
            except Exception as update_error:
                logger.error(f"💥 EXCEPTION during clerk_id update for user {user.id}: {update_error}")
                logger.error(f"💥 Exception type: {type(update_error)}")
                await self.session.rollback()
                logger.error("💥 Transaction rolled back")
                return user
            
        except Exception as e:
            logger.error(f"User lookup with fallback failed: {e}")
            return None

    async def bulk_update_user_statuses(
        self,
        items: list[BulkUserStatusUpdateItem],
        current_user_context: AuthContext,
    ) -> BulkUserStatusUpdateResponse:
        """Bulk update user statuses with organization scope and transition validation."""

        current_user_context.require_role("admin")

        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")

        if len(items) > 100:
            raise BadRequestError("Cannot update more than 100 users at once")

        results: list[Optional[BulkUserStatusUpdateResult]] = [None] * len(items)

        unique_ids: list[UUID] = []
        seen_ids: Set[UUID] = set()
        for index, item in enumerate(items):
            if item.user_id in seen_ids:
                results[index] = BulkUserStatusUpdateResult(
                    userId=item.user_id,
                    success=False,
                    error="Duplicate userId in request",
                )
                continue
            seen_ids.add(item.user_id)
            unique_ids.append(item.user_id)

        current_status_map = await self.user_repo.get_user_statuses(org_id, unique_ids)

        allowed_transitions: dict[UserStatus, set[UserStatus]] = {
            UserStatus.PENDING_APPROVAL: {UserStatus.ACTIVE},
            UserStatus.ACTIVE: {UserStatus.INACTIVE},
            UserStatus.INACTIVE: {UserStatus.ACTIVE},
        }

        pending_updates: Dict[UUID, UserStatus] = {}
        pending_indices: Dict[UUID, int] = {}

        for index, item in enumerate(items):
            if results[index] is not None:
                continue

            user_id = item.user_id
            requested_status = item.new_status

            current_status_value = current_status_map.get(user_id)
            if current_status_value is None:
                results[index] = BulkUserStatusUpdateResult(
                    userId=user_id,
                    success=False,
                    error="User not found in your organization",
                )
                continue

            current_status = UserStatus(current_status_value)

            if requested_status == current_status:
                results[index] = BulkUserStatusUpdateResult(
                    userId=user_id,
                    success=False,
                    error="User already has the requested status",
                )
                continue

            allowed_targets = allowed_transitions.get(current_status, set())
            if requested_status not in allowed_targets:
                results[index] = BulkUserStatusUpdateResult(
                    userId=user_id,
                    success=False,
                    error=f"Invalid status transition from {current_status.value} to {requested_status.value}",
                )
                continue

            pending_updates[user_id] = requested_status
            pending_indices[user_id] = index

        updated_ids: Set[UUID] = set()

        if pending_updates:
            try:
                updated_ids = await self.user_repo.batch_update_user_statuses(org_id, pending_updates)
                if updated_ids:
                    await self.session.commit()
                else:
                    logger.warning(
                        "No user statuses were updated in batch operation; this may be due to concurrent changes or invalid transitions."
                    )
            except Exception as exc:
                await self.session.rollback()
                raise BadRequestError("Failed to update user statuses") from exc
        # No DB changes were staged when there are no pending updates;
        # avoid issuing an unnecessary rollback.

        for user_id, index in pending_indices.items():
            if user_id in updated_ids:
                results[index] = BulkUserStatusUpdateResult(userId=user_id, success=True)
            else:
                results[index] = BulkUserStatusUpdateResult(
                    userId=user_id,
                    success=False,
                    error="No status change was applied",
                )

        # Filter out None just in case (defensive)
        finalized_results = [result for result in results if result is not None]

        success_count = sum(1 for result in finalized_results if result.success)
        failure_count = len(finalized_results) - success_count

        return BulkUserStatusUpdateResponse(
            results=finalized_results,
            successCount=success_count,
            failureCount=failure_count,
        )

    
    # Private helper methods
    
    def _generate_cache_key(
        self,
        prefix: str,
        params: Dict[str, Any]
    ) -> str:
        """Generates a cache key based on the prefix and parameters."""
        # Sort keys to ensure consistent cache keys for the same parameters
        sorted_params = sorted(params.items())
        key_parts = [f"{k}={v}" for k, v in sorted_params]
        return f"{prefix}:{':'.join(key_parts)}"
    
    async def _validate_user_creation(self, user_data: UserCreate, org_id: str) -> None:
        """Validate all business rules before creating a user."""
        # Validate role IDs exist
        if user_data.role_ids:
            logger.info(f"🔍 VALIDATION: Validating {len(user_data.role_ids)} role IDs for org {org_id}")
            for role_id in user_data.role_ids:
                logger.info(f"🔍 VALIDATION: Checking role {role_id} in org {org_id}")
                role = await self.role_repo.get_by_id(role_id, org_id)
                if not role:
                    logger.error(f"❌ VALIDATION FAILED: Role with ID {role_id} does not exist in org {org_id}")
                    raise BadRequestError(f"Role with ID {role_id} does not exist")
                else:
                    logger.info(f"✅ VALIDATION: Role {role_id} found: {role.name}")
        else:
            logger.info("🔍 VALIDATION: No role IDs provided for validation")
        
        # Validate supervisor exists and is active
        if user_data.supervisor_id:
            supervisor = await self.user_repo.get_user_by_id(user_data.supervisor_id, org_id)
            if not supervisor:
                raise BadRequestError(f"Supervisor with ID {user_data.supervisor_id} does not exist")
            if supervisor.status != UserStatus.ACTIVE.value:
                raise BadRequestError(f"Supervisor with ID {user_data.supervisor_id} is not active")
        
        # Validate subordinates exist and are active
        if user_data.subordinate_ids:
            for subordinate_id in user_data.subordinate_ids:
                subordinate = await self.user_repo.get_user_by_id(subordinate_id, org_id)
                if not subordinate:
                    raise BadRequestError(f"Subordinate with ID {subordinate_id} does not exist")
                if subordinate.status != UserStatus.ACTIVE.value:
                    raise BadRequestError(f"Subordinate with ID {subordinate_id} is not active")
        
        # Validate department exists if provided
        if user_data.department_id:
            department = await self.department_repo.get_by_id(user_data.department_id, org_id)
            if not department:
                raise BadRequestError(f"Department with ID {user_data.department_id} does not exist")
        
        # Validate stage exists if provided
        if user_data.stage_id:
            stage = await self.stage_repo.get_by_id(user_data.stage_id, org_id)
            if not stage:
                raise BadRequestError(f"Stage with ID {user_data.stage_id} does not exist")
        
        # Check for existing user with same email or employee_code
        existing_user_email = await self.user_repo.get_user_by_email(user_data.email, org_id)
        if existing_user_email:
            raise ConflictError(f"User with email {user_data.email} already exists")
        
        existing_user_code = await self.user_repo.get_user_by_employee_code(user_data.employee_code, org_id)
        if existing_user_code:
            raise ConflictError(f"User with employee code {user_data.employee_code} already exists")
        
        # Check for existing user with same clerk_user_id
        existing_user_clerk = await self.user_repo.get_user_by_clerk_id(user_data.clerk_user_id)
        if existing_user_clerk:
            raise ConflictError(f"User with clerk_user_id {user_data.clerk_user_id} already exists")
    
    async def _validate_user_update(self, user_data: UserUpdate, existing_user: UserModel, org_id: str) -> None:
        """Validate user update data"""
        # Check for conflicts if email or employee_code is being updated
        if user_data.email and user_data.email != existing_user.email:
            existing_user_with_email = await self.user_repo.get_user_by_email(user_data.email, org_id)
            if existing_user_with_email and existing_user_with_email.id != existing_user.id:
                raise ConflictError(f"User with email {user_data.email} already exists")
        
        if user_data.employee_code and user_data.employee_code != existing_user.employee_code:
            existing_user_with_code = await self.user_repo.get_user_by_employee_code(user_data.employee_code, org_id)
            if existing_user_with_code and existing_user_with_code.id != existing_user.id:
                raise ConflictError(f"User with employee code {user_data.employee_code} already exists")
        
        # Validate role IDs exist if being updated
        if user_data.role_ids is not None:
            for role_id in user_data.role_ids:
                role = await self.role_repo.get_by_id(role_id, org_id)
                if not role:
                    raise BadRequestError(f"Role with ID {role_id} does not exist")
        
        # Validate supervisor exists and is active if being updated
        if user_data.supervisor_id is not None and user_data.supervisor_id:
            supervisor = await self.user_repo.get_user_by_id(user_data.supervisor_id, org_id)
            if not supervisor:
                raise BadRequestError(f"Supervisor with ID {user_data.supervisor_id} does not exist")
            if supervisor.status != UserStatus.ACTIVE.value:
                raise BadRequestError(f"Supervisor with ID {user_data.supervisor_id} is not active")
            if supervisor.id == existing_user.id:
                raise BadRequestError("User cannot be their own supervisor")
        
        # Validate subordinates exist and are active if being updated
        if user_data.subordinate_ids is not None:
            for subordinate_id in user_data.subordinate_ids:
                subordinate = await self.user_repo.get_user_by_id(subordinate_id, org_id)
                if not subordinate:
                    raise BadRequestError(f"Subordinate with ID {subordinate_id} does not exist")
                if subordinate.status != UserStatus.ACTIVE.value:
                    raise BadRequestError(f"Subordinate with ID {subordinate_id} is not active")
                if subordinate_id == existing_user.id:
                    raise BadRequestError("User cannot be their own subordinate")
        
        # Validate department exists if being updated
        if user_data.department_id is not None:
            department = await self.department_repo.get_by_id(user_data.department_id, org_id)
            if not department:
                raise BadRequestError(f"Department with ID {user_data.department_id} does not exist")
        
    
    async def _enrich_user_data(self, user: UserModel) -> User:
        """Enrich user data with relationships using repository pattern"""
        # Get department using repository
        department_model = await self.department_repo.get_by_id(user.department_id, user.clerk_organization_id)
        if not department_model:
            # Create a fallback department if not found
            department = Department(
                id=user.department_id,
                name="Unknown Department",
                description="Department not found"
            )
        else:
            department = Department.model_validate(department_model, from_attributes=True)
        
        # Get stage using repository
        stage_model = await self.stage_repo.get_by_id(user.stage_id, user.clerk_organization_id)
        if not stage_model:
            # Create a fallback stage if not found
            stage = Stage(
                id=user.stage_id,
                name="Unknown Stage",
                description="Stage not found"
            )
        else:
            stage = Stage.model_validate(stage_model, from_attributes=True)
        
        # Get roles using repository
        role_models = await self.role_repo.get_user_roles(user.id, user.clerk_organization_id)
        roles = [Role.model_validate(role, from_attributes=True) for role in role_models]

        # Use UserInDB to validate basic user data first
        user_in_db = UserInDB.model_validate(user, from_attributes=True)
        
        return User(
            **user_in_db.model_dump(),
            department=department,
            stage=stage,
            roles=roles,
        )

    async def _enrich_detailed_user_data(self, user: UserModel) -> UserDetailResponse:
        """Enrich user data for UserDetailResponse with supervisor/subordinates using repository pattern"""
        # Get basic enriched user data first
        base_user = await self._enrich_user_data(user)
        
        # Get supervisor relationship
        supervisor_models = await self.user_repo.get_user_supervisors(user.id, user.clerk_organization_id)
        supervisor = None
        if supervisor_models:
            supervisor_model = supervisor_models[0]  # Take first supervisor if multiple
            supervisor = await self._enrich_user_data(supervisor_model)

        # Get subordinates relationship
        subordinate_models = await self.user_repo.get_subordinates(user.id, user.clerk_organization_id)
        subordinates = []
        for subordinate_model in subordinate_models:
            subordinate = await self._enrich_user_data(subordinate_model)
            subordinates.append(subordinate)

        # Create detailed response with supervisor/subordinates
        user_detail_data = base_user.model_dump()
        user_detail_data.update({
            'supervisor': supervisor,
            'subordinates': subordinates if subordinates else None
        })

        return UserDetailResponse(**user_detail_data)
    
