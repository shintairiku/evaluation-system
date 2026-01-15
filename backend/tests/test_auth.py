import pytest
from unittest.mock import patch, AsyncMock
from jose import jwt
from datetime import datetime, timedelta

from app.core.clerk_config import ClerkConfig
from app.schemas.auth import AuthUser
from app.services.auth_service import AuthService
from app.dependencies.auth import get_current_user, get_admin_user, get_supervisor_or_admin_user
from app.schemas.auth import UserAuthResponse, TokenVerifyRequest, TokenVerifyResponse
from app.schemas.user import UserExistsResponse
from app.core.exceptions import UnauthorizedError
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials


# Test fixtures
@pytest.fixture
def mock_clerk_config():
    """Real Clerk configuration using actual environment variables."""
    return ClerkConfig()


@pytest.fixture
def mock_jwt_token(mock_clerk_config):
    """JWT token using actual Clerk secret key with new roles array format."""
    payload = {
        "sub": "user_123",
        "email": "test@example.com",
        "first_name": "Test",
        "last_name": "User",
        "roles": ["employee"],  # New format: roles array
        "role": "employee",     # Keep legacy field for backward compatibility
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=1)
    }
    return jwt.encode(payload, mock_clerk_config.secret_key, algorithm="HS256")


@pytest.fixture
def mock_admin_jwt_token(mock_clerk_config):
    """Admin JWT token using actual Clerk secret key with new roles array format."""
    payload = {
        "sub": "admin_123",
        "email": "admin@example.com",
        "first_name": "Admin",
        "last_name": "User",
        "roles": ["admin"],  # New format: roles array
        "role": "admin",     # Keep legacy field for backward compatibility
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=1)
    }
    return jwt.encode(payload, mock_clerk_config.secret_key, algorithm="HS256")


# Test ClerkConfig
class TestClerkConfig:
    def test_config_initialization_with_env_vars(self):
        """Test ClerkConfig initialization with actual environment variables."""
        config = ClerkConfig()
        # Test that actual environment variables are loaded
        assert config.secret_key.startswith('sk_test_')
        assert config.publishable_key.startswith('pk_test_')
        assert len(config.secret_key) > 20
        assert len(config.publishable_key) > 20

    def test_config_initialization_skip_validation(self):
        """Test ClerkConfig initialization with skip_validation=True."""
        config = ClerkConfig(skip_validation=True)
        assert isinstance(config, ClerkConfig)

    def test_config_missing_env_vars_raises_error(self):
        """Test ClerkConfig raises error when environment variables are missing."""
        with patch.dict('os.environ', {}, clear=True):
            with pytest.raises(ValueError):
                ClerkConfig()

    def test_jwt_verification_key_property(self):
        """Test JWT verification key property."""
        config = ClerkConfig(skip_validation=True)
        config.secret_key = "sk_test_123"
        expected_key = config.secret_key
        assert config.jwt_verification_key == expected_key


# Test AuthUser
class TestAuthUser:
    def test_auth_user_creation(self):
        """Test AuthUser model creation with new roles array."""
        user = AuthUser(
            clerk_id="user_123",
            email="test@example.com",
            first_name="Test",
            last_name="User",
            roles=["employee"],
            role="employee"
        )
        assert user.clerk_id == "user_123"
        assert user.email == "test@example.com"
        assert user.first_name == "Test"
        assert user.last_name == "User"
        assert user.roles == ["employee"]
        assert user.role == "employee"

    def test_auth_user_optional_fields(self):
        """Test AuthUser with optional fields."""
        user = AuthUser(
            clerk_id="user_123",
            email="test@example.com"
        )
        assert user.clerk_id == "user_123"
        assert user.email == "test@example.com"
        assert user.first_name is None
        assert user.last_name is None
        assert user.roles is None
        assert user.role is None

    def test_auth_user_multiple_roles(self):
        """Test AuthUser with multiple roles array."""
        user = AuthUser(
            clerk_id="user_123",
            email="test@example.com",
            roles=["manager", "employee"],
            role="manager"  # Primary role
        )
        assert user.roles == ["manager", "employee"]
        assert user.role == "manager"

    def test_auth_user_backward_compatibility(self):
        """Test AuthUser still works with legacy single role field."""
        user = AuthUser(
            clerk_id="user_123",
            email="test@example.com",
            role="supervisor"
        )
        assert user.role == "supervisor"
        assert user.roles is None


