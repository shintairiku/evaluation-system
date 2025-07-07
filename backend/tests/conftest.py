"""
Global test configuration and shared fixtures
Provides common fixtures and utilities for all test layers
"""

import pytest
import pytest_asyncio
from unittest.mock import MagicMock, AsyncMock
from uuid import uuid4, UUID
from datetime import datetime, timedelta
from typing import Optional
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

# Import the FastAPI app
from app.main import app

# Import common schemas
from app.schemas.user import UserCreate, UserUpdate
from app.schemas.department import DepartmentCreate, DepartmentUpdate
from app.schemas.common import PaginationParams

# Import database session
from app.database.session import get_db_session


# =============================================================================
# Global Test Client
# =============================================================================

@pytest.fixture(scope="session")
def test_client():
    """Create FastAPI test client for all tests"""
    return TestClient(app)


# =============================================================================
# Database Fixtures
# =============================================================================

@pytest_asyncio.fixture
async def db_session():
    """Get database session for integration tests"""
    async for session in get_db_session():
        yield session
        break


# =============================================================================
# Authentication Fixtures
# =============================================================================

@pytest.fixture
def admin_user():
    """Admin user for testing"""
    return {
        "sub": "admin_test_user",
        "role": "admin",
        "email": "admin@test.com",
        "name": "Test Admin",
        "permissions": ["create", "read", "update", "delete"]
    }


@pytest.fixture
def manager_user():
    """Manager user for testing"""
    return {
        "sub": "manager_test_user",
        "role": "manager", 
        "email": "manager@test.com",
        "name": "Test Manager",
        "permissions": ["create", "read", "update"]
    }


@pytest.fixture
def supervisor_user():
    """Supervisor user for testing"""
    return {
        "sub": "supervisor_test_user",
        "role": "supervisor",
        "email": "supervisor@test.com", 
        "name": "Test Supervisor",
        "permissions": ["read", "update"]
    }


@pytest.fixture
def employee_user():
    """Employee user for testing"""
    return {
        "sub": "employee_test_user",
        "role": "employee",
        "email": "employee@test.com",
        "name": "Test Employee", 
        "permissions": ["read"]
    }


@pytest.fixture
def invalid_user():
    """Invalid/unauthorized user for testing"""
    return {
        "sub": "invalid_test_user",
        "role": "invalid",
        "email": "invalid@test.com",
        "name": "Invalid User",
        "permissions": []
    }


# =============================================================================
# Test Data Fixtures
# =============================================================================

@pytest.fixture
def sample_user_data():
    """Sample user data for testing"""
    return UserCreate(
        name="Test User",
        email="testuser@example.com",
        employee_code="TEST001",
        job_title="Test Engineer",
        status="active"
    )


@pytest.fixture
def sample_user_update_data():
    """Sample user update data for testing"""
    return UserUpdate(
        name="Updated Test User",
        email="updated@example.com",
        job_title="Senior Test Engineer"
    )


@pytest.fixture
def sample_department_data():
    """Sample department data for testing"""
    return DepartmentCreate(
        name="Test Department",
        description="A department for testing purposes"
    )


@pytest.fixture
def sample_department_update_data():
    """Sample department update data for testing"""
    return DepartmentUpdate(
        name="Updated Test Department", 
        description="An updated department for testing"
    )


@pytest.fixture
def pagination_params():
    """Standard pagination parameters"""
    return PaginationParams(
        page=1,
        limit=10,
        sort_by="created_at",
        sort_order="desc"
    )


# =============================================================================
# Mock Fixtures
# =============================================================================

@pytest.fixture
def mock_async():
    """Create AsyncMock for async operations"""
    return AsyncMock()


@pytest.fixture 
def mock_sync():
    """Create MagicMock for sync operations"""
    return MagicMock()


@pytest.fixture
def mock_uuid():
    """Generate a mock UUID for testing"""
    return uuid4()


@pytest.fixture
def mock_datetime():
    """Generate a mock datetime for testing"""
    return datetime.utcnow()


# =============================================================================
# Repository Mock Fixtures
# =============================================================================

@pytest.fixture
def mock_user_repository():
    """Mock UserRepository for testing"""
    mock_repo = AsyncMock()
    mock_repo.get_by_id.return_value = None
    mock_repo.get_by_email.return_value = None
    mock_repo.create_user.return_value = None
    mock_repo.update_user.return_value = None
    mock_repo.delete_user.return_value = True
    mock_repo.search_users.return_value = []
    mock_repo.count_users.return_value = 0
    return mock_repo


@pytest.fixture
def mock_department_repository():
    """Mock DepartmentRepository for testing"""
    mock_repo = AsyncMock()
    mock_repo.get_by_id.return_value = None
    mock_repo.get_by_name.return_value = None
    mock_repo.create_department.return_value = None
    mock_repo.update_department.return_value = None
    mock_repo.delete_department.return_value = True
    mock_repo.search_departments.return_value = []
    mock_repo.count_departments.return_value = 0
    return mock_repo


