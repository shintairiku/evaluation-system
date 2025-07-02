from typing import List, Optional, TYPE_CHECKING
from pydantic import BaseModel, Field
from uuid import UUID

# Import base class and models for runtime use
from .user import UserBase, User, Department, Stage, Role, UserProfileOption


# ========================================
# SIGNUP SCHEMAS
# ========================================
class UserSignUpRequest(UserBase):
    """Request for user signup with all profile options."""
    clerk_user_id: str = Field(..., min_length=1)
    department_id: Optional[UUID] = None
    stage_id: Optional[UUID] = None
    role_ids: List[int] = []
    supervisor_id: Optional[UUID] = None
    subordinate_ids: Optional[List[UUID]] = None


class SignUpOptionsResponse(BaseModel):
    """Response with all available options for signup."""
    departments: List[Department]
    stages: List[Stage]
    roles: List[Role]
    users: List[UserProfileOption]  # Simple user options without complex relationships

class SignInRequest(BaseModel):
    """Request model for clerk signin."""
    clerk_token: str = Field(..., min_length=1, description="Clerk authentication token")


class TokenData(BaseModel):
    """Data model for the application's token."""
    access_token: str = Field(..., min_length=1, description="JWT access token")
    refresh_token: str = Field(..., min_length=1, description="JWT refresh token")


class UserAuthResponse(BaseModel):
    """Response model for authenticated user information."""
    id: UUID
    email: str
    name: str
    clerk_user_id: str


class TokenVerifyRequest(BaseModel):
    """Request model for token verification."""
    token: str


class TokenVerifyResponse(BaseModel):
    """Response model for token verification."""
    valid: bool
    user: Optional[UserAuthResponse] = None
    error: Optional[str] = None


class LogoutResponse(BaseModel):
    """Response model for logout."""
    message: str = "Logout successful" 
