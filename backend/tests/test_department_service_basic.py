"""
Basic tests for DepartmentService to verify functionality
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from uuid import uuid4, UUID

from app.services.department_service import DepartmentService
from app.schemas.department import DepartmentCreate, DepartmentUpdate
from app.database.models.user import Department as DepartmentModel
from app.core.exceptions import (
    NotFoundError, ConflictError, ValidationError, 
    PermissionDeniedError, BadRequestError
)


class TestDepartmentServiceBasic:
    """Basic test cases for DepartmentService"""
    
    @pytest.fixture
    def department_service(self):
        """DepartmentService fixture"""
        return DepartmentService()
    
    @pytest.fixture
    def sample_admin_user(self):
        """Sample admin user"""
        return {
            "sub": "admin_123",
            "role": "admin",
            "email": "admin@example.com"
        }
    
    @pytest.fixture
    def sample_employee_user(self):
        """Sample employee user"""
        return {
            "sub": "employee_123", 
            "role": "employee",
            "email": "employee@example.com"
        }
    
    @pytest.fixture
    def sample_department_data(self):
        """Sample department data"""
        return DepartmentCreate(
            name="Engineering",
            description="Software engineering department"
        )
    
    @pytest.fixture
    def sample_department_model(self):
        """Sample department model"""
        dept_id = uuid4()
        dept = DepartmentModel()
        dept.id = dept_id
        dept.name = "Engineering"
        dept.description = "Software engineering department"
        dept.created_at = "2025-01-01T00:00:00Z"
        dept.updated_at = "2025-01-01T00:00:00Z"
        return dept
    
    @pytest.mark.asyncio
    async def test_service_initialization(self, department_service):
        """Test that DepartmentService initializes correctly"""
        assert department_service is not None
        assert department_service.dept_repo is not None
    
    @pytest.mark.asyncio
    @patch('app.services.department_service.DepartmentRepository')
    async def test_create_department_admin_success(
        self, 
        mock_dept_repo_class,
        department_service, 
        sample_admin_user, 
        sample_department_data,
        sample_department_model
    ):
        """Test successful department creation by admin"""
        # Mock repository
        mock_dept_repo = AsyncMock()
        mock_dept_repo_class.return_value = mock_dept_repo
        mock_dept_repo.get_by_name.return_value = None  # No existing department
        mock_dept_repo.create_department.return_value = sample_department_model
        
        # Replace the repository instance
        department_service.dept_repo = mock_dept_repo
        
        # Test creation
        result = await department_service.create_department(
            sample_department_data, 
            sample_admin_user
        )
        
        # Verify
        assert result is not None
        assert result.name == "Engineering"
        mock_dept_repo.create_department.assert_called_once()
    
    @pytest.mark.asyncio
    @patch('app.services.department_service.DepartmentRepository')
    async def test_create_department_non_admin_denied(
        self, 
        mock_dept_repo_class,
        department_service, 
        sample_employee_user, 
        sample_department_data
    ):
        """Test that non-admin cannot create department"""
        # Mock repository
        mock_dept_repo = AsyncMock()
        mock_dept_repo_class.return_value = mock_dept_repo
        department_service.dept_repo = mock_dept_repo
        
        # Test creation should fail
        with pytest.raises(PermissionDeniedError) as exc_info:
            await department_service.create_department(
                sample_department_data, 
                sample_employee_user
            )
        
        assert "Only administrators can create departments" in str(exc_info.value)
        mock_dept_repo.create_department.assert_not_called()
    
    @pytest.mark.asyncio
    @patch('app.services.department_service.DepartmentRepository')
    async def test_get_department_by_id_admin_success(
        self, 
        mock_dept_repo_class,
        department_service, 
        sample_admin_user,
        sample_department_model
    ):
        """Test admin can get any department by ID"""
        dept_id = sample_department_model.id
        
        # Mock repository
        mock_dept_repo = AsyncMock()
        mock_dept_repo_class.return_value = mock_dept_repo
        mock_dept_repo.get_by_id.return_value = sample_department_model
        department_service.dept_repo = mock_dept_repo
        
        # Mock user count for enrichment
        with patch('app.database.repositories.user_repo.UserRepository') as mock_user_repo_class:
            mock_user_repo = AsyncMock()
            mock_user_repo_class.return_value = mock_user_repo
            mock_user_repo.count_users.return_value = 5
            
            # Test get department
            result = await department_service.get_department_by_id(
                dept_id, 
                sample_admin_user
            )
        
        # Verify
        assert result is not None
        assert result.id == dept_id
        assert result.name == "Engineering"
        assert result.user_count == 5
        mock_dept_repo.get_by_id.assert_called_once_with(dept_id)
    
    @pytest.mark.asyncio
    @patch('app.services.department_service.DepartmentRepository')
    async def test_get_department_by_id_not_found(
        self, 
        mock_dept_repo_class,
        department_service, 
        sample_admin_user
    ):
        """Test get department by ID when department doesn't exist"""
        dept_id = uuid4()
        
        # Mock repository
        mock_dept_repo = AsyncMock()
        mock_dept_repo_class.return_value = mock_dept_repo
        mock_dept_repo.get_by_id.return_value = None  # Department not found
        department_service.dept_repo = mock_dept_repo
        
        # Test should raise NotFoundError
        with pytest.raises(NotFoundError) as exc_info:
            await department_service.get_department_by_id(
                dept_id, 
                sample_admin_user
            )
        
        assert f"Department with ID {dept_id} not found" in str(exc_info.value)
    
    @pytest.mark.asyncio
    @patch('app.services.department_service.DepartmentRepository')
    async def test_update_department_admin_success(
        self, 
        mock_dept_repo_class,
        department_service, 
        sample_admin_user,
        sample_department_model
    ):
        """Test successful department update by admin"""
        dept_id = sample_department_model.id
        update_data = DepartmentUpdate(name="Updated Engineering")
        
        # Mock repository
        mock_dept_repo = AsyncMock()
        mock_dept_repo_class.return_value = mock_dept_repo
        mock_dept_repo.get_by_id.return_value = sample_department_model
        mock_dept_repo.get_by_name.return_value = None  # No name conflict
        
        # Create updated department
        updated_dept = DepartmentModel()
        updated_dept.id = dept_id
        updated_dept.name = "Updated Engineering"
        updated_dept.description = sample_department_model.description
        mock_dept_repo.update_department.return_value = updated_dept
        
        department_service.dept_repo = mock_dept_repo
        
        # Test update
        result = await department_service.update_department(
            dept_id, 
            update_data, 
            sample_admin_user
        )
        
        # Verify
        assert result is not None
        assert result.name == "Updated Engineering"
        mock_dept_repo.update_department.assert_called_once()
    
    @pytest.mark.asyncio
    @patch('app.services.department_service.DepartmentRepository')
    async def test_delete_department_admin_success(
        self, 
        mock_dept_repo_class,
        department_service, 
        sample_admin_user,
        sample_department_model
    ):
        """Test successful department deletion by admin"""
        dept_id = sample_department_model.id
        
        # Mock repository
        mock_dept_repo = AsyncMock()
        mock_dept_repo_class.return_value = mock_dept_repo
        mock_dept_repo.get_by_id.return_value = sample_department_model
        mock_dept_repo.delete_department.return_value = True
        department_service.dept_repo = mock_dept_repo
        
        # Mock user repository for validation
        with patch('app.database.repositories.user_repo.UserRepository') as mock_user_repo_class:
            mock_user_repo = AsyncMock()
            mock_user_repo_class.return_value = mock_user_repo
            mock_user_repo.count_users.return_value = 0  # No active users
            
            # Test deletion
            result = await department_service.delete_department(
                dept_id, 
                sample_admin_user
            )
        
        # Verify
        assert result is not None
        assert result["message"] == "Department deleted successfully"
        mock_dept_repo.delete_department.assert_called_once()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])