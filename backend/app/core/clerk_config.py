import os
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class ClerkConfig:
    """Configuration class for Clerk authentication settings."""
    
    def __init__(self, skip_validation: bool = False):
        """
        Initialize Clerk configuration.
        
        Args:
            skip_validation: If True, skip environment variable validation for testing
        """
        self.skip_validation = skip_validation
        
        # Load environment variables
        self.secret_key: str = self._get_env("CLERK_SECRET_KEY", "")
        self.publishable_key: str = self._get_env("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "")
        
        # Validate required environment variables
        if not skip_validation:
            self._validate_config()
    
    def _get_env(self, key: str, default: str = "") -> str:
        """Get environment variable with optional default."""
        return os.getenv(key, default)
    
    def _validate_config(self) -> None:
        """Validate that all required configuration is present."""
        if not self.secret_key:
            raise ValueError(
                "CLERK_SECRET_KEY environment variable is required. "
                "Please set it in your environment or .env file."
            )
        
        if not self.publishable_key:
            raise ValueError(
                "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY environment variable is required. "
                "Please set it in your environment or .env file."
            )
    
    @property
    def jwt_verification_key(self) -> str:
        """Get the JWT verification key (uses secret key)."""
        return self.secret_key
    
    def __repr__(self) -> str:
        return f"ClerkConfig(publishable_key={self.publishable_key[:10]}...)"