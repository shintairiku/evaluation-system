"""
Unit tests for support documents API endpoints.
Tests the router functions with mocked service dependencies.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4
from datetime import datetime

from fastapi import HTTPException

from app.api.v1.support_documents import (
    get_support_documents,
    create_support_document,
    update_support_document,
    delete_support_document,
)
from app.schemas.support_document import (
    SupportDocumentCreate,
    SupportDocumentUpdate,
    SupportDocumentResponse,
    SupportDocumentListResponse,
)
from app.security.context import AuthContext, RoleInfo
from app.core.exceptions import NotFoundError, PermissionDeniedError, ValidationError


@pytest.fixture
def admin_context():
    admin_role = RoleInfo(id=1, name="admin", description="Administrator")
    return AuthContext(
        user_id=UUID("00000000-0000-0000-0000-000000000001"),
        roles=[admin_role],
        clerk_user_id="test_admin",
        organization_id="org_test",
    )


@pytest.fixture
def mock_doc_response():
    return SupportDocumentResponse(
        id=UUID("11111111-1111-1111-1111-111111111111"),
        organizationId="org_test",
        title="Test Doc",
        description="A test document",
        documentType="link",
        url="https://example.com",
        filePath=None,
        fileName=None,
        category="general",
        displayOrder=0,
        isActive=True,
        createdBy=UUID("00000000-0000-0000-0000-000000000001"),
        createdAt=datetime.utcnow(),
        updatedAt=datetime.utcnow(),
    )


@pytest.fixture
def mock_list_response(mock_doc_response):
    return SupportDocumentListResponse(
        items=[mock_doc_response],
        categories=["general"],
    )


class TestGetSupportDocuments:

    @pytest.mark.asyncio
    async def test_success(self, admin_context, mock_list_response, monkeypatch):
        mock_service = AsyncMock()
        mock_service.list_documents = AsyncMock(return_value=mock_list_response)
        monkeypatch.setattr(
            "app.api.v1.support_documents.SupportDocumentService",
            lambda session: mock_service,
        )

        result = await get_support_documents(
            category=None, context=admin_context, session=AsyncMock()
        )
        assert len(result.items) == 1
        mock_service.list_documents.assert_called_once_with(admin_context, category=None)

    @pytest.mark.asyncio
    async def test_with_category_filter(self, admin_context, mock_list_response, monkeypatch):
        mock_service = AsyncMock()
        mock_service.list_documents = AsyncMock(return_value=mock_list_response)
        monkeypatch.setattr(
            "app.api.v1.support_documents.SupportDocumentService",
            lambda session: mock_service,
        )

        await get_support_documents(
            category="hr", context=admin_context, session=AsyncMock()
        )
        mock_service.list_documents.assert_called_once_with(admin_context, category="hr")

    @pytest.mark.asyncio
    async def test_permission_denied(self, admin_context, monkeypatch):
        mock_service = AsyncMock()
        mock_service.list_documents = AsyncMock(
            side_effect=PermissionDeniedError("No org")
        )
        monkeypatch.setattr(
            "app.api.v1.support_documents.SupportDocumentService",
            lambda session: mock_service,
        )

        with pytest.raises(HTTPException) as exc_info:
            await get_support_documents(
                category=None, context=admin_context, session=AsyncMock()
            )
        assert exc_info.value.status_code == 403


class TestCreateSupportDocument:

    @pytest.mark.asyncio
    async def test_success(self, admin_context, mock_doc_response, monkeypatch):
        mock_service = AsyncMock()
        mock_service.create_document = AsyncMock(return_value=mock_doc_response)
        monkeypatch.setattr(
            "app.api.v1.support_documents.SupportDocumentService",
            lambda session: mock_service,
        )

        data = SupportDocumentCreate(title="New", url="https://example.com")
        result = await create_support_document(
            data=data, context=admin_context, session=AsyncMock()
        )
        assert result.title == "Test Doc"
        mock_service.create_document.assert_called_once_with(data, admin_context)

    @pytest.mark.asyncio
    async def test_permission_denied(self, admin_context, monkeypatch):
        mock_service = AsyncMock()
        mock_service.create_document = AsyncMock(
            side_effect=PermissionDeniedError("Admin only")
        )
        monkeypatch.setattr(
            "app.api.v1.support_documents.SupportDocumentService",
            lambda session: mock_service,
        )

        data = SupportDocumentCreate(title="New", url="https://example.com")
        with pytest.raises(HTTPException) as exc_info:
            await create_support_document(
                data=data, context=admin_context, session=AsyncMock()
            )
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_validation_error(self, admin_context, monkeypatch):
        mock_service = AsyncMock()
        mock_service.create_document = AsyncMock(
            side_effect=ValidationError("URL required")
        )
        monkeypatch.setattr(
            "app.api.v1.support_documents.SupportDocumentService",
            lambda session: mock_service,
        )

        data = SupportDocumentCreate(title="Bad")
        with pytest.raises(HTTPException) as exc_info:
            await create_support_document(
                data=data, context=admin_context, session=AsyncMock()
            )
        assert exc_info.value.status_code == 422


class TestUpdateSupportDocument:

    @pytest.mark.asyncio
    async def test_success(self, admin_context, mock_doc_response, monkeypatch):
        mock_service = AsyncMock()
        mock_service.update_document = AsyncMock(return_value=mock_doc_response)
        monkeypatch.setattr(
            "app.api.v1.support_documents.SupportDocumentService",
            lambda session: mock_service,
        )

        doc_id = UUID("11111111-1111-1111-1111-111111111111")
        data = SupportDocumentUpdate(title="Updated")
        result = await update_support_document(
            document_id=doc_id, data=data, context=admin_context, session=AsyncMock()
        )
        assert result.title == "Test Doc"
        mock_service.update_document.assert_called_once_with(doc_id, data, admin_context)

    @pytest.mark.asyncio
    async def test_not_found(self, admin_context, monkeypatch):
        mock_service = AsyncMock()
        mock_service.update_document = AsyncMock(
            side_effect=NotFoundError("Not found")
        )
        monkeypatch.setattr(
            "app.api.v1.support_documents.SupportDocumentService",
            lambda session: mock_service,
        )

        data = SupportDocumentUpdate(title="Ghost")
        with pytest.raises(HTTPException) as exc_info:
            await update_support_document(
                document_id=uuid4(), data=data, context=admin_context, session=AsyncMock()
            )
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_permission_denied(self, admin_context, monkeypatch):
        mock_service = AsyncMock()
        mock_service.update_document = AsyncMock(
            side_effect=PermissionDeniedError("Admin only")
        )
        monkeypatch.setattr(
            "app.api.v1.support_documents.SupportDocumentService",
            lambda session: mock_service,
        )

        data = SupportDocumentUpdate(title="Hacked")
        with pytest.raises(HTTPException) as exc_info:
            await update_support_document(
                document_id=uuid4(), data=data, context=admin_context, session=AsyncMock()
            )
        assert exc_info.value.status_code == 403


class TestDeleteSupportDocument:

    @pytest.mark.asyncio
    async def test_success(self, admin_context, monkeypatch):
        mock_service = AsyncMock()
        mock_service.delete_document = AsyncMock(return_value=True)
        monkeypatch.setattr(
            "app.api.v1.support_documents.SupportDocumentService",
            lambda session: mock_service,
        )

        doc_id = UUID("11111111-1111-1111-1111-111111111111")
        result = await delete_support_document(
            document_id=doc_id, context=admin_context, session=AsyncMock()
        )
        assert result.message == "Support document deleted successfully"

    @pytest.mark.asyncio
    async def test_not_found(self, admin_context, monkeypatch):
        mock_service = AsyncMock()
        mock_service.delete_document = AsyncMock(
            side_effect=NotFoundError("Not found")
        )
        monkeypatch.setattr(
            "app.api.v1.support_documents.SupportDocumentService",
            lambda session: mock_service,
        )

        with pytest.raises(HTTPException) as exc_info:
            await delete_support_document(
                document_id=uuid4(), context=admin_context, session=AsyncMock()
            )
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_permission_denied(self, admin_context, monkeypatch):
        mock_service = AsyncMock()
        mock_service.delete_document = AsyncMock(
            side_effect=PermissionDeniedError("Admin only")
        )
        monkeypatch.setattr(
            "app.api.v1.support_documents.SupportDocumentService",
            lambda session: mock_service,
        )

        with pytest.raises(HTTPException) as exc_info:
            await delete_support_document(
                document_id=uuid4(), context=admin_context, session=AsyncMock()
            )
        assert exc_info.value.status_code == 403
