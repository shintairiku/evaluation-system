from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import logging

from ..security import AuthContext, get_auth_context
from ..database.session import get_db_session
from ..database.repositories.organization_repo import OrganizationRepository
from ..core.config import settings

logger = logging.getLogger(__name__)

class OrganizationContext:
    """Context object containing organization information for the current request."""
    
    def __init__(self, organization_id: str, organization_slug: str):
        self.organization_id = organization_id
        self.organization_slug = organization_slug

async def require_org_access(
    org_slug: str,
    auth_context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
) -> OrganizationContext:
    """
    Middleware to validate organization access based on URL slug and JWT claims.
    
    Args:
        org_slug: Organization slug from URL path
        auth_context: Authenticated user context from JWT
        session: Database session for org_id -> slug resolution
        
    Returns:
        OrganizationContext: Organization context for the request
        
    Raises:
        HTTPException: 403 if user is not a member of the organization
        HTTPException: 404 if organization not found
    """
    # Check if organization features are enabled
    if not settings.CLERK_ORGANIZATION_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Organization features are not enabled"
        )
    
    # Ensure user has organization context
    if not auth_context.organization_id:
        logger.warning(f"User {auth_context.user_id} attempted to access org route without organization membership")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: User is not a member of any organization"
        )
    
    # Get organization slug from auth context (normalized claims)
    token_org_slug = getattr(auth_context, 'organization_slug', None)
    
    # If we have a direct slug match, we're good
    if token_org_slug and token_org_slug == org_slug:
        logger.debug(f"Organization slug match: {org_slug}")
        return OrganizationContext(
            organization_id=auth_context.organization_id,
            organization_slug=org_slug
        )
    
    # If no direct slug match, resolve organization_id to slug via database
    try:
        org_repo = OrganizationRepository(session)
        organization = await org_repo.get_by_id(auth_context.organization_id)
        
        if not organization:
            logger.error(f"Organization {auth_context.organization_id} not found in database")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organization not found"
            )
        
        # Check if the resolved slug matches the URL slug
        if organization.slug != org_slug:
            logger.warning(
                f"Organization slug mismatch: user org={organization.slug}, "
                f"requested org={org_slug}, user_id={auth_context.user_id}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: User is not a member of the requested organization"
            )
        
        logger.info(f"Organization access granted: user={auth_context.user_id}, org={org_slug}")
        return OrganizationContext(
            organization_id=auth_context.organization_id,
            organization_slug=org_slug
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during organization access validation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error validating organization access"
        )