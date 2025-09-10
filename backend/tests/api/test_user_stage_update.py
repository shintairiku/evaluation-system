"""
Unit tests for user stage update API endpoint.
Tests the new admin-only PATCH /api/v1/users/{user_id}/stage endpoint.
"""
import pytest
import asyncio
import logging
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.services.user_service import UserService
from app.schemas.user import UserStageUpdate, UserDetailResponse, UserStatus
from app.security.context import AuthContext, RoleInfo
from app.core.exceptions import NotFoundError, PermissionDeniedError, ValidationError

logger = logging.getLogger(__name__)


class TestUserStageUpdateAPI:
    """Test class for user stage update API functionality"""

    @pytest.fixture
    def client(self):
        """FastAPI test client"""
        return TestClient(app)
    
    @pytest.fixture
    def admin_context(self):
        """Mock admin authentication context"""
        admin_role = RoleInfo(id=1, name="admin", description="Administrator")
        return AuthContext(
            user_id=UUID("00000000-0000-0000-0000-000000000001"),
            roles=[admin_role],
            clerk_user_id="test_admin_clerk_id"
        )
    
    @pytest.fixture
    def non_admin_context(self):
        """Mock non-admin authentication context"""
        employee_role = RoleInfo(id=4, name="employee", description="Regular employee")
        return AuthContext(
            user_id=UUID("00000000-0000-0000-0000-000000000004"),
            roles=[employee_role],
            clerk_user_id="test_employee_clerk_id"
        )
    
    @pytest.fixture
    def mock_user_detail_response(self):
        """Mock UserDetailResponse for testing"""
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
            subordinates=None
        )

    @pytest.mark.asyncio
    async def test_update_user_stage_admin_success(
        self, 
        admin_context, 
        mock_user_detail_response,
        monkeypatch
    ):
        """Test successful user stage update by admin"""
        # Arrange
        user_id = UUID("12345678-1234-1234-1234-123456789abc")
        stage_id = UUID("87654321-4321-4321-4321-987654321def")
        stage_update = UserStageUpdate(stage_id=stage_id)
        
        # Mock the service method
        mock_service = AsyncMock()
        mock_service.update_user_stage = AsyncMock(return_value=mock_user_detail_response)
        
        async def mock_get_db_session():
            yield AsyncMock()
        
        async def mock_require_admin():
            return admin_context
        
        # Mock dependencies
        monkeypatch.setattr("app.api.v1.users.UserService", lambda session: mock_service)
        monkeypatch.setattr("app.api.v1.users.get_db_session", mock_get_db_session)
        monkeypatch.setattr("app.api.v1.users.require_admin", lambda: mock_require_admin)
        
        # Act & Assert
        from app.api.v1.users import update_user_stage
        result = await update_user_stage(
            user_id=user_id,
            stage_update=stage_update,
            context=admin_context,
            session=AsyncMock()
        )
        
        # Verify service was called correctly
        mock_service.update_user_stage.assert_called_once_with(
            user_id, stage_update, admin_context
        )
        
        # Verify response
        assert result == mock_user_detail_response

    @pytest.mark.asyncio
    async def test_update_user_stage_user_not_found(
        self, 
        admin_context,
        monkeypatch
    ):
        """Test user stage update when user not found"""
        # Arrange
        user_id = UUID("00000000-0000-0000-0000-000000000000")
        stage_id = UUID("87654321-4321-4321-4321-987654321def")
        stage_update = UserStageUpdate(stage_id=stage_id)
        
        # Mock the service to raise NotFoundError
        mock_service = AsyncMock()
        mock_service.update_user_stage = AsyncMock(
            side_effect=NotFoundError(f"User with ID {user_id} not found")
        )
        
        async def mock_get_db_session():
            yield AsyncMock()
        
        # Mock dependencies
        monkeypatch.setattr("app.api.v1.users.UserService", lambda session: mock_service)
        monkeypatch.setattr("app.api.v1.users.get_db_session", mock_get_db_session)
        
        # Act & Assert
        from app.api.v1.users import update_user_stage
        with pytest.raises(HTTPException) as exc_info:
            await update_user_stage(
                user_id=user_id,
                stage_update=stage_update,
                context=admin_context,
                session=AsyncMock()
            )
        
        assert exc_info.value.status_code == 404
        assert "not found" in str(exc_info.value.detail).lower()

    @pytest.mark.asyncio
    async def test_update_user_stage_invalid_stage_id(
        self, 
        admin_context,
        monkeypatch
    ):
        """Test user stage update with invalid stage ID"""
        # Arrange
        user_id = UUID("12345678-1234-1234-1234-123456789abc")
        stage_id = UUID("00000000-0000-0000-0000-000000000000")
        stage_update = UserStageUpdate(stage_id=stage_id)
        
        # Mock the service to raise NotFoundError for stage
        mock_service = AsyncMock()
        mock_service.update_user_stage = AsyncMock(
            side_effect=NotFoundError(f"Stage with ID {stage_id} not found")
        )
        
        async def mock_get_db_session():
            yield AsyncMock()
        
        # Mock dependencies
        monkeypatch.setattr("app.api.v1.users.UserService", lambda session: mock_service)
        monkeypatch.setattr("app.api.v1.users.get_db_session", mock_get_db_session)
        
        # Act & Assert
        from app.api.v1.users import update_user_stage
        with pytest.raises(HTTPException) as exc_info:
            await update_user_stage(
                user_id=user_id,
                stage_update=stage_update,
                context=admin_context,
                session=AsyncMock()
            )
        
        assert exc_info.value.status_code == 404
        assert "stage" in str(exc_info.value.detail).lower()

    @pytest.mark.asyncio
    async def test_update_user_stage_validation_error(
        self, 
        admin_context,
        monkeypatch
    ):
        """Test user stage update with validation error"""
        # Arrange
        user_id = UUID("12345678-1234-1234-1234-123456789abc")
        stage_id = UUID("87654321-4321-4321-4321-987654321def")
        stage_update = UserStageUpdate(stage_id=stage_id)
        
        # Mock the service to raise ValidationError
        mock_service = AsyncMock()
        mock_service.update_user_stage = AsyncMock(
            side_effect=ValidationError("Invalid stage data")
        )
        
        async def mock_get_db_session():
            yield AsyncMock()
        
        # Mock dependencies
        monkeypatch.setattr("app.api.v1.users.UserService", lambda session: mock_service)
        monkeypatch.setattr("app.api.v1.users.get_db_session", mock_get_db_session)
        
        # Act & Assert
        from app.api.v1.users import update_user_stage
        with pytest.raises(HTTPException) as exc_info:
            await update_user_stage(
                user_id=user_id,
                stage_update=stage_update,
                context=admin_context,
                session=AsyncMock()
            )
        
        assert exc_info.value.status_code == 422
        assert "invalid" in str(exc_info.value.detail).lower()


