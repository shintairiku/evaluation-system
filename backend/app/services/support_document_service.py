from __future__ import annotations
import logging
from typing import Optional
from uuid import UUID

from ..database.repositories.support_document_repo import SupportDocumentRepository
from ..schemas.support_document import (
    SupportDocumentCreate,
    SupportDocumentUpdate,
    SupportDocumentResponse,
    SupportDocumentListResponse,
    SupportDocumentReorderRequest,
)
from ..security.context import AuthContext
from ..core.exceptions import NotFoundError, PermissionDeniedError, ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class SupportDocumentService:
    """Service layer for support document operations."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.doc_repo = SupportDocumentRepository(session)

    def _require_admin(self, context: AuthContext) -> None:
        if not context.is_admin():
            raise PermissionDeniedError("Only admins can manage support documents")

    async def list_documents(
        self,
        current_user_context: AuthContext,
        category: Optional[str] = None,
    ) -> SupportDocumentListResponse:
        """List documents for the current user's organization + system docs."""
        if not current_user_context.organization_id:
            raise PermissionDeniedError("User has no organization assigned")

        org_id = current_user_context.organization_id

        docs = await self.doc_repo.list_by_org(org_id, category=category)
        categories = await self.doc_repo.get_categories(org_id)

        items = [SupportDocumentResponse.model_validate(doc) for doc in docs]

        return SupportDocumentListResponse(items=items, categories=categories)

    async def create_document(
        self,
        data: SupportDocumentCreate,
        current_user_context: AuthContext,
    ) -> SupportDocumentResponse:
        """Create a new support document (admin only)."""
        self._require_admin(current_user_context)

        if not current_user_context.organization_id:
            raise PermissionDeniedError("User has no organization assigned")

        # Validate: link type requires url
        if data.document_type == "link" and not data.url:
            raise ValidationError("URL is required for link-type documents")

        try:
            # Auto-increment display_order within org + category
            next_order = await self.doc_repo.get_next_display_order(
                current_user_context.organization_id, data.category
            )

            doc = await self.doc_repo.create(
                org_id=current_user_context.organization_id,
                title=data.title,
                description=data.description,
                document_type=data.document_type,
                url=data.url,
                category=data.category,
                created_by=current_user_context.user_id,
                display_order=next_order,
            )

            await self.session.commit()
            await self.session.refresh(doc)

            return SupportDocumentResponse.model_validate(doc)
        except Exception:
            await self.session.rollback()
            raise

    async def update_document(
        self,
        document_id: UUID,
        data: SupportDocumentUpdate,
        current_user_context: AuthContext,
    ) -> SupportDocumentResponse:
        """Update a support document (admin only)."""
        self._require_admin(current_user_context)

        if not current_user_context.organization_id:
            raise PermissionDeniedError("User has no organization assigned")

        try:
            update_data = data.model_dump(exclude_unset=True, by_alias=False)
            doc = await self.doc_repo.update(
                doc_id=document_id,
                org_id=current_user_context.organization_id,
                **update_data,
            )

            if not doc:
                raise NotFoundError(f"Support document with ID {document_id} not found")

            await self.session.commit()
            await self.session.refresh(doc)

            return SupportDocumentResponse.model_validate(doc)
        except (NotFoundError, PermissionDeniedError):
            raise
        except Exception:
            await self.session.rollback()
            raise

    async def delete_document(
        self,
        document_id: UUID,
        current_user_context: AuthContext,
    ) -> bool:
        """Delete a support document (admin only)."""
        self._require_admin(current_user_context)

        if not current_user_context.organization_id:
            raise PermissionDeniedError("User has no organization assigned")

        try:
            deleted = await self.doc_repo.delete_doc(document_id, current_user_context.organization_id)

            if not deleted:
                raise NotFoundError(f"Support document with ID {document_id} not found")

            await self.session.commit()
            return True
        except (NotFoundError, PermissionDeniedError):
            raise
        except Exception:
            await self.session.rollback()
            raise

    async def reorder_documents(
        self,
        data: SupportDocumentReorderRequest,
        current_user_context: AuthContext,
    ) -> int:
        """Reorder support documents (admin only). Returns count of updated docs."""
        self._require_admin(current_user_context)

        if not current_user_context.organization_id:
            raise PermissionDeniedError("User has no organization assigned")

        try:
            items = [
                {
                    "id": item.id,
                    "category": item.category,
                    "display_order": item.display_order,
                }
                for item in data.items
            ]
            updated = await self.doc_repo.bulk_reorder(
                current_user_context.organization_id, items
            )
            await self.session.commit()
            return updated
        except Exception:
            await self.session.rollback()
            raise
