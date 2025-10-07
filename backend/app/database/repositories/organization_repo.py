import logging
from typing import Optional, List
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError

from ..models.organization import Organization

logger = logging.getLogger(__name__)

class OrganizationRepository:
    """Repository for organization operations."""
    
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, organization_id: str) -> Optional[Organization]:
        """Get organization by Clerk organization ID."""
        try:
            result = await self.session.execute(
                select(Organization).filter(Organization.id == organization_id)
            )
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching organization by ID {organization_id}: {e}")
            raise

    async def get_by_slug(self, slug: str) -> Optional[Organization]:
        """Get organization by slug."""
        try:
            result = await self.session.execute(
                select(Organization).filter(Organization.slug == slug)
            )
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching organization by slug {slug}: {e}")
            raise

    async def get_all(self) -> List[Organization]:
        """Get all organizations."""
        try:
            result = await self.session.execute(select(Organization))
            return result.scalars().all()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching all organizations: {e}")
            raise

    async def create_organization(self, org_data: dict) -> Organization:
        """Create a new organization."""
        try:
            organization = Organization(
                id=org_data["id"],
                name=org_data["name"],
                slug=org_data.get("slug")
            )
            
            self.session.add(organization)
            await self.session.flush()
            
            logger.info(f"Organization created: {organization.id}")
            return organization
        except SQLAlchemyError as e:
            logger.error(f"Error creating organization: {e}")
            raise

    async def update_organization(self, organization_id: str, org_data: dict) -> Optional[Organization]:
        """Update an organization."""
        try:
            organization = await self.get_by_id(organization_id)
            if not organization:
                return None
            
            if "name" in org_data:
                organization.name = org_data["name"]
            if "slug" in org_data:
                organization.slug = org_data["slug"]
            
            self.session.add(organization)
            await self.session.flush()
            
            logger.info(f"Organization updated: {organization_id}")
            return organization
        except SQLAlchemyError as e:
            logger.error(f"Error updating organization {organization_id}: {e}")
            raise

    async def delete_organization(self, organization_id: str) -> bool:
        """Delete an organization."""
        try:
            result = await self.session.execute(
                delete(Organization).where(Organization.id == organization_id)
            )
            
            if result.rowcount > 0:
                logger.info(f"Organization deleted: {organization_id}")
                return True
            return False
        except SQLAlchemyError as e:
            logger.error(f"Error deleting organization {organization_id}: {e}")
            raise