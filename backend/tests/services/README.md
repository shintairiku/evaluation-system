# Service Testing Guide

This guide shows how to create comprehensive service tests with detailed logging for business logic and service layer operations. Follow this format for all service tests to ensure consistent testing and debugging capabilities.

## Quick Start

Copy the template from any test file and modify it for your service. The template includes:
- ✅ Comprehensive logging to dedicated log files
- ✅ Business logic validation
- ✅ Service dependency mocking
- ✅ Permission and authorization testing
- ✅ Error handling and exception scenarios
- ✅ Data validation and transformation testing

## File Structure

```
backend/tests/services/
├── README.md                     # This guide
├── test_logging_utils.py         # Centralized logging utilities
├── test_user_service.py          # User service tests
├── test_department_service.py    # Department service tests
├── test_auth_service.py          # Authentication service tests
├── test_evaluation_service.py    # Evaluation service tests
├── __init__.py                   # Package initialization
└── logs/                         # Centralized log files for ALL service tests
    ├── user_service_test_YYYYMMDD_HHMMSS.log
    ├── department_service_test_YYYYMMDD_HHMMSS.log
    ├── auth_service_test_YYYYMMDD_HHMMSS.log
    └── evaluation_service_test_YYYYMMDD_HHMMSS.log
```

## Template Structure

### 1. Import and Centralized Logging Setup

```python
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
from datetime import datetime

from app.services.your_service import YourService
from app.schemas.your_schema import YourCreateSchema, YourUpdateSchema
from app.core.exceptions import (
    NotFoundError, ConflictError, ValidationError, 
    PermissionDeniedError, BadRequestError
)
from tests.services.test_logging_utils import (
    setup_service_test_logging,
    log_test_start,
    log_service_operation,
    log_business_logic_verification,
    log_assertion_success,
    log_service_dependency,
    log_validation_test,
    log_permission_test,
    log_exception_handling,
    log_test_summary,
    log_error
)

# Set up centralized logging - CHANGE 'your_service' to your service name
# Examples: 'user', 'department', 'auth', 'evaluation'
TEST_LOG_FILE = setup_service_test_logging('your_service')
```

### 2. Test Class Structure

```python
class TestYourService:
    """Test YourService business logic and operations"""

    @pytest.fixture
    def your_service(self):
        """Create YourService instance for testing"""
        return YourService()

    @pytest.fixture
    def admin_user(self):
        """Admin user for testing"""
        return {
            "sub": "admin_user_123",
            "role": "admin",
            "email": "admin@example.com"
        }

    @pytest.fixture
    def manager_user(self):
        """Manager user for testing"""
        return {
            "sub": "manager_user_456",
            "role": "manager",
            "email": "manager@example.com"
        }

    @pytest.fixture
    def employee_user(self):
        """Employee user for testing"""
        return {
            "sub": "employee_user_789",
            "role": "employee",
            "email": "employee@example.com"
        }

    @pytest.fixture
    def sample_create_data(self):
        """Sample data for creation tests"""
        return YourCreateSchema(
            name="Test Item",
            description="Test description"
        )

    @pytest.fixture
    def sample_update_data(self):
        """Sample data for update tests"""
        return YourUpdateSchema(
            name="Updated Test Item",
            description="Updated description"
        )
```

### 3. Individual Test Functions Template

