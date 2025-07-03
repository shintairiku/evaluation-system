import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
from datetime import datetime

from app.services.department_service import DepartmentService
from app.schemas.department import DepartmentCreate, DepartmentUpdate
from app.schemas.common import PaginationParams
from app.core.exceptions import (
    NotFoundError, ConflictError, ValidationError, 
    PermissionDeniedError, BadRequestError
)
from app.core.permissions import Permission


class TestDepartmentServiceIntegration:
    """Integration tests for DepartmentService with real database operations"""
    
    @pytest.fixture
    def department_service(self):
        """Create DepartmentService instance for testing"""
        return DepartmentService()
    
    @pytest.fixture
    def admin_user(self):
        """Admin user for testing"""
        return {
            "sub": "admin_user_123",
            "role": "admin"
        }
    
    @pytest.fixture
    def manager_user(self):
        """Manager user for testing"""
        return {
            "sub": "manager_user_456",
            "role": "manager"
        }
    
    @pytest.fixture
    def employee_user(self):
        """Employee user for testing"""
        return {
            "sub": "employee_user_789",
            "role": "employee"
        }
    
    @pytest.fixture
    def sample_department_data(self):
        """Sample department data for testing"""
        return DepartmentCreate(
            name="Test Engineering Department",
            description="A test department for integration testing"
        )
    
    @pytest.mark.asyncio
    async def test_create_and_retrieve_department(self, department_service, admin_user, sample_department_data):
        """Test creating a department and then retrieving it"""
        # Mock PermissionManager for admin access
        with patch('app.services.department_service.PermissionManager.has_permission') as mock_perm:
            mock_perm.return_value = True
            
            # Create department
            created_dept = await department_service.create_department(
                dept_data=sample_department_data,
                current_user=admin_user
            )
            
            # Verify department was created
            assert created_dept.name == sample_department_data.name
            assert created_dept.description == sample_department_data.description
            assert created_dept.id is not None
            
            # Retrieve the department
            retrieved_dept = await department_service.get_department_by_id(
                dept_id=created_dept.id,
                current_user=admin_user
            )
            
            # Verify retrieved department matches created one
            assert retrieved_dept.id == created_dept.id
            assert retrieved_dept.name == created_dept.name
            assert retrieved_dept.description == created_dept.description
    
    @pytest.mark.asyncio
    async def test_update_department(self, department_service, admin_user, sample_department_data):
        """Test updating a department"""
        # Mock PermissionManager for admin access
        with patch('app.services.department_service.PermissionManager.has_permission') as mock_perm:
            mock_perm.return_value = True
            
            # Create department first
            created_dept = await department_service.create_department(
                dept_data=sample_department_data,
                current_user=admin_user
            )
            
            # Update department
            update_data = DepartmentUpdate(
                name="Updated Engineering Department",
                description="Updated description for testing"
            )
            
            updated_dept = await department_service.update_department(
                dept_id=created_dept.id,
                dept_data=update_data,
                current_user=admin_user
            )
            
            # Verify department was updated
            assert updated_dept.id == created_dept.id
            assert updated_dept.name == update_data.name
            assert updated_dept.description == update_data.description
            assert updated_dept.updated_at > created_dept.created_at
    
    @pytest.mark.asyncio
    async def test_delete_department(self, department_service, admin_user, sample_department_data):
        """Test deleting a department"""
        # Mock PermissionManager for admin access
        with patch('app.services.department_service.PermissionManager.has_permission') as mock_perm:
            mock_perm.return_value = True
            
            # Create department first
            created_dept = await department_service.create_department(
                dept_data=sample_department_data,
                current_user=admin_user
            )
            
            # Delete department
            result = await department_service.delete_department(
                dept_id=created_dept.id,
                current_user=admin_user
            )
            
            # Verify department was deleted
            assert result["message"] == "Department deleted successfully"
            
            # Verify department no longer exists
            with pytest.raises(NotFoundError):
                await department_service.get_department_by_id(
                    dept_id=created_dept.id,
                    current_user=admin_user
                )
    
    @pytest.mark.asyncio
    async def test_get_departments_pagination(self, department_service, admin_user):
        """Test getting departments with pagination"""
        # Mock PermissionManager for admin access
        with patch('app.services.department_service.PermissionManager.has_permission') as mock_perm:
            mock_perm.return_value = True
            
            # Create multiple departments
            dept_names = ["Dept A", "Dept B", "Dept C", "Dept D", "Dept E"]
            created_depts = []
            
            for name in dept_names:
                dept_data = DepartmentCreate(name=name, description=f"Description for {name}")
                dept = await department_service.create_department(
                    dept_data=dept_data,
                    current_user=admin_user
                )
                created_depts.append(dept)
            
            # Test pagination - first page
            result_page1 = await department_service.get_departments(
                current_user=admin_user,
                pagination=PaginationParams(page=1, limit=2)
            )
            
            assert result_page1.total >= len(dept_names)
            assert len(result_page1.items) == 2
            
            # Test pagination - second page
            result_page2 = await department_service.get_departments(
                current_user=admin_user,
                pagination=PaginationParams(page=2, limit=2)
            )
            
            assert len(result_page2.items) == 2
            
            # Verify different items on different pages
            page1_ids = {dept.id for dept in result_page1.items}
            page2_ids = {dept.id for dept in result_page2.items}
            assert page1_ids != page2_ids
    
    @pytest.mark.asyncio
    async def test_search_departments(self, department_service, admin_user):
        """Test searching departments by name and description"""
        # Mock PermissionManager for admin access
        with patch('app.services.department_service.PermissionManager.has_permission') as mock_perm:
            mock_perm.return_value = True
            
            # Create departments with specific names
            dept_data1 = DepartmentCreate(
                name="Software Engineering",
                description="Develops software applications"
            )
            dept_data2 = DepartmentCreate(
                name="Hardware Engineering",
                description="Develops hardware systems"
            )
            dept_data3 = DepartmentCreate(
                name="Marketing",
                description="Handles marketing activities"
            )
            
            await department_service.create_department(dept_data1, admin_user)
            await department_service.create_department(dept_data2, admin_user)
            await department_service.create_department(dept_data3, admin_user)
            
            # Search by "Engineering"
            result = await department_service.get_departments(
                current_user=admin_user,
                search_term="Engineering"
            )
            
            # Should find both engineering departments
            assert result.total >= 2
            for dept in result.items:
                assert "Engineering" in dept.name
            
            # Search by "Marketing"
            result = await department_service.get_departments(
                current_user=admin_user,
                search_term="Marketing"
            )
            
            # Should find marketing department
            assert result.total >= 1
            assert any("Marketing" in dept.name for dept in result.items)
    
    @pytest.mark.asyncio
    async def test_department_name_uniqueness(self, department_service, admin_user):
        """Test that department names must be unique"""
        # Mock PermissionManager for admin access
        with patch('app.services.department_service.PermissionManager.has_permission') as mock_perm:
            mock_perm.return_value = True
            
            # Create first department
            dept_data = DepartmentCreate(
                name="Unique Department",
                description="First department with this name"
            )
            
            await department_service.create_department(dept_data, admin_user)
            
            # Try to create second department with same name
            duplicate_data = DepartmentCreate(
                name="Unique Department",
                description="Second department with same name"
            )
            
            with pytest.raises(ConflictError, match="Department with name 'Unique Department' already exists"):
                await department_service.create_department(duplicate_data, admin_user)
    
    @pytest.mark.asyncio
    async def test_employee_access_restrictions(self, department_service, employee_user):
        """Test that employees have restricted access to departments"""
        # Mock PermissionManager for employee access
        with patch('app.services.department_service.PermissionManager.has_permission') as mock_perm:
            mock_perm.side_effect = lambda role, perm: perm == Permission.DEPARTMENT_READ_OWN
            
            # Mock user repository to return employee with department
            with patch('app.services.department_service.UserRepository') as mock_user_repo:
                mock_user_repo.return_value.get_by_clerk_id.return_value = MagicMock(
                    id=uuid4(),
                    department_id=uuid4()
                )
                
                # Mock department repository
                with patch('app.services.department_service.DepartmentRepository') as mock_dept_repo:
                    mock_dept_repo.return_value.get_by_id.return_value = MagicMock(
                        id=uuid4(),
                        name="Employee Dept",
                        description="Employee Department"
                    )
                    
                    # Employee should be able to see their own department
                    result = await department_service.get_departments(
                        current_user=employee_user,
                        pagination=PaginationParams(page=1, limit=10)
                    )
                    
                    assert result.total == 1
                    assert len(result.items) == 1
    
    @pytest.mark.asyncio
    async def test_manager_access_restrictions(self, department_service, manager_user):
        """Test that managers have restricted access to departments"""
        # Mock PermissionManager for manager access
        with patch('app.services.department_service.PermissionManager.has_permission') as mock_perm:
            mock_perm.side_effect = lambda role, perm: perm == Permission.DEPARTMENT_READ_MANAGED
            
            # Mock department repository to return empty list (no managed departments)
            with patch('app.services.department_service.DepartmentRepository') as mock_dept_repo:
                mock_dept_repo.return_value.get_by_manager.return_value = []
                
                # Manager with no managed departments should get empty result
                result = await department_service.get_departments(
                    current_user=manager_user,
                    pagination=PaginationParams(page=1, limit=10)
                )
                
                assert result.total == 0
                assert len(result.items) == 0
    
    @pytest.mark.asyncio
    async def test_validation_errors(self, department_service, admin_user):
        """Test various validation errors"""
        # Mock PermissionManager for admin access
        with patch('app.services.department_service.PermissionManager.has_permission') as mock_perm:
            mock_perm.return_value = True
            
            # Test empty name
            with pytest.raises(ValidationError, match="Department name is required"):
                await department_service.create_department(
                    DepartmentCreate(name="", description="Test"),
                    admin_user
                )
            
            # Test name too short
            with pytest.raises(ValidationError, match="Department name must be at least 2 characters long"):
                await department_service.create_department(
                    DepartmentCreate(name="A", description="Test"),
                    admin_user
                )
            
            # Test name too long
            long_name = "A" * 101
            with pytest.raises(ValidationError, match="Department name must be at most 100 characters long"):
                await department_service.create_department(
                    DepartmentCreate(name=long_name, description="Test"),
                    admin_user
                )
    
    @pytest.mark.asyncio
    async def test_permission_denied_errors(self, department_service, employee_user):
        """Test permission denied errors for various operations"""
        # Mock PermissionManager to deny all permissions
        with patch('app.services.department_service.PermissionManager.has_permission') as mock_perm:
            mock_perm.return_value = False
            
            # Test creating department
            with pytest.raises(PermissionDeniedError, match="Only administrators can create departments"):
                await department_service.create_department(
                    DepartmentCreate(name="Test Dept", description="Test"),
                    employee_user
                )
            
            # Test updating department
            with pytest.raises(PermissionDeniedError, match="Only administrators can update departments"):
                await department_service.update_department(
                    uuid4(),
                    DepartmentUpdate(name="Updated Dept"),
                    employee_user
                )
            
            # Test deleting department
            with pytest.raises(PermissionDeniedError, match="Only administrators can delete departments"):
                await department_service.delete_department(
                    uuid4(),
                    employee_user
                )
    
    @pytest.mark.asyncio
    async def test_department_detail_enrichment(self, department_service, admin_user, sample_department_data):
        """Test that department details are properly enriched with additional data"""
        # Mock PermissionManager for admin access
        with patch('app.services.department_service.PermissionManager.has_permission') as mock_perm:
            mock_perm.return_value = True
            
            # Create department
            created_dept = await department_service.create_department(
                dept_data=sample_department_data,
                current_user=admin_user
            )
            
            # Get department details
            dept_detail = await department_service.get_department_by_id(
                dept_id=created_dept.id,
                current_user=admin_user
            )
            
            # Verify enriched data
            assert dept_detail.id == created_dept.id
            assert dept_detail.name == created_dept.name
            assert dept_detail.description == created_dept.description
            assert hasattr(dept_detail, 'user_count')
            assert hasattr(dept_detail, 'manager')
            assert dept_detail.created_at is not None
            assert dept_detail.updated_at is not None 