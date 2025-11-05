import pytest
import pytest_asyncio
from datetime import datetime
from uuid import uuid4

from sqlalchemy import create_engine, event, schema
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.session import Base
from app.database.models.permission import Permission as PermissionModel, RolePermission as RolePermissionModel
from app.database.models.user import Role as RoleModel
from app.database.models.organization import Organization
from app.database.repositories.permission_repo import (
    PermissionRepository,
    RolePermissionRepository,
)


@event.listens_for(PermissionModel, "before_insert", propagate=True)
def _assign_permission_uuid(mapper, connection, target):
    if getattr(target, "id", None) is None:
        target.id = uuid4()


@event.listens_for(RolePermissionModel, "before_insert", propagate=True)
def _assign_role_permission_uuid(mapper, connection, target):
    if getattr(target, "id", None) is None:
        target.id = uuid4()


class AsyncSessionStub:
    def __init__(self, session):
        self._session = session

    def add(self, obj):
        self._session.add(obj)

    def add_all(self, objs):
        self._session.add_all(objs)

    async def execute(self, statement):
        return self._session.execute(statement)

    async def flush(self):
        self._session.flush()

    async def commit(self):
        self._session.commit()

    async def rollback(self):
        self._session.rollback()

    async def close(self):
        self._session.close()


@pytest_asyncio.fixture
async def memory_session():
    engine = create_engine(
        "sqlite:///:memory:",
        future=True,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SessionLocal = sessionmaker(bind=engine, future=True)

    original_defaults = {
        PermissionModel.__table__.c.id: (
            PermissionModel.__table__.c.id.server_default,
            PermissionModel.__table__.c.id.default,
        ),
        RolePermissionModel.__table__.c.id: (
            RolePermissionModel.__table__.c.id.server_default,
            RolePermissionModel.__table__.c.id.default,
        ),
        RoleModel.__table__.c.id: (
            RoleModel.__table__.c.id.server_default,
            RoleModel.__table__.c.id.default,
        ),
    }

    try:
        for column in original_defaults:
            column.server_default = None

        # Create only the tables required for these tests
        Organization.__table__.create(engine)
        RoleModel.__table__.create(engine)
        PermissionModel.__table__.create(engine)
        RolePermissionModel.__table__.create(engine)

        for column in original_defaults:
            column.default = schema.ColumnDefault(lambda: uuid4())
    finally:
        for column, defaults in original_defaults.items():
            server_default, python_default = defaults
            column.server_default = server_default
            column.default = python_default

    sync_session = SessionLocal()
    async_session = AsyncSessionStub(sync_session)

    try:
        yield async_session
    finally:
        await async_session.close()
        engine.dispose()


ORG_ID = "org_repo_test"


@pytest.mark.asyncio
async def test_ensure_permission_codes_idempotent(memory_session):
    repo = PermissionRepository(memory_session)
    catalog = [
        ("user:read:all", "Read all users"),
        ("goal:read:self", "Read own goals"),
    ]

    permissions, created = await repo.ensure_permission_codes(catalog)
    await memory_session.commit()

    assert created is True
    assert {perm.code for perm in permissions} >= {code for code, _ in catalog}

    # Second call should be idempotent
    _, created_second = await repo.ensure_permission_codes(catalog)
    assert created_second is False


@pytest.mark.asyncio
async def test_replace_role_permissions_persists_assignments(memory_session):
    permission_repo = PermissionRepository(memory_session)
    role_permission_repo = RolePermissionRepository(memory_session)

    role = RoleModel(
        id=uuid4(),
        organization_id=ORG_ID,
        name="custom",
        description="Custom role",
        hierarchy_order=1,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    memory_session.add(role)

    catalog = [
        ("user:read:all", "Read all users"),
        ("goal:read:self", "Read own goals"),
    ]
    permissions, _ = await permission_repo.ensure_permission_codes(catalog)
    await memory_session.flush()

    await role_permission_repo.replace_role_permissions(role, ORG_ID, permissions[:1])
    await memory_session.commit()

    assigned = await permission_repo.list_for_role(role.id, ORG_ID)
    assert [perm.code for perm in assigned] == [permissions[0].code]


@pytest.mark.asyncio
async def test_get_by_codes_preserves_request_order(memory_session):
    repo = PermissionRepository(memory_session)
    catalog = [
        ("goal:manage", "Manage all goals"),
        ("user:manage", "Manage users"),
        ("evaluation:read", "Read evaluations"),
    ]

    await repo.ensure_permission_codes(catalog)
    await memory_session.commit()

    requested_order = ["evaluation:read", "goal:manage", "user:manage"]
    permissions = await repo.get_by_codes(requested_order)
    assert [perm.code for perm in permissions] == requested_order