```python
@pytest.mark.asyncio
async def test_create_service_operation(self, your_service, admin_user, sample_create_data):
    """Test successful service creation operation"""
    log_test_start("create_service_operation")
    
    try:
        # Mock dependencies
        with patch('app.services.your_service.YourRepository') as mock_repo:
            mock_repo_instance = AsyncMock()
            mock_repo.return_value = mock_repo_instance
            mock_repo_instance.create.return_value = MagicMock(
                id=uuid4(),
                name=sample_create_data.name,
                description=sample_create_data.description
            )
            
            # Log service operation
            log_service_operation("create", "YourService", {
                "user_role": admin_user["role"],
                "data": sample_create_data.name
            })
            
            # Execute service operation
            result = await your_service.create_item(sample_create_data, admin_user)
            
            # Verify business logic
            assert result is not None
            assert result.name == sample_create_data.name
            
            # Log business logic verification
            log_business_logic_verification("create_validation", {
                "created_id": str(result.id),
                "name": result.name,
                "description": result.description
            })
            
            # Verify repository was called correctly
            mock_repo_instance.create.assert_called_once()
            log_service_dependency("YourRepository.create", True)
            
            log_assertion_success("Service creation completed successfully")
            log_test_summary("create_service_operation", True)
            
    except Exception as e:
        log_error(e, "create_service_operation test")
        log_test_summary("create_service_operation", False, str(e))
        raise

@pytest.mark.asyncio
async def test_permission_denied_scenario(self, your_service, employee_user, sample_create_data):
    """Test permission denied scenario"""
    log_test_start("permission_denied_scenario")
    
    try:
        # Mock permission check
        with patch('app.services.your_service.PermissionManager') as mock_perm:
            mock_perm.has_permission.return_value = False
            
            # Log permission test
            log_permission_test(employee_user["role"], "create", False)
            
            # Execute service operation - should raise PermissionDeniedError
            with pytest.raises(PermissionDeniedError) as exc_info:
                await your_service.create_item(sample_create_data, employee_user)
            
            # Log exception handling
            log_exception_handling("PermissionDeniedError", True, True)
            
            assert "permission" in str(exc_info.value).lower()
            
            log_assertion_success("Permission denied scenario handled correctly")
            log_test_summary("permission_denied_scenario", True)
            
    except Exception as e:
        log_error(e, "permission_denied_scenario test")
        log_test_summary("permission_denied_scenario", False, str(e))
        raise

@pytest.mark.asyncio
async def test_validation_error_scenario(self, your_service, admin_user):
    """Test validation error scenario"""
    log_test_start("validation_error_scenario")
    
    try:
        # Create invalid data
        invalid_data = YourCreateSchema(name="", description="")
        
        # Log validation test
        log_validation_test("empty_name", {"name": "", "description": ""}, False)
        
        # Execute service operation - should raise ValidationError
        with pytest.raises(ValidationError) as exc_info:
            await your_service.create_item(invalid_data, admin_user)
        
        # Log exception handling
        log_exception_handling("ValidationError", True, True)
        
        assert "name" in str(exc_info.value).lower()
        
        log_assertion_success("Validation error scenario handled correctly")
        log_test_summary("validation_error_scenario", True)
        
    except Exception as e:
        log_error(e, "validation_error_scenario test")
        log_test_summary("validation_error_scenario", False, str(e))
        raise
```

### 4. Required Test Categories

Every service test should include these categories:

#### A. Business Logic Tests
```python
@pytest.mark.asyncio
async def test_business_rule_validation(self, your_service, admin_user):
    """Test specific business rules"""
    # Test business-specific logic
    
@pytest.mark.asyncio
async def test_data_transformation(self, your_service, admin_user):
    """Test data transformation logic"""
    # Test how service transforms data
    
@pytest.mark.asyncio
async def test_business_workflow(self, your_service, admin_user):
    """Test multi-step business workflows"""
    # Test complex business processes
```

#### B. Permission and Authorization Tests
```python
@pytest.mark.asyncio
async def test_admin_permissions(self, your_service, admin_user):
    """Test admin user permissions"""
    
@pytest.mark.asyncio
async def test_manager_permissions(self, your_service, manager_user):
    """Test manager user permissions"""
    
@pytest.mark.asyncio
async def test_employee_permissions(self, your_service, employee_user):
    """Test employee user permissions"""
```

#### C. Validation Tests
```python
@pytest.mark.asyncio
async def test_input_validation(self, your_service, admin_user):
    """Test input validation rules"""
    
@pytest.mark.asyncio
async def test_business_constraints(self, your_service, admin_user):
    """Test business constraint validation"""
    
@pytest.mark.asyncio
async def test_data_integrity(self, your_service, admin_user):
    """Test data integrity checks"""
```

#### D. Error Handling Tests
```python
@pytest.mark.asyncio
async def test_not_found_error(self, your_service, admin_user):
    """Test not found error handling"""
    
@pytest.mark.asyncio
async def test_conflict_error(self, your_service, admin_user):
    """Test conflict error handling"""
    
@pytest.mark.asyncio
async def test_dependency_failure(self, your_service, admin_user):
    """Test dependency failure handling"""
```

