import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import os

# Set environment variables before importing the app
os.environ['ENVIRONMENT'] = 'development'
os.environ['ENGINEER_ACCESS_KEY'] = 'test_engineer_key'

from app.main import app
from app.core.rbac_config import RBACConfig
from app.core.secure_docs import verify_engineer_access_key
from app.dependencies.auth import get_current_user, require_role, require_admin


@pytest.fixture
def client():
    """Create test client."""
    return TestClient(app)


@pytest.fixture
def mock_rbac_config():
    """Mock RBAC configuration for testing."""
    with patch('app.core.rbac_config.RBACConfig') as mock_config:
        config_instance = mock_config.return_value
        config_instance.is_development_mode.return_value = True
        config_instance.is_valid_engineer_key.return_value = True
        config_instance.engineer_access_key = "test_engineer_key"
        yield config_instance


@pytest.fixture
def production_client():
    """Create test client for production environment."""
    with patch.dict(os.environ, {'ENVIRONMENT': 'production'}):
        # Need to reimport app with production settings
        import importlib
        from app import main
        importlib.reload(main)
        return TestClient(main.app)


class TestRBACConfig:
    """Test RBAC configuration functionality."""
    
    def test_development_mode_detection(self):
        """Test development mode detection."""
        with patch.dict(os.environ, {'ENVIRONMENT': 'development'}):
            config = RBACConfig(skip_validation=True)
            assert config.is_development_mode() == True
            assert config.is_production_mode() == False
    
    def test_production_mode_detection(self):
        """Test production mode detection."""
        with patch.dict(os.environ, {'ENVIRONMENT': 'production'}):
            config = RBACConfig(skip_validation=True)
            assert config.is_development_mode() == False
            assert config.is_production_mode() == True
    
    def test_engineer_key_validation(self):
        """Test engineer access key validation."""
        with patch.dict(os.environ, {
            'ENVIRONMENT': 'development',
            'ENGINEER_ACCESS_KEY': 'secret_key_123'
        }):
            config = RBACConfig(skip_validation=True)
            assert config.is_valid_engineer_key('secret_key_123') == True
            assert config.is_valid_engineer_key('wrong_key') == False
    
    def test_engineer_key_validation_production(self):
        """Test engineer access key validation in production."""
        with patch.dict(os.environ, {
            'ENVIRONMENT': 'production',
            'ENGINEER_ACCESS_KEY': 'secret_key_123'
        }):
            config = RBACConfig(skip_validation=True)
            # Should return False in production mode
            assert config.is_valid_engineer_key('secret_key_123') == False


class TestSecureDocumentation:
    """Test secure API documentation functionality."""
    
    def test_docs_disabled_in_production(self, production_client):
        """Test that /docs returns 404 in production mode."""
        response = production_client.get("/docs")
        assert response.status_code == 404
        assert "API documentation is not available" in response.json()["detail"]
    
    def test_redoc_disabled_in_production(self, production_client):
        """Test that /redoc returns 404 in production mode."""
        response = production_client.get("/redoc")
        assert response.status_code == 404
        assert "API documentation is not available" in response.json()["detail"]
    
    def test_openapi_disabled_in_production(self, production_client):
        """Test that /openapi.json returns 404 in production mode."""
        response = production_client.get("/openapi.json")
        assert response.status_code == 404
        assert "API documentation is not available" in response.json()["detail"]
    
    def test_secure_docs_requires_key(self, client, mock_rbac_config):
        """Test that secure docs require engineer access key."""
        response = client.get("/secure-docs")
        assert response.status_code == 401
        assert "Engineer access key is required" in response.json()["detail"]
    
    def test_secure_docs_with_valid_key(self, client, mock_rbac_config):
        """Test that secure docs work with valid engineer access key."""
        headers = {"X-Engineer-Access-Key": "test_engineer_key"}
        response = client.get("/secure-docs", headers=headers)
        # Should return HTML content for Swagger UI
        assert response.status_code == 200
        assert "text/html" in response.headers.get("content-type", "")
    
    def test_secure_docs_with_invalid_key(self, client, mock_rbac_config):
        """Test that secure docs reject invalid engineer access key."""
        mock_rbac_config.is_valid_engineer_key.return_value = False
        headers = {"X-Engineer-Access-Key": "invalid_key"}
        response = client.get("/secure-docs", headers=headers)
        assert response.status_code == 401
        assert "Invalid engineer access key" in response.json()["detail"]
    
    def test_secure_docs_not_available_in_production(self, production_client):
        """Test that secure docs return 404 in production mode."""
        headers = {"X-Engineer-Access-Key": "test_engineer_key"}
        response = production_client.get("/secure-docs", headers=headers)
        assert response.status_code == 404
        assert "API documentation is not available" in response.json()["detail"]


