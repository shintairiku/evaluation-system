from clerk_backend_api import Clerk
from typing import Dict, Any, Optional
import os
import logging

logger = logging.getLogger(__name__)

class ClerkService:
    def __init__(self):
        self.clerk = Clerk(
            bearer_auth=os.getenv("CLERK_SECRET_KEY")
        )
        
    
    def update_user_metadata(self, clerk_user_id: str, metadata: Dict[str, Any]) -> bool:
        """Update user's publicMetadata (SYNCHRONOUS - NOT ASYNC)"""
        try:
            result = self.clerk.users.update_metadata(
                user_id=clerk_user_id,
                public_metadata=metadata
            )
            return True
            
        except Exception as e:
            logger.error(f"Failed to update metadata for {clerk_user_id}: {e}")
            return False
    
    def get_user_metadata(self, clerk_user_id: str) -> Optional[Dict[str, Any]]:
        """Get user's publicMetadata (SYNCHRONOUS - NOT ASYNC)"""
        try:
            user = self.clerk.users.get(user_id=clerk_user_id)
            metadata = user.public_metadata or {}
            return metadata
            
        except Exception as e:
            logger.error(f"Failed to get metadata for {clerk_user_id}: {e}")
            return None
    
    def get_user_by_id(self, clerk_user_id: str) -> Optional[Dict[str, Any]]:
        """Get user by clerk_user_id (SYNCHRONOUS - NOT ASYNC)"""
        try:
            user = self.clerk.users.get(user_id=clerk_user_id)
            
            user_data = {
                'id': user.id,
                'email': user.email_addresses[0].email_address if user.email_addresses else None,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'public_metadata': user.public_metadata or {}
            }
            
            return user_data
            
        except Exception as e:
            logger.error(f"Failed to get user {clerk_user_id}: {e}")
            return None