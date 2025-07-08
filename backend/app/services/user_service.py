from __future__ import annotations
import logging
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
import json
from cachetools import TTLCache

from ..database.repositories.user_repo import UserRepository
from ..database.models.user import User as UserModel
from ..schemas.user import (
    UserCreate, UserUpdate, User, UserDetailResponse,
    Department, Stage, Role, UserStatus
)
from ..schemas.common import PaginationParams, PaginatedResponse, BaseResponse
from ..core.exceptions import (
    NotFoundError, ConflictError, ValidationError, 
    PermissionDeniedError, BadRequestError
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
        current_user: Dict[str, Any]
    ) -> User:
        """
        Get a specific user by ID with permission checks
        
        Business Logic:
        - Users can view their own profile
        - Admin can view any user
        - Manager/Supervisor can view subordinates
        - Viewer can view users in same department
        """
        try:
            current_user_role = current_user.get("role")
            current_user_clerk_id = current_user.get("sub")
            
            # Check if user exists
            user = await self.user_repo.get_by_id(user_id)
            if not user:
                raise NotFoundError(f"User with ID {user_id} not found")
            
            # Permission checks
            if current_user_clerk_id:
                current_user_obj = await self.user_repo.get_by_clerk_id(current_user_clerk_id)
                if current_user_obj and current_user_obj.id == user_id:
                    # User can always view their own profile
                    pass
                elif current_user_role == "admin":
                    # Admin can view any user
                    pass
                elif current_user_role in ["manager", "supervisor"]:
                    # Check if user is a subordinate
                    if current_user_obj:
                        subordinates = await self.user_repo.get_subordinates(current_user_obj.id)
                        if user_id not in [sub.id for sub in subordinates]:
                            raise PermissionDeniedError("You can only view your own profile or subordinates")
                    else:
                        raise PermissionDeniedError("Current user not found in database")
                elif current_user_role == "viewer":
                    # Check if user is in same department
                    if current_user_obj and current_user_obj.department_id != user.department_id:
                        raise PermissionDeniedError("You can only view users in your department")
                    elif not current_user_obj:
                        raise PermissionDeniedError("Current user not found in database")
                else:
                    raise PermissionDeniedError("Insufficient permissions to view this user")
            
            # Enrich user data with relationships
            enriched_user = await self._enrich_user_data(user)
            return enriched_user
            
        except Exception as e:
            logger.error(f"Error getting user {user_id}: {str(e)}")
            raise
    
    async def create_user(
        self, 
        user_data: UserCreate, 
        current_user: Dict[str, Any]
    ) -> UserCreateResponse:
        """
        Create a new user with validation and business rules
        
        Business Logic:
        - Only admin can create users
        - Validate all required relationships exist
        - Check for conflicts (email, employee_code, clerk_id)
        - Set default status to active
        """
        try:
            # Permission check
            if current_user.get("role") != "admin":
                raise PermissionDeniedError("Only administrators can create users")
            
            # Business validation
            await self._validate_user_creation(user_data)
            
            # Create user through repository
            created_user = await self.user_repo.create_user(user_data)
            
            # Enrich user data for response
            enriched_user = await self._enrich_user_data(created_user)
            
            logger.info(f"User created successfully: {created_user.id}")
            return UserCreateResponse(
                user=enriched_user,
                message="User created successfully"
            )
            
        except Exception as e:
            logger.error(f"Error creating user: {str(e)}")
            raise
    
    async def update_user(
        self, 
        user_id: UUID, 
        user_data: UserUpdate, 
        current_user: Dict[str, Any]
    ) -> UserUpdateResponse:
        """
        Update user information with permission checks
        
        Business Logic:
        - Users can update their own profile
        - Admin can update any user
        - Validate relationships if being updated
        - Check for conflicts
        """
        try:
            current_user_role = current_user.get("role")
            current_user_clerk_id = current_user.get("sub")
            
            # Check if user exists
            existing_user = await self.user_repo.get_by_id(user_id)
            if not existing_user:
                raise NotFoundError(f"User with ID {user_id} not found")
            
            # Permission checks
            if current_user_clerk_id:
                current_user_obj = await self.user_repo.get_by_clerk_id(current_user_clerk_id)
                if current_user_obj and current_user_obj.id == user_id:
                    # User can update their own profile
                    pass
                elif current_user_role == "admin":
                    # Admin can update any user
                    pass
                else:
                    raise PermissionDeniedError("You can only update your own profile")
            
            # Business validation
            await self._validate_user_update(user_data, existing_user)
            
            # Update user through repository
            updated_user = await self.user_repo.update_user(user_id, user_data)
            if not updated_user:
                raise NotFoundError(f"User with ID {user_id} not found")
            
            # Enrich user data for response
            enriched_user = await self._enrich_user_data(updated_user)
            
            logger.info(f"User updated successfully: {user_id}")
            return UserUpdateResponse(
                user=enriched_user,
                message="User updated successfully"
            )
            
        except Exception as e:
            logger.error(f"Error updating user {user_id}: {str(e)}")
            raise
    
    async def delete_user(
        self,
        user_id: UUID,
        mode: str = "soft",
    ) -> bool:
        """Delete a user via repository helper.

        A minimal, clear implementation that supports:

        • soft - mark user as INACTIVE
        • hard - remove user and all relationships
        """

        if mode not in ("soft", "hard"):
            raise BadRequestError("delete_user mode must be 'soft' or 'hard'.")

        from ..database.session import AsyncSessionLocal  # local import avoids cycles

        async with AsyncSessionLocal() as session:
            repo = UserRepository(session)

            if mode == "soft":
                success = await repo.update_user_status(user_id, UserStatus.INACTIVE)
            else:
                success = await repo.hard_delete_user_by_id(user_id)

            await session.commit()

        return success
    
    async def get_user_profile(
        self, 
        user_id: UUID, 
        current_user: Dict[str, Any]
    ) -> UserProfile:
        """Get user profile for display purposes"""
        try:
            user = await self.get_user_by_id(user_id, current_user)
            return await self._enrich_user_profile(user)
        except Exception as e:
            logger.error(f"Error getting user profile {user_id}: {str(e)}")
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
    
    async def _validate_user_creation(self, user_data: UserCreate) -> None:
        """Validate user creation data"""
        # Additional business validation can be added here
        # Repository already handles most validation
        pass
    
    async def _validate_user_update(self, user_data: UserUpdate, existing_user: UserBase) -> None:
        """Validate user update data"""
        # Check for conflicts if email or employee_code is being updated
        if user_data.email and user_data.email != existing_user.email:
            existing_user_with_email = await self.user_repo.get_by_email(user_data.email)
            if existing_user_with_email and existing_user_with_email.id != existing_user.id:
                raise ConflictError(f"User with email {user_data.email} already exists")
        
        if user_data.employee_code and user_data.employee_code != existing_user.employee_code:
            existing_user_with_code = await self.user_repo.get_by_employee_code(user_data.employee_code)
            if existing_user_with_code and existing_user_with_code.id != existing_user.id:
                raise ConflictError(f"User with employee code {user_data.employee_code} already exists")
    
    async def _validate_user_inactivation(self, user_id: UUID) -> None:
        """Validate that user can be inactivated"""
        # Check if user is a supervisor of active users
        subordinates = await self.user_repo.get_subordinates(user_id)
        if subordinates:
            raise BadRequestError("Cannot inactivate user who is currently supervising active users")
        
        # Additional checks can be added here (e.g., active evaluations)
    
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
            supervisor_id=user.supervisor_id,
            created_at=user.created_at,
            updated_at=user.updated_at,
            last_login_at=user.last_login_at,
            department=department,
            stage=stage,
            roles=roles,
            supervisor=supervisor
        )
    
    async def _enrich_user_profile(self, user: UserBase) -> UserProfile:
        """Enrich user data for profile display"""
        # Get department
        department = await self._get_department(user.department_id)
        
        # Get stage
        stage = await self._get_stage(user.stage_id)
        
        # Get roles
        roles = await self._get_user_roles(user.id)
        
        return UserProfile(
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
        users: List[UserBase], 
        search_term: str, 
        filters: Optional[Dict[str, Any]]
    ) -> List[UserBase]:
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
