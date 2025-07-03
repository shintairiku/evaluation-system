import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4, UUID
from datetime import datetime

from app.services.user_service import UserService
from app.database.models.user import User as UserModel
from app.schemas.user import UserStatus
from app.schemas.user import (
    UserCreate, UserUpdate, UserProfile, User, Department, Stage, Role,
    UserCreateResponse, UserUpdateResponse, UserInactivateResponse
)
from app.schemas.common import PaginationParams, PaginatedResponse
from app.core.exceptions import (
    NotFoundError, ConflictError, ValidationError, 
    PermissionDeniedError, BadRequestError
)


class TestUserService:
    """Test suite for UserService"""
    
    @pytest.fixture
    def user_service(self):
        """Create UserService instance with mocked repository"""
        service = UserService()
        service.user_repo = AsyncMock()
        return service
    
    @pytest.fixture
    def sample_user_data(self):
        """Sample user data for testing"""
        return {
            "id": uuid4(),
            "clerk_user_id": "user_123",
            "name": "John Doe",
            "email": "john.doe@example.com",
            "employee_code": "EMP001",
            "status": UserStatus.ACTIVE.value,
            "job_title": "Software Engineer",
            "department_id": uuid4(),
            "stage_id": uuid4(),
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }
    
    @pytest.fixture
    def sample_user_model(self, sample_user_data):
        """Create UserModel instance"""
        return UserModel(**sample_user_data)
    
    @pytest.fixture
    def admin_user(self):
        """Admin user context"""
        return {"role": "admin", "sub": "admin_123"}
    
    @pytest.fixture
    def manager_user(self):
        """Manager user context"""
        return {"role": "manager", "sub": "manager_123"}
    
    @pytest.fixture
    def regular_user(self):
        """Regular user context"""
        return {"role": "employee", "sub": "user_123"}
    
    # Test get_users method
    
    @pytest.mark.asyncio
    async def test_get_users_admin_all_users(self, user_service, admin_user, sample_user_model):
        """Test admin can see all users"""
        # Mock repository responses
        user_service.user_repo.search_users.return_value = [sample_user_model]
        user_service.user_repo.count_users.return_value = 1
        
        # Mock enrichment methods
        user_service._enrich_user_profile = AsyncMock(return_value=UserProfile(
            id=sample_user_model.id,
            clerk_user_id=sample_user_model.clerk_user_id,
            employee_code=sample_user_model.employee_code,
            name=sample_user_model.name,
            email=sample_user_model.email,
            status=sample_user_model.status,
            job_title=sample_user_model.job_title,
            department=Department(id=uuid4(), name="IT"),
            stage=Stage(id=uuid4(), name="Senior"),
            roles=[],
            last_login_at=None
        ))
        
        result = await user_service.get_users(admin_user)
        
        assert isinstance(result, PaginatedResponse)
        assert len(result.items) == 1
        assert result.total == 1
        user_service.user_repo.search_users.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_users_manager_subordinates_only(self, user_service, manager_user, sample_user_model, sample_user_data):
        """Test manager can only see subordinates"""
        # Mock current user lookup
        current_user_obj = UserModel(**{
            **sample_user_data,
            "id": uuid4(),
            "clerk_user_id": "manager_123"
        })
        user_service.user_repo.get_by_clerk_id.return_value = current_user_obj
        
        # Mock subordinates
        subordinate = UserModel(**{
            **sample_user_data,
            "id": uuid4(),
            "clerk_user_id": "sub_123"
        })
        user_service.user_repo.get_subordinates.return_value = [subordinate]
        
        # Mock enrichment
        user_service._enrich_user_profile = AsyncMock(return_value=UserProfile(
            id=subordinate.id,
            clerk_user_id=subordinate.clerk_user_id,
            employee_code=subordinate.employee_code,
            name=subordinate.name,
            email=subordinate.email,
            status=subordinate.status,
            job_title=subordinate.job_title,
            department=Department(id=uuid4(), name="IT"),
            stage=Stage(id=uuid4(), name="Junior"),
            roles=[],
            last_login_at=None
        ))
        
        result = await user_service.get_users(manager_user)
        
        assert isinstance(result, PaginatedResponse)
        assert len(result.items) == 1
        assert result.total == 1
        user_service.user_repo.get_subordinates.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_users_insufficient_permissions(self, user_service, regular_user):
        """Test user with insufficient permissions"""
        with pytest.raises(PermissionDeniedError, match="Insufficient permissions"):
            await user_service.get_users(regular_user)
    
    # Test get_user_by_id method
    
    @pytest.mark.asyncio
    async def test_get_user_by_id_own_profile(self, user_service, regular_user, sample_user_model):
        """Test user can view their own profile"""
        user_id = sample_user_model.id
        
        # Mock user lookup
        user_service.user_repo.get_by_id.return_value = sample_user_model
        user_service.user_repo.get_by_clerk_id.return_value = sample_user_model
        
        # Mock enrichment
        user_service._enrich_user_data = AsyncMock(return_value=User(
            id=sample_user_model.id,
            clerk_user_id=sample_user_model.clerk_user_id,
            name=sample_user_model.name,
            email=sample_user_model.email,
            employee_code=sample_user_model.employee_code,
            status=sample_user_model.status,
            job_title=sample_user_model.job_title,
            department_id=sample_user_model.department_id,
            stage_id=sample_user_model.stage_id,
                        created_at=sample_user_model.created_at,
            updated_at=sample_user_model.updated_at,
                        department=Department(id=uuid4(), name="IT"),
            stage=Stage(id=uuid4(), name="Senior"),
            roles=[],
            supervisor=None
        ))
        
        result = await user_service.get_user_by_id(user_id, regular_user)
        
        assert isinstance(result, User)
        assert result.id == user_id
        user_service.user_repo.get_by_id.assert_called_once_with(user_id)
    
    @pytest.mark.asyncio
    async def test_get_user_by_id_not_found(self, user_service, admin_user):
        """Test getting non-existent user"""
        user_id = uuid4()
        user_service.user_repo.get_by_id.return_value = None
        
        with pytest.raises(NotFoundError, match=f"User with ID {user_id} not found"):
            await user_service.get_user_by_id(user_id, admin_user)
    
    # Test create_user method
    
    @pytest.mark.asyncio
    async def test_create_user_admin_success(self, user_service, admin_user, sample_user_model):
        """Test admin can create user successfully"""
        user_create = UserCreate(
            clerk_user_id="new_user_123",
            name="Jane Doe",
            email="jane.doe@example.com",
            employee_code="EMP002",
            department_id=uuid4(),
            stage_id=uuid4(),
            role_ids=[1, 2],
                    )
        
        # Mock repository responses
        user_service.user_repo.create_user.return_value = sample_user_model
        
        # Mock enrichment
        user_service._enrich_user_data = AsyncMock(return_value=User(
            id=sample_user_model.id,
            clerk_user_id=sample_user_model.clerk_user_id,
            name=sample_user_model.name,
            email=sample_user_model.email,
            employee_code=sample_user_model.employee_code,
            status=sample_user_model.status,
            job_title=sample_user_model.job_title,
            department_id=sample_user_model.department_id,
            stage_id=sample_user_model.stage_id,
                        created_at=sample_user_model.created_at,
            updated_at=sample_user_model.updated_at,
                        department=Department(id=uuid4(), name="IT"),
            stage=Stage(id=uuid4(), name="Senior"),
            roles=[],
            supervisor=None
        ))
        
        result = await user_service.create_user(user_create, admin_user)
        
        assert isinstance(result, UserCreateResponse)
        assert result.message == "User created successfully"
        user_service.user_repo.create_user.assert_called_once_with(user_create)
    
    @pytest.mark.asyncio
    async def test_create_user_non_admin_denied(self, user_service, regular_user):
        """Test non-admin cannot create user"""
        user_create = UserCreate(
            clerk_user_id="new_user_123",
            name="Jane Doe",
            email="jane.doe@example.com",
            employee_code="EMP002",
            department_id=uuid4(),
            stage_id=uuid4(),
            role_ids=[],
                    )
        
        with pytest.raises(PermissionDeniedError, match="Only administrators can create users"):
            await user_service.create_user(user_create, regular_user)
    
    # Test update_user method
    
    @pytest.mark.asyncio
    async def test_update_user_own_profile(self, user_service, regular_user, sample_user_model):
        """Test user can update their own profile"""
        user_id = sample_user_model.id
        user_update = UserUpdate(name="Updated Name")
        
        # Mock repository responses
        user_service.user_repo.get_by_id.return_value = sample_user_model
        user_service.user_repo.get_by_clerk_id.return_value = sample_user_model
        user_service.user_repo.update_user.return_value = sample_user_model
        
        # Mock enrichment
        user_service._enrich_user_data = AsyncMock(return_value=User(
            id=sample_user_model.id,
            clerk_user_id=sample_user_model.clerk_user_id,
            name=sample_user_model.name,
            email=sample_user_model.email,
            employee_code=sample_user_model.employee_code,
            status=sample_user_model.status,
            job_title=sample_user_model.job_title,
            department_id=sample_user_model.department_id,
            stage_id=sample_user_model.stage_id,
                        created_at=sample_user_model.created_at,
            updated_at=sample_user_model.updated_at,
                        department=Department(id=uuid4(), name="IT"),
            stage=Stage(id=uuid4(), name="Senior"),
            roles=[],
            supervisor=None
        ))
        
        result = await user_service.update_user(user_id, user_update, regular_user)
        
        assert isinstance(result, UserUpdateResponse)
        assert result.message == "User updated successfully"
        user_service.user_repo.update_user.assert_called_once_with(user_id, user_update)
    
    @pytest.mark.asyncio
    async def test_update_user_not_found(self, user_service, admin_user):
        """Test updating non-existent user"""
        user_id = uuid4()
        user_update = UserUpdate(name="Updated Name")
        
        user_service.user_repo.get_by_id.return_value = None
        
        with pytest.raises(NotFoundError, match=f"User with ID {user_id} not found"):
            await user_service.update_user(user_id, user_update, admin_user)
    
    # Test inactivate_user method
    
    @pytest.mark.asyncio
    async def test_inactivate_user_admin_success(self, user_service, admin_user, sample_user_model, sample_user_data):
        """Test admin can inactivate user successfully"""
        user_id = sample_user_model.id
        
        # Mock repository responses
        user_service.user_repo.get_by_id.return_value = sample_user_model
        user_service.user_repo.get_by_clerk_id.return_value = UserModel(**{
            **sample_user_data,
            "id": uuid4(),
            "clerk_user_id": "admin_123"
        })
        user_service.user_repo.get_subordinates.return_value = []
        user_service.user_repo.inactivate_user.return_value = True
        
        result = await user_service.inactivate_user(user_id, admin_user)
        
        assert isinstance(result, UserInactivateResponse)
        assert result.success is True
        assert result.message == "User inactivated successfully"
        user_service.user_repo.inactivate_user.assert_called_once_with(user_id)
    
    @pytest.mark.asyncio
    async def test_inactivate_user_self_denied(self, user_service, admin_user, sample_user_model):
        """Test admin cannot inactivate themselves"""
        user_id = sample_user_model.id
        
        # Mock repository responses
        user_service.user_repo.get_by_id.return_value = sample_user_model
        user_service.user_repo.get_by_clerk_id.return_value = sample_user_model
        
        with pytest.raises(BadRequestError, match="Cannot inactivate your own account"):
            await user_service.inactivate_user(user_id, admin_user)
    
    @pytest.mark.asyncio
    async def test_inactivate_user_with_subordinates_denied(self, user_service, admin_user, sample_user_model, sample_user_data):
        """Test cannot inactivate user with subordinates"""
        user_id = sample_user_model.id
        
        # Mock repository responses
        user_service.user_repo.get_by_id.return_value = sample_user_model
        user_service.user_repo.get_by_clerk_id.return_value = UserModel(**{
            **sample_user_data,
            "id": uuid4(),
            "clerk_user_id": "admin_123"
        })
        user_service.user_repo.get_subordinates.return_value = [UserModel(**sample_user_data)]
        
        with pytest.raises(BadRequestError, match="Cannot inactivate user who is currently supervising active users"):
            await user_service.inactivate_user(user_id, admin_user)
    
    # Test helper methods
    
    @pytest.mark.asyncio
    async def test_validate_user_update_conflict(self, user_service, sample_user_model, sample_user_data):
        """Test user update validation with conflicts"""
        user_update = UserUpdate(email="conflict@example.com")
        
        # Mock conflicting user
        conflicting_user = UserModel(**{
            **sample_user_data,
            "id": uuid4(),
            "email": "conflict@example.com"
        })
        user_service.user_repo.get_by_email.return_value = conflicting_user
        
        with pytest.raises(ConflictError, match="User with email conflict@example.com already exists"):
            await user_service._validate_user_update(user_update, sample_user_model)
    
    @pytest.mark.asyncio
    async def test_filter_users_by_criteria(self, user_service, sample_user_model):
        """Test user filtering by criteria"""
        users = [sample_user_model]
        
        # Test search filtering
        filtered = user_service._filter_users_by_criteria(users, "john", None)
        assert len(filtered) == 1
        
        filtered = user_service._filter_users_by_criteria(users, "nonexistent", None)
        assert len(filtered) == 0
        
        # Test status filtering
        filters = {"status": UserStatus.ACTIVE}
        filtered = user_service._filter_users_by_criteria(users, "", filters)
        assert len(filtered) == 1
        
        filters = {"status": UserStatus.INACTIVE}
        filtered = user_service._filter_users_by_criteria(users, "", filters)
        assert len(filtered) == 0
    
    @pytest.mark.asyncio
    async def test_update_last_login_success(self, user_service, sample_user_model):
        """Test updating last login timestamp"""
        clerk_user_id = "user_123"
        
        user_service.user_repo.get_by_clerk_id.return_value = sample_user_model
        user_service.user_repo.update_last_login.return_value = True
        
        result = await user_service.update_last_login(clerk_user_id)
        
        assert result is True
        user_service.user_repo.update_last_login.assert_called_once_with(sample_user_model.id)
    
    @pytest.mark.asyncio
    async def test_update_last_login_user_not_found(self, user_service):
        """Test updating last login for non-existent user"""
        clerk_user_id = "nonexistent_123"
        
        user_service.user_repo.get_by_clerk_id.return_value = None
        
        result = await user_service.update_last_login(clerk_user_id)
        
        assert result is False
        user_service.user_repo.update_last_login.assert_not_called()


# Integration tests for database operations
class TestUserServiceIntegration:
    """Integration tests for UserService with actual database operations"""
    
    @pytest.mark.asyncio
    async def test_service_repository_integration(self):
        """Test service layer integration with repository"""
        # This would require a test database setup
        # For now, we'll test the service can be instantiated
        service = UserService()
        assert service is not None
        assert hasattr(service, 'user_repo')
        assert hasattr(service, 'get_users')
        assert hasattr(service, 'create_user')
        assert hasattr(service, 'update_user')
        assert hasattr(service, 'inactivate_user') 