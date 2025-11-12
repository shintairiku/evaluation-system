import pytest
from types import SimpleNamespace
from uuid import uuid4

from app.services.role_service import RoleService
from app.security.context import AuthContext, RoleInfo
from app.security.permissions import Permission
from app.core.exceptions import BadRequestError, NotFoundError


class StubSession:
    def __init__(self):
        self.committed = False
        self.rolled_back = False

    async def commit(self):
        self.committed = True

    async def rollback(self):
        self.rolled_back = True

    async def refresh(self, _obj):
        return None


@pytest.mark.asyncio
async def test_delete_role_raises_when_role_assigned():
    session = StubSession()
    service = RoleService(session)  # type: ignore[arg-type]

    role_id = uuid4()
    org_id = "org-test"
    role = SimpleNamespace(id=role_id, name="custom", organization_id=org_id)

    class StubRoleRepo:
        async def get_by_id(self, target_role_id, organization_id):
            assert target_role_id == role_id
            assert organization_id == org_id
            return role

        async def delete_role(self, _role_id, _org_id):
            pytest.fail("delete_role should not be called when validation fails")

    class StubUserRepo:
        async def count_users_with_role(self, target_role_id, organization_id):
            assert target_role_id == role_id
            assert organization_id == org_id
            return 3

    service.role_repo = StubRoleRepo()  # type: ignore[assignment]
    service.user_repo = StubUserRepo()  # type: ignore[assignment]

    context = AuthContext(
        roles=[RoleInfo(id=uuid4(), name="admin", description="Administrator")],
        organization_id=org_id,
        role_permission_overrides={"admin": {Permission.ROLE_MANAGE}},
    )

    with pytest.raises(BadRequestError):
        await service.delete_role(role_id, context)

    assert session.rolled_back is True
    assert session.committed is False


@pytest.mark.asyncio
async def test_delete_role_success_when_unassigned(monkeypatch):
    session = StubSession()
    service = RoleService(session)  # type: ignore[arg-type]

    role_id = uuid4()
    org_id = "org-test"
    role = SimpleNamespace(id=role_id, name="custom", organization_id=org_id)

    class StubRoleRepo:
        def __init__(self):
            self.deleted = False

        async def get_by_id(self, target_role_id, organization_id):
            assert target_role_id == role_id
            assert organization_id == org_id
            return role

        async def delete_role(self, target_role_id, organization_id):
            assert target_role_id == role_id
            assert organization_id == org_id
            self.deleted = True
            return True

    class StubUserRepo:
        async def count_users_with_role(self, target_role_id, organization_id):
            assert target_role_id == role_id
            assert organization_id == org_id
            return 0

    stub_repo = StubRoleRepo()
    service.role_repo = stub_repo  # type: ignore[assignment]
    service.user_repo = StubUserRepo()  # type: ignore[assignment]

    context = AuthContext(
        roles=[RoleInfo(id=uuid4(), name="admin", description="Administrator")],
        organization_id=org_id,
        role_permission_overrides={"admin": {Permission.ROLE_MANAGE}},
    )

    result = await service.delete_role(role_id, context)

    assert result is True
    assert stub_repo.deleted is True
    assert session.committed is True
    assert session.rolled_back is False


@pytest.mark.asyncio
async def test_delete_role_missing_role():
    session = StubSession()
    service = RoleService(session)  # type: ignore[arg-type]

    class StubRoleRepo:
        async def get_by_id(self, _role_id, _org_id):
            return None

        async def delete_role(self, _role_id, _org_id):
            pytest.fail("delete_role should not run when role is missing")

    service.role_repo = StubRoleRepo()  # type: ignore[assignment]

    context = AuthContext(
        roles=[RoleInfo(id=uuid4(), name="admin", description="Administrator")],
        organization_id="org-test",
        role_permission_overrides={"admin": {Permission.ROLE_MANAGE}},
    )

    with pytest.raises(NotFoundError):
        await service.delete_role(uuid4(), context)

    assert session.rolled_back is True
    assert session.committed is False
