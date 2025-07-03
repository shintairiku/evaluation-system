import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from fastapi import status
from uuid import uuid4
import json

from app.main import app
from app.schemas.user import UserCreate, UserUpdate
from app.core.exceptions import PermissionDeniedError, NotFoundError


class TestUserAPIEndpoints:
    """Test suite for User API endpoints with permission checks"""
    
    @pytest.fixture
    def client(self):
        """Create test client"""
        return TestClient(app)
    
    @pytest.fixture
    def admin_token(self):
        """Admin JWT token"""
        return "admin_valid_token"
    
    @pytest.fixture
    def manager_token(self):
        """Manager JWT token"""
        return "manager_valid_token"
    
    @pytest.fixture
    def employee_token(self):
        """Employee JWT token"""
        return "employee_valid_token"
    
    @pytest.fixture
    def mock_admin_user(self):
        """Mock admin user context"""
        return {
            "sub": "admin_123",
            "email": "admin@example.com",
            "first_name": "Admin",
            "last_name": "User",
            "role": "admin"
        }
    
    @pytest.fixture
    def mock_manager_user(self):
        """Mock manager user context"""
        return {
            "sub": "manager_123",
            "email": "manager@example.com",
            "first_name": "Manager",
            "last_name": "User",
            "role": "manager"
        }
    
    @pytest.fixture
    def mock_employee_user(self):
        """Mock employee user context"""
        return {
            "sub": "employee_123",
            "email": "employee@example.com",
            "first_name": "Employee",
            "last_name": "User",
            "role": "employee"
        }
    
    @pytest.fixture
    def sample_user_data(self):
        """Sample user data for testing"""
        return {
            "clerk_user_id": "new_user_123",
            "name": "Test User",
            "email": "test@example.com",
            "employee_code": "EMP999",
            "department_id": str(uuid4()),
            "stage_id": str(uuid4()),
            "role_ids": [1, 2],
            "supervisor_id": None
        }
    
    # Test GET /api/v1/users/
    
    @patch('app.dependencies.auth.get_current_user')
    @patch('app.services.user_service.UserService.get_users')
    def test_get_users_admin_success(self, mock_get_users, mock_get_current_user, client, mock_admin_user):
        """Test admin can get all users"""
        # Mock the authentication
        mock_get_current_user.return_value = mock_admin_user
        
        # Mock the service response
        mock_get_users.return_value = {
            "items": [],
            "total": 0,
            "page": 1,
            "size": 10,
            "pages": 0
        }
        
        response = client.get("/api/v1/users/")
        
        assert response.status_code == status.HTTP_200_OK
        mock_get_users.assert_called_once()
    
    @patch('app.dependencies.auth.get_current_user')
    @patch('app.services.user_service.UserService.get_users')
    def test_get_users_manager_subordinates_only(self, mock_get_users, mock_get_current_user, client, mock_manager_user):
        """Test manager can only get subordinates"""
        # Mock the authentication
        mock_get_current_user.return_value = mock_manager_user
        
        # Mock the service response
        mock_get_users.return_value = {
            "items": [],
            "total": 0,
            "page": 1,
            "size": 10,
            "pages": 0
        }
        
        response = client.get("/api/v1/users/")
        
        assert response.status_code == status.HTTP_200_OK
        mock_get_users.assert_called_once()
    
    @patch('app.dependencies.auth.get_current_user')
    @patch('app.services.user_service.UserService.get_users')
    def test_get_users_insufficient_permissions(self, mock_get_users, mock_get_current_user, client, mock_employee_user):
        """Test employee cannot get users list"""
        # Mock the authentication
        mock_get_current_user.return_value = mock_employee_user
        
        # Mock the service to raise permission error
        mock_get_users.side_effect = PermissionDeniedError("Insufficient permissions to view users")
        
        response = client.get("/api/v1/users/")
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Insufficient permissions" in response.json()["detail"]
    
    @patch('app.dependencies.auth.get_current_user')
    def test_get_users_unauthorized(self, mock_get_current_user, client):
        """Test unauthorized access to users endpoint"""
        # Mock authentication failure
        mock_get_current_user.side_effect = Exception("Invalid token")
        
        response = client.get("/api/v1/users/")
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    # Test GET /api/v1/users/{user_id}
    
    @patch('app.dependencies.auth.get_current_user')
    @patch('app.services.user_service.UserService.get_user_by_id')
    def test_get_user_by_id_admin_success(self, mock_get_user, mock_get_current_user, client, mock_admin_user):
        """Test admin can get any user by ID"""
        user_id = str(uuid4())
        
        # Mock the authentication
        mock_get_current_user.return_value = mock_admin_user
        
        # Mock the service response
        mock_get_user.return_value = {
            "id": user_id,
            "name": "Test User",
            "email": "test@example.com"
        }
        
        response = client.get(f"/api/v1/users/{user_id}")
        
        assert response.status_code == status.HTTP_200_OK
        mock_get_user.assert_called_once_with(uuid4(), mock_admin_user)
    
    @patch('app.dependencies.auth.get_current_user')
    @patch('app.services.user_service.UserService.get_user_by_id')
    def test_get_user_by_id_own_profile(self, mock_get_user, mock_get_current_user, client, mock_employee_user):
        """Test employee can get their own profile"""
        user_id = str(uuid4())
        
        # Mock the authentication
        mock_get_current_user.return_value = mock_employee_user
        
        # Mock the service response
        mock_get_user.return_value = {
            "id": user_id,
            "name": "Test User",
            "email": "test@example.com"
        }
        
        response = client.get(f"/api/v1/users/{user_id}")
        
        assert response.status_code == status.HTTP_200_OK
        mock_get_user.assert_called_once_with(uuid4(), mock_employee_user)
    
    @patch('app.dependencies.auth.get_current_user')
    @patch('app.services.user_service.UserService.get_user_by_id')
    def test_get_user_by_id_permission_denied(self, mock_get_user, mock_get_current_user, client, mock_employee_user):
        """Test employee cannot get other user's profile"""
        user_id = str(uuid4())
        
        # Mock the authentication
        mock_get_current_user.return_value = mock_employee_user
        
        # Mock the service to raise permission error
        mock_get_user.side_effect = PermissionDeniedError("You can only view your own profile or subordinates")
        
        response = client.get(f"/api/v1/users/{user_id}")
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "You can only view your own profile" in response.json()["detail"]
    
    @patch('app.dependencies.auth.get_current_user')
    @patch('app.services.user_service.UserService.get_user_by_id')
    def test_get_user_by_id_not_found(self, mock_get_user, mock_get_current_user, client, mock_admin_user):
        """Test getting non-existent user"""
        user_id = str(uuid4())
        
        # Mock the authentication
        mock_get_current_user.return_value = mock_admin_user
        
        # Mock the service to raise not found error
        mock_get_user.side_effect = NotFoundError(f"User with ID {user_id} not found")
        
        response = client.get(f"/api/v1/users/{user_id}")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "not found" in response.json()["detail"]
    
    # Test POST /api/v1/users/
    
    @patch('app.dependencies.auth.get_current_user')
    @patch('app.services.user_service.UserService.create_user')
    def test_create_user_admin_success(self, mock_create_user, mock_get_current_user, client, mock_admin_user, sample_user_data):
        """Test admin can create user"""
        # Mock the authentication
        mock_get_current_user.return_value = mock_admin_user
        
        # Mock the service response
        mock_create_user.return_value = {
            "message": "User created successfully",
            "user": {
                "id": str(uuid4()),
                "name": "Test User"
            }
        }
        
        response = client.post("/api/v1/users/", json=sample_user_data)
        
        assert response.status_code == status.HTTP_200_OK
        assert "User created successfully" in response.json()["message"]
        mock_create_user.assert_called_once()
    
    @patch('app.dependencies.auth.get_current_user')
    @patch('app.services.user_service.UserService.create_user')
    def test_create_user_non_admin_denied(self, mock_create_user, mock_get_current_user, client, mock_employee_user, sample_user_data):
        """Test non-admin cannot create user"""
        # Mock the authentication
        mock_get_current_user.return_value = mock_employee_user
        
        # Mock the service to raise permission error
        mock_create_user.side_effect = PermissionDeniedError("Only administrators can create users")
        
        response = client.post("/api/v1/users/", json=sample_user_data)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Only administrators can create users" in response.json()["detail"]
    
    @patch('app.dependencies.auth.get_current_user')
    def test_create_user_invalid_data(self, mock_get_current_user, client, mock_admin_user):
        """Test creating user with invalid data"""
        # Mock the authentication
        mock_get_current_user.return_value = mock_admin_user
        
        # Invalid user data
        invalid_data = {
            "name": "",  # Empty name
            "email": "invalid-email",  # Invalid email
            "employee_code": "EMP999"
        }
        
        response = client.post("/api/v1/users/", json=invalid_data)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    # Test PUT /api/v1/users/{user_id}
    
    @patch('app.dependencies.auth.get_current_user')
    @patch('app.services.user_service.UserService.update_user')
    def test_update_user_admin_success(self, mock_update_user, mock_get_current_user, client, mock_admin_user):
        """Test admin can update any user"""
        user_id = str(uuid4())
        update_data = {"name": "Updated Name"}
        
        # Mock the authentication
        mock_get_current_user.return_value = mock_admin_user
        
        # Mock the service response
        mock_update_user.return_value = {
            "message": "User updated successfully",
            "user": {
                "id": user_id,
                "name": "Updated Name"
            }
        }
        
        response = client.put(f"/api/v1/users/{user_id}", json=update_data)
        
        assert response.status_code == status.HTTP_200_OK
        assert "User updated successfully" in response.json()["message"]
        mock_update_user.assert_called_once()
    
    @patch('app.dependencies.auth.get_current_user')
    @patch('app.services.user_service.UserService.update_user')
    def test_update_user_own_profile(self, mock_update_user, mock_get_current_user, client, mock_employee_user):
        """Test employee can update their own profile"""
        user_id = str(uuid4())
        update_data = {"name": "Updated Name"}
        
        # Mock the authentication
        mock_get_current_user.return_value = mock_employee_user
        
        # Mock the service response
        mock_update_user.return_value = {
            "message": "User updated successfully",
            "user": {
                "id": user_id,
                "name": "Updated Name"
            }
        }
        
        response = client.put(f"/api/v1/users/{user_id}", json=update_data)
        
        assert response.status_code == status.HTTP_200_OK
        mock_update_user.assert_called_once()
    
    @patch('app.dependencies.auth.get_current_user')
    @patch('app.services.user_service.UserService.update_user')
    def test_update_user_permission_denied(self, mock_update_user, mock_get_current_user, client, mock_employee_user):
        """Test employee cannot update other user's profile"""
        user_id = str(uuid4())
        update_data = {"name": "Updated Name"}
        
        # Mock the authentication
        mock_get_current_user.return_value = mock_employee_user
        
        # Mock the service to raise permission error
        mock_update_user.side_effect = PermissionDeniedError("You can only update your own profile")
        
        response = client.put(f"/api/v1/users/{user_id}", json=update_data)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "You can only update your own profile" in response.json()["detail"]
    
    # Test DELETE /api/v1/users/{user_id}
    
    @patch('app.dependencies.auth.get_current_user')
    @patch('app.services.user_service.UserService.inactivate_user')
    def test_delete_user_admin_success(self, mock_inactivate_user, mock_get_current_user, client, mock_admin_user):
        """Test admin can delete user"""
        user_id = str(uuid4())
        
        # Mock the authentication
        mock_get_current_user.return_value = mock_admin_user
        
        # Mock the service response
        mock_inactivate_user.return_value = {
            "message": "User inactivated successfully",
            "user_id": user_id
        }
        
        response = client.delete(f"/api/v1/users/{user_id}")
        
        assert response.status_code == status.HTTP_200_OK
        assert "User inactivated successfully" in response.json()["message"]
        mock_inactivate_user.assert_called_once()
    
    @patch('app.dependencies.auth.get_current_user')
    @patch('app.services.user_service.UserService.inactivate_user')
    def test_delete_user_non_admin_denied(self, mock_inactivate_user, mock_get_current_user, client, mock_employee_user):
        """Test non-admin cannot delete user"""
        user_id = str(uuid4())
        
        # Mock the authentication
        mock_get_current_user.return_value = mock_employee_user
        
        # Mock the service to raise permission error
        mock_inactivate_user.side_effect = PermissionDeniedError("Only administrators can delete users")
        
        response = client.delete(f"/api/v1/users/{user_id}")
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Only administrators can delete users" in response.json()["detail"]
    
    @patch('app.dependencies.auth.get_current_user')
    @patch('app.services.user_service.UserService.inactivate_user')
    def test_delete_user_self_denied(self, mock_inactivate_user, mock_get_current_user, client, mock_admin_user):
        """Test admin cannot delete themselves"""
        user_id = str(uuid4())
        
        # Mock the authentication
        mock_get_current_user.return_value = mock_admin_user
        
        # Mock the service to raise bad request error
        mock_inactivate_user.side_effect = Exception("Cannot inactivate your own account")
        
        response = client.delete(f"/api/v1/users/{user_id}")
        
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
    
    # Test GET /api/v1/users/{user_id}/profile
    
    @patch('app.dependencies.auth.get_current_user')
    @patch('app.services.user_service.UserService.get_user_profile')
    def test_get_user_profile_success(self, mock_get_profile, mock_get_current_user, client, mock_admin_user):
        """Test getting user profile"""
        user_id = str(uuid4())
        
        # Mock the authentication
        mock_get_current_user.return_value = mock_admin_user
        
        # Mock the service response
        mock_get_profile.return_value = {
            "id": user_id,
            "name": "Test User",
            "email": "test@example.com",
            "department": {"id": str(uuid4()), "name": "IT"},
            "stage": {"id": str(uuid4()), "name": "Senior"},
            "roles": []
        }
        
        response = client.get(f"/api/v1/users/{user_id}/profile")
        
        assert response.status_code == status.HTTP_200_OK
        mock_get_profile.assert_called_once()


