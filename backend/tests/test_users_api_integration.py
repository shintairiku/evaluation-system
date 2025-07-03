"""
Integration tests for Users API endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock

from app.main import app


class TestUsersAPIIntegration:
    """Integration tests for Users API endpoints"""
    
    @pytest.fixture
    def client(self):
        """Test client fixture"""
        return TestClient(app)
    
    @patch('app.dependencies.auth.get_current_user')
    def test_get_users_endpoint_exists(self, mock_get_current_user, client):
        """Test that the GET /users/ endpoint exists and is accessible"""
        # Mock the async function to return a value
        mock_get_current_user.return_value = AsyncMock(return_value={
            "sub": "admin_123",
            "email": "admin@example.com",
            "role": "admin"
        })
        
        with patch('app.services.user_service.UserService.get_users') as mock_get_users:
            mock_get_users.return_value = {
                "items": [],
                "total": 0,
                "page": 1,
                "size": 10,
                "pages": 0
            }
            
            response = client.get("/api/v1/users/")
            
            assert response.status_code == 200
            mock_get_users.assert_called_once()

    @patch('app.dependencies.auth.get_current_user')
    def test_get_users_with_filters(self, mock_get_current_user, client):
        """Test GET /users/ with filtering parameters"""
        # Mock the async function to return a value
        mock_get_current_user.return_value = AsyncMock(return_value={
            "sub": "admin_123",
            "email": "admin@example.com",
            "role": "admin"
        })
        
        with patch('app.services.user_service.UserService.get_users') as mock_get_users:
            mock_get_users.return_value = {
                "items": [],
                "total": 0,
                "page": 1,
                "size": 10,
                "pages": 0
            }
            
            response = client.get("/api/v1/users/?search=john&role_name=employee&status=active")
            
            assert response.status_code == 200
            call_args = mock_get_users.call_args
            assert call_args[1]['search_term'] == "john"
            assert call_args[1]['filters']['role_name'] == "employee"
            assert call_args[1]['filters']['status'] == "active"

    def test_openapi_documentation(self, client):
        """Test that OpenAPI documentation is generated correctly"""
        response = client.get("/openapi.json")
        
        assert response.status_code == 200
        schema = response.json()
        
        # Check that users endpoints are documented
        assert "/api/v1/users/" in schema["paths"]
        assert "/api/v1/users/{user_id}" in schema["paths"]
        assert "/api/v1/users/{user_id}/profile" in schema["paths"]
        
        # Check that endpoints have descriptions
        users_path = schema["paths"]["/api/v1/users/"]
        assert "summary" in users_path["get"]
        assert "description" in users_path["get"]
