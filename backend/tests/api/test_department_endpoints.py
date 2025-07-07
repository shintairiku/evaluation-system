import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
from datetime import datetime
from fastapi.testclient import TestClient
from fastapi import status

from app.main import app
from app.services.department_service import DepartmentService
from app.schemas.department import DepartmentCreate, DepartmentUpdate
from app.core.exceptions import (
    NotFoundError, ConflictError, ValidationError, 
    PermissionDeniedError, BadRequestError
)

client = TestClient(app)


class TestDepartmentAPIEndpoints:
    """Test cases for Department API endpoints"""
    
    @pytest.fixture
    def mock_department_service(self):
        """Mock DepartmentService"""
        with patch('app.api.v1.departments.DepartmentService') as mock_class:
            mock_instance = AsyncMock()
            mock_class.return_value = mock_instance
            yield mock_instance
    
    @pytest.fixture
    def admin_user_token(self):
        """Admin user authentication token"""
        return {
            "sub": "admin_user_123",
            "role": "admin",
            "email": "admin@example.com"
        }
    
    @pytest.fixture
    def manager_user_token(self):
        """Manager user authentication token"""
        return {
            "sub": "manager_user_456",
            "role": "manager",
            "email": "manager@example.com"
        }
    
    @pytest.fixture
    def employee_user_token(self):
        """Employee user authentication token"""
        return {
            "sub": "employee_user_789",
            "role": "employee",
            "email": "employee@example.com"
        }
    
    @pytest.fixture
    def sample_department_data(self):
        """Sample department data for testing"""
        return {
            "name": "Test Engineering Department",
            "description": "A test department for API testing"
        }
    
    @pytest.fixture
    def sample_department_response(self):
        """Sample department response"""
        dept_id = uuid4()
        return {
            "id": str(dept_id),
            "name": "Test Engineering Department",
            "description": "A test department for API testing",
            "created_at": "2025-01-01T00:00:00Z",
            "updated_at": "2025-01-01T00:00:00Z"
        }
    
    @pytest.fixture
    def sample_department_detail_response(self):
        """Sample department detail response"""
        dept_id = uuid4()
        return {
            "id": str(dept_id),
            "name": "Test Engineering Department",
            "description": "A test department for API testing",
            "created_at": "2025-01-01T00:00:00Z",
            "updated_at": "2025-01-01T00:00:00Z",
            "user_count": 5,
            "manager": None
        }
    
    @pytest.fixture
    def sample_paginated_response(self):
        """Sample paginated response"""
        return {
            "items": [
                {
                    "id": str(uuid4()),
                    "name": "Department 1",
                    "description": "First department",
                    "created_at": "2025-01-01T00:00:00Z",
                    "updated_at": "2025-01-01T00:00:00Z"
                },
                {
                    "id": str(uuid4()),
                    "name": "Department 2",
                    "description": "Second department",
                    "created_at": "2025-01-02T00:00:00Z",
                    "updated_at": "2025-01-02T00:00:00Z"
                }
            ],
            "total": 2,
            "page": 1,
            "limit": 10,
            "pages": 1
        }
    
    @patch('app.dependencies.auth.get_current_user')
    def test_get_departments_success(self, mock_get_current_user, mock_department_service, admin_user_token, sample_paginated_response):
        """Test successful GET /departments/ endpoint"""
        # Mock authentication
        mock_get_current_user.return_value = admin_user_token
        
        # Mock service response
        mock_department_service.get_departments.return_value = sample_paginated_response
        
        # Make request
        response = client.get("/api/v1/departments/")
        
        # Verify response
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        assert len(data["items"]) == 2
        assert data["items"][0]["name"] == "Department 1"
        
        # Verify service was called
        mock_department_service.get_departments.assert_called_once()
    
    @patch('app.dependencies.auth.get_current_user')
    def test_get_departments_with_filters(self, mock_get_current_user, mock_department_service, admin_user_token, sample_paginated_response):
        """Test GET /departments/ with query parameters"""
        # Mock authentication
        mock_get_current_user.return_value = admin_user_token
        
        # Mock service response
        mock_department_service.get_departments.return_value = sample_paginated_response
        
        # Make request with filters
        response = client.get("/api/v1/departments/?search=Engineering&page=1&limit=5&sort_by=name&sort_order=asc")
        
        # Verify response
        assert response.status_code == 200
        
        # Verify service was called with correct parameters
        mock_department_service.get_departments.assert_called_once()
        call_args = mock_department_service.get_departments.call_args
        assert call_args[1]["search_term"] == "Engineering"
        assert call_args[1]["filters"]["sort_by"] == "name"
        assert call_args[1]["filters"]["sort_order"] == "asc"
    
    @patch('app.dependencies.auth.get_current_user')
    def test_get_departments_permission_denied(self, mock_get_current_user, mock_department_service, employee_user_token):
        """Test GET /departments/ with insufficient permissions"""
        # Mock authentication
        mock_get_current_user.return_value = employee_user_token
        
        # Mock service to raise permission error
        mock_department_service.get_departments.side_effect = PermissionDeniedError("Insufficient permissions")
        
        # Make request
        response = client.get("/api/v1/departments/")
        
        # Verify response
        assert response.status_code == 403
        assert "Insufficient permissions" in response.json()["detail"]
    
    @patch('app.dependencies.auth.get_current_user')
    def test_create_department_success(self, mock_get_current_user, mock_department_service, admin_user_token, sample_department_data, sample_department_response):
        """Test successful POST /departments/ endpoint"""
        # Mock authentication
        mock_get_current_user.return_value = admin_user_token
        
        # Mock service response
        mock_department_service.create_department.return_value = sample_department_response
        
        # Make request
        response = client.post("/api/v1/departments/", json=sample_department_data)
        
        # Verify response
        assert response.status_code == 200
        data = response.json()
        assert data["department"]["name"] == sample_department_data["name"]
        assert data["message"] == "Department created successfully"
        
        # Verify service was called
        mock_department_service.create_department.assert_called_once()
    
    @patch('app.dependencies.auth.get_current_user')
    def test_create_department_employee_denied(self, mock_get_current_user, mock_department_service, employee_user_token, sample_department_data):
        """Test POST /departments/ with insufficient permissions"""
        # Mock authentication
        mock_get_current_user.return_value = employee_user_token
        
        # Mock service to raise permission error
        mock_department_service.create_department.side_effect = PermissionDeniedError("Only administrators can create departments")
        
        # Make request
        response = client.post("/api/v1/departments/", json=sample_department_data)
        
        # Verify response
        assert response.status_code == 403
        assert "Only administrators can create departments" in response.json()["detail"]
    
    @patch('app.dependencies.auth.get_current_user')
    def test_create_department_validation_error(self, mock_get_current_user, mock_department_service, admin_user_token):
        """Test POST /departments/ with validation error"""
        # Mock authentication
        mock_get_current_user.return_value = admin_user_token
        
        # Mock service to raise validation error
        mock_department_service.create_department.side_effect = ValidationError("Department name is required")
        
        # Make request with invalid data
        invalid_data = {"name": "", "description": "Invalid department"}
        response = client.post("/api/v1/departments/", json=invalid_data)
        
        # Verify response
        assert response.status_code == 400
        assert "Department name is required" in response.json()["detail"]
    
    @patch('app.dependencies.auth.get_current_user')
    def test_create_department_conflict_error(self, mock_get_current_user, mock_department_service, admin_user_token, sample_department_data):
        """Test POST /departments/ with conflict error"""
        # Mock authentication
        mock_get_current_user.return_value = admin_user_token
        
        # Mock service to raise conflict error
        mock_department_service.create_department.side_effect = ConflictError("Department with name 'Test Engineering Department' already exists")
        
        # Make request
        response = client.post("/api/v1/departments/", json=sample_department_data)
        
        # Verify response
        assert response.status_code == 409
        assert "already exists" in response.json()["detail"]
    
    @patch('app.dependencies.auth.get_current_user')
    def test_get_department_by_id_success(self, mock_get_current_user, mock_department_service, admin_user_token, sample_department_detail_response):
        """Test successful GET /departments/{id} endpoint"""
        dept_id = uuid4()
        
        # Mock authentication
        mock_get_current_user.return_value = admin_user_token
        
        # Mock service response
        mock_department_service.get_department_by_id.return_value = sample_department_detail_response
        
        # Make request
        response = client.get(f"/api/v1/departments/{dept_id}")
        
        # Verify response
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == sample_department_detail_response["name"]
        assert data["user_count"] == 5
        
        # Verify service was called
        mock_department_service.get_department_by_id.assert_called_once_with(dept_id=dept_id, current_user=admin_user_token)
    
    @patch('app.dependencies.auth.get_current_user')
    def test_get_department_by_id_not_found(self, mock_get_current_user, mock_department_service, admin_user_token):
        """Test GET /departments/{id} with non-existent department"""
        dept_id = uuid4()
        
        # Mock authentication
        mock_get_current_user.return_value = admin_user_token
        
        # Mock service to raise not found error
        mock_department_service.get_department_by_id.side_effect = NotFoundError(f"Department with ID {dept_id} not found")
        
        # Make request
        response = client.get(f"/api/v1/departments/{dept_id}")
        
        # Verify response
        assert response.status_code == 404
        assert f"Department with ID {dept_id} not found" in response.json()["detail"]
    
    @patch('app.dependencies.auth.get_current_user')
    def test_update_department_success(self, mock_get_current_user, mock_department_service, admin_user_token, sample_department_response):
        """Test successful PUT /departments/{id} endpoint"""
        dept_id = uuid4()
        update_data = {"name": "Updated Department Name"}
        
        # Mock authentication
        mock_get_current_user.return_value = admin_user_token
        
        # Mock service response
        mock_department_service.update_department.return_value = sample_department_response
        
        # Make request
        response = client.put(f"/api/v1/departments/{dept_id}", json=update_data)
        
        # Verify response
        assert response.status_code == 200
        data = response.json()
        assert data["department"]["name"] == sample_department_response["name"]
        assert data["message"] == "Department updated successfully"
        
        # Verify service was called
        mock_department_service.update_department.assert_called_once_with(
            dept_id=dept_id, 
            dept_data=update_data, 
            current_user=admin_user_token
        )
    
    @patch('app.dependencies.auth.get_current_user')
    def test_delete_department_success(self, mock_get_current_user, mock_department_service, admin_user_token):
        """Test successful DELETE /departments/{id} endpoint"""
        dept_id = uuid4()
        
        # Mock authentication
        mock_get_current_user.return_value = admin_user_token
        
        # Mock service response
        mock_department_service.delete_department.return_value = {"message": "Department deleted successfully"}
        
        # Make request
        response = client.delete(f"/api/v1/departments/{dept_id}")
        
        # Verify response
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["message"] == "Department deleted successfully"
        
        # Verify service was called
        mock_department_service.delete_department.assert_called_once_with(dept_id=dept_id, current_user=admin_user_token)
    
    @patch('app.dependencies.auth.get_current_user')
    def test_get_department_users_success(self, mock_get_current_user, mock_department_service, admin_user_token):
        """Test successful GET /departments/{id}/users endpoint"""
        dept_id = uuid4()
        users_response = {
            "items": [
                {
                    "id": str(uuid4()),
                    "name": "User 1",
                    "email": "user1@example.com",
                    "employee_code": "EMP001",
                    "status": "active"
                }
            ],
            "total": 1,
            "page": 1,
            "limit": 10,
            "pages": 1
        }
        
        # Mock authentication
        mock_get_current_user.return_value = admin_user_token
        
        # Mock service response
        mock_department_service.get_department_users.return_value = users_response
        
        # Make request
        response = client.get(f"/api/v1/departments/{dept_id}/users")
        
        # Verify response
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert len(data["items"]) == 1
        assert data["items"][0]["name"] == "User 1"
        
        # Verify service was called
        mock_department_service.get_department_users.assert_called_once()
    
    @patch('app.dependencies.auth.get_current_user')
    def test_get_department_users_with_filters(self, mock_get_current_user, mock_department_service, admin_user_token):
        """Test GET /departments/{id}/users with query parameters"""
        dept_id = uuid4()
        users_response = {
            "items": [],
            "total": 0,
            "page": 1,
            "limit": 10,
            "pages": 0
        }
        
        # Mock authentication
        mock_get_current_user.return_value = admin_user_token
        
        # Mock service response
        mock_department_service.get_department_users.return_value = users_response
        
        # Make request with filters
        response = client.get(f"/api/v1/departments/{dept_id}/users?status=active&page=1&limit=5&sort_by=name&sort_order=desc")
        
        # Verify response
        assert response.status_code == 200
        
        # Verify service was called with correct parameters
        mock_department_service.get_department_users.assert_called_once()
        call_args = mock_department_service.get_department_users.call_args
        assert call_args[1]["filters"]["status"] == "active"
        assert call_args[1]["filters"]["sort_by"] == "name"
        assert call_args[1]["filters"]["sort_order"] == "desc"
    
    @patch('app.dependencies.auth.get_current_user')
    def test_assign_user_to_department_not_implemented(self, mock_get_current_user, admin_user_token):
        """Test POST /departments/{id}/users/{user_id} endpoint (not implemented)"""
        dept_id = uuid4()
        user_id = uuid4()
        
        # Mock authentication
        mock_get_current_user.return_value = admin_user_token
        
        # Make request
        response = client.post(f"/api/v1/departments/{dept_id}/users/{user_id}")
        
        # Verify response
        assert response.status_code == 501
        assert "not yet implemented" in response.json()["detail"]
    
    @patch('app.dependencies.auth.get_current_user')
    def test_remove_user_from_department_not_implemented(self, mock_get_current_user, admin_user_token):
        """Test DELETE /departments/{id}/users/{user_id} endpoint (not implemented)"""
        dept_id = uuid4()
        user_id = uuid4()
        
        # Mock authentication
        mock_get_current_user.return_value = admin_user_token
        
        # Make request
        response = client.delete(f"/api/v1/departments/{dept_id}/users/{user_id}")
        
        # Verify response
        assert response.status_code == 501
        assert "not yet implemented" in response.json()["detail"]
    
    @patch('app.dependencies.auth.get_current_user')
    def test_get_department_statistics_not_implemented(self, mock_get_current_user, admin_user_token):
        """Test GET /departments/{id}/statistics endpoint (not implemented)"""
        dept_id = uuid4()
        
        # Mock authentication
        mock_get_current_user.return_value = admin_user_token
        
        # Make request
        response = client.get(f"/api/v1/departments/{dept_id}/statistics")
        
        # Verify response
        assert response.status_code == 501
        assert "not yet implemented" in response.json()["detail"]
    
    @patch('app.dependencies.auth.get_current_user')
    def test_invalid_uuid_format(self, mock_get_current_user, admin_user_token):
        """Test endpoints with invalid UUID format"""
        # Mock authentication
        mock_get_current_user.return_value = admin_user_token
        
        # Test with invalid UUID
        invalid_uuid = "invalid-uuid"
        
        # Test GET department by ID
        response = client.get(f"/api/v1/departments/{invalid_uuid}")
        assert response.status_code == 422  # Validation error
        
        # Test PUT department
        response = client.put(f"/api/v1/departments/{invalid_uuid}", json={"name": "Test"})
        assert response.status_code == 422  # Validation error
        
        # Test DELETE department
        response = client.delete(f"/api/v1/departments/{invalid_uuid}")
        assert response.status_code == 422  # Validation error
        
        # Test GET department users
        response = client.get(f"/api/v1/departments/{invalid_uuid}/users")
        assert response.status_code == 422  # Validation error
    
    @patch('app.dependencies.auth.get_current_user')
    def test_query_parameter_validation(self, mock_get_current_user, mock_department_service, admin_user_token, sample_paginated_response):
        """Test query parameter validation"""
        # Mock authentication
        mock_get_current_user.return_value = admin_user_token
        
        # Mock service response
        mock_department_service.get_departments.return_value = sample_paginated_response
        
        # Test invalid page number
        response = client.get("/api/v1/departments/?page=0")
        assert response.status_code == 422  # Validation error
        
        # Test invalid limit
        response = client.get("/api/v1/departments/?limit=0")
        assert response.status_code == 422  # Validation error
        
        # Test limit too high
        response = client.get("/api/v1/departments/?limit=101")
        assert response.status_code == 422  # Validation error
        
        # Test invalid sort order
        response = client.get("/api/v1/departments/?sort_order=invalid")
        assert response.status_code == 422  # Validation error
    
    @patch('app.dependencies.auth.get_current_user')
    def test_internal_server_error_handling(self, mock_get_current_user, mock_department_service, admin_user_token):
        """Test internal server error handling"""
        # Mock authentication
        mock_get_current_user.return_value = admin_user_token
        
        # Mock service to raise unexpected error
        mock_department_service.get_departments.side_effect = Exception("Unexpected error")
        
        # Make request
        response = client.get("/api/v1/departments/")
        
        # Verify response
        assert response.status_code == 500
        assert "Internal server error" in response.json()["detail"] 