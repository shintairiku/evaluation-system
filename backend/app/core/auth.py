from typing import Optional, Dict, Any
from pydantic import BaseModel
from jose import jwt, JWTError
from datetime import datetime

from .clerk_config import ClerkConfig


class AuthUser(BaseModel):
    """User model for authenticated users from Clerk."""
    user_id: str
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: str = "employee"  # Default role


class ClerkAuth:
    """Clerk authentication service for JWT token verification."""
    
    def __init__(self, config: Optional[ClerkConfig] = None):
        """
        Initialize Clerk authentication service.
        
        Args:
            config: Clerk configuration instance. If None, creates a new one.
        """
        self.config = config or ClerkConfig()
    
    def verify_token(self, token: str) -> AuthUser:
        """
        Verify a JWT token from Clerk and return user information.
        
        Args:
            token: JWT token string
            
        Returns:
            AuthUser: Authenticated user information
            
        Raises:
            JWTError: If token is invalid or expired
            ValueError: If required claims are missing
        """
        try:
            # Decode and verify the JWT token
            payload = jwt.decode(
                token, 
                self.config.jwt_verification_key, 
                algorithms=["HS256"]
            )
            
            # Extract user information from token payload
            user_id = payload.get("sub")
            if not user_id:
                raise ValueError("Token missing 'sub' claim")
            
            email = payload.get("email", "")
            first_name = payload.get("first_name")
            last_name = payload.get("last_name")
            role = payload.get("role", "employee")
            
            return AuthUser(
                user_id=user_id,
                email=email,
                first_name=first_name,
                last_name=last_name,
                role=role
            )
            
        except JWTError as e:
            raise JWTError(f"Invalid or expired token: {str(e)}")
        except Exception as e:
            raise ValueError(f"Token verification failed: {str(e)}")
    
    def get_user_from_payload(self, payload: Dict[str, Any]) -> AuthUser:
        """
        Create AuthUser from JWT payload.
        
        Args:
            payload: Decoded JWT payload
            
        Returns:
            AuthUser: User information
        """
        return AuthUser(
            user_id=payload.get("sub", ""),
            email=payload.get("email", ""),
            first_name=payload.get("first_name"),
            last_name=payload.get("last_name"),
            role=payload.get("role", "employee")
        )