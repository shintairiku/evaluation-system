import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
from datetime import datetime
from fastapi.testclient import TestClient
from fastapi import status

from app.main import app
from app.database.repositories.department_repo import DepartmentRepository
from app.database.repositories.user_repo import UserRepository
from app.schemas.department import DepartmentCreate, DepartmentUpdate
from app.core.exceptions import (
    NotFoundError, ConflictError, ValidationError, 
    PermissionDeniedError, BadRequestError
)

client = TestClient(app)


class TestDepartmentAPIIntegration:
    """Integration tests for Department API endpoints with seed data"""
    
    @pytest.fixture
    def mock_auth_dependency(self):
        """Mock authentication dependency"""
        with patch('app.dependencies.auth.get_current_user') as mock:
            yield mock
    
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
    def sample_departments_data(self):
        """Sample departments data for testing"""
        return [
            {
                "name": "Engineering",
                "description": "Software engineering department"
            },
            {
                "name": "Marketing",
                "description": "Marketing and communications department"
            },
            {
                "name": "Human Resources",
                "description": "HR and recruitment department"
            },
            {
                "name": "Finance",
                "description": "Finance and accounting department"
            },
            {
                "name": "Sales",
                "description": "Sales and business development department"
            }
        ]
    
    @pytest.fixture
    def sample_users_data(self):
        """Sample users data for testing"""
        return [
            {
                "clerk_user_id": "user_001",
                "name": "John Doe",
                "email": "john.doe@example.com",
                "employee_code": "EMP001",
                "status": "active"
            },
            {
                "clerk_user_id": "user_002",
                "name": "Jane Smith",
                "email": "jane.smith@example.com",
                "employee_code": "EMP002",
                "status": "active"
            },
            {
                "clerk_user_id": "user_003",
                "name": "Bob Johnson",
                "email": "bob.johnson@example.com",
                "employee_code": "EMP003",
                "status": "inactive"
            }
        ]
    
    @pytest.mark.asyncio
    async def test_department_crud_operations_with_seed_data(self, mock_auth_dependency, admin_user_token, sample_departments_data):
        """Test complete CRUD operations with seed data"""
        # Mock authentication
        mock_auth_dependency.return_value = admin_user_token
        
        # Test 1: Create departments
        created_departments = []
        for dept_data in sample_departments_data:
            response = client.post("/api/v1/departments/", json=dept_data)
            assert response.status_code == 200
            created_dept = response.json()
            created_departments.append(created_dept["department"])
            assert created_dept["department"]["name"] == dept_data["name"]
            assert created_dept["message"] == "Department created successfully"
        
        # Test 2: Get all departments
        response = client.get("/api/v1/departments/")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= len(sample_departments_data)
        assert len(data["items"]) >= len(sample_departments_data)
        
        # Test 3: Get specific department
        first_dept_id = created_departments[0]["id"]
        response = client.get(f"/api/v1/departments/{first_dept_id}")
        assert response.status_code == 200
        dept_detail = response.json()
        assert dept_detail["id"] == first_dept_id
        assert dept_detail["name"] == sample_departments_data[0]["name"]
        
        # Test 4: Update department
        update_data = {
            "name": "Updated Engineering Department",
            "description": "Updated software engineering department"
        }
        response = client.put(f"/api/v1/departments/{first_dept_id}", json=update_data)
        assert response.status_code == 200
        updated_dept = response.json()
        assert updated_dept["department"]["name"] == update_data["name"]
        assert updated_dept["message"] == "Department updated successfully"
        
        # Test 5: Verify update
        response = client.get(f"/api/v1/departments/{first_dept_id}")
        assert response.status_code == 200
        dept_detail = response.json()
        assert dept_detail["name"] == update_data["name"]
        assert dept_detail["description"] == update_data["description"]
    
    @pytest.mark.asyncio
    async def test_department_search_and_filtering(self, mock_auth_dependency, admin_user_token, sample_departments_data):
        """Test department search and filtering functionality"""
        # Mock authentication
        mock_auth_dependency.return_value = admin_user_token
        
        # Create test departments
        for dept_data in sample_departments_data:
            client.post("/api/v1/departments/", json=dept_data)
        
        # Test search by name
        response = client.get("/api/v1/departments/?search=Engineering")
        assert response.status_code == 200
        data = response.json()
        # Should find Engineering department
        assert any("Engineering" in dept["name"] for dept in data["items"])
        
        # Test search by description
        response = client.get("/api/v1/departments/?search=software")
        assert response.status_code == 200
        data = response.json()
        # Should find Engineering department (contains "software" in description)
        assert any("Engineering" in dept["name"] for dept in data["items"])
        
        # Test pagination
        response = client.get("/api/v1/departments/?page=1&limit=2")
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) <= 2
        assert data["page"] == 1
        assert data["limit"] == 2
        
        # Test sorting by name
        response = client.get("/api/v1/departments/?sort_by=name&sort_order=asc")
        assert response.status_code == 200
        data = response.json()
        if len(data["items"]) >= 2:
            # Verify ascending order
            names = [dept["name"] for dept in data["items"]]
            assert names == sorted(names)
        
        # Test sorting by name descending
        response = client.get("/api/v1/departments/?sort_by=name&sort_order=desc")
        assert response.status_code == 200
        data = response.json()
        if len(data["items"]) >= 2:
            # Verify descending order
            names = [dept["name"] for dept in data["items"]]
            assert names == sorted(names, reverse=True)
    
    @pytest.mark.asyncio
    async def test_department_permission_checks(self, mock_auth_dependency, manager_user_token, employee_user_token, sample_departments_data):
        """Test department permission checks for different user roles"""
        # Create a department first with admin
        admin_token = {
            "sub": "admin_user_123",
            "role": "admin",
            "email": "admin@example.com"
        }
        mock_auth_dependency.return_value = admin_token
        
        dept_data = sample_departments_data[0]
        response = client.post("/api/v1/departments/", json=dept_data)
        assert response.status_code == 200
        created_dept = response.json()["department"]
        dept_id = created_dept["id"]
        
        # Test manager permissions
        mock_auth_dependency.return_value = manager_user_token
        
        # Manager should be able to view departments (managed ones)
        response = client.get("/api/v1/departments/")
        # This might succeed or fail depending on whether the manager manages any departments
        # The important thing is that it doesn't crash
        
        # Manager should not be able to create departments
        response = client.post("/api/v1/departments/", json=dept_data)
        assert response.status_code == 403
        
        # Manager should not be able to update departments
        update_data = {"name": "Updated Department"}
        response = client.put(f"/api/v1/departments/{dept_id}", json=update_data)
        assert response.status_code == 403
        
        # Manager should not be able to delete departments
        response = client.delete(f"/api/v1/departments/{dept_id}")
        assert response.status_code == 403
        
        # Test employee permissions
        mock_auth_dependency.return_value = employee_user_token
        
        # Employee should not be able to create departments
        response = client.post("/api/v1/departments/", json=dept_data)
        assert response.status_code == 403
        
        # Employee should not be able to update departments
        response = client.put(f"/api/v1/departments/{dept_id}", json=update_data)
        assert response.status_code == 403
        
        # Employee should not be able to delete departments
        response = client.delete(f"/api/v1/departments/{dept_id}")
        assert response.status_code == 403
    
    @pytest.mark.asyncio
    async def test_department_validation_errors(self, mock_auth_dependency, admin_user_token):
        """Test department validation error handling"""
        # Mock authentication
        mock_auth_dependency.return_value = admin_user_token
        
        # Test empty name
        invalid_data = {"name": "", "description": "Test department"}
        response = client.post("/api/v1/departments/", json=invalid_data)
        assert response.status_code == 400
        
        # Test missing name
        invalid_data = {"description": "Test department"}
        response = client.post("/api/v1/departments/", json=invalid_data)
        assert response.status_code == 422  # Pydantic validation error
        
        # Test name too long
        invalid_data = {"name": "A" * 101, "description": "Test department"}
        response = client.post("/api/v1/departments/", json=invalid_data)
        assert response.status_code == 400
        
        # Test description too long
        invalid_data = {"name": "Test Department", "description": "A" * 501}
        response = client.post("/api/v1/departments/", json=invalid_data)
        assert response.status_code == 400
    
    @pytest.mark.asyncio
    async def test_department_conflict_handling(self, mock_auth_dependency, admin_user_token):
        """Test department conflict error handling"""
        # Mock authentication
        mock_auth_dependency.return_value = admin_user_token
        
        # Create first department
        dept_data = {"name": "Test Department", "description": "Test description"}
        response = client.post("/api/v1/departments/", json=dept_data)
        assert response.status_code == 200
        
        # Try to create department with same name
        response = client.post("/api/v1/departments/", json=dept_data)
        assert response.status_code == 409  # Conflict error
    
    @pytest.mark.asyncio
    async def test_department_not_found_handling(self, mock_auth_dependency, admin_user_token):
        """Test department not found error handling"""
        # Mock authentication
        mock_auth_dependency.return_value = admin_user_token
        
        # Try to get non-existent department
        fake_id = str(uuid4())
        response = client.get(f"/api/v1/departments/{fake_id}")
        assert response.status_code == 404
        
        # Try to update non-existent department
        update_data = {"name": "Updated Department"}
        response = client.put(f"/api/v1/departments/{fake_id}", json=update_data)
        assert response.status_code == 404
        
        # Try to delete non-existent department
        response = client.delete(f"/api/v1/departments/{fake_id}")
        assert response.status_code == 404
    
    @pytest.mark.asyncio
    async def test_department_users_endpoint(self, mock_auth_dependency, admin_user_token, sample_departments_data):
        """Test department users endpoint"""
        # Mock authentication
        mock_auth_dependency.return_value = admin_user_token
        
        # Create a department
        dept_data = sample_departments_data[0]
        response = client.post("/api/v1/departments/", json=dept_data)
        assert response.status_code == 200
        created_dept = response.json()["department"]
        dept_id = created_dept["id"]
        
        # Test getting department users
        response = client.get(f"/api/v1/departments/{dept_id}/users")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "limit" in data
        
        # Test with pagination
        response = client.get(f"/api/v1/departments/{dept_id}/users?page=1&limit=5")
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["limit"] == 5
        
        # Test with search
        response = client.get(f"/api/v1/departments/{dept_id}/users?search=test")
        assert response.status_code == 200
        
        # Test with status filter
        response = client.get(f"/api/v1/departments/{dept_id}/users?status=active")
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_department_statistics_endpoint(self, mock_auth_dependency, admin_user_token, sample_departments_data):
        """Test department statistics endpoint"""
        # Mock authentication
        mock_auth_dependency.return_value = admin_user_token
        
        # Create a department
        dept_data = sample_departments_data[0]
        response = client.post("/api/v1/departments/", json=dept_data)
        assert response.status_code == 200
        created_dept = response.json()["department"]
        dept_id = created_dept["id"]
        
        # Test getting department statistics
        response = client.get(f"/api/v1/departments/{dept_id}/statistics")
        # This should return 501 since it's not implemented yet
        assert response.status_code == 501
    
    @pytest.mark.asyncio
    async def test_user_assignment_endpoints(self, mock_auth_dependency, admin_user_token, sample_departments_data):
        """Test user assignment endpoints"""
        # Mock authentication
        mock_auth_dependency.return_value = admin_user_token
        
        # Create a department
        dept_data = sample_departments_data[0]
        response = client.post("/api/v1/departments/", json=dept_data)
        assert response.status_code == 200
        created_dept = response.json()["department"]
        dept_id = created_dept["id"]
        
        # Test assigning user to department
        user_id = str(uuid4())
        response = client.post(f"/api/v1/departments/{dept_id}/users/{user_id}")
        # This should return 501 since it's not implemented yet
        assert response.status_code == 501
        
        # Test removing user from department
        response = client.delete(f"/api/v1/departments/{dept_id}/users/{user_id}")
        # This should return 501 since it's not implemented yet
        assert response.status_code == 501
    
    @pytest.mark.asyncio
    async def test_query_parameter_edge_cases(self, mock_auth_dependency, admin_user_token):
        """Test query parameter edge cases"""
        # Mock authentication
        mock_auth_dependency.return_value = admin_user_token
        
        # Test with very long search term
        long_search = "a" * 1000
        response = client.get(f"/api/v1/departments/?search={long_search}")
        # Should handle gracefully, not crash
        
        # Test with special characters in search
        special_search = "!@#$%^&*()"
        response = client.get(f"/api/v1/departments/?search={special_search}")
        # Should handle gracefully
        
        # Test with negative values (should be rejected by validation)
        response = client.get("/api/v1/departments/?page=-1")
        assert response.status_code == 422
        
        response = client.get("/api/v1/departments/?limit=-1")
        assert response.status_code == 422
        
        # Test with very large values
        response = client.get("/api/v1/departments/?limit=1000")
        assert response.status_code == 422  # Should be rejected
    
    @pytest.mark.asyncio
    async def test_concurrent_department_operations(self, mock_auth_dependency, admin_user_token, sample_departments_data):
        """Test concurrent department operations"""
        # Mock authentication
        mock_auth_dependency.return_value = admin_user_token
        
        # Create multiple departments concurrently
        import asyncio
        import concurrent.futures
        
        def create_department(dept_data):
            return client.post("/api/v1/departments/", json=dept_data)
        
        # Create departments concurrently
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [
                executor.submit(create_department, dept_data)
                for dept_data in sample_departments_data
            ]
            responses = [future.result() for future in futures]
        
        # All should succeed
        for response in responses:
            assert response.status_code == 200
        
        # Verify all departments were created
        response = client.get("/api/v1/departments/")
        assert response.status_code == 200
        data = response.json()
        # Should have at least the number of departments we created
        assert data["total"] >= len(sample_departments_data) 