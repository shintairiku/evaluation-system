import os
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class RBACConfig:
    """Configuration class for Role-Based Access Control (RBAC) settings."""
    
    def __init__(self, skip_validation: bool = False):
        """
        Initialize RBAC configuration.
        
        Args:
            skip_validation: If True, skip environment variable validation for testing
        """
        self.skip_validation = skip_validation
        
        # Load environment variables
        self.environment: str = self._get_env("ENVIRONMENT", "production")
        self.engineer_access_key: str = self._get_env("ENGINEER_ACCESS_KEY", "")
        
        # Validate required environment variables
        if not skip_validation:
            self._validate_config()
    
    def _get_env(self, key: str, default: str = "") -> str:
        """Get environment variable with optional default."""
        return os.getenv(key, default)
    
    def _validate_config(self) -> None:
        """Validate that all required configuration is present."""
        if self.is_development_mode() and not self.engineer_access_key:
            raise ValueError(
                "ENGINEER_ACCESS_KEY environment variable is required when ENVIRONMENT is set to 'development'. "
                "Please set it in your environment or .env file."
            )
    
    def is_development_mode(self) -> bool:
        """Check if the application is running in development mode."""
        return self.environment.lower() == "development"
    
    def is_production_mode(self) -> bool:
        """Check if the application is running in production mode."""
        return self.environment.lower() == "production"
    
    def is_valid_engineer_key(self, provided_key: str) -> bool:
        """
        Check if the provided engineer access key is valid.
        
        Args:
            provided_key: The engineer access key to validate
            
        Returns:
            bool: True if the key is valid and environment is development
        """
        if not self.is_development_mode():
            return False
        
        if not self.engineer_access_key:
            return False
        
        return provided_key == self.engineer_access_key
    
    def __repr__(self) -> str:
        return f"RBACConfig(environment={self.environment})" 