#### E. Integration Tests
```python
@pytest.mark.asyncio
async def test_repository_integration(self, your_service, admin_user):
    """Test repository integration"""
    
@pytest.mark.asyncio
async def test_external_service_integration(self, your_service, admin_user):
    """Test external service integration"""
    
@pytest.mark.asyncio
async def test_cache_integration(self, your_service, admin_user):
    """Test cache integration"""
```

## Available Logging Utility Functions

```python
from tests.services.test_logging_utils import (
    setup_service_test_logging,     # Set up logging for service (required)
    log_test_start,                # Log start of test function
    log_service_operation,         # Log service operation details
    log_business_logic_verification, # Log business logic verification
    log_assertion_success,         # Log successful assertions
    log_service_dependency,        # Log service dependency interactions
    log_validation_test,           # Log validation tests
    log_permission_test,           # Log permission tests
    log_exception_handling,        # Log exception handling
    log_test_summary,              # Log test summary
    log_error,                     # Log error details
    log_warning,                   # Log warnings
    log_info                       # Log info messages
)
```

## Test Execution

### Run Individual Service Test Files
```bash
# Run specific service test file
python -m pytest backend/tests/services/test_user_service.py -v

# Run with logging output
python -m pytest backend/tests/services/test_user_service.py -v -s

# Run specific test function
python -m pytest backend/tests/services/test_user_service.py::TestUserService::test_create_user_success -v
```

### Run All Service Tests
```bash
# Run all service tests
python -m pytest backend/tests/services/ -v

# Run with coverage
python -m pytest backend/tests/services/ --cov=app.services --cov-report=html
```

### Direct Execution
```bash
# Make test file executable
chmod +x backend/tests/services/test_user_service.py

# Run directly
python backend/tests/services/test_user_service.py
```

## Best Practices

### 1. Test Organization
- **One test file per service** (UserService, DepartmentService, etc.)
- **Group related tests in classes**
- **Use descriptive test names** that explain the business scenario

### 2. Mocking Strategy
- **Mock external dependencies** (repositories, external APIs)
- **Mock database operations** unless testing integration
- **Mock authentication/authorization** where appropriate
- **Keep business logic unmocked** to test actual service behavior

### 3. Test Data
- **Use realistic test data** that matches business scenarios
- **Test edge cases** and boundary conditions
- **Use fixtures** for reusable test data
- **Clean test data** between tests

### 4. Business Logic Focus
- **Test business rules** and constraints
- **Test data transformations**
- **Test workflow processes**
- **Test error scenarios** and recovery

### 5. Coverage Goals
- **Test all public methods**
- **Test all business rules**
- **Test all permission scenarios**
- **Test all error conditions**
- **Test integration points**

## Common Patterns

### Parameterized Permission Tests
```python
@pytest.mark.parametrize("user_role,should_succeed", [
    ("admin", True),
    ("manager", True),
    ("employee", False),
])
@pytest.mark.asyncio
async def test_role_based_operations(self, your_service, user_role, should_succeed):
    """Test operations by user role"""
    # Implementation
```

### Business Rule Validation
```python
@pytest.mark.asyncio
async def test_business_rule_validation(self, your_service, admin_user):
    """Test specific business rules"""
    # Setup test data that violates business rules
    # Execute operation
    # Verify rule enforcement
```

### Workflow Testing
```python
@pytest.mark.asyncio
async def test_multi_step_workflow(self, your_service, admin_user):
    """Test complete business workflow"""
    # Step 1: Create
    # Step 2: Update
    # Step 3: Process
    # Step 4: Complete
    # Verify each step and final state
```

## Integration with CI/CD

### GitHub Actions
```yaml
- name: Run Service Tests
  run: |
    python -m pytest backend/tests/services/ -v --cov=app.services --cov-report=xml
    
- name: Upload Service Test Logs
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: service-test-logs
    path: backend/tests/services/logs/
```

### Docker Testing
```bash
# Run service tests in Docker
docker-compose run --rm backend python -m pytest backend/tests/services/ -v
```

This guide ensures comprehensive, maintainable, and business-focused service testing across the entire application. 