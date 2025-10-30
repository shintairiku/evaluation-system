from clerk_backend_api import Clerk
from typing import Dict, Any, Optional, List
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
                'public_metadata': user.public_metadata or {},
                # Best-effort expose membership info if available on SDK object
                'organization_memberships': getattr(user, 'organization_memberships', None)
            }
            
            return user_data
            
        except Exception as e:
            logger.error(f"Failed to get user {clerk_user_id}: {e}")
            return None

    # --- Organization membership helpers ---
    def _get_membership(self, organization_id: str, clerk_user_id: str) -> Optional[Dict[str, Any]]:
        """Fetch the user's organization membership via Clerk SDK."""
        try:
            result = self.clerk.organization_memberships.list(
                organization_id=organization_id,
                user_id=[clerk_user_id],
                limit=10,
            )
            items = getattr(result, 'data', None) or []
            if not items:
                logger.error(
                    "No organization membership found for user %s in org %s",
                    clerk_user_id,
                    organization_id,
                )
                return None
            membership = items[0]
            membership_dict = membership.__dict__ if hasattr(membership, '__dict__') else dict(membership)
            logger.debug(
                "Fetched Clerk membership for user %s in org %s: %s",
                clerk_user_id,
                organization_id,
                {k: membership_dict.get(k) for k in ('id', 'role', 'permissions')},
            )
            return membership_dict
        except Exception as e:
            logger.error(
                "Failed to fetch membership for user %s in org %s: %s",
                clerk_user_id,
                organization_id,
                e,
            )
            return None

    @staticmethod
    def _build_role_candidates(current_role: Optional[str], target: str) -> List[str]:
        candidates: List[str] = []
        prefix = None
        if current_role and ':' in current_role:
            prefix = current_role.split(':', 1)[0]

        if target == 'admin':
            suffixes = ['admin']
            defaults = ['admin', 'org:admin', 'organization:admin', 'super_admin']
        else:
            suffixes = ['member', 'basic_member']
            defaults = ['basic_member', 'member', 'org:member', 'organization:member']

        if prefix:
            for suffix in suffixes:
                candidates.append(f"{prefix}:{suffix}")

        if target == 'member' and current_role:
            candidates.append(current_role)

        for default_role in defaults:
            if default_role not in candidates:
                candidates.append(default_role)

        seen: set[str] = set()
        ordered: List[str] = []
        for role in candidates:
            if role and role not in seen:
                ordered.append(role)
                seen.add(role)
        return ordered

    def set_organization_role(self, organization_id: str, clerk_user_id: str, make_admin: bool) -> bool:
        """Update Clerk organization membership role, adapting to org-specific role naming."""
        membership = self._get_membership(organization_id, clerk_user_id)
        if not membership:
            return False

        current_role = membership.get('role') if isinstance(membership, dict) else None
        target = 'admin' if make_admin else 'member'
        candidates = self._build_role_candidates(current_role, target)

        last_error: Optional[Exception] = None
        for role_value in candidates:
            try:
                self.clerk.organization_memberships.update(
                    organization_id=organization_id,
                    user_id=clerk_user_id,
                    role=role_value,
                )
                logger.info(
                    "Clerk org role updated for user %s in org %s to %s",
                    clerk_user_id,
                    organization_id,
                    role_value,
                )
                return True
            except Exception as e:
                last_error = e
                logger.debug(
                    "Clerk role update attempt failed for user %s in org %s role=%s: %s",
                    clerk_user_id,
                    organization_id,
                    role_value,
                    e,
                )

        logger.error(
            "Unable to update Clerk org role for user %s in org %s (target=%s). Tried roles=%s. Last error=%s",
            clerk_user_id,
            organization_id,
            target,
            candidates,
            last_error,
        )
        return False
