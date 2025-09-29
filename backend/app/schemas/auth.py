from typing import List, Optional
from pydantic import BaseModel, Field
from uuid import UUID


# ========================================
# AUTH USER FROM TOKEN
# ========================================
class AuthUser(BaseModel):
    """User information extracted from Clerk JWT token."""
    clerk_id: str = Field(..., description="Clerk user ID")
    email: str = Field(..., description="User email address")
    first_name: Optional[str] = Field(None, description="User first name")
    last_name: Optional[str] = Field(None, description="User last name")
    roles: Optional[List[str]] = Field(None, description="User roles array from JWT")
    role: Optional[str] = Field(None, description="Legacy single role field (deprecated)")
    organization_id: Optional[str] = Field(None, description="Clerk organization ID from JWT")
    organization_name: Optional[str] = Field(None, description="Organization name from JWT")
    organization_slug: Optional[str] = Field(None, description="Organization slug for routing from JWT")


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
