"""
Simplified FastAPI dependencies for authentication and authorization.

This module provides clean, simple dependencies for RBAC without over-engineering.
"""

from typing import List
import logging
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from ..database.session import get_db_session
from ..database.repositories.role_repo import RoleRepository
from ..database.repositories.user_repo import UserRepository
from ..services.auth_service import AuthService
from .permissions import Permission, PermissionManager
from .context import AuthContext, RoleInfo

security = HTTPBearer(
    scheme_name="Bearer",  # Label in OpenAPI docs
    auto_error=False,       # We'll raise detailed errors ourselves
)


async def get_auth_context(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    session: AsyncSession = Depends(get_db_session)
) -> AuthContext:
    """
    Main dependency to get authenticated user's authorization context.
    
    This replaces the complex SecurityContext with a simple, unified approach.
    Use this in any endpoint that needs authentication + authorization.
    
    Returns:
        AuthContext: Complete user auth context with roles and permissions
        
    Raises:
        HTTPException: If authentication fails or user not found
    """
    try:
        # Extract token, tolerating missing credentials (HTTPBearer with auto_error=False)
        if not credentials or not credentials.scheme:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing Authorization header",
            )

        scheme = credentials.scheme.lower()
        if scheme != "bearer":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authorization header must use Bearer scheme",
            )

        token = credentials.credentials
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing Bearer token",
            )
        
        # SECURITY: Only allow development tokens in development environment
        from ..core.config import Settings
        settings = Settings()
        
        # Check for development API keys ONLY in development environment
        if settings.ENVIRONMENT.value == "development":
            dev_keys = {
                "dev-admin-key": {
                    "user_id": "00000000-0000-0000-0000-000000000001",
                    "clerk_user_id": "dev-admin",
                    "roles": [RoleInfo(id=1, name="admin", description="Development admin role")]
                },
                "dev-manager-key": {
                    "user_id": "00000000-0000-0000-0000-000000000002", 
                    "clerk_user_id": "dev-manager",
                    "roles": [RoleInfo(id=2, name="manager", description="Development manager role")]
                },
                "dev-supervisor-key": {
                    "user_id": "00000000-0000-0000-0000-000000000003",
                    "clerk_user_id": "dev-supervisor", 
                    "roles": [RoleInfo(id=3, name="supervisor", description="Development supervisor role")]
                },
                "dev-employee-key": {
                    "user_id": "00000000-0000-0000-0000-000000000004",
                    "clerk_user_id": "dev-employee",
                    "roles": [RoleInfo(id=4, name="employee", description="Development employee role")]
                }
            }
            
            if token in dev_keys:
                from uuid import UUID
                logger = logging.getLogger(__name__)
                # Avoid logging raw tokens to prevent leaking sensitive credentials in logs
                try:
                    token_preview = f"{str(token)[:6]}...{str(token)[-4:]}" if token else "<no-token>"
                except Exception:
                    token_preview = "<redacted>"
                logger.warning(f"🔧 DEVELOPMENT: Using dev token (preview={token_preview}) - NEVER use in production!")
                
                dev_user = dev_keys[token]
                return AuthContext(
                    user_id=UUID(dev_user["user_id"]),
                    clerk_user_id=dev_user["clerk_user_id"],
                    roles=dev_user["roles"],
                    organization_id="dev-org-1",  # Development organization ID
                    organization_slug="dev-organization"
                )
        
        # Verify with Clerk and get user info
        auth_service = AuthService(session)
        auth_user = await auth_service.get_user_from_token(token)
        
        # Check if user exists in our database (use repository directly, not service)
        user_repo = UserRepository(session)
        user_data = await user_repo.check_user_exists_by_clerk_id(auth_user.clerk_id)
        
        if not user_data:
            # User has valid Clerk token but doesn't exist in our database yet (signup case)
            # Derive roles from token to allow org-scoped, role-based access where appropriate
            derived_roles: List[RoleInfo] = []

            # Try new roles array first
            if hasattr(auth_user, "roles") and auth_user.roles:
                logger = logging.getLogger(__name__)
                logger.warning(
                    "User %s not found in DB for org %s; using token-derived roles %s",
                    auth_user.clerk_id,
                    auth_user.organization_id,
                    auth_user.roles,
                )
                derived_roles = [
                    RoleInfo(id=i, name=role.strip().lower(), description="Token-derived role (no DB user)")
                    for i, role in enumerate(auth_user.roles) if role and role.strip()
                ]
            # Fallback to legacy single role field
            elif getattr(auth_user, "role", None):
                logger = logging.getLogger(__name__)
                fallback_role = str(auth_user.role).strip().lower()
                if fallback_role:
                    logger.warning(
                        "User %s not found in DB for org %s; using token-derived legacy role '%s'",
                        auth_user.clerk_id,
                        auth_user.organization_id,
                        fallback_role,
                    )
                    derived_roles = [RoleInfo(id=0, name=fallback_role, description="Token-derived role (no DB user)")]

            return AuthContext(
                user_id=None,  # No user_id yet
                clerk_user_id=auth_user.clerk_id,  # But we have Clerk ID
                roles=derived_roles,
                organization_id=auth_user.organization_id,
                organization_slug=auth_user.organization_slug
            )
        
        user_id = user_data["id"]
        
        # Get user roles
        role_repo = RoleRepository(session)
        user_roles = await role_repo.get_user_roles(user_id, auth_user.organization_id)
        
        # Convert to RoleInfo objects
        role_infos = [
            RoleInfo(id=role.id, name=role.name, description=role.description)
            for role in user_roles
        ]

        # Fallback: if no DB roles found for this org, derive from JWT roles
        if not role_infos:
            logger = logging.getLogger(__name__)

            # Try new roles array first
            if hasattr(auth_user, "roles") and auth_user.roles:
                logger.warning(
                    "No DB roles found for user %s in org %s; falling back to token roles %s",
                    auth_user.clerk_id,
                    auth_user.organization_id,
                    auth_user.roles,
                )
                role_infos = [
                    RoleInfo(id=i, name=role.strip().lower(), description="Token-derived role")
                    for i, role in enumerate(auth_user.roles) if role and role.strip()
                ]
            # Fallback to legacy single role field
            elif getattr(auth_user, "role", None):
                fallback_role = str(auth_user.role).strip().lower()
                if fallback_role:
                    logger.warning(
                        "No DB roles found for user %s in org %s; falling back to token legacy role '%s'",
                        auth_user.clerk_id,
                        auth_user.organization_id,
                        fallback_role,
                    )
                    role_infos = [RoleInfo(id=0, name=fallback_role, description="Token-derived role")]
        else:
            # If roles exist but map to no permissions (e.g., org-custom names), append token roles as safety net
            derived_perm_count = 0
            for r in role_infos:
                derived_perm_count += len(PermissionManager.get_role_permissions(r.name))

            if derived_perm_count == 0:
                logger = logging.getLogger(__name__)

                # Try new roles array first
                if hasattr(auth_user, "roles") and auth_user.roles:
                    for i, role in enumerate(auth_user.roles):
                        if role and role.strip() and all(r.name.lower() != role.strip().lower() for r in role_infos):
                            logger.warning(
                                "DB roles for user %s in org %s have no mapped permissions; adding token role '%s'",
                                auth_user.clerk_id,
                                auth_user.organization_id,
                                role,
                            )
                            role_infos.append(RoleInfo(id=len(role_infos) + i, name=role.strip().lower(), description="Token-derived role"))
                # Fallback to legacy single role field
                elif getattr(auth_user, "role", None):
                    fallback_role = str(auth_user.role).strip().lower()
                    if fallback_role and all(r.name.lower() != fallback_role for r in role_infos):
                        logger.warning(
                            "DB roles for user %s in org %s have no mapped permissions; adding token legacy role '%s'",
                            auth_user.clerk_id,
                            auth_user.organization_id,
                            fallback_role,
                        )
                        role_infos.append(RoleInfo(id=0, name=fallback_role, description="Token-derived role"))
        
        # Create and return AuthContext
        return AuthContext(
            user_id=user_id, 
            clerk_user_id=auth_user.clerk_id, 
            roles=role_infos,
            organization_id=auth_user.organization_id,
            organization_slug=auth_user.organization_slug
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}"
        )


