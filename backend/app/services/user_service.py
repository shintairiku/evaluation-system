from __future__ import annotations
import logging
from typing import Optional, Dict, Any
from uuid import UUID
from datetime import date
from cachetools import TTLCache

from .clerk_service import ClerkService
from ..database.repositories.user_repo import UserRepository
from ..database.repositories.department_repo import DepartmentRepository
from ..database.repositories.stage_repo import StageRepository
from ..database.repositories.role_repo import RoleRepository
from ..database.models.user import User as UserModel, UserSupervisor
from ..schemas.user import (
    UserCreate, UserUpdate, User, UserDetailResponse, UserInDB,
    Department, Stage, Role, UserStatus, UserExistsResponse, ProfileOptionsResponse, UserProfileOption, UserClerkIdUpdate
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



class UserService:
    """Service layer for user-related business logic and operations"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.clerk_service = ClerkService()
        self.user_repo = UserRepository(session)
        self.department_repo = DepartmentRepository(session)
        self.stage_repo = StageRepository(session)
        self.role_repo = RoleRepository(session)
    
    async def get_users(
        self, 
        current_user_context: AuthContext, 
        search_term: str = "",
        statuses: Optional[list[UserStatus]] = None,
        department_ids: Optional[list[UUID]] = None,
        stage_ids: Optional[list[UUID]] = None,
        role_ids: Optional[list[UUID]] = None,
        supervisor_id: Optional[UUID] = None,  # Task #168: Filter by supervisor to get subordinates
        pagination: Optional[PaginationParams] = None
    ) -> PaginatedResponse[UserDetailResponse]:
        """
        Get users based on current user's permissions, with explicit multi-select filters.
        Uses permission-based access control from security module.
        """
        try:
            
            # Ultra-simple permission-based access control
            user_ids_to_filter = None
            
            if current_user_context.has_permission(Permission.USER_READ_ALL):
                # Admin: Can see all users
                user_ids_to_filter = None
            elif current_user_context.has_permission(Permission.USER_READ_SUBORDINATES):
                # Manager/Supervisor: Can see subordinates
                subordinate_users = await self.user_repo.get_subordinates(
                    current_user_context.user_id
                )
                user_ids_to_filter = [user.id for user in subordinate_users]
            elif current_user_context.has_permission(Permission.USER_READ_SELF):
                # Employee: Can only see themselves
                user_ids_to_filter = [current_user_context.user_id]
            else:
                # No permission to read users - use helper method
                current_user_context.require_any_permission([
                    Permission.USER_READ_ALL,
                    Permission.USER_READ_SUBORDINATES,
                    Permission.USER_READ_SELF
                ])
            
            # Generate cache key including role information for proper caching
            cache_key_params = {
                "search_term": search_term,
                "statuses": sorted(statuses) if statuses else None,
                "department_ids": sorted([str(d) for d in department_ids]) if department_ids else None,
                "stage_ids": sorted([str(s) for s in stage_ids]) if stage_ids else None,
                "role_ids": sorted([str(r) for r in role_ids]) if role_ids else None,
                "supervisor_id": str(supervisor_id) if supervisor_id else None,  # Task #168: Include supervisor_id in cache key
                "user_ids": sorted([str(u) for u in user_ids_to_filter]) if user_ids_to_filter else None,
                "pagination": f"{pagination.page}_{pagination.limit}" if pagination else None,
                "requesting_user_roles": sorted(current_user_context.role_names)
            }
            cache_key = self._generate_cache_key("get_users", cache_key_params)
            
            # Check cache
            cached_result = user_search_cache.get(cache_key)
            if cached_result:
                return PaginatedResponse.model_validate_json(cached_result)
            
            # Task #168: Handle supervisor_id filtering specifically
            final_user_ids_to_filter = user_ids_to_filter
            if supervisor_id:
                # Get subordinates of the specified supervisor
                subordinate_users = await self.user_repo.get_subordinates(supervisor_id)
                subordinate_ids = [user.id for user in subordinate_users]
                
                # If we already have user_ids_to_filter, intersect them
                if final_user_ids_to_filter:
                    final_user_ids_to_filter = list(set(final_user_ids_to_filter) & set(subordinate_ids))
                else:
                    final_user_ids_to_filter = subordinate_ids
            
            # Get data from repository
            users = await self.user_repo.search_users(
                search_term=search_term,
                statuses=statuses,
                department_ids=department_ids,
                stage_ids=stage_ids,
                role_ids=role_ids,
                user_ids=final_user_ids_to_filter,
                pagination=pagination
            )
            
            total_count = await self.user_repo.count_users(
                search_term=search_term,
                statuses=statuses,
                department_ids=department_ids,
                stage_ids=stage_ids,
                role_ids=role_ids,
                user_ids=final_user_ids_to_filter  # Task #168: Use final filtered user IDs
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
    
    async def get_user_by_id(
        self, 
        user_id: UUID, 
        current_user_context: AuthContext
    ) -> UserDetailResponse:
        """
        Get a specific user by ID and return UserDetailResponse with supervisor/subordinates
        """
        try:
            # Check if user exists
            user = await self.user_repo.get_user_by_id(user_id)
            if not user:
                raise NotFoundError(f"User with ID {user_id} not found")
            
            # Permission-based access control - Crystal clear business logic
            if current_user_context.has_permission(Permission.USER_READ_ALL):
                # Admin: Can access any user
                pass
            elif current_user_context.has_permission(Permission.USER_READ_SUBORDINATES):
                # Manager/Supervisor: Can access subordinates - check if user_id is a subordinate
                subordinates = await self.user_repo.get_subordinates(current_user_context.user_id)
                subordinate_ids = [sub.id for sub in subordinates]
                if user_id not in subordinate_ids:
                    raise PermissionDeniedError(f"You do not have permission to access user {user_id} (not your subordinate)")
            elif current_user_context.user_id == user_id:
                # Self-access: User can access their own profile (requires USER_READ_SELF permission)
                current_user_context.require_permission(Permission.USER_READ_SELF)
            else:
                # No access: User cannot access this profile
                raise PermissionDeniedError(f"You do not have permission to access user {user_id}")
            
            # Enrich user data for detail response with supervisor/subordinates
            enriched_user = await self._enrich_detailed_user_data(user)
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
            # Permission-based access control
            is_admin = current_user_context.has_permission(Permission.USER_MANAGE)
            is_self_registration = (user_data.clerk_user_id == current_user_context.clerk_user_id)
            
            if not (is_admin or is_self_registration):
                raise PermissionDeniedError("You can only create your own user profile or be an admin")
            
            # For self-registration, set status to PENDING_APPROVAL
            if is_self_registration and not is_admin:
                user_data.status = UserStatus.PENDING_APPROVAL
            
            # Business validation
            await self._validate_user_creation(user_data)
            
            # Create user through repository
            created_user = await self.user_repo.create_user(user_data)
            
            # Flush to get the user ID for relationships
            await self.session.flush()
            await self.session.refresh(created_user)
            
            # Get the actual user ID value
            user_id = created_user.id
            logger.info(f"Created user with ID: {str(user_id)[:10]}...")
            
            # Assign roles if provided
            if user_data.role_ids:
                logger.info(f"About to assign roles {user_data.role_ids} to user {user_id}")
                logger.info(f"User ID type: {type(user_id)}, value: {user_id}")
                logger.info(f"Role IDs type: {type(user_data.role_ids)}, value: {user_data.role_ids}")
                await self.user_repo.assign_roles_to_user(user_id, user_data.role_ids)
                logger.info(f"Completed role assignment for user {user_id}")
            else:
                logger.info(f"No role_ids provided for user {user_id}")
            
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
            await self.session.commit()
            logger.info(f"Transaction committed successfully for user {user_id}")
            
            # Update Clerk publicMetadata with Users.id (only profile_completed and users_table_id)
            metadata = {
                'users_table_id': str(user_id),
                'profile_completed': True
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
            fresh_user = await self.user_repo.get_user_by_id_with_details(user_id)
            if not fresh_user:
                # This should not happen since we just created the user successfully
                logger.error(f"Created user {user_id} not found after commit - this indicates a serious database issue")
                raise NotFoundError(f"User was created successfully but could not be retrieved from database")
            
            # Enrich user data for detailed response
            enriched_user = await self._enrich_detailed_user_data(fresh_user)
            
            logger.info(f"User created successfully with relationships: {created_user.id}")
            return enriched_user
            
        except Exception as e:
            await self.session.rollback()
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
            # Check if user exists
            existing_user = await self.user_repo.get_user_by_id(user_id)
            if not existing_user:
                raise NotFoundError(f"User with ID {user_id} not found")
            
            # Permission-based access control - ultra-simple with helper method
            if current_user_context.has_permission(Permission.USER_MANAGE):
                # Admin can modify any user
                pass
            elif current_user_context.user_id == user_id:
                # User can modify their own profile - no additional permission needed
                pass
            else:
                # Use helper method for consistent error handling
                current_user_context.require_permission(Permission.USER_MANAGE)
            
            # Business validation
            await self._validate_user_update(user_data, existing_user)
            
            # Update user through repository using UserUpdate schema
            updated_user = await self.user_repo.update_user(user_id, user_data)
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
                    # Remove existing supervisor relationships
                    await self.session.execute(
                        delete(UserSupervisor).where(UserSupervisor.user_id == user_id)
                    )
                    
                    # Add new supervisor if specified
                    if user_data.supervisor_id:
                        logger.info(f"Updating supervisor relationship: user {user_id} -> supervisor {user_data.supervisor_id}")
                        relationship = UserSupervisor(
                            user_id=user_id,
                            supervisor_id=user_data.supervisor_id,
                            valid_from=date.today(),
                            valid_to=None
                        )
                        self.session.add(relationship)
                
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
            await self.session.commit()
            await self.session.refresh(updated_user)
            
            # Enrich user data for detailed response
            enriched_user = await self._enrich_detailed_user_data(updated_user)
            
            logger.info(f"User updated successfully: {user_id}")
            return enriched_user
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error updating user {user_id}: {str(e)}")
            raise
    
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
            # Permission-based access control - ultra-simple with helper method
            current_user_context.require_permission(Permission.USER_MANAGE)

            # Check if user exists
            existing_user = await self.user_repo.get_user_by_id(user_id)
            if not existing_user:
                raise NotFoundError(f"User with ID {user_id} not found")

            if mode == "soft":
                # Self-deletion check
                if current_user_context.user_id == user_id:
                    raise BadRequestError("You cannot inactivate your own account")

                # Check if user is a supervisor of active users
                subordinates = await self.user_repo.get_subordinates(user_id)
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
            user = await self.user_repo.get_user_by_id(UUID(users_table_id))
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
                    logger.info(f"📄 Repository returned updated user, committing transaction...")
                    await self.session.commit()
                    logger.info(f"✅ Transaction committed! Refreshing user...")
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
                logger.error(f"💥 Transaction rolled back")
                return user
            
        except Exception as e:
            logger.error(f"User lookup with fallback failed: {e}")
            return None

    async def get_profile_options(self) -> ProfileOptionsResponse:
        """Get all available options for profile completion."""
        # Fetch raw data from repositories
        departments_data = await self.department_repo.get_all()
        stages_data = await self.stage_repo.get_all()
        roles_data = await self.role_repo.get_all()
        users_data = await self.user_repo.get_active_users()
        
        # Convert SQLAlchemy models to Pydantic models
        departments = [Department.model_validate(dept, from_attributes=True) for dept in departments_data]
        stages = [Stage.model_validate(stage, from_attributes=True) for stage in stages_data]
        roles = [Role.model_validate(role, from_attributes=True) for role in roles_data]
        
        # Create simple user options without complex relationships
        users = []
        for user_data in users_data:
            user_option = UserProfileOption(
                id=user_data.id,
                name=user_data.name,
                email=user_data.email,
                employee_code=user_data.employee_code,
                job_title=user_data.job_title,
                roles=[Role.model_validate(role, from_attributes=True) for role in user_data.roles]
            )
            users.append(user_option)
        
        return ProfileOptionsResponse(
            departments=departments,
            stages=stages,
            roles=roles,
            users=users
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
    
    async def _validate_user_creation(self, user_data: UserCreate) -> None:
        """Validate all business rules before creating a user."""
        # Validate role IDs exist
        if user_data.role_ids:
            for role_id in user_data.role_ids:
                role = await self.role_repo.get_by_id(role_id)
                if not role:
                    raise BadRequestError(f"Role with ID {role_id} does not exist")
        
        # Validate supervisor exists and is active
        if user_data.supervisor_id:
            supervisor = await self.user_repo.get_user_by_id(user_data.supervisor_id)
            if not supervisor:
                raise BadRequestError(f"Supervisor with ID {user_data.supervisor_id} does not exist")
            if supervisor.status != UserStatus.ACTIVE.value:
                raise BadRequestError(f"Supervisor with ID {user_data.supervisor_id} is not active")
        
        # Validate subordinates exist and are active
        if user_data.subordinate_ids:
            for subordinate_id in user_data.subordinate_ids:
                subordinate = await self.user_repo.get_user_by_id(subordinate_id)
                if not subordinate:
                    raise BadRequestError(f"Subordinate with ID {subordinate_id} does not exist")
                if subordinate.status != UserStatus.ACTIVE.value:
                    raise BadRequestError(f"Subordinate with ID {subordinate_id} is not active")
        
        # Validate department exists if provided
        if user_data.department_id:
            department = await self.department_repo.get_by_id(user_data.department_id)
            if not department:
                raise BadRequestError(f"Department with ID {user_data.department_id} does not exist")
        
        # Validate stage exists if provided
        if user_data.stage_id:
            stage = await self.stage_repo.get_by_id(user_data.stage_id)
            if not stage:
                raise BadRequestError(f"Stage with ID {user_data.stage_id} does not exist")
        
        # Check for existing user with same email or employee_code
        existing_user_email = await self.user_repo.get_user_by_email(user_data.email)
        if existing_user_email:
            raise ConflictError(f"User with email {user_data.email} already exists")
        
        existing_user_code = await self.user_repo.get_user_by_employee_code(user_data.employee_code)
        if existing_user_code:
            raise ConflictError(f"User with employee code {user_data.employee_code} already exists")
        
        # Check for existing user with same clerk_user_id
        existing_user_clerk = await self.user_repo.get_user_by_clerk_id(user_data.clerk_user_id)
        if existing_user_clerk:
            raise ConflictError(f"User with clerk_user_id {user_data.clerk_user_id} already exists")
    
    async def _validate_user_update(self, user_data: UserUpdate, existing_user: UserModel) -> None:
        """Validate user update data"""
        # Check for conflicts if email or employee_code is being updated
        if user_data.email and user_data.email != existing_user.email:
            existing_user_with_email = await self.user_repo.get_user_by_email(user_data.email)
            if existing_user_with_email and existing_user_with_email.id != existing_user.id:
                raise ConflictError(f"User with email {user_data.email} already exists")
        
        if user_data.employee_code and user_data.employee_code != existing_user.employee_code:
            existing_user_with_code = await self.user_repo.get_user_by_employee_code(user_data.employee_code)
            if existing_user_with_code and existing_user_with_code.id != existing_user.id:
                raise ConflictError(f"User with employee code {user_data.employee_code} already exists")
        
        # Validate role IDs exist if being updated
        if user_data.role_ids is not None:
            for role_id in user_data.role_ids:
                role = await self.role_repo.get_by_id(role_id)
                if not role:
                    raise BadRequestError(f"Role with ID {role_id} does not exist")
        
        # Validate supervisor exists and is active if being updated
        if user_data.supervisor_id is not None and user_data.supervisor_id:
            supervisor = await self.user_repo.get_user_by_id(user_data.supervisor_id)
            if not supervisor:
                raise BadRequestError(f"Supervisor with ID {user_data.supervisor_id} does not exist")
            if supervisor.status != UserStatus.ACTIVE.value:
                raise BadRequestError(f"Supervisor with ID {user_data.supervisor_id} is not active")
            if supervisor.id == existing_user.id:
                raise BadRequestError("User cannot be their own supervisor")
        
        # Validate subordinates exist and are active if being updated
        if user_data.subordinate_ids is not None:
            for subordinate_id in user_data.subordinate_ids:
                subordinate = await self.user_repo.get_user_by_id(subordinate_id)
                if not subordinate:
                    raise BadRequestError(f"Subordinate with ID {subordinate_id} does not exist")
                if subordinate.status != UserStatus.ACTIVE.value:
                    raise BadRequestError(f"Subordinate with ID {subordinate_id} is not active")
                if subordinate_id == existing_user.id:
                    raise BadRequestError("User cannot be their own subordinate")
        
        # Validate department exists if being updated
        if user_data.department_id is not None:
            department = await self.department_repo.get_by_id(user_data.department_id)
            if not department:
                raise BadRequestError(f"Department with ID {user_data.department_id} does not exist")
        
        # Validate stage exists if being updated
        if user_data.stage_id is not None:
            stage = await self.stage_repo.get_by_id(user_data.stage_id)
            if not stage:
                raise BadRequestError(f"Stage with ID {user_data.stage_id} does not exist")
    
    
    async def _enrich_user_data(self, user: UserModel) -> User:
        """Enrich user data with relationships using repository pattern"""
        # Get department using repository
        department_model = await self.department_repo.get_by_id(user.department_id)
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
        stage_model = await self.stage_repo.get_by_id(user.stage_id)
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
        role_models = await self.role_repo.get_user_roles(user.id)
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
        supervisor_models = await self.user_repo.get_user_supervisors(user.id)
        supervisor = None
        if supervisor_models:
            supervisor_model = supervisor_models[0]  # Take first supervisor if multiple
            supervisor = await self._enrich_user_data(supervisor_model)

        # Get subordinates relationship
        subordinate_models = await self.user_repo.get_subordinates(user.id)
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
    
