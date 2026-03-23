"""
Unit tests for SupportDocumentService.
Uses mocked repositories to test business logic in isolation.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4, UUID
from datetime import datetime

from app.services.support_document_service import SupportDocumentService
from app.schemas.support_document import (
    SupportDocumentCreate,
    SupportDocumentUpdate,
    SupportDocumentResponse,
    SupportDocumentReorderRequest,
    SupportDocumentReorderItem,
)
from app.security.context import AuthContext, RoleInfo
from app.core.exceptions import NotFoundError, PermissionDeniedError, ValidationError
from app.database.models.support_document import SupportDocument


def make_admin_context(org_id: str = "org_test") -> AuthContext:
    admin_role = RoleInfo(id=1, name="admin", description="Administrator")
    return AuthContext(
        user_id=uuid4(),
        roles=[admin_role],
        clerk_user_id="clerk_admin",
        organization_id=org_id,
    )


def make_employee_context(org_id: str = "org_test") -> AuthContext:
    employee_role = RoleInfo(id=4, name="employee", description="Employee")
    return AuthContext(
        user_id=uuid4(),
        roles=[employee_role],
        clerk_user_id="clerk_employee",
        organization_id=org_id,
    )


def make_doc_model(**overrides):
    """Create a mock SupportDocument model instance."""
    defaults = dict(
        id=uuid4(),
        organization_id="org_test",
        title="Test Doc",
        description="A test document",
        document_type="link",
        url="https://example.com",
        file_path=None,
        file_name=None,
        category="general",
        display_order=0,
        is_active=True,
        created_by=uuid4(),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    defaults.update(overrides)
    doc = MagicMock(spec=SupportDocument)
    for k, v in defaults.items():
        setattr(doc, k, v)
    return doc


class TestSupportDocumentService:

    @pytest.fixture
    def mock_session(self):
        session = AsyncMock()
        session.commit = AsyncMock()
        session.rollback = AsyncMock()
        session.refresh = AsyncMock()
        return session

    @pytest.fixture
    def service(self, mock_session):
        return SupportDocumentService(mock_session)

    # ---- list_documents ----

    @pytest.mark.asyncio
    async def test_list_documents(self, service):
        ctx = make_admin_context()
        doc = make_doc_model()
        service.doc_repo.list_by_org = AsyncMock(return_value=[doc])
        service.doc_repo.get_categories = AsyncMock(return_value=["general"])

        result = await service.list_documents(ctx)
        assert len(result.items) == 1
        assert result.categories == ["general"]

    @pytest.mark.asyncio
    async def test_list_documents_no_org_raises(self, service):
        ctx = make_admin_context()
        ctx.organization_id = None
        with pytest.raises(PermissionDeniedError):
            await service.list_documents(ctx)

    @pytest.mark.asyncio
    async def test_list_documents_with_category_filter(self, service):
        ctx = make_admin_context()
        service.doc_repo.list_by_org = AsyncMock(return_value=[])
        service.doc_repo.get_categories = AsyncMock(return_value=[])

        await service.list_documents(ctx, category="hr")
        service.doc_repo.list_by_org.assert_called_once_with(
            ctx.organization_id, category="hr"
        )

    # ---- create_document ----

    @pytest.mark.asyncio
    async def test_create_document_admin(self, service, mock_session):
        ctx = make_admin_context()
        doc = make_doc_model(display_order=0)
        service.doc_repo.get_next_display_order = AsyncMock(return_value=0)
        service.doc_repo.create = AsyncMock(return_value=doc)

        data = SupportDocumentCreate(title="New Link", url="https://example.com")
        result = await service.create_document(data, ctx)

        assert result.title == "Test Doc"
        service.doc_repo.get_next_display_order.assert_called_once_with(
            ctx.organization_id, "general"
        )
        service.doc_repo.create.assert_called_once()
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_document_auto_increments_display_order(self, service, mock_session):
        ctx = make_admin_context()
        doc = make_doc_model(display_order=3)
        service.doc_repo.get_next_display_order = AsyncMock(return_value=3)
        service.doc_repo.create = AsyncMock(return_value=doc)

        data = SupportDocumentCreate(
            title="Third Doc", url="https://example.com", category="evaluation"
        )
        await service.create_document(data, ctx)

        service.doc_repo.get_next_display_order.assert_called_once_with(
            ctx.organization_id, "evaluation"
        )
        # Verify display_order=3 was passed to create
        call_kwargs = service.doc_repo.create.call_args
        assert call_kwargs.kwargs.get("display_order") == 3

    @pytest.mark.asyncio
    async def test_create_document_non_admin_raises(self, service):
        ctx = make_employee_context()
        data = SupportDocumentCreate(title="Sneaky", url="https://example.com")
        with pytest.raises(PermissionDeniedError):
            await service.create_document(data, ctx)

    @pytest.mark.asyncio
    async def test_create_link_without_url_raises(self, service):
        ctx = make_admin_context()
        data = SupportDocumentCreate(title="No URL", document_type="link", url=None)
        with pytest.raises(ValidationError):
            await service.create_document(data, ctx)

    @pytest.mark.asyncio
    async def test_create_document_no_org_raises(self, service):
        ctx = make_admin_context()
        ctx.organization_id = None
        data = SupportDocumentCreate(title="Test", url="https://example.com")
        with pytest.raises(PermissionDeniedError):
            await service.create_document(data, ctx)

    # ---- update_document ----

    @pytest.mark.asyncio
    async def test_update_document_admin(self, service, mock_session):
        ctx = make_admin_context()
        doc = make_doc_model(title="Updated")
        service.doc_repo.update = AsyncMock(return_value=doc)

        data = SupportDocumentUpdate(title="Updated")
        result = await service.update_document(doc.id, data, ctx)

        assert result.title == "Updated"
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_document_not_found(self, service, mock_session):
        ctx = make_admin_context()
        service.doc_repo.update = AsyncMock(return_value=None)

        data = SupportDocumentUpdate(title="Ghost")
        with pytest.raises(NotFoundError):
            await service.update_document(uuid4(), data, ctx)

    @pytest.mark.asyncio
    async def test_update_document_non_admin_raises(self, service):
        ctx = make_employee_context()
        data = SupportDocumentUpdate(title="Hacked")
        with pytest.raises(PermissionDeniedError):
            await service.update_document(uuid4(), data, ctx)

    # ---- delete_document ----

    @pytest.mark.asyncio
    async def test_delete_document_admin(self, service, mock_session):
        ctx = make_admin_context()
        service.doc_repo.delete_doc = AsyncMock(return_value=True)

        result = await service.delete_document(uuid4(), ctx)
        assert result is True
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_document_not_found(self, service, mock_session):
        ctx = make_admin_context()
        service.doc_repo.delete_doc = AsyncMock(return_value=False)

        with pytest.raises(NotFoundError):
            await service.delete_document(uuid4(), ctx)

    @pytest.mark.asyncio
    async def test_delete_document_non_admin_raises(self, service):
        ctx = make_employee_context()
        with pytest.raises(PermissionDeniedError):
            await service.delete_document(uuid4(), ctx)

    # ---- reorder_documents ----

    @pytest.mark.asyncio
    async def test_reorder_documents_admin(self, service, mock_session):
        ctx = make_admin_context()
        service.doc_repo.bulk_reorder = AsyncMock(return_value=2)

        data = SupportDocumentReorderRequest(items=[
            SupportDocumentReorderItem(id=uuid4(), category="general", display_order=0),
            SupportDocumentReorderItem(id=uuid4(), category="general", display_order=1),
        ])
        result = await service.reorder_documents(data, ctx)

        assert result == 2
        service.doc_repo.bulk_reorder.assert_called_once()
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_reorder_documents_non_admin_raises(self, service):
        ctx = make_employee_context()
        data = SupportDocumentReorderRequest(items=[
            SupportDocumentReorderItem(id=uuid4(), category="general", display_order=0),
        ])
        with pytest.raises(PermissionDeniedError):
            await service.reorder_documents(data, ctx)

    @pytest.mark.asyncio
    async def test_reorder_documents_no_org_raises(self, service):
        ctx = make_admin_context()
        ctx.organization_id = None
        data = SupportDocumentReorderRequest(items=[
            SupportDocumentReorderItem(id=uuid4(), category="general", display_order=0),
        ])
        with pytest.raises(PermissionDeniedError):
            await service.reorder_documents(data, ctx)

    @pytest.mark.asyncio
    async def test_reorder_documents_rollback_on_error(self, service, mock_session):
        ctx = make_admin_context()
        service.doc_repo.bulk_reorder = AsyncMock(side_effect=Exception("DB error"))

        data = SupportDocumentReorderRequest(items=[
            SupportDocumentReorderItem(id=uuid4(), category="general", display_order=0),
        ])
        with pytest.raises(Exception):
            await service.reorder_documents(data, ctx)
        mock_session.rollback.assert_called_once()
