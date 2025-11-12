import pytest
import pytest_asyncio
from uuid import uuid4
from datetime import datetime

from sqlalchemy import create_engine, event, schema
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.session import Base
from app.database.models.permission import Permission as PermissionModel, RolePermission as RolePermissionModel
from app.database.models.user import Role as RoleModel
from app.database.models.organization import Organization
from app.schemas.permission import RolePermissionUpdateRequest
from app.security.context import AuthContext, RoleInfo
from app.security.permissions import Permission as PermissionEnum
from app.services.permission_service import PermissionService


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


ORG_ID = "org_service_test"


def build_admin_context() -> AuthContext:
    return AuthContext(
        user_id=uuid4(),
        organization_id=ORG_ID,
        roles=[RoleInfo(id=uuid4(), name="admin", description="Administrator")],
    )


def build_role(name: str) -> RoleModel:
    now = datetime.utcnow()
    return RoleModel(
        id=uuid4(),
        organization_id=ORG_ID,
        name=name,
        description=f"{name} role",
        hierarchy_order=1,
        created_at=now,
        updated_at=now,
    )


@pytest.mark.asyncio
async def test_get_role_permissions_defaults_when_empty(memory_session):
    role = build_role("admin")
    memory_session.add(role)
    await memory_session.flush()

    service = PermissionService(memory_session)
    context = build_admin_context()

    response = await service.get_role_permissions(role.id, context)

    # With no assignments in DB, a role returns no permissions
    returned_codes = sorted(item.code for item in response.permissions)
    assert returned_codes == []


@pytest.mark.asyncio
async def test_clone_role_permissions_copies_assignments(memory_session):
    source_role = build_role("admin")
    target_role = build_role("viewer")
    target_role.hierarchy_order = 2

    memory_session.add_all([source_role, target_role])
    await memory_session.flush()

    service = PermissionService(memory_session)
    context = build_admin_context()

    desired_codes = [
        PermissionEnum.USER_READ_ALL.value,
        PermissionEnum.GOAL_READ_SELF.value,
        PermissionEnum.EVALUATION_READ.value,
    ]

    await service.replace_role_permissions(
        source_role.id,
        RolePermissionUpdateRequest(permissions=desired_codes),
        context,
    )

    clone_response = await service.clone_role_permissions(
        target_role.id,
        source_role.id,
        context,
    )

    assert sorted(item.code for item in clone_response.permissions) == sorted(desired_codes)

    persisted = await service.get_role_permissions(target_role.id, context)
    assert sorted(item.code for item in persisted.permissions) == sorted(desired_codes)