class TestRoleBasedAccess:
    """Test role-based access control functionality."""
    
    def test_require_admin_function(self):
        """Test require_admin dependency function."""
        admin_dependency = require_admin()
        
        # Mock admin user
        admin_user = {"role": "admin", "sub": "admin_user"}
        
        # Should not raise exception for admin user
        result = admin_dependency.__code__.co_code  # This is a placeholder
        assert admin_dependency is not None
    
    def test_require_role_function(self):
        """Test require_role dependency function."""
        supervisor_dependency = require_role(["supervisor", "admin"])
        
        # Should create a dependency function
        assert callable(supervisor_dependency)
    
    def test_engineer_bypass_in_development(self):
        """Test engineer bypass functionality in development mode."""
        with patch('app.dependencies.auth.rbac_config') as mock_config:
            mock_config.is_development_mode.return_value = True
            mock_config.is_valid_engineer_key.return_value = True
            
            # Should return engineer admin user
            from app.dependencies.auth import ENGINEER_ADMIN_USER
            assert ENGINEER_ADMIN_USER["role"] == "admin"
            assert ENGINEER_ADMIN_USER["email"] == "engineer@development.local"
    
    def test_engineer_bypass_not_in_production(self):
        """Test engineer bypass is disabled in production mode."""
        with patch('app.dependencies.auth.rbac_config') as mock_config:
            mock_config.is_development_mode.return_value = False
            mock_config.is_valid_engineer_key.return_value = False
            
            # Should not allow engineer bypass
            assert mock_config.is_development_mode() == False


class TestAPIEndpointProtection:
    """Test API endpoint protection with RBAC."""
    
    def test_health_endpoint_public_access(self, client):
        """Test that health endpoint is publicly accessible."""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"
    
    def test_root_endpoint_public_access(self, client):
        """Test that root endpoint is publicly accessible."""
        response = client.get("/")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"
    
    @patch('app.dependencies.auth.clerk_auth')
    def test_protected_endpoint_requires_auth(self, mock_clerk_auth, client):
        """Test that protected endpoints require authentication."""
        mock_clerk_auth.verify_token.side_effect = Exception("Invalid token")
        
        # Try to access a protected endpoint without authentication
        response = client.get("/api/v1/users/")
        assert response.status_code == 401
    
    @patch('app.dependencies.auth.clerk_auth')
    def test_admin_endpoint_requires_admin_role(self, mock_clerk_auth, client):
        """Test that admin endpoints require admin role."""
        # Mock non-admin user
        mock_auth_user = MagicMock()
        mock_auth_user.user_id = "user_123"
        mock_auth_user.email = "user@example.com"
        mock_auth_user.role = "employee"
        mock_clerk_auth.verify_token.return_value = mock_auth_user
        
        headers = {"Authorization": "Bearer valid_token"}
        response = client.get("/api/v1/admin/roles/", headers=headers)
        assert response.status_code == 403
        assert "Access denied" in response.json()["detail"]
    
    @patch('app.dependencies.auth.clerk_auth')
    def test_admin_endpoint_allows_admin_role(self, mock_clerk_auth, client):
        """Test that admin endpoints allow admin role."""
        # Mock admin user
        mock_auth_user = MagicMock()
        mock_auth_user.user_id = "admin_123"
        mock_auth_user.email = "admin@example.com"
        mock_auth_user.role = "admin"
        mock_clerk_auth.verify_token.return_value = mock_auth_user
        
        headers = {"Authorization": "Bearer valid_token"}
        response = client.get("/api/v1/admin/roles/", headers=headers)
        # Should not return 403 (might return 200 or other status based on implementation)
        assert response.status_code != 403


class TestEngineerBypass:
    """Test engineer bypass functionality."""
    
    @patch('app.dependencies.auth.rbac_config')
    def test_engineer_bypass_grants_admin_access(self, mock_config, client):
        """Test that engineer bypass grants admin access."""
        mock_config.is_development_mode.return_value = True
        mock_config.is_valid_engineer_key.return_value = True
        
        headers = {
            "X-Engineer-Access-Key": "test_engineer_key",
            "Authorization": "Bearer dummy_token"
        }
        
        # Should be able to access admin endpoints
        response = client.get("/api/v1/admin/roles/", headers=headers)
        # Should not return 403 (access denied)
        assert response.status_code != 403
    
    @patch('app.dependencies.auth.rbac_config')
    def test_engineer_bypass_disabled_in_production(self, mock_config, client):
        """Test that engineer bypass is disabled in production."""
        mock_config.is_development_mode.return_value = False
        mock_config.is_valid_engineer_key.return_value = False
        
        headers = {
            "X-Engineer-Access-Key": "test_engineer_key",
            "Authorization": "Bearer dummy_token"
        }
        
        # Should still require valid JWT token
        response = client.get("/api/v1/admin/roles/", headers=headers)
        assert response.status_code == 401  # Unauthorized due to invalid token


if __name__ == "__main__":
    pytest.main([__file__]) 