# =============================================================================
# Service Mock Fixtures 
# =============================================================================

@pytest.fixture
def mock_user_service():
    """Mock UserService for testing"""
    mock_service = AsyncMock()
    mock_service.create_user.return_value = None
    mock_service.get_user_by_id.return_value = None
    mock_service.update_user.return_value = None
    mock_service.delete_user.return_value = {"message": "User deleted successfully"}
    mock_service.get_users.return_value = {"items": [], "total": 0, "page": 1, "limit": 10}
    return mock_service


@pytest.fixture
def mock_department_service():
    """Mock DepartmentService for testing"""
    mock_service = AsyncMock()
    mock_service.create_department.return_value = None
    mock_service.get_department_by_id.return_value = None
    mock_service.update_department.return_value = None
    mock_service.delete_department.return_value = {"message": "Department deleted successfully"}
    mock_service.get_departments.return_value = {"items": [], "total": 0, "page": 1, "limit": 10}
    return mock_service


# =============================================================================
# Test Utility Functions
# =============================================================================

def generate_test_user(role: str = "employee", **kwargs):
    """Generate test user data with specified role"""
    base_data = {
        "sub": f"{role}_test_user_{uuid4().hex[:8]}",
        "role": role,
        "email": f"{role}@test.com",
        "name": f"Test {role.title()}",
        "permissions": {
            "admin": ["create", "read", "update", "delete"],
            "manager": ["create", "read", "update"],
            "supervisor": ["read", "update"],
            "employee": ["read"]
        }.get(role, [])
    }
    base_data.update(kwargs)
    return base_data


def generate_test_department(**kwargs):
    """Generate test department data"""
    base_data = {
        "name": f"Test Department {uuid4().hex[:8]}",
        "description": "A test department for automated testing"
    }
    base_data.update(kwargs)
    return DepartmentCreate(**base_data)


def generate_test_user_create(department_id: Optional[UUID] = None, **kwargs):
    """Generate test user creation data"""
    base_data = {
        "name": f"Test User {uuid4().hex[:8]}",
        "email": f"testuser_{uuid4().hex[:8]}@example.com",
        "employee_code": f"TEST{uuid4().hex[:8].upper()}",
        "job_title": "Test Engineer",
        "status": "active",
        "department_id": department_id
    }
    base_data.update(kwargs)
    return UserCreate(**base_data)


# =============================================================================
# Test Configuration Fixtures
# =============================================================================

@pytest.fixture
def test_settings():
    """Test-specific application settings"""
    return {
        "environment": "test",
        "database_url": "postgresql://test:test@localhost/test_db",
        "log_level": "DEBUG",
        "testing": True
    }


@pytest.fixture(autouse=True)
def setup_test_environment(test_settings):
    """Automatically setup test environment for all tests"""
    # This fixture runs before each test
    # Add any global test setup here
    pass


# =============================================================================
# Performance Testing Fixtures
# =============================================================================

@pytest.fixture
def performance_thresholds():
    """Performance thresholds for testing"""
    return {
        "api_response_time": 1.0,  # seconds
        "database_query_time": 0.5,  # seconds
        "service_operation_time": 0.3,  # seconds
        "integration_workflow_time": 5.0  # seconds
    }


# =============================================================================
# Error Testing Fixtures
# =============================================================================

@pytest.fixture
def test_exceptions():
    """Common test exceptions"""
    from app.core.exceptions import (
        NotFoundError, ConflictError, ValidationError,
        PermissionDeniedError, BadRequestError
    )
    
    return {
        "not_found": NotFoundError("Test resource not found"),
        "conflict": ConflictError("Test resource already exists"),
        "validation": ValidationError("Test validation failed"),
        "permission_denied": PermissionDeniedError("Test permission denied"),
        "bad_request": BadRequestError("Test bad request")
    }


# =============================================================================
# Cleanup Fixtures
# =============================================================================

@pytest.fixture
def test_cleanup():
    """Provides cleanup functionality for tests"""
    cleanup_tasks = []
    
    def add_cleanup(task):
        """Add a cleanup task"""
        cleanup_tasks.append(task)
    
    yield add_cleanup
    
    # Execute cleanup tasks after test
    for task in cleanup_tasks:
        try:
            if callable(task):
                task()
        except Exception as e:
            print(f"Cleanup task failed: {e}")


# =============================================================================
# Test Markers Configuration
# =============================================================================

def pytest_configure(config):
    """Configure pytest markers"""
    config.addinivalue_line(
        "markers", "integration: mark test as integration test"
    )
    config.addinivalue_line(
        "markers", "unit: mark test as unit test"
    )
    config.addinivalue_line(
        "markers", "api: mark test as API test"
    )
    config.addinivalue_line(
        "markers", "security: mark test as security test"
    )
    config.addinivalue_line(
        "markers", "performance: mark test as performance test"
    )
    config.addinivalue_line(
        "markers", "slow: mark test as slow running"
    ) 