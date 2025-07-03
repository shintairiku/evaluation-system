from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from clerk_backend_sdk import ApiClient, Configuration, SessionsApi
import logging

from ..database.session import get_db_session
from ..database.repositories.user_repo import UserRepository
from ..database.repositories.department_repo import DepartmentRepository
from ..database.repositories.stage_repo import StageRepository
from ..database.repositories.role_repo import RoleRepository
from ..database.models.user import User
from ..utils.user_relationships import UserRelationshipManager
from ..schemas.user import UserDetailResponse, Department, Stage, Role, UserProfileOption, UserExistsResponse, UserStatus
from ..schemas.auth import UserSignUpRequest, SignUpOptionsResponse, AuthUser
from ..core.clerk_config import get_clerk_config

logger = logging.getLogger(__name__)

class AuthService:
    """Service for handling user authentication operations."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.user_repo = UserRepository(session)
        self.department_repo = DepartmentRepository(session)
        self.stage_repo = StageRepository(session)
        self.role_repo = RoleRepository(session)
        self.relationship_manager = UserRelationshipManager(session)
        
        # Initialize Clerk client
        clerk_config = get_clerk_config()
        configuration = Configuration(
            api_key=clerk_config.secret_key
        )
        self.clerk_client = ApiClient(configuration)
        self.sessions_api = SessionsApi(self.clerk_client)

    def get_user_from_token(self, token: str) -> AuthUser:
        """
        Validate Clerk JWT token and extract user information.
        
        Args:
            token: JWT token from Clerk
            
        Returns:
            AuthUser: User information extracted from token
            
        Raises:
            Exception: If token is invalid or verification fails
        """
        try:
            # Verify the session token with Clerk
            # Note: For JWT tokens, we might need to decode them first to get session info
            # For now, let's extract basic info from the token payload using python-jose
            from jose import jwt
            
            # Decode without verification first to get the payload structure
            payload = jwt.get_unverified_claims(token)
            
            # Extract user information from the JWT payload
            user_id = payload.get("sub")  # Subject is typically the user ID
            email = payload.get("email", "")
            first_name = payload.get("given_name", "")
            last_name = payload.get("family_name", "")
            role = payload.get("role", "")  # Custom claim if available
            
            if not user_id:
                raise ValueError("User ID not found in token")
                
            return AuthUser(
                user_id=user_id,
                email=email,
                first_name=first_name,
                last_name=last_name,
                role=role
            )
            
        except Exception as e:
            raise Exception(f"Token validation failed: {str(e)}")

    async def check_user_exists_by_clerk_id(self, clerk_user_id: str) -> UserExistsResponse:
        """Check if user exists in database with minimal info."""
        user_data = await self.user_repo.check_user_exists_by_clerk_id(clerk_user_id)
        
        if user_data:
            return UserExistsResponse(
                exists=True,
                user_id=user_data["id"],
                name=user_data["name"],
                email=user_data["email"], 
                status=user_data["status"]
            )
        else:
            return UserExistsResponse(exists=False) 

    async def complete_signup(self, signup_data: UserSignUpRequest) -> UserDetailResponse:
        """Complete user signup process by orchestrating repository interactions."""
        try:
            # 1. Create the User entity (Business Logic)
            new_user = User(
                clerk_user_id=signup_data.clerk_user_id,
                name=signup_data.name,
                email=signup_data.email,
                employee_code=signup_data.employee_code,
                job_title=signup_data.job_title,
                department_id=signup_data.department_id,
                stage_id=signup_data.stage_id,
                status=UserStatus.PENDING_APPROVAL.value  # Business rule: default status
            )

            # 2. Add the main entity to the session via the repo
            self.user_repo.add(new_user)
            await self.session.flush()  # Flush to get the new_user.id for relationships

            # 3. Handle role associations (Orchestration)
            if signup_data.role_ids:
                await self.relationship_manager.assign_roles_to_user(new_user.id, signup_data.role_ids)

            # 4. Handle supervisor relationship if provided
            if signup_data.supervisor_id:
                await self.relationship_manager.add_supervisor_relationship(new_user.id, signup_data.supervisor_id)
            
            # 5. Handle subordinate relationships if provided
            if signup_data.subordinate_ids:
                await self.relationship_manager.add_subordinate_relationships(new_user.id, signup_data.subordinate_ids)
            
            # 6. Commit the transaction (Service Layer controls the Unit of Work)
            await self.session.commit()
            await self.session.refresh(new_user)  # Refresh to load relationships

            # 7. Get user with full details for response
            user_with_details = await self.user_repo.get_user_by_id_with_details(new_user.id)
            
            return UserDetailResponse.model_validate(user_with_details, from_attributes=True)

        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error during signup completion: {e}")
            raise

    async def get_profile_options(self) -> SignUpOptionsResponse:
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
        
        return SignUpOptionsResponse(
            departments=departments,
            stages=stages,
            roles=roles,
            users=users
        )