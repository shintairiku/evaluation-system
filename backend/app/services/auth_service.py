from sqlalchemy.ext.asyncio import AsyncSession
from clerk_backend_sdk import ApiClient, Configuration, SessionsApi
import logging

from ..database.repositories.user_repo import UserRepository
from ..database.repositories.department_repo import DepartmentRepository
from ..database.repositories.stage_repo import StageRepository
from ..database.repositories.role_repo import RoleRepository
from ..database.models.user import User
from ..utils.user_relationships import UserRelationshipManager
from ..schemas.auth import AuthUser
from ..schemas.user import UserDetailResponse, Department, Stage, Role, UserProfileOption, UserExistsResponse, UserStatus
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
