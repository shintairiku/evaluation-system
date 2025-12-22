from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.common import PaginationParams
from app.security.context import AuthContext, RoleInfo
from app.security.permissions import Permission
from app.services.goal_service import GoalService


@pytest.mark.asyncio
async def test_get_goals_no_access_returns_empty_without_queries():
    session = AsyncMock(spec=AsyncSession)
    service = GoalService(session)

    context = MagicMock()
    context.organization_id = "org_test"

    service._get_accessible_goal_user_ids = AsyncMock(return_value=[])
    service.goal_repo.search_goals = AsyncMock()
    service.goal_repo.count_goals = AsyncMock()

    result = await service.get_goals(
        current_user_context=context,
        pagination=PaginationParams(page=1, limit=25),
    )

    assert result.total == 0
    assert result.items == []
    assert service.goal_repo.search_goals.await_count == 0
    assert service.goal_repo.count_goals.await_count == 0


@pytest.mark.asyncio
async def test_accessible_goal_user_ids_include_self_for_manage_self():
    session = AsyncMock(spec=AsyncSession)
    service = GoalService(session)

    user_id = uuid4()
    context = AuthContext(
        user_id=user_id,
        roles=[RoleInfo(id=1, name="employee", description="Employee role")],
        organization_id="org_test",
        role_permission_overrides={"employee": {Permission.GOAL_MANAGE_SELF}},
    )

    accessible = await service._get_accessible_goal_user_ids(context)

    assert accessible == [user_id]

