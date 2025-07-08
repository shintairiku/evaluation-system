from __future__ import annotations
import logging
from typing import Optional, List, Dict, Any
from uuid import UUID
from cachetools import TTLCache

from ..database.repositories.user_repo import UserRepository
from ..database.repositories.department_repo import DepartmentRepository
from ..database.repositories.stage_repo import StageRepository
from ..database.repositories.role_repo import RoleRepository
from ..database.models.user import User as UserModel
from ..schemas.user import (
    UserCreate, UserUpdate, User, UserDetailResponse,
    Department, Stage, Role, UserStatus
)
from ..schemas.common import PaginationParams, PaginatedResponse
from ..dependencies.role import UserRole
from ..core.exceptions import (
    NotFoundError, ConflictError, PermissionDeniedError, BadRequestError
)
from ..utils.user_relationships import UserRelationshipManager
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# Cache for user search results (100 items, 5-minute TTL)
user_search_cache = TTLCache(maxsize=100, ttl=300)


class UserService:
    """Service layer for user-related business logic and operations"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.user_repo = UserRepository(session)
        self.department_repo = DepartmentRepository(session)
        self.stage_repo = StageRepository(session)
        self.role_repo = RoleRepository(session)
        self.user_relationships = UserRelationshipManager(session)
    
    async def get_users(
        self, 
        current_user_roles, 
        search_term: str = "",
        statuses: Optional[list[UserStatus]] = None,
        department_ids: Optional[list[UUID]] = None,
        stage_ids: Optional[list[UUID]] = None,
        role_ids: Optional[list[UUID]] = None,
        pagination: Optional[PaginationParams] = None
    ) -> PaginatedResponse[User]:
        """
        Get users based on current user's roles and permissions, with explicit multi-select filters.
        Uses role-based access control from dependencies/role.py.
        """
        try:
            # Check permissions based on user roles
            user_ids_to_filter = None
            
            # Business Logic: Determine access scope based on roles
            # if current_user_roles.has_any_role(["admin", "viewer"]):
            #     # Admin and Viewer: Can see all users
            #     user_ids_to_filter = None
            # elif current_user_roles.has_any_role(["manager", "supervisor"]):
            #     # Manager/Supervisor: Can only see subordinates
            #     subordinate_ids = await self.user_relationships.get_all_subordinates(
            #         current_user_roles.user_id
            #     )
            #     user_ids_to_filter = subordinate_ids
            # else:
            #     # Default: No access to user listing
            #     return PaginatedResponse(
            #         items=[],
            #         total=0,
            #         page=pagination.page if pagination else 1,
            #         limit=pagination.limit if pagination else 10,
            #         pages=0
            #     )
            
            # Generate cache key including role information for proper caching
            cache_key_params = {
                "search_term": search_term,
                "statuses": sorted(statuses) if statuses else None,
                "department_ids": sorted([str(d) for d in department_ids]) if department_ids else None,
                "stage_ids": sorted([str(s) for s in stage_ids]) if stage_ids else None,
                "role_ids": sorted([str(r) for r in role_ids]) if role_ids else None,
                "user_ids": sorted([str(u) for u in user_ids_to_filter]) if user_ids_to_filter else None,
                "pagination": f"{pagination.page}_{pagination.limit}" if pagination else None,
                "requesting_user_roles": sorted(current_user_roles.role_names)
            }
            cache_key = self._generate_cache_key("get_users", cache_key_params)
            
            # Check cache
            cached_result = user_search_cache.get(cache_key)
            if cached_result:
                return PaginatedResponse.model_validate_json(cached_result)
            
            # Get data from repository
            users = await self.user_repo.search_users(
                search_term=search_term,
                statuses=statuses,
                department_ids=department_ids,
                stage_ids=stage_ids,
                role_ids=role_ids,
                user_ids=user_ids_to_filter,
                pagination=pagination
            )
            
            total_count = await self.user_repo.count_users(
                search_term=search_term,
                statuses=statuses,
                department_ids=department_ids,
                stage_ids=stage_ids,
                role_ids=role_ids,
                user_ids=user_ids_to_filter
            )
            
            # Enrich users with schema conversion
            enriched_users = []
            for user_model in users:
                enriched_user = await self._enrich_user_data(user_model)
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
        current_user_roles: UserRole
    ) -> UserDetailResponse:
        """
        Get a specific user by ID and return UserDetailResponse with supervisor/subordinates
        """
        try:
            # Check if user exists
            user = await self.user_repo.get_user_by_id(user_id)
            if not user:
                raise NotFoundError(f"User with ID {user_id} not found")
            
            # TODO: add role-based access control
            
            # Enrich user data for detail response with supervisor/subordinates
            enriched_user = await self._enrich_detailed_user_data(user)
            return enriched_user
            
        except Exception as e:
            logger.error(f"Error getting user {user_id}: {str(e)}")
            raise
    
    async def create_user(
        self, 
        user_data: UserCreate, 
        current_user_roles: UserRole
    ) -> UserDetailResponse:
        """
        Create a new user with validation and business rules
        
        Business Logic:
        - Only admin can create users
        - Validate all required relationships exist
        - Check for conflicts (email, employee_code, clerk_id)
        - Set default status to active
        """
        try:
            # TODO: Role-based access control
            # if not current_user_roles.has_role("admin"):
            #     raise PermissionDeniedError("Only administrators can create users")
            
            # Business validation
            await self._validate_user_creation(user_data)
            
            # Create user through repository
            created_user = await self.user_repo.create_user(user_data)
            
            # Commit the transaction (Service controls the Unit of Work)
            await self.session.commit()
            await self.session.refresh(created_user)
            
            # Enrich user data for detailed response
            enriched_user = await self._enrich_detailed_user_data(created_user)
            
            logger.info(f"User created successfully: {created_user.id}")
            return enriched_user
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error creating user: {str(e)}")
            raise
    
    async def update_user(
        self, 
        user_id: UUID, 
        user_data: UserUpdate, 
        current_user_roles: UserRole
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
            
            # TODO: Role-based access control
            # if current_user_roles.has_role("admin"):
            #     # Admin can update any user
            #     pass
            # elif current_user_roles.user_id == user_id:
            #     # User can update their own profile
            #     pass
            # else:
            #     raise PermissionDeniedError("You can only update your own profile or need admin role")
            
            # Business validation
            await self._validate_user_update(user_data, existing_user)
            
            # Update user through repository using UserUpdate schema
            updated_user = await self.user_repo.update_user(user_id, user_data)
            if not updated_user:
                raise NotFoundError(f"User with ID {user_id} not found")
            
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
        current_user_roles: UserRole,
        mode: str = "soft",
    ) -> bool:
        """
        Delete a user. 'soft' marks as inactive, 'hard' removes from DB.
        NOTE: Hard delete is permanent and irreversible.
        """
        try:
            # TODO: Role-based access control
            # if not current_user_roles.has_role("admin"):
            #     raise PermissionDeniedError("Only administrators can delete users.")

            # Check if user exists
            existing_user = await self.user_repo.get_user_by_id(user_id)
            if not existing_user:
                raise NotFoundError(f"User with ID {user_id} not found")

            if mode == "soft":
                # TODO: Self-deletion check
                # if current_user_roles.user_id == user_id:
                #     raise BadRequestError("Administrators cannot inactivate their own accounts.")

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
            user = await self.user_repo.get_by_clerk_id(clerk_user_id)
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
        # Additional business validation can be added here
        # Repository already handles most validation
        pass
    
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
    
    
    async def _enrich_user_data(self, user: UserModel) -> User:
        """Enrich user data with relationships using repository pattern"""
        # Get department using repository
        department_model = await self.department_repo.get_department_by_id(user.department_id)
        department = Department(
            id=department_model.id,
            name=department_model.name,
            description=department_model.description
        ) if department_model else None
        
        # Get stage using repository
        stage_model = await self.stage_repo.get_stage_by_id(user.stage_id)
        stage = Stage(
            id=stage_model.id,
            name=stage_model.name,
            description=stage_model.description
        ) if stage_model else None
        
        # Get roles using repository
        role_models = await self.role_repo.get_user_roles(user.id)
        roles = [Role(
            id=role.id,
            name=role.name,
            description=role.description
        ) for role in role_models]

        return User(
            id=user.id,
            clerk_user_id=user.clerk_user_id,
            name=user.name,
            email=user.email,
            employee_code=user.employee_code,
            status=user.status,
            job_title=user.job_title,
            department_id=user.department_id,
            stage_id=user.stage_id,
            created_at=user.created_at,
            updated_at=user.updated_at,
            last_login_at=user.last_login_at,
            department=department,
            stage=stage,
            roles=roles,
        )

    async def _enrich_detailed_user_data(self, user: UserModel) -> UserDetailResponse:
        """Enrich user data for UserDetailResponse with supervisor/subordinates using repository pattern"""
        # Get basic data using repository pattern
        department_model = await self.department_repo.get_department_by_id(user.department_id)
        department = Department(
            id=department_model.id,
            name=department_model.name,
            description=department_model.description
        ) if department_model else None
        
        stage_model = await self.stage_repo.get_stage_by_id(user.stage_id)
        stage = Stage(
            id=stage_model.id,
            name=stage_model.name,
            description=stage_model.description
        ) if stage_model else None
        
        role_models = await self.role_repo.get_user_roles(user.id)
        roles = [Role(
            id=role.id,
            name=role.name,
            description=role.description
        ) for role in role_models]

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

        return UserDetailResponse(
            id=user.id,
            clerk_user_id=user.clerk_user_id,
            employee_code=user.employee_code,
            name=user.name,
            email=user.email,
            status=user.status,
            job_title=user.job_title,
            department=department,
            stage=stage,
            roles=roles,
            supervisor=supervisor,
            subordinates=subordinates if subordinates else None
        )
    
    
    def _filter_users_by_criteria(
        self, 
        users: List[UserModel], 
        search_term: str, 
        filters: Optional[Dict[str, Any]]
    ) -> List[UserModel]:
        """Filter users by search term and filters"""
        filtered_users = users
        
        # Apply search term
        if search_term:
            search_lower = search_term.lower()
            filtered_users = [
                user for user in filtered_users
                if (search_lower in user.name.lower() or
                    search_lower in user.email.lower() or
                    search_lower in user.employee_code.lower())
            ]
        
        # Apply filters
        if filters:
            if "status" in filters:
                filtered_users = [
                    user for user in filtered_users
                    if user.status == filters["status"]
                ]
            
            if "department_id" in filters:
                filtered_users = [
                    user for user in filtered_users
                    if user.department_id == filters["department_id"]
                ]
            
            if "stage_id" in filters:
                filtered_users = [
                    user for user in filtered_users
                    if user.stage_id == filters["stage_id"]
                ]
        
        return filtered_users
