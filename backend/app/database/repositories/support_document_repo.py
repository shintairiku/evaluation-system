import logging
from typing import Optional, List
from uuid import UUID

from sqlalchemy import select, delete, func, or_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.support_document import SupportDocument
from .base import BaseRepository

logger = logging.getLogger(__name__)


class SupportDocumentRepository(BaseRepository[SupportDocument]):

    def __init__(self, session: AsyncSession):
        super().__init__(session, SupportDocument)

    # ========================================
    # READ OPERATIONS
    # ========================================

    async def list_by_org(
        self,
        org_id: str,
        category: Optional[str] = None,
        include_system: bool = True,
        active_only: bool = True,
    ) -> List[SupportDocument]:
        """
        List documents for an organization, optionally including system-wide docs.
        Returns org-specific docs + system docs (organization_id IS NULL).
        """
        try:
            query = select(SupportDocument)

            # Org scoping: org docs + optionally system-wide docs
            if include_system:
                query = query.where(
                    or_(
                        SupportDocument.organization_id == org_id,
                        SupportDocument.organization_id.is_(None),
                    )
                )
            else:
                query = self.apply_org_scope_direct(query, SupportDocument.organization_id, org_id)

            if category:
                query = query.where(SupportDocument.category == category)

            if active_only:
                query = query.where(SupportDocument.is_active.is_(True))

            query = query.order_by(
                SupportDocument.category,
                SupportDocument.display_order,
                SupportDocument.title,
            )

            result = await self.session.execute(query)
            return list(result.scalars().all())
        except SQLAlchemyError as e:
            logger.error(f"Error listing support documents for org {org_id}: {e}")
            raise

    async def get_by_id(self, doc_id: UUID, org_id: str) -> Optional[SupportDocument]:
        """Get a document by ID, scoped to org or system-wide."""
        try:
            query = select(SupportDocument).where(
                SupportDocument.id == doc_id,
                or_(
                    SupportDocument.organization_id == org_id,
                    SupportDocument.organization_id.is_(None),
                ),
            )
            result = await self.session.execute(query)
            return result.scalars().first()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching support document {doc_id} in org {org_id}: {e}")
            raise

    async def get_categories(self, org_id: str) -> List[str]:
        """Get distinct categories for an organization (including system docs)."""
        try:
            query = (
                select(func.distinct(SupportDocument.category))
                .where(
                    or_(
                        SupportDocument.organization_id == org_id,
                        SupportDocument.organization_id.is_(None),
                    ),
                    SupportDocument.is_active.is_(True),
                )
                .order_by(SupportDocument.category)
            )
            result = await self.session.execute(query)
            return [row[0] for row in result.all()]
        except SQLAlchemyError as e:
            logger.error(f"Error fetching categories for org {org_id}: {e}")
            raise

    # ========================================
    # CREATE OPERATIONS
    # ========================================

    async def create(
        self,
        org_id: Optional[str],
        title: str,
        description: Optional[str],
        document_type: str,
        url: Optional[str],
        category: str,
        display_order: int,
        created_by: UUID,
    ) -> SupportDocument:
        """Create a new support document. Does not commit."""
        try:
            doc = SupportDocument(
                organization_id=org_id,
                title=title,
                description=description,
                document_type=document_type,
                url=url,
                category=category,
                display_order=display_order,
                created_by=created_by,
            )
            self.session.add(doc)
            return doc
        except SQLAlchemyError as e:
            logger.error(f"Error creating support document: {e}")
            raise

    # ========================================
    # UPDATE OPERATIONS
    # ========================================

    async def update(
        self,
        doc_id: UUID,
        org_id: str,
        **kwargs,
    ) -> Optional[SupportDocument]:
        """Update a support document. Does not commit."""
        try:
            doc = await self.get_by_id(doc_id, org_id)
            if not doc:
                return None

            # Only allow editing org-scoped docs (not system-wide)
            if doc.organization_id is None:
                return None

            for key, value in kwargs.items():
                if value is not None and hasattr(doc, key):
                    setattr(doc, key, value)

            self.session.add(doc)
            return doc
        except SQLAlchemyError as e:
            logger.error(f"Error updating support document {doc_id}: {e}")
            raise

    # ========================================
    # DELETE OPERATIONS
    # ========================================

    async def delete_doc(self, doc_id: UUID, org_id: str) -> bool:
        """Delete a support document. Only org-scoped docs can be deleted. Does not commit."""
        try:
            # Verify doc exists and belongs to this org (not system-wide)
            doc = await self.get_by_id(doc_id, org_id)
            if not doc or doc.organization_id is None:
                return False

            stmt = delete(SupportDocument).where(SupportDocument.id == doc_id).returning(SupportDocument.id)
            result = await self.session.execute(stmt)
            return result.scalar_one_or_none() is not None
        except SQLAlchemyError as e:
            logger.error(f"Error deleting support document {doc_id}: {e}")
            raise
