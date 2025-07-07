import logging
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime

from ..database.repositories.user_repo import UserRepository
from ..database.models.user import UserBase
from ..schemas.user import (
    UserCreate, UserUpdate, UserProfile, User, UserInDB,
    UserCreateResponse, UserUpdateResponse, UserInactivateResponse,
    Department, Stage, Role, UserStatus
)
from ..schemas.common import PaginationParams, PaginatedResponse, BaseResponse
from ..core.exceptions import (
    NotFoundError, ConflictError, ValidationError, 
    PermissionDeniedError, BadRequestError
)

logger = logging.getLogger(__name__)


class UserService:
    """Service layer for user-related business logic and operations"""
    
    def __init__(self):
        self.user_repo = UserRepository()
    
    async def get_users(
        self, 
        current_user: Dict[str, Any],
        search_term: str = "",
        filters: Optional[Dict[str, Any]] = None,
        pagination: Optional[PaginationParams] = None
    ) -> PaginatedResponse[UserProfile]:
        """
        Get users based on current user's role and permissions
        
        Business Logic:
        - Admin: Can see all users
        - Manager: Can see subordinates only
        - Viewer: Department-based access
        - Supervisor: Can see subordinates only
        """
        try:
            user_role = current_user.get("role")
            user_id = current_user.get("sub")
            
            # Apply role-based filtering
            if user_role == "admin":
                # Admin can see all users
                users = await self.user_repo.search_users(
                    search_term=search_term,
                    filters=filters or {},
                    pagination=pagination
                )
                total = await self.user_repo.count_users(filters=filters or {})
            elif user_role in ["manager", "supervisor"]:
                # Manager/Supervisor can only see subordinates
                if not user_id:
                    raise PermissionDeniedError("User ID not found in token")
                
                # Get current user's UUID
                current_user_obj = await self.user_repo.get_by_clerk_id(user_id)
                if not current_user_obj:
                    raise NotFoundError("Current user not found in database")
                
                # Get subordinates
                subordinates = await self.user_repo.get_subordinates(current_user_obj.id)
                
                # Apply search and filters to subordinates
                filtered_subordinates = self._filter_users_by_criteria(
                    subordinates, search_term, filters
                )
                
                # Apply pagination
                if pagination:
                    start = pagination.offset
                    end = start + pagination.limit
                    users = filtered_subordinates[start:end]
                else:
                    users = filtered_subordinates
                
                total = len(filtered_subordinates)
            elif user_role == "viewer":
                # Viewer can see users in their department
                if not user_id:
                    raise PermissionDeniedError("User ID not found in token")
                
                current_user_obj = await self.user_repo.get_by_clerk_id(user_id)
                if not current_user_obj:
                    raise NotFoundError("Current user not found in database")
                
                # Add department filter
                if filters is None:
                    filters = {}
                filters["department_id"] = current_user_obj.department_id
                
                users = await self.user_repo.search_users(
                    search_term=search_term,
                    filters=filters,
                    pagination=pagination
                )
                total = await self.user_repo.count_users(filters=filters)
            else:
                raise PermissionDeniedError("Insufficient permissions to view users")
            
            # Convert to UserProfile objects
            user_profiles = []
            for user in users:
                profile = await self._enrich_user_profile(user)
                user_profiles.append(profile)
            
            # Create pagination params if not provided
            if pagination is None:
                pagination = PaginationParams(page=1, limit=len(user_profiles))
            
            return PaginatedResponse.create(
                items=user_profiles,
                total=total,
                pagination=pagination
            )
            
        except Exception as e:
            logger.error(f"Error getting users: {str(e)}")
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
        current_user: Dict[str, Any],
        mode: str = "soft"
    ) -> BaseResponse:
        """
        Delete a user. Supports 'soft' and 'hard' delete modes.

        - soft: Inactivates the user by changing their status. (default)
        - hard: Permanently deletes the user and their related data.

        Business Logic:
        - Only admin can delete users.
        - Cannot delete self.
        - Soft delete checks for active supervisory roles.
        """
        if mode not in ["soft", "hard"]:
            raise BadRequestError("Invalid delete mode. Must be 'soft' or 'hard'.")

        try:
            # Permission check: Only admins can delete
            if current_user.get("role") != "admin":
                raise PermissionDeniedError("Only administrators can delete users.")

            # Existence check
            existing_user = await self.user_repo.get_user_by_id(user_id)
            if not existing_user:
                raise NotFoundError(f"User with ID {user_id} not found.")

            # Prevent self-deletion
            current_user_clerk_id = current_user.get("sub")
            if current_user_clerk_id:
                current_user_obj = await self.user_repo.get_user_by_clerk_id(current_user_clerk_id)
                if current_user_obj and current_user_obj.id == user_id:
                    raise BadRequestError("Cannot delete your own account.")

            if mode == "soft":
                # Business logic for soft delete (inactivation)
                await self._validate_user_inactivation(user_id)
                
                success = await self.user_repo.update_user_status(user_id, UserStatus.INACTIVE)
                message = "User inactivated successfully."
                log_message = f"User soft-deleted (inactivated) successfully: {user_id}"

            else:  # mode == "hard"
                success = await self.user_repo.hard_delete_user_by_id(user_id)
                message = "User permanently deleted successfully."
                log_message = f"User hard-deleted successfully: {user_id}"

            if not success:
                raise NotFoundError(f"User with ID {user_id} not found or could not be deleted.")

            logger.info(log_message)
            return BaseResponse(success=True, message=message)

        except (NotFoundError, BadRequestError, PermissionDeniedError) as e:
            logger.warning(f"Failed to delete user {user_id} (mode: {mode}): {e}")
            raise
        except Exception as e:
            logger.error(f"Error deleting user {user_id} (mode: {mode}): {str(e)}")
            raise
    
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
    
    async def _enrich_user_data(self, user: UserBase) -> User:
        """Enrich user data with relationships"""
        # Get department
        department = await self._get_department(user.department_id)
        
        # Get stage
        stage = await self._get_stage(user.stage_id)
        
        # Get roles
        roles = await self._get_user_roles(user.id)
        
        # Get supervisor
        supervisor = None
        if user.supervisor_id:
            supervisor_data = await self.user_repo.get_by_id(user.supervisor_id)
            if supervisor_data:
                supervisor = await self._enrich_user_profile(supervisor_data)
        
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
            last_login_at=user.last_login_at
        )
    
    async def _get_department(self, department_id: UUID) -> Department:
        """Get department information"""
        query = "SELECT id, name, description FROM departments WHERE id = $1"
        row = await self.user_repo.db.fetchrow(query, department_id)
        if not row:
            raise NotFoundError(f"Department {department_id} not found")
        return Department(**dict(row))
    
    async def _get_stage(self, stage_id: UUID) -> Stage:
        """Get stage information"""
        query = "SELECT id, name, description FROM stages WHERE id = $1"
        row = await self.user_repo.db.fetchrow(query, stage_id)
        if not row:
            raise NotFoundError(f"Stage {stage_id} not found")
        return Stage(**dict(row))
    
    async def _get_user_roles(self, user_id: UUID) -> List[Role]:
        """Get user roles"""
        query = """
            SELECT r.id, r.name, r.description 
            FROM roles r
            INNER JOIN user_roles ur ON r.id = ur.role_id
            WHERE ur.user_id = $1
            ORDER BY r.name
        """
        rows = await self.user_repo.db.fetch(query, user_id)
        return [Role(**dict(row)) for row in rows]
    
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