class TestUserServiceStageUpdate:
    """Test class for UserService.update_user_stage method"""

    @pytest.fixture
    def mock_session(self):
        """Mock database session"""
        session = AsyncMock()
        session.commit = AsyncMock()
        session.rollback = AsyncMock()
        session.refresh = AsyncMock()
        return session

    @pytest.fixture
    def admin_context(self):
        """Mock admin authentication context"""
        admin_role = RoleInfo(id=1, name="admin", description="Administrator")
        return AuthContext(
            user_id=UUID("00000000-0000-0000-0000-000000000001"),
            roles=[admin_role],
            clerk_user_id="test_admin_clerk_id"
        )

    @pytest.mark.asyncio
    async def test_service_update_user_stage_success(
        self, 
        mock_session, 
        admin_context,
        monkeypatch
    ):
        """Test UserService.update_user_stage success case"""
        # Arrange
        user_id = UUID("12345678-1234-1234-1234-123456789abc")
        stage_id = UUID("87654321-4321-4321-4321-987654321def")
        stage_update = UserStageUpdate(stage_id=stage_id)
        
        # Mock user and stage models
        mock_user = MagicMock()
        mock_user.id = user_id
        mock_stage = MagicMock()
        mock_stage.id = stage_id
        
        # Mock repositories
        mock_user_repo = AsyncMock()
        mock_user_repo.get_user_by_id = AsyncMock(return_value=mock_user)
        mock_user_repo.update_user_stage = AsyncMock(return_value=mock_user)
        
        mock_stage_repo = AsyncMock()
        mock_stage_repo.get_by_id = AsyncMock(return_value=mock_stage)
        
        # Mock UserService initialization
        service = UserService(mock_session)
        service.user_repo = mock_user_repo
        service.stage_repo = mock_stage_repo
        
        # Mock _enrich_detailed_user_data method
        mock_enriched_user = UserDetailResponse(
            id=user_id,
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
            subordinates=None
        )
        service._enrich_detailed_user_data = AsyncMock(return_value=mock_enriched_user)
        
        # Act
        result = await service.update_user_stage(user_id, stage_update, admin_context)
        
        # Assert
        mock_user_repo.get_user_by_id.assert_called_once_with(user_id)
        mock_stage_repo.get_by_id.assert_called_once_with(stage_id)
        mock_user_repo.update_user_stage.assert_called_once_with(user_id, stage_id)
        mock_session.commit.assert_called_once()
        mock_session.refresh.assert_called_once_with(mock_user)
        
        assert result == mock_enriched_user

    @pytest.mark.asyncio
    async def test_service_update_user_stage_user_not_found(
        self, 
        mock_session, 
        admin_context
    ):
        """Test UserService.update_user_stage when user not found"""
        # Arrange
        user_id = UUID("00000000-0000-0000-0000-000000000000")
        stage_id = UUID("87654321-4321-4321-4321-987654321def")
        stage_update = UserStageUpdate(stage_id=stage_id)
        
        # Mock repositories
        mock_user_repo = AsyncMock()
        mock_user_repo.get_user_by_id = AsyncMock(return_value=None)  # User not found
        
        service = UserService(mock_session)
        service.user_repo = mock_user_repo
        
        # Act & Assert
        with pytest.raises(NotFoundError) as exc_info:
            await service.update_user_stage(user_id, stage_update, admin_context)
        
        assert str(user_id) in str(exc_info.value)
        mock_session.rollback.assert_called_once()

    @pytest.mark.asyncio
    async def test_service_update_user_stage_invalid_stage(
        self, 
        mock_session, 
        admin_context
    ):
        """Test UserService.update_user_stage when stage not found"""
        # Arrange
        user_id = UUID("12345678-1234-1234-1234-123456789abc")
        stage_id = UUID("00000000-0000-0000-0000-000000000000")
        stage_update = UserStageUpdate(stage_id=stage_id)
        
        # Mock user exists but stage doesn't
        mock_user = MagicMock()
        mock_user.id = user_id
        
        # Mock repositories
        mock_user_repo = AsyncMock()
        mock_user_repo.get_user_by_id = AsyncMock(return_value=mock_user)
        
        mock_stage_repo = AsyncMock()
        mock_stage_repo.get_by_id = AsyncMock(return_value=None)  # Stage not found
        
        service = UserService(mock_session)
        service.user_repo = mock_user_repo
        service.stage_repo = mock_stage_repo
        
        # Act & Assert
        with pytest.raises(NotFoundError) as exc_info:
            await service.update_user_stage(user_id, stage_update, admin_context)
        
        assert str(stage_id) in str(exc_info.value)
        mock_session.rollback.assert_called_once()


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])