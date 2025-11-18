import pytest
from uuid import UUID
from unittest.mock import AsyncMock

from app.api.v1 import self_assessment_summary as api_module
from app.security.context import AuthContext, RoleInfo
from app.core.exceptions import PermissionDeniedError


@pytest.fixture
def admin_context():
    role = RoleInfo(id=1, name="admin", description="Administrator")
    return AuthContext(
        user_id=UUID("00000000-0000-0000-0000-000000000001"),
        roles=[role],
        clerk_user_id="admin",
        organization_id="org_test",
    )


@pytest.fixture
def mock_service(monkeypatch):
    instance = AsyncMock()
    monkeypatch.setattr(api_module, "SelfAssessmentService", lambda session: instance)
    return instance


@pytest.mark.asyncio
async def test_get_current_context_calls_service(admin_context, mock_service):
    expected = {"goals": [], "draft": [], "stageWeights": {}, "thresholds": [], "summary": None}
    mock_service.get_current_context = AsyncMock(return_value=expected)
    result = await api_module.get_current_context(context=admin_context, session=AsyncMock())
    mock_service.get_current_context.assert_awaited_once()
    assert result == expected


@pytest.mark.asyncio
async def test_submit_returns_summary(admin_context, mock_service):
    payload = [{"goalId": UUID("00000000-0000-0000-0000-000000000111"), "bucket": "quantitative"}]
    expected = {"finalRating": "A", "perBucket": []}
    mock_service.submit = AsyncMock(return_value=expected)

    result = await api_module.submit_assessments(draft=payload, context=admin_context, session=AsyncMock())

    mock_service.submit.assert_awaited_once_with(admin_context, payload)
    assert result == expected


@pytest.mark.asyncio
async def test_get_summary_permission_denied_raises_http(admin_context, mock_service):
    mock_service.get_summary = AsyncMock(side_effect=PermissionDeniedError("nope"))
    with pytest.raises(api_module.HTTPException) as exc:
        await api_module.get_summary(
            period_id=UUID("00000000-0000-0000-0000-000000000222"),
            user_id=UUID("00000000-0000-0000-0000-000000000333"),
            context=admin_context,
            session=AsyncMock(),
        )
    assert exc.value.status_code == 403
