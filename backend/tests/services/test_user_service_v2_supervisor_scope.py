import pytest
from uuid import uuid4
from datetime import datetime, date

from app.database.models.organization import Organization
from app.database.models.user import User, UserSupervisor
from app.security.context import AuthContext, RoleInfo
from app.security.permissions import Permission
from app.services.user_service_v2 import UserServiceV2
from app.schemas.user import UserStatus


@pytest.mark.asyncio
async def test_supervisor_list_users_does_not_leak_same_name_accounts(test_session):
    """
    Regression guard: when multiple users share the same name, a supervisor should only
    see actual subordinates (plus self), not every user with the same name.
    """
    org_id = "org_test_duplicates"
    org = Organization(id=org_id, name="Test Org", slug="test-org")

    supervisor = User(
        id=uuid4(),
        clerk_user_id="clerk_supervisor",
        clerk_organization_id=org_id,
        name="Supervisor User",
        email="supervisor@example.com",
        employee_code="SUP000_TEST",
        status=UserStatus.ACTIVE.value,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    subordinate_expected = User(
        id=uuid4(),
        clerk_user_id="clerk_sub_1",
        clerk_organization_id=org_id,
        name="Silva Isaac",
        email="isaac1@example.com",
        employee_code="TEST0006",
        status=UserStatus.ACTIVE.value,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    same_name_not_subordinate_1 = User(
        id=uuid4(),
        clerk_user_id="clerk_sub_2",
        clerk_organization_id=org_id,
        name="Silva Isaac",
        email="isaac2@example.com",
        employee_code="TEST0002",
        status=UserStatus.ACTIVE.value,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    same_name_not_subordinate_2 = User(
        id=uuid4(),
        clerk_user_id="clerk_sub_3",
        clerk_organization_id=org_id,
        name="Silva Isaac",
        email="isaac3@example.com",
        employee_code="TEST0004",
        status=UserStatus.ACTIVE.value,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    link = UserSupervisor(
        user_id=subordinate_expected.id,
        supervisor_id=supervisor.id,
        valid_from=date.today(),
        valid_to=None,
    )

    test_session.add_all(
        [
            org,
            supervisor,
            subordinate_expected,
            same_name_not_subordinate_1,
            same_name_not_subordinate_2,
            link,
        ]
    )
    await test_session.flush()

    ctx = AuthContext(
        user_id=supervisor.id,
        clerk_user_id=supervisor.clerk_user_id,
        organization_id=org_id,
        roles=[RoleInfo(id=uuid4(), name="supervisor", description="Supervisor")],
        role_permission_overrides={
            "supervisor": {Permission.USER_READ_SUBORDINATES, Permission.USER_READ_SELF}
        },
    )

    service = UserServiceV2(test_session)
    result = await service.list_users(
        ctx,
        page=1,
        limit=50,
        include={"roles"},
        with_count=False,
    )

    returned_employee_codes = {item.employee_code for item in result.payload.items}
    assert returned_employee_codes == {"SUP000_TEST", "TEST0006"}
