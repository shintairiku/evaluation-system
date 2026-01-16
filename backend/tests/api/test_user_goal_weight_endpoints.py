"""
Unit tests for user goal weight override API endpoints.
"""
import pytest
from unittest.mock import AsyncMock
from uuid import UUID
from fastapi import HTTPException

from app.schemas.user import (
    UserGoalWeightUpdate,
    UserDetailResponse,
    UserStatus,
    UserGoalWeightHistoryEntry,
    GoalWeightBudget,
)
from app.security.context import AuthContext, RoleInfo
from app.core.exceptions import NotFoundError, ValidationError


class TestUserGoalWeightEndpoints:
    @pytest.fixture
    def admin_context(self):
        admin_role = RoleInfo(id=1, name="admin", description="Administrator")
        return AuthContext(
            user_id=UUID("00000000-0000-0000-0000-000000000001"),
            roles=[admin_role],
            clerk_user_id="test_admin_clerk_id",
        )

    @pytest.fixture
    def mock_user_detail_response(self):
        return UserDetailResponse(
            id=UUID("12345678-1234-1234-1234-123456789abc"),
            clerk_user_id="test_clerk_id",
            employee_code="EMP001",
            name="Test User",
            email="test@example.com",
            status=UserStatus.ACTIVE,
            job_title="Software Engineer",
            department=None,
            stage=None,
            roles=[],
            supervisor=None,
            subordinates=None,
        )

    @pytest.mark.asyncio
    async def test_update_user_goal_weights_success(self, admin_context, mock_user_detail_response, monkeypatch):
        user_id = UUID("12345678-1234-1234-1234-123456789abc")
        payload = UserGoalWeightUpdate(
            quantitativeWeight=70,
            qualitativeWeight=20,
            competencyWeight=10,
        )

        mock_service = AsyncMock()
        mock_service.set_user_goal_weight_override = AsyncMock(return_value=mock_user_detail_response)

        async def mock_get_db_session():
            yield AsyncMock()

        monkeypatch.setattr("app.api.v1.users.UserService", lambda session: mock_service)
        monkeypatch.setattr("app.api.v1.users.get_db_session", mock_get_db_session)

        from app.api.v1.users import update_user_goal_weights

        result = await update_user_goal_weights(
            user_id=user_id,
            weight_update=payload,
            context=admin_context,
            session=AsyncMock(),
        )

        mock_service.set_user_goal_weight_override.assert_called_once_with(user_id, payload, admin_context)
        assert result == mock_user_detail_response

    @pytest.mark.asyncio
    async def test_update_user_goal_weights_not_found(self, admin_context, monkeypatch):
        user_id = UUID("00000000-0000-0000-0000-000000000000")
        payload = UserGoalWeightUpdate(
            quantitativeWeight=70,
            qualitativeWeight=20,
            competencyWeight=10,
        )

        mock_service = AsyncMock()
        mock_service.set_user_goal_weight_override = AsyncMock(
            side_effect=NotFoundError("User not found")
        )

        async def mock_get_db_session():
            yield AsyncMock()

        monkeypatch.setattr("app.api.v1.users.UserService", lambda session: mock_service)
        monkeypatch.setattr("app.api.v1.users.get_db_session", mock_get_db_session)

        from app.api.v1.users import update_user_goal_weights

        with pytest.raises(HTTPException) as exc_info:
            await update_user_goal_weights(
                user_id=user_id,
                weight_update=payload,
                context=admin_context,
                session=AsyncMock(),
            )

        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_update_user_goal_weights_validation_error(self, admin_context, monkeypatch):
        user_id = UUID("12345678-1234-1234-1234-123456789abc")
        payload = UserGoalWeightUpdate(
            quantitativeWeight=70,
            qualitativeWeight=20,
            competencyWeight=10,
        )

        mock_service = AsyncMock()
        mock_service.set_user_goal_weight_override = AsyncMock(
            side_effect=ValidationError("Invalid weights")
        )

        async def mock_get_db_session():
            yield AsyncMock()

        monkeypatch.setattr("app.api.v1.users.UserService", lambda session: mock_service)
        monkeypatch.setattr("app.api.v1.users.get_db_session", mock_get_db_session)

        from app.api.v1.users import update_user_goal_weights

        with pytest.raises(HTTPException) as exc_info:
            await update_user_goal_weights(
                user_id=user_id,
                weight_update=payload,
                context=admin_context,
                session=AsyncMock(),
            )

        assert exc_info.value.status_code == 422

    @pytest.mark.asyncio
    async def test_clear_user_goal_weights_success(self, admin_context, mock_user_detail_response, monkeypatch):
        user_id = UUID("12345678-1234-1234-1234-123456789abc")

        mock_service = AsyncMock()
        mock_service.clear_user_goal_weight_override = AsyncMock(return_value=mock_user_detail_response)

        async def mock_get_db_session():
            yield AsyncMock()

        monkeypatch.setattr("app.api.v1.users.UserService", lambda session: mock_service)
        monkeypatch.setattr("app.api.v1.users.get_db_session", mock_get_db_session)

        from app.api.v1.users import clear_user_goal_weights

        result = await clear_user_goal_weights(
            user_id=user_id,
            context=admin_context,
            session=AsyncMock(),
        )

        mock_service.clear_user_goal_weight_override.assert_called_once_with(user_id, admin_context)
        assert result == mock_user_detail_response

    @pytest.mark.asyncio
    async def test_get_user_goal_weight_history_success(self, admin_context, monkeypatch):
        user_id = UUID("12345678-1234-1234-1234-123456789abc")
        history_entry = UserGoalWeightHistoryEntry(
            id=UUID("87654321-4321-4321-4321-987654321def"),
            userId=user_id,
            organizationId="org_123",
            actorUserId=UUID("00000000-0000-0000-0000-000000000001"),
            actorName="Admin",
            actorEmployeeCode="ADM001",
            quantitativeWeightBefore=None,
            quantitativeWeightAfter=70,
            qualitativeWeightBefore=None,
            qualitativeWeightAfter=20,
            competencyWeightBefore=None,
            competencyWeightAfter=10,
            changedAt="2024-01-01T00:00:00Z",
        )

        mock_service = AsyncMock()
        mock_service.get_user_goal_weight_history = AsyncMock(return_value=[history_entry])

        async def mock_get_db_session():
            yield AsyncMock()

        monkeypatch.setattr("app.api.v1.users.UserService", lambda session: mock_service)
        monkeypatch.setattr("app.api.v1.users.get_db_session", mock_get_db_session)

        from app.api.v1.users import get_user_goal_weight_history

        result = await get_user_goal_weight_history(
            user_id=user_id,
            limit=20,
            context=admin_context,
            session=AsyncMock(),
        )

        mock_service.get_user_goal_weight_history.assert_called_once_with(user_id, admin_context, 20)
        assert result == [history_entry]

    def test_user_detail_response_accepts_goal_weight_budget_field_name(self):
        budget = GoalWeightBudget(
            quantitative=50,
            qualitative=50,
            competency=10,
            source="user",
        )

        user = UserDetailResponse(
            id=UUID("12345678-1234-1234-1234-123456789abc"),
            clerk_user_id="test_clerk_id",
            employee_code="EMP001",
            name="Test User",
            email="test@example.com",
            status=UserStatus.ACTIVE,
            job_title="Software Engineer",
            department=None,
            stage=None,
            roles=[],
            supervisor=None,
            subordinates=None,
            goal_weight_budget=budget,
        )

        assert user.goal_weight_budget == budget
        data = user.model_dump(by_alias=True)
        assert data["goalWeightBudget"]["quantitative"] == 50
