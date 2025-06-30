import os
from typing import Optional

class ClerkConfig:
    """Configuration class for Clerk authentication settings."""
    
    def __init__(self):
        """Initialize Clerk configuration from environment variables."""
        self.secret_key = os.environ.get("CLERK_SECRET_KEY")
        self.publishable_key = os.environ.get("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY")
        
        if not self.secret_key:
            raise ValueError("CLERK_SECRET_KEY environment variable is required")
    
    @property
    def is_configured(self) -> bool:
        """Check if Clerk is properly configured."""
        return bool(self.secret_key)


# Global Clerk configuration instance - lazy loaded
_clerk_config: Optional[ClerkConfig] = None

def get_clerk_config() -> ClerkConfig:
    """Get or create the global Clerk configuration instance."""
    global _clerk_config
    if _clerk_config is None:
        _clerk_config = ClerkConfig()
    return _clerk_config

# For backward compatibility with existing code
def get_clerk_secret_key() -> Optional[str]:
    """Get Clerk secret key, returns None if not configured."""
    try:
        return get_clerk_config().secret_key
    except ValueError:
        return None

CLERK_SECRET_KEY = get_clerk_secret_key()