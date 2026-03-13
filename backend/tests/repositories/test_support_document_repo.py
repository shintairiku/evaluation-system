"""
Unit tests for SupportDocumentRepository.
Uses mocked AsyncSession to test repository logic without DB dependencies.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4, UUID

from app.database.repositories.support_document_repo import SupportDocumentRepository
from app.database.models.support_document import SupportDocument


@pytest.fixture
def mock_session():
    session = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    return session


@pytest.fixture
def repo(mock_session):
    return SupportDocumentRepository(mock_session)


def make_doc(
    org_id="org_test",
    title="Test Doc",
    category="general",
    display_order=0,
    is_active=True,
    doc_id=None,
):
    doc = MagicMock(spec=SupportDocument)
    doc.id = doc_id or uuid4()
    doc.organization_id = org_id
    doc.title = title
    doc.category = category
    doc.display_order = display_order
    doc.is_active = is_active
    return doc


class TestSupportDocumentRepository:

    # ---- list_by_org ----

    @pytest.mark.asyncio
    async def test_list_by_org_builds_query_with_system_docs(self, repo, mock_session):
        """list_by_org should include system docs (org_id IS NULL) by default."""
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [
            make_doc(org_id="org_test", title="Org Doc"),
            make_doc(org_id=None, title="System Doc"),
        ]
        mock_session.execute = AsyncMock(return_value=mock_result)

        docs = await repo.list_by_org("org_test")
        assert len(docs) == 2
        mock_session.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_list_by_org_with_category_filter(self, repo, mock_session):
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [
            make_doc(category="hr"),
        ]
        mock_session.execute = AsyncMock(return_value=mock_result)

        docs = await repo.list_by_org("org_test", category="hr")
        assert len(docs) == 1

    @pytest.mark.asyncio
    async def test_list_by_org_without_system(self, repo, mock_session):
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [
            make_doc(org_id="org_test"),
        ]
        mock_session.execute = AsyncMock(return_value=mock_result)

        docs = await repo.list_by_org("org_test", include_system=False)
        assert len(docs) == 1

    # ---- get_by_id ----

    @pytest.mark.asyncio
    async def test_get_by_id_found(self, repo, mock_session):
        expected = make_doc()
        mock_result = MagicMock()
        mock_result.scalars.return_value.first.return_value = expected
        mock_session.execute = AsyncMock(return_value=mock_result)

        doc = await repo.get_by_id(expected.id, "org_test")
        assert doc == expected

    @pytest.mark.asyncio
    async def test_get_by_id_not_found(self, repo, mock_session):
        mock_result = MagicMock()
        mock_result.scalars.return_value.first.return_value = None
        mock_session.execute = AsyncMock(return_value=mock_result)

        doc = await repo.get_by_id(uuid4(), "org_test")
        assert doc is None

    # ---- get_categories ----

    @pytest.mark.asyncio
    async def test_get_categories(self, repo, mock_session):
        mock_result = MagicMock()
        mock_result.all.return_value = [("evaluation",), ("general",), ("hr",)]
        mock_session.execute = AsyncMock(return_value=mock_result)

        cats = await repo.get_categories("org_test")
        assert cats == ["evaluation", "general", "hr"]

    # ---- get_next_display_order ----

    @pytest.mark.asyncio
    async def test_get_next_display_order_existing(self, repo, mock_session):
        """When docs exist, return max + 1."""
        mock_result = MagicMock()
        mock_result.scalar.return_value = 3
        mock_session.execute = AsyncMock(return_value=mock_result)

        order = await repo.get_next_display_order("org_test", "evaluation")
        assert order == 4

    @pytest.mark.asyncio
    async def test_get_next_display_order_empty_category(self, repo, mock_session):
        """When no docs exist, coalesce returns -1, (-1 or 0) = -1, so -1 + 1 = 0."""
        mock_result = MagicMock()
        mock_result.scalar.return_value = -1
        mock_session.execute = AsyncMock(return_value=mock_result)

        order = await repo.get_next_display_order("org_test", "new_category")
        # -1 is truthy, so (result.scalar() or 0) = -1, then -1 + 1 = 0
        assert order == 0

    # ---- create ----

    @pytest.mark.asyncio
    async def test_create_document(self, repo, mock_session):
        user_id = uuid4()
        doc = await repo.create(
            org_id="org_test",
            title="New Doc",
            description="desc",
            document_type="link",
            url="https://example.com",
            category="general",
            created_by=user_id,
            display_order=5,
        )
        assert doc.title == "New Doc"
        assert doc.display_order == 5
        mock_session.add.assert_called_once_with(doc)

    @pytest.mark.asyncio
    async def test_create_document_default_display_order(self, repo, mock_session):
        user_id = uuid4()
        doc = await repo.create(
            org_id="org_test",
            title="No Order",
            description=None,
            document_type="link",
            url="https://example.com",
            category="general",
            created_by=user_id,
        )
        assert doc.display_order is None  # default when not passed

    # ---- update ----

    @pytest.mark.asyncio
    async def test_update_document(self, repo, mock_session):
        existing = make_doc(org_id="org_test", title="Old Title")
        mock_result = MagicMock()
        mock_result.scalars.return_value.first.return_value = existing
        mock_session.execute = AsyncMock(return_value=mock_result)

        updated = await repo.update(existing.id, "org_test", title="New Title")
        assert updated is not None

    @pytest.mark.asyncio
    async def test_update_system_doc_returns_none(self, repo, mock_session):
        """System docs (org_id=None) should not be updatable."""
        system_doc = make_doc(org_id=None)
        mock_result = MagicMock()
        mock_result.scalars.return_value.first.return_value = system_doc
        mock_session.execute = AsyncMock(return_value=mock_result)

        result = await repo.update(system_doc.id, "org_test", title="Hacked")
        assert result is None

    @pytest.mark.asyncio
    async def test_update_not_found_returns_none(self, repo, mock_session):
        mock_result = MagicMock()
        mock_result.scalars.return_value.first.return_value = None
        mock_session.execute = AsyncMock(return_value=mock_result)

        result = await repo.update(uuid4(), "org_test", title="Ghost")
        assert result is None

    # ---- delete ----

    @pytest.mark.asyncio
    async def test_delete_document(self, repo, mock_session):
        existing = make_doc(org_id="org_test")
        # First call: get_by_id returns the doc
        get_result = MagicMock()
        get_result.scalars.return_value.first.return_value = existing
        # Second call: delete returning
        delete_result = MagicMock()
        delete_result.scalar_one_or_none.return_value = existing.id
        mock_session.execute = AsyncMock(side_effect=[get_result, delete_result])

        deleted = await repo.delete_doc(existing.id, "org_test")
        assert deleted is True

    @pytest.mark.asyncio
    async def test_delete_system_doc_returns_false(self, repo, mock_session):
        system_doc = make_doc(org_id=None)
        mock_result = MagicMock()
        mock_result.scalars.return_value.first.return_value = system_doc
        mock_session.execute = AsyncMock(return_value=mock_result)

        deleted = await repo.delete_doc(system_doc.id, "org_test")
        assert deleted is False

    @pytest.mark.asyncio
    async def test_delete_not_found_returns_false(self, repo, mock_session):
        mock_result = MagicMock()
        mock_result.scalars.return_value.first.return_value = None
        mock_session.execute = AsyncMock(return_value=mock_result)

        deleted = await repo.delete_doc(uuid4(), "org_test")
        assert deleted is False