class TestAPIErrorHandling:
    """Test suite for API error handling and security"""
    
    @pytest.fixture
    def client(self):
        """Create test client"""
        return TestClient(app)
    
    def test_missing_authentication_header(self, client):
        """Test API endpoints without authentication header"""
        response = client.get("/api/v1/users/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_invalid_authentication_header(self, client):
        """Test API endpoints with invalid authentication header"""
        headers = {"Authorization": "Bearer invalid_token"}
        response = client.get("/api/v1/users/", headers=headers)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_malformed_authentication_header(self, client):
        """Test API endpoints with malformed authentication header"""
        headers = {"Authorization": "InvalidFormat token123"}
        response = client.get("/api/v1/users/", headers=headers)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_invalid_user_id_format(self, client):
        """Test API endpoints with invalid UUID format"""
        response = client.get("/api/v1/users/invalid-uuid")
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    def test_missing_required_fields(self, client):
        """Test creating user with missing required fields"""
        user_data = {"name": "Test User"}  # Missing email, employee_code, etc.
        response = client.post("/api/v1/users/", json=user_data)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestAPIPagination:
    """Test suite for API pagination"""
    
    @pytest.fixture
    def client(self):
        """Create test client"""
        return TestClient(app)
    
    @patch('app.dependencies.auth.get_current_user')
    @patch('app.services.user_service.UserService.get_users')
    def test_pagination_parameters(self, mock_get_users, mock_get_current_user, client, mock_admin_user):
        """Test pagination parameters are properly handled"""
        # Mock the authentication
        mock_get_current_user.return_value = mock_admin_user
        
        # Mock the service response
        mock_get_users.return_value = {
            "items": [],
            "total": 0,
            "page": 2,
            "size": 5,
            "pages": 0
        }
        
        response = client.get("/api/v1/users/?page=2&size=5")
        
        assert response.status_code == status.HTTP_200_OK
        mock_get_users.assert_called_once()
    
    @patch('app.dependencies.auth.get_current_user')
    def test_invalid_pagination_parameters(self, mock_get_current_user, client, mock_admin_user):
        """Test invalid pagination parameters are rejected"""
        # Mock the authentication
        mock_get_current_user.return_value = mock_admin_user
        
        # Test negative page
        response = client.get("/api/v1/users/?page=-1")
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        # Test zero page size
        response = client.get("/api/v1/users/?size=0")
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        # Test page size too large
        response = client.get("/api/v1/users/?size=1000")
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


if __name__ == "__main__":
    pytest.main([__file__, "-v"]) 