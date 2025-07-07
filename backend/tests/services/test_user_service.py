from __future__ import annotations
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4, UUID
from datetime import datetime
import logging
from tests.integration.logging_utils import setup_auth_test_logging

from app.services.user_service import UserService
from app.database.models.user import User as UserModel
from app.schemas.user import (
    UserCreate, UserUpdate, User, Department, Stage, Role,
    UserStatus
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
        with patch('app.services.user_service.UserRepository') as MockUserRepository:
            mock_repo_instance = MockUserRepository.return_value
            # Since we are mocking the repository, we can pass a dummy session.
            service = UserService(session=AsyncMock())
            service.user_repo = mock_repo_instance
            yield service
    
    @pytest.fixture
    def sample_user_data(self):
        """Sample user data for testing"""
        return {
            "id": uuid4(),
            "clerk_user_id": "user_123",
            "name": "John Doe",
            "email": "john.doe@example.com",
            "employee_code": "EMP001",
            "status": UserStatus.ACTIVE,
            "job_title": "Software Engineer",
            "department_id": uuid4(),
            "stage_id": uuid4(),
            "supervisor_id": None,
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
            "last_login_at": None
        }
    
    @pytest.fixture
    def sample_user_base(self, sample_user_data):
        """Create UserBase instance"""
        return UserModel(**sample_user_data)
    
    @pytest.fixture
    def admin_user(self):
        """Admin user context"""
        return {"role": "admin", "sub": "user_clerk_admin_1"}
    
    @pytest.fixture
    def manager_user(self):
        """Manager user context"""
        return {"role": "manager", "sub": "user_3bcdef234567890abcdef12"}
    
    @pytest.fixture
    def viewer_user(self):
        """Viewer user context"""
        # Using an employee's clerk_id but with 'viewer' role for the test
        return {"role": "viewer", "sub": "user_2abcdef1234567890abcdef"}
    
    @pytest.fixture
    def regular_user(self):
        """Regular user context"""
        return {"role": "employee", "sub": "user_2abcdef1234567890abcdef"}
    
    # Test get_users method
    
    @pytest.mark.asyncio
    async def test_get_users_scenarios(self, user_service, admin_user, manager_user, viewer_user, regular_user, sample_user_data):
        """Test get_users method with various scenarios and fine-grained logging."""
        log_file = setup_auth_test_logging("user_service")
        logger = logging.getLogger(__name__)
        logger.info(f"Log file for this test run: {log_file}")
        logger.info("Starting test_get_users_scenarios with seed data")

        # --- Setup common data from 007_seed_user_data.sql ---
        logger.info("Setting up common user data from seed file")
        
        # Departments
        hr_dept_id = UUID('650e8400-e29b-41d4-a716-446655440003')
        sales_dept_id = UUID('650e8400-e29b-41d4-a716-446655440001')
        eng_dept_id = UUID('650e8400-e29b-41d4-a716-446655440002')

        # Users - adding datetime fields
        now = datetime.now()
        admin_sato = UserModel(id=UUID('850e8400-e29b-41d4-a716-446655440001'), clerk_user_id='user_clerk_admin_1', employee_code='ADM001', name='佐藤 管理者', email='admin.sato@example.com', status=UserStatus.ACTIVE, department_id=hr_dept_id, stage_id=UUID('33333333-4444-5555-6666-777777777777'), job_title='システム管理者', created_at=now, updated_at=now)
        manager_sato = UserModel(id=UUID('223e4567-e89b-12d3-a456-426614174001'), clerk_user_id='user_3bcdef234567890abcdef12', employee_code='EMP002', name='佐藤 花子', email='sato.hanako@company.com', status=UserStatus.ACTIVE, department_id=sales_dept_id, stage_id=UUID('33333333-4444-5555-6666-777777777777'), job_title='マネージャー', created_at=now, updated_at=now)
        employee_yamada = UserModel(id=UUID('123e4567-e89b-12d3-a456-426614174000'), clerk_user_id='user_2abcdef1234567890abcdef', employee_code='EMP001', name='山田 太郎', email='yamada.taro@company.com', status=UserStatus.ACTIVE, department_id=sales_dept_id, stage_id=UUID('22222222-3333-4444-5555-666666666666'), job_title='主任', created_at=now, updated_at=now)
        employee_tanaka = UserModel(id=UUID('333e4567-e89b-12d3-a456-426614174002'), clerk_user_id='user_4cdef34567890abcdef123', employee_code='EMP003', name='田中 一郎', email='tanaka.ichiro@company.com', status=UserStatus.ACTIVE, department_id=eng_dept_id, stage_id=UUID('11111111-2222-3333-4444-555555555555'), job_title=None, created_at=now, updated_at=now)

        all_users = [admin_sato, manager_sato, employee_yamada, employee_tanaka]
        
        # Roles from seed data
        role_admin = Role(id=1, name='admin', description='System administrator with full access')
        role_supervisor = Role(id=2, name='supervisor', description='Department supervisor with management rights')
        role_employee = Role(id=3, name='employee', description='Regular employee with basic access')

        # User-to-Role mapping from seed data
        user_role_map = {
            admin_sato.id: [role_admin],
            manager_sato.id: [role_supervisor],
            employee_yamada.id: [role_employee],
            employee_tanaka.id: [role_employee]
        }

        def _enrich(user_model: UserModel) -> User:
            # Simplified enrichment for testing that mimics the service
            department = Department(id=user_model.department_id, name="Dept Name")
            stage = Stage(id=user_model.stage_id, name="Stage Name")
            
            # Manually create a dictionary from the SQLAlchemy model's attributes
            user_data = {
                "id": user_model.id,
                "clerk_user_id": user_model.clerk_user_id,
                "name": user_model.name,
                "email": user_model.email,
                "employee_code": user_model.employee_code,
                "status": user_model.status,
                "job_title": user_model.job_title,
                "department_id": user_model.department_id,
                "stage_id": user_model.stage_id,
                "supervisor_id": getattr(user_model, 'supervisor_id', None),
                "created_at": user_model.created_at,
                "updated_at": user_model.updated_at,
                "last_login_at": getattr(user_model, 'last_login_at', None)
            }

            # Directly construct the User schema
            return User(
                **user_data,
                department=department,
                stage=stage,
                roles=user_role_map.get(user_model.id, [])
            )

        # --- Scenario 1: Admin User ---
        logger.info("--- SCENARIO: Testing Admin Role ---")
        user_service.user_repo.reset_mock()
        
        logger.info("[Admin] Setting up mocks for admin user to fetch all users")
        user_service.user_repo.search_users = AsyncMock(return_value=all_users)
        user_service.user_repo.count_users = AsyncMock(return_value=len(all_users))
        user_service._enrich_user_profile = AsyncMock(side_effect=[_enrich(u) for u in all_users])

        logger.info("[Admin] Calling get_users with no filters")
        result = await user_service.get_users(admin_user)
        logger.info(f"[Admin] Result:\n{result.model_dump_json(indent=2)}")
        assert isinstance(result, PaginatedResponse)
        assert len(result.items) == 4
        assert result.total == 4
        logger.info("[Admin] OK: Correctly fetched all users.")

        logger.info("[Admin] Testing search_term")
        user_service.user_repo.search_users.return_value = [employee_yamada]
        user_service.user_repo.count_users.return_value = 1
        user_service._enrich_user_profile = AsyncMock(return_value=_enrich(employee_yamada))
        result = await user_service.get_users(admin_user, search_term="山田")
        logger.info(f"[Admin] Result with search_term '山田':\n{result.model_dump_json(indent=2)}")
        assert len(result.items) == 1
        assert result.items[0].name == "山田 太郎"
        user_service.user_repo.search_users.assert_called_with(search_term="山田", filters={}, pagination=None)
        logger.info("[Admin] OK: Correctly filtered users by search_term.")
        
        logger.info("[Admin] Testing filters")
        user_service.user_repo.search_users.return_value = [admin_sato]
        user_service.user_repo.count_users.return_value = 1
        user_service._enrich_user_profile = AsyncMock(return_value=_enrich(admin_sato))
        filters = {"department_id": hr_dept_id}
        result = await user_service.get_users(admin_user, filters=filters)
        logger.info(f"[Admin] Result with filters:\n{result.model_dump_json(indent=2)}")
        assert len(result.items) == 1
        assert result.items[0].department_id == hr_dept_id
        user_service.user_repo.search_users.assert_called_with(search_term="", filters=filters, pagination=None)
        logger.info("[Admin] OK: Correctly filtered users by department.")
        
        logger.info("[Admin] Testing pagination")
        pagination = PaginationParams(page=1, limit=2)
        user_service.user_repo.search_users.return_value = all_users[:2]
        user_service._enrich_user_profile = AsyncMock(side_effect=[_enrich(u) for u in all_users[:2]])
        await user_service.get_users(admin_user, pagination=pagination)
        user_service.user_repo.search_users.assert_called_with(search_term="", filters={}, pagination=pagination)
        logger.info("[Admin] OK: Correctly applied pagination.")

        # --- Scenario 2: Manager User ---
        logger.info("--- SCENARIO: Testing Manager Role (sees subordinates only) ---")
        user_service.user_repo.reset_mock()
        
        logger.info("[Manager] Setting up mocks for manager (佐藤 花子)")
        user_service.user_repo.get_by_clerk_id = AsyncMock(return_value=manager_sato)
        # Manager Sato supervises Yamada and Tanaka
        subordinates = [employee_yamada, employee_tanaka]
        user_service.user_repo.get_subordinates = AsyncMock(return_value=subordinates)
        user_service._enrich_user_profile = AsyncMock(side_effect=[_enrich(u) for u in subordinates])

        logger.info("[Manager] Calling get_users")
        result = await user_service.get_users(manager_user)
        logger.info(f"[Manager] Result:\n{result.model_dump_json(indent=2)}")
        assert len(result.items) == 2
        assert result.total == 2
        assert {item.name for item in result.items} == {"山田 太郎", "田中 一郎"}
        user_service.user_repo.get_subordinates.assert_called_once_with(manager_sato.id)
        user_service.user_repo.search_users.assert_not_called()
        logger.info("[Manager] OK: Correctly fetched only subordinates.")

        # --- Scenario 3: Viewer User ---
        logger.info("--- SCENARIO: Testing Viewer Role (sees users in same department) ---")
        user_service.user_repo.reset_mock()
        
        logger.info("[Viewer] Setting up mocks for viewer (山田 太郎 in Sales)")
        user_service.user_repo.get_by_clerk_id = AsyncMock(return_value=employee_yamada)
        # Viewer should see other users in the 'Sales' department (manager_sato)
        sales_users = [manager_sato, employee_yamada]
        user_service.user_repo.search_users.return_value = sales_users
        user_service.user_repo.count_users.return_value = len(sales_users)
        user_service._enrich_user_profile = AsyncMock(side_effect=[_enrich(u) for u in sales_users])

        logger.info("[Viewer] Calling get_users")
        result = await user_service.get_users(viewer_user)
        logger.info(f"[Viewer] Result:\n{result.model_dump_json(indent=2)}")
        expected_filters = {"department_id": sales_dept_id}
        user_service.user_repo.search_users.assert_called_with(search_term="", filters=expected_filters, pagination=None)
        logger.info("[Viewer] OK: search_users called with correct department filter.")

        # --- Scenario 4: Insufficient Permissions ---
        logger.info("--- SCENARIO: Testing Insufficient Permissions ---")
        logger.info("[Insufficient] Calling get_users with 'employee' role")
        with pytest.raises(PermissionDeniedError, match="Insufficient permissions"):
            await user_service.get_users(regular_user)
        logger.info("[Insufficient] OK: Correctly raised PermissionDeniedError.")
        
        logger.info("Finished test_get_users_scenarios successfully.")

    # Test get_user_by_id method
    
    @pytest.mark.asyncio
    async def test_get_user_by_id_own_profile(self, user_service, regular_user, sample_user_base):
        """Test user can view their own profile"""
        user_id = sample_user_base.id
        
        # Mock user lookup
        user_service.user_repo.get_by_id.return_value = sample_user_base
        user_service.user_repo.get_by_clerk_id.return_value = sample_user_base
        
        # Mock enrichment
        user_service._enrich_user_data = AsyncMock(return_value=User(
            id=sample_user_base.id,
            clerk_user_id=sample_user_base.clerk_user_id,
            name=sample_user_base.name,
            email=sample_user_base.email,
            employee_code=sample_user_base.employee_code,
            status=sample_user_base.status,
            job_title=sample_user_base.job_title,
            department_id=sample_user_base.department_id,
            stage_id=sample_user_base.stage_id,
            supervisor_id=sample_user_base.supervisor_id,
            created_at=sample_user_base.created_at,
            updated_at=sample_user_base.updated_at,
            last_login_at=sample_user_base.last_login_at,
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
    async def test_create_user_admin_success(self, user_service, admin_user, sample_user_base):
        """Test admin can create user successfully"""
        user_create = UserCreate(
            clerk_user_id="new_user_123",
            name="Jane Doe",
            email="jane.doe@example.com",
            employee_code="EMP002",
            department_id=uuid4(),
            stage_id=uuid4(),
            role_ids=[1, 2],
            supervisor_id=None
        )
        
        # Mock repository responses
        user_service.user_repo.create_user.return_value = sample_user_base
        
        # Mock enrichment
        user_service._enrich_user_data = AsyncMock(return_value=User(
            id=sample_user_base.id,
            clerk_user_id=sample_user_base.clerk_user_id,
            name=sample_user_base.name,
            email=sample_user_base.email,
            employee_code=sample_user_base.employee_code,
            status=sample_user_base.status,
            job_title=sample_user_base.job_title,
            department_id=sample_user_base.department_id,
            stage_id=sample_user_base.stage_id,
            supervisor_id=sample_user_base.supervisor_id,
            created_at=sample_user_base.created_at,
            updated_at=sample_user_base.updated_at,
            last_login_at=sample_user_base.last_login_at,
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
            supervisor_id=None
        )
        
        with pytest.raises(PermissionDeniedError, match="Only administrators can create users"):
            await user_service.create_user(user_create, regular_user)
    
    # Test update_user method
    
    @pytest.mark.asyncio
    async def test_update_user_own_profile(self, user_service, regular_user, sample_user_base):
        """Test user can update their own profile"""
        user_id = sample_user_base.id
        user_update = UserUpdate(name="Updated Name")
        
        # Mock repository responses
        user_service.user_repo.get_by_id.return_value = sample_user_base
        user_service.user_repo.get_by_clerk_id.return_value = sample_user_base
        user_service.user_repo.update_user.return_value = sample_user_base
        
        # Mock enrichment
        user_service._enrich_user_data = AsyncMock(return_value=User(
            id=sample_user_base.id,
            clerk_user_id=sample_user_base.clerk_user_id,
            name=sample_user_base.name,
            email=sample_user_base.email,
            employee_code=sample_user_base.employee_code,
            status=sample_user_base.status,
            job_title=sample_user_base.job_title,
            department_id=sample_user_base.department_id,
            stage_id=sample_user_base.stage_id,
            supervisor_id=sample_user_base.supervisor_id,
            created_at=sample_user_base.created_at,
            updated_at=sample_user_base.updated_at,
            last_login_at=sample_user_base.last_login_at,
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
    async def test_inactivate_user_admin_success(self, user_service, admin_user, sample_user_base, sample_user_data):
        """Test admin can inactivate user successfully"""
        user_id = sample_user_base.id
        
        # Mock repository responses
        user_service.user_repo.get_by_id.return_value = sample_user_base
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
    async def test_inactivate_user_self_denied(self, user_service, admin_user, sample_user_base):
        """Test admin cannot inactivate themselves"""
        user_id = sample_user_base.id
        
        # Mock repository responses
        user_service.user_repo.get_by_id.return_value = sample_user_base
        user_service.user_repo.get_by_clerk_id.return_value = sample_user_base
        
        with pytest.raises(BadRequestError, match="Cannot inactivate your own account"):
            await user_service.inactivate_user(user_id, admin_user)
    
    @pytest.mark.asyncio
    async def test_inactivate_user_with_subordinates_denied(self, user_service, admin_user, sample_user_base, sample_user_data):
        """Test cannot inactivate user with subordinates"""
        user_id = sample_user_base.id
        
        # Mock repository responses
        user_service.user_repo.get_by_id.return_value = sample_user_base
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
    async def test_validate_user_update_conflict(self, user_service, sample_user_base, sample_user_data):
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
            await user_service._validate_user_update(user_update, sample_user_base)
    
    @pytest.mark.asyncio
    async def test_filter_users_by_criteria(self, user_service, sample_user_base):
        """Test user filtering by criteria"""
        users = [sample_user_base]
        
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
    async def test_update_last_login_success(self, user_service, sample_user_base):
        """Test updating last login timestamp"""
        clerk_user_id = "user_123"
        
        user_service.user_repo.get_by_clerk_id.return_value = sample_user_base
        user_service.user_repo.update_last_login.return_value = True
        
        result = await user_service.update_last_login(clerk_user_id)
        
        assert result is True
        user_service.user_repo.update_last_login.assert_called_once_with(sample_user_base.id)
    
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