from typing import Optional
from pydantic import BaseModel, EmailStr


class UserAuthResponse(BaseModel):
    """Response model for authenticated user information."""
    id: str
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: str = "employee"


class TokenVerifyRequest(BaseModel):
    """Request model for token verification."""
    token: str


class TokenVerifyResponse(BaseModel):
    """Response model for token verification."""
    valid: bool
    user: Optional[UserAuthResponse] = None
    error: Optional[str] = None


class LoginRequest(BaseModel):
    """Request model for login (handled by Clerk on frontend)."""
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    """Response model for login."""
    access_token: str
    token_type: str = "bearer"
    user: UserAuthResponse


class LogoutResponse(BaseModel):
    """Response model for logout."""
    message: str = "Logout successful"