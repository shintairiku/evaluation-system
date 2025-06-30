from typing import Optional, TYPE_CHECKING
from pydantic import BaseModel, Field
from uuid import UUID

if TYPE_CHECKING:
    from .user import UserDetailResponse


class SignInRequest(BaseModel):
    """Request model for clerk signin."""
    clerk_token: str = Field(..., min_length=1, description="Clerk authentication token")


class TokenData(BaseModel):
    """Data model for the application's token."""
    access_token: str = Field(..., min_length=1, description="JWT access token")
    refresh_token: str = Field(..., min_length=1, description="JWT refresh token")


class SignInResponse(BaseModel):
    """Response model for login."""
    user: UserDetailResponse
    token: TokenData


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
