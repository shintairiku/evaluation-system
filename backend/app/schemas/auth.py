from typing import List, Optional
from pydantic import BaseModel, Field
from uuid import UUID

# Import base class and models for runtime use
from .user import UserBase, Department, Role, UserProfileOption
from .stage_competency import Stage


# ========================================
# AUTH USER FROM TOKEN
# ========================================
class AuthUser(BaseModel):
    """User information extracted from Clerk JWT token."""
    clerk_id: str = Field(..., description="Clerk user ID")
    email: str = Field(..., description="User email address")
    first_name: Optional[str] = Field(None, description="User first name")
    last_name: Optional[str] = Field(None, description="User last name")
    role: Optional[str] = Field(None, description="User role")


# ========================================
# SIGNUP SCHEMAS
# ========================================

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