# Test AuthService
class TestAuthService:
    def test_auth_service_initialization(self, mock_clerk_config):
        """Test AuthService initialization."""
        service = AuthService(config=mock_clerk_config)
        assert service.clerk_auth.config == mock_clerk_config

    def test_verify_token_success(self, mock_clerk_config, mock_jwt_token):
        """Test successful token verification through service."""
        service = AuthService(config=mock_clerk_config)
        user = service.verify_token(mock_jwt_token)
        
        assert isinstance(user, AuthUser)
        assert user.clerk_id == "user_123"

    def test_verify_token_failure(self, mock_clerk_config):
        """Test token verification failure through service."""
        service = AuthService(config=mock_clerk_config)
        
        with pytest.raises(Exception):
            service.verify_token("invalid_token")


# Test Auth Dependencies
class TestAuthDependencies:
    @pytest.mark.asyncio
    async def test_get_current_user_success(self, mock_jwt_token):
        """Test successful get_current_user dependency."""
        credentials = HTTPAuthorizationCredentials(
            scheme="Bearer",
            credentials=mock_jwt_token
        )

        mock_service = AsyncMock()
        mock_service.get_user_from_token = AsyncMock(
            return_value=AuthUser(
                clerk_id="user_123",
                email="test@example.com",
                first_name="Test",
                last_name="User",
                roles=["employee"],
                role="employee"
            )
        )
        mock_service.check_user_exists_by_clerk_id = AsyncMock(
            return_value=UserExistsResponse(
                exists=True,
                user_id=None,
                name="Test User",
                email="test@example.com",
                status=None,
            )
        )

        result = await get_current_user(credentials, auth_service=mock_service)

        assert result.exists is True
        assert result.email == "test@example.com"

    @pytest.mark.asyncio
    async def test_get_current_user_invalid_token(self):
        """Test get_current_user with invalid token."""
        credentials = HTTPAuthorizationCredentials(
            scheme="Bearer",
            credentials="invalid_token"
        )

        mock_service = AsyncMock()
        mock_service.get_user_from_token = AsyncMock(side_effect=Exception("Invalid token"))
        
        with pytest.raises(UnauthorizedError):
            await get_current_user(credentials, auth_service=mock_service)

    @pytest.mark.asyncio
    async def test_get_admin_user_success(self):
        """Test successful get_admin_user dependency."""
        admin_user = {
            "sub": "admin_123",
            "email": "admin@example.com",
            "role": "admin"
        }
        
        result = await get_admin_user(admin_user)
        assert result == admin_user

    @pytest.mark.asyncio
    async def test_get_admin_user_forbidden(self):
        """Test get_admin_user with non-admin user."""
        regular_user = {
            "sub": "user_123",
            "email": "user@example.com",
            "role": "employee"
        }
        
        with pytest.raises(HTTPException) as exc_info:
            await get_admin_user(regular_user)
        
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_get_supervisor_or_admin_user_supervisor(self):
        """Test get_supervisor_or_admin_user with supervisor."""
        supervisor_user = {
            "sub": "supervisor_123",
            "email": "supervisor@example.com",
            "role": "supervisor"
        }
        
        result = await get_supervisor_or_admin_user(supervisor_user)
        assert result == supervisor_user

    @pytest.mark.asyncio
    async def test_get_supervisor_or_admin_user_admin(self):
        """Test get_supervisor_or_admin_user with admin."""
        admin_user = {
            "sub": "admin_123",
            "email": "admin@example.com",
            "role": "admin"
        }
        
        result = await get_supervisor_or_admin_user(admin_user)
        assert result == admin_user

    @pytest.mark.asyncio
    async def test_get_supervisor_or_admin_user_forbidden(self):
        """Test get_supervisor_or_admin_user with regular user."""
        regular_user = {
            "sub": "user_123",
            "email": "user@example.com",
            "role": "employee"
        }
        
        with pytest.raises(HTTPException) as exc_info:
            await get_supervisor_or_admin_user(regular_user)
        
        assert exc_info.value.status_code == 403


# Test Auth Schemas
class TestAuthSchemas:
    def test_user_response_creation(self):
        """Test UserAuthResponse schema creation."""
        from uuid import uuid4

        response = UserAuthResponse(
            id=uuid4(),
            email="test@example.com",
            name="Test User",
            clerk_user_id="user_123"
        )

        assert response.email == "test@example.com"
        assert response.name == "Test User"
        assert response.clerk_user_id == "user_123"

    def test_token_verify_request(self):
        """Test TokenVerifyRequest schema."""
        request = TokenVerifyRequest(token="test_token")
        assert request.token == "test_token"

    def test_token_verify_response(self):
        """Test TokenVerifyResponse schema."""
        response = TokenVerifyResponse(
            valid=True,
            user=UserAuthResponse(
                id="user_123",
                email="test@example.com",
                first_name="Test",
                last_name="User",
                role="employee"
            )
        )
        
        assert response.valid is True
        assert response.user.id == "user_123"