def require_role(required_roles: List[str]):
    """
    Simple dependency factory that requires specific roles.
    
    Usage:
        @router.get("/admin-only")
        async def admin_endpoint(
            auth: AuthContext = Depends(require_role(["admin"]))
        ):
            # Only admins can access this endpoint
            pass
    
    Args:
        required_roles: List of role names required to access the endpoint
        
    Returns:
        FastAPI dependency function that enforces role requirements
    """
    async def check_roles(
        auth_context: AuthContext = Depends(get_auth_context)
    ) -> AuthContext:
        if not auth_context.has_any_role(required_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(required_roles)}"
            )
        return auth_context
    
    return check_roles


def require_permission(required_permissions: List[Permission]):
    """
    Simple dependency factory that requires specific permissions.
    
    Usage:
        @router.get("/user-management")
        async def user_endpoint(
            auth: AuthContext = Depends(require_permission([Permission.USER_READ_ALL]))
        ):
            # Only users with USER_READ_ALL permission can access
            pass
    
    Args:
        required_permissions: List of permissions required to access the endpoint
        
    Returns:
        FastAPI dependency function that enforces permission requirements
    """
    async def check_permissions(
        auth_context: AuthContext = Depends(get_auth_context)
    ) -> AuthContext:
        if not any(auth_context.has_permission(perm) for perm in required_permissions):
            permission_names = [perm.value for perm in required_permissions]
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required permissions: {', '.join(permission_names)}"
            )
        return auth_context
    
    return check_permissions


# Convenience dependencies for common roles
require_admin = require_role(["admin"])
require_manager_or_admin = require_role(["admin", "manager"])
require_supervisor_or_above = require_role(["admin", "manager", "supervisor"])


# Backward compatibility alias
get_security_context = get_auth_context