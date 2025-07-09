"""
Simplified Authentication module for RBAC integration.
Provides ClerkAuth interface compatible with existing AuthService.
"""

import logging
from typing import Dict, Any, Optional
from dataclasses import dataclass

from .clerk_config import ClerkConfig
from ..services.auth_service import AuthService
from ..core.exceptions import UnauthorizedError

logger = logging.getLogger(__name__)


@dataclass
class AuthUser:
    """Represents an authenticated user from Clerk."""
    user_id: str
    email: str
    first_name: str
    last_name: str
    role: str


class ClerkAuth:
    """
    Simplified ClerkAuth implementation for RBAC integration.
    Works with existing AuthService infrastructure.
    """
    
    def __init__(self, config: ClerkConfig):
        """Initialize ClerkAuth with configuration."""
        self.config = config
        self.auth_service = None
    
    def verify_token(self, token: str) -> AuthUser:
        """
        Verify JWT token and return user information.
        
        For now, this is a simplified implementation that works with
        the existing system. In a full RBAC implementation, this would
        integrate with Clerk's JWT verification.
        
        Args:
            token: JWT token to verify
            
        Returns:
            AuthUser: Authenticated user information
            
        Raises:
            UnauthorizedError: If token is invalid
        """
        try:
            # For development/testing, create a mock user
            # In production, this would integrate with Clerk JWT verification
            if token == "mock_admin_token":
                return AuthUser(
                    user_id="admin_user_123",
                    email="admin@example.com",
                    first_name="Admin",
                    last_name="User",
                    role="admin"
                )
            elif token == "mock_user_token":
                return AuthUser(
                    user_id="regular_user_123",
                    email="user@example.com",
                    first_name="Regular",
                    last_name="User",
                    role="employee"
                )
            else:
                # In a real implementation, this would verify the JWT with Clerk
                # For now, return a default user for any token
                return AuthUser(
                    user_id="user_123",
                    email="user@example.com",
                    first_name="Test",
                    last_name="User",
                    role="employee"
                )
                
        except Exception as e:
            logger.error(f"Token verification failed: {str(e)}")
            raise UnauthorizedError(f"Invalid token: {str(e)}")
    
    def get_user_info(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Get user information by user ID.
        
        Args:
            user_id: User ID to lookup
            
        Returns:
            Dict with user information or None if not found
        """
        # This would typically integrate with Clerk's user management API
        # For now, return mock data
        return {
            "user_id": user_id,
            "email": "user@example.com",
            "first_name": "Test",
            "last_name": "User",
            "role": "employee"
        } 