"""
Tests for DepartmentRepository
"""

import pytest
from uuid import uuid4, UUID
from datetime import datetime
from unittest.mock import AsyncMock, patch, MagicMock

from app.database.repositories.department_repo import DepartmentRepository
from app.schemas.department import DepartmentCreate, DepartmentUpdate
from app.database.models.user import Department


class TestDepartmentRepository:
    """Test cases for DepartmentRepository"""
    
    @pytest.fixture
    def department_repo(self):
        """DepartmentRepository fixture"""
        return DepartmentRepository()
    
    @pytest.fixture
    def sample_department_data(self):
        """Sample department data for testing"""
        return {
            "id": str(uuid4()),
            "name": "Engineering",
            "description": "Software engineering department",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
    
    @pytest.fixture
    def sample_department(self, sample_department_data):
        """Sample Department model instance"""
        return Department(**sample_department_data)
    
    @pytest.mark.asyncio
    async def test_get_by_id_success(self, department_repo, sample_department_data):
        """Test successful department retrieval by ID"""
        dept_id = UUID(sample_department_data["id"])
        sample_dept = Department(**sample_department_data)
        
        with patch('app.database.repositories.department_repo.get_db_session') as mock_get_session:
            mock_session = AsyncMock()
            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = sample_dept
            mock_session.execute.return_value = mock_result
            mock_get_session.return_value = [mock_session]
            
            result = await department_repo.get_by_id(dept_id)
            
            assert result is not None
            assert result.id == dept_id
            assert result.name == sample_department_data["name"]
            assert result.description == sample_department_data["description"]
    
    @pytest.mark.asyncio
    async def test_get_by_id_not_found(self, department_repo):
        """Test department retrieval by ID when not found"""
        dept_id = uuid4()
        
        with patch('app.database.repositories.department_repo.get_db_session') as mock_get_session:
            mock_session = AsyncMock()
            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = None
            mock_session.execute.return_value = mock_result
            mock_get_session.return_value = [mock_session]
            
            result = await department_repo.get_by_id(dept_id)
            
            assert result is None
    
    @pytest.mark.asyncio
    async def test_get_by_name_success(self, department_repo, sample_department_data):
        """Test successful department retrieval by name"""
        dept_name = sample_department_data["name"]
        sample_dept = Department(**sample_department_data)
        
        with patch('app.database.repositories.department_repo.get_db_session') as mock_get_session:
            mock_session = AsyncMock()
            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = sample_dept
            mock_session.execute.return_value = mock_result
            mock_get_session.return_value = [mock_session]
            
            result = await department_repo.get_by_name(dept_name)
            
            assert result is not None
            assert result.name == dept_name
    
    @pytest.mark.asyncio
    async def test_get_by_name_not_found(self, department_repo):
        """Test department retrieval by name when not found"""
        dept_name = "NonExistentDepartment"
        
        with patch('app.database.repositories.department_repo.get_db_session') as mock_get_session:
            mock_session = AsyncMock()
            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = None
            mock_session.execute.return_value = mock_result
            mock_get_session.return_value = [mock_session]
            
            result = await department_repo.get_by_name(dept_name)
            
            assert result is None
    
    @pytest.mark.asyncio
    async def test_create_department_success(self, department_repo, sample_department_data):
        """Test successful department creation"""
        dept_create = DepartmentCreate(
            name=sample_department_data["name"],
            description=sample_department_data["description"]
        )
        sample_dept = Department(**sample_department_data)
        
        with patch.object(department_repo, 'get_by_name') as mock_get_by_name, \
             patch('app.database.repositories.department_repo.get_db_session') as mock_get_session:
            
            mock_get_by_name.return_value = None  # No existing department with same name
            mock_session = AsyncMock()
            mock_get_session.return_value = [mock_session]
            
            result = await department_repo.create_department(dept_create)
            
            assert result is not None
            assert result.name == dept_create.name
            assert result.description == dept_create.description
            mock_get_by_name.assert_called_once_with(dept_create.name)
            mock_session.add.assert_called_once()
            mock_session.commit.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_create_department_name_conflict(self, department_repo, sample_department):
        """Test department creation with existing name"""
        dept_create = DepartmentCreate(
            name=sample_department.name,
            description="Another description"
        )
        
        with patch.object(department_repo, 'get_by_name') as mock_get_by_name:
            mock_get_by_name.return_value = sample_department
            
            with pytest.raises(ValueError, match=f"Department with name '{dept_create.name}' already exists"):
                await department_repo.create_department(dept_create)
            
            mock_get_by_name.assert_called_once_with(dept_create.name)
    
    @pytest.mark.asyncio
    async def test_update_department_success(self, department_repo, sample_department_data):
        """Test successful department update"""
        dept_id = UUID(sample_department_data["id"])
        dept_update = DepartmentUpdate(
            name="Updated Engineering",
            description="Updated description"
        )
        existing_dept = Department(**sample_department_data)
        
        with patch.object(department_repo, 'get_by_id') as mock_get_by_id, \
             patch.object(department_repo, 'get_by_name') as mock_get_by_name, \
             patch('app.database.repositories.department_repo.get_db_session') as mock_get_session:
            
            mock_get_by_id.return_value = existing_dept
            mock_get_by_name.return_value = None  # No name conflict
            mock_session = AsyncMock()
            mock_get_session.return_value = [mock_session]
            
            result = await department_repo.update_department(dept_id, dept_update)
            
            assert result is not None
            assert result.name == dept_update.name
            assert result.description == dept_update.description
            mock_get_by_id.assert_called_once_with(dept_id)
            mock_session.commit.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_update_department_not_found(self, department_repo):
        """Test department update when department not found"""
        dept_id = uuid4()
        dept_update = DepartmentUpdate(name="Updated Name")
        
        with patch.object(department_repo, 'get_by_id') as mock_get_by_id:
            mock_get_by_id.return_value = None
            
            result = await department_repo.update_department(dept_id, dept_update)
            
            assert result is None
            mock_get_by_id.assert_called_once_with(dept_id)
    
    @pytest.mark.asyncio
    async def test_update_department_name_conflict(self, department_repo, sample_department_data):
        """Test department update with name conflict"""
        dept_id = UUID(sample_department_data["id"])
        dept_update = DepartmentUpdate(name="Conflicting Name")
        
        existing_dept = Department(**sample_department_data)
        conflicting_dept = Department(
            id=uuid4(),
            name="Conflicting Name",
            description="Another department"
        )
        
        with patch.object(department_repo, 'get_by_id') as mock_get_by_id, \
             patch.object(department_repo, 'get_by_name') as mock_get_by_name:
            
            mock_get_by_id.return_value = existing_dept
            mock_get_by_name.return_value = conflicting_dept
            
            with pytest.raises(ValueError, match="Department with name 'Conflicting Name' already exists"):
                await department_repo.update_department(dept_id, dept_update)
    
    @pytest.mark.asyncio
    async def test_delete_department_success(self, department_repo):
        """Test successful department deletion"""
        dept_id = uuid4()
        
        with patch('app.database.repositories.department_repo.get_db_session') as mock_get_session:
            mock_session = AsyncMock()
            mock_user_count_result = MagicMock()
            mock_user_count_result.scalar.return_value = 0  # No active users
            mock_delete_result = MagicMock()
            mock_delete_result.rowcount = 1
            mock_session.execute.side_effect = [mock_user_count_result, mock_delete_result]
            mock_get_session.return_value = [mock_session]
            
            result = await department_repo.delete_department(dept_id)
            
            assert result is True
            mock_session.commit.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_delete_department_with_active_users(self, department_repo):
        """Test department deletion when it has active users"""
        dept_id = uuid4()
        
        with patch('app.database.repositories.department_repo.get_db_session') as mock_get_session:
            mock_session = AsyncMock()
            mock_user_count_result = MagicMock()
            mock_user_count_result.scalar.return_value = 5  # Has 5 active users
            mock_session.execute.return_value = mock_user_count_result
            mock_get_session.return_value = [mock_session]
            
            with pytest.raises(ValueError, match="Cannot delete department with 5 active users"):
                await department_repo.delete_department(dept_id)
    
    @pytest.mark.asyncio
    async def test_search_departments(self, department_repo, sample_department_data):
        """Test department search functionality"""
        search_term = "Engineering"
        sample_dept = Department(**sample_department_data)
        
        with patch('app.database.repositories.department_repo.get_db_session') as mock_get_session:
            mock_session = AsyncMock()
            mock_result = MagicMock()
            mock_result.scalars.return_value.all.return_value = [sample_dept]
            mock_session.execute.return_value = mock_result
            mock_get_session.return_value = [mock_session]
            
            result = await department_repo.search_departments(search_term)
            
            assert len(result) == 1
            assert result[0].name == sample_department_data["name"]
    
    @pytest.mark.asyncio
    async def test_get_with_user_count(self, department_repo, sample_department_data):
        """Test getting departments with user count"""
        sample_dept = Department(**sample_department_data)
        
        with patch('app.database.repositories.department_repo.get_db_session') as mock_get_session:
            mock_session = AsyncMock()
            mock_result = MagicMock()
            mock_result.scalars.return_value.all.return_value = [sample_dept]
            mock_session.execute.return_value = mock_result
            mock_get_session.return_value = [mock_session]
            
            result = await department_repo.get_with_user_count()
            
            assert len(result) == 1
            assert result[0]["name"] == sample_department_data["name"]
    
    @pytest.mark.asyncio
    async def test_get_department_users(self, department_repo):
        """Test getting users in a department"""
        dept_id = uuid4()
        user_data = {
            "id": str(uuid4()),
            "clerk_user_id": "user_123",
            "name": "John Doe",
            "email": "john@example.com",
            "employee_code": "EMP001",
            "status": "active",
            "job_title": "Engineer",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "last_login_at": None
        }
        
        with patch('app.database.repositories.department_repo.get_db_session') as mock_get_session:
            mock_session = AsyncMock()
            mock_result = MagicMock()
            mock_result.scalars.return_value.all.return_value = [user_data]
            mock_session.execute.return_value = mock_result
            mock_get_session.return_value = [mock_session]
            
            result = await department_repo.get_department_users(dept_id)
            
            assert len(result) == 1
            assert result[0]["name"] == user_data["name"]
            assert result[0]["email"] == user_data["email"]
    
    @pytest.mark.asyncio
    async def test_count_departments(self, department_repo):
        """Test counting departments"""
        with patch('app.database.repositories.department_repo.get_db_session') as mock_get_session:
            mock_session = AsyncMock()
            mock_result = MagicMock()
            mock_result.scalar.return_value = 10
            mock_session.execute.return_value = mock_result
            mock_get_session.return_value = [mock_session]
            
            result = await department_repo.count_departments()
            
            assert result == 10
    
    @pytest.mark.asyncio
    async def test_count_departments_with_filters(self, department_repo):
        """Test counting departments with filters"""
        filters = {"name": "Engineering", "has_users": True}
        
        with patch('app.database.repositories.department_repo.get_db_session') as mock_get_session:
            mock_session = AsyncMock()
            mock_result = MagicMock()
            mock_result.scalar.return_value = 3
            mock_session.execute.return_value = mock_result
            mock_get_session.return_value = [mock_session]
            
            result = await department_repo.count_departments(filters)
            
            assert result == 3 