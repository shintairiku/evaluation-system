# Service Layer Tests

This directory contains unit tests for all service layer components in the application.

## Purpose

Service tests validate business logic and ensure services interact correctly with repositories and handle data transformations properly. These tests should be fast, isolated, and focused on specific functionality.

## Testing Guidelines

### What to Test in Services
- **Business logic validation**
- **Data transformation and mapping**
- **Repository method calls and interactions**
- **Error handling and exception cases**
- **Return value structure and types**

### What NOT to Test in Services
- Database queries (test in repository layer)
- HTTP requests/responses (test in API layer)
- Complex integration flows (test in integration layer)

### Testing Patterns

#### 1. Mock Dependencies
```python
# Always mock repository dependencies
service.department_repo.get_all = AsyncMock(return_value=[])
```

#### 2. Test One Function at a Time
```python
@pytest.mark.asyncio
async def test_specific_method():
    # Focus on single method behavior
```

#### 3. Use Clear Test Structure
- **Arrange**: Set up mocks and test data
- **Act**: Call the method being tested
- **Assert**: Verify expected behavior

### File Naming Convention
- `test_{service_name}.py` - e.g., `test_auth_service.py`, `test_user_service.py`
- One test file per service class

### Running Tests

```bash
# Run all service tests
pytest backend/tests/services/ -v

# Run specific service test file
pytest backend/tests/services/test_auth_service.py -v

# Run specific test function
pytest backend/tests/services/test_auth_service.py::test_get_profile_options -v

# Run with coverage
pytest backend/tests/services/ --cov=app.services -v
```

## Test Organization

Each service test file should:
1. Import only necessary dependencies
2. Use async/await for service methods
3. Mock all external dependencies
4. Focus on business logic validation
5. Include error case testing

## Logging

All service tests use centralized logging utilities for consistent output and debugging.

### Setup
```python
from .test_logging_utils import setup_service_test_logging
TEST_LOG_FILE = setup_service_test_logging('auth')
```

### Usage in Tests
```python
from .test_logging_utils import (
    log_test_start,
    log_test_success,
    log_test_failure,
    log_mock_setup,
    log_assertion_success,
    log_repository_interaction
)

@pytest.mark.asyncio
async def test_my_service_method():
    test_name = "test_my_service_method"
    log_test_start(test_name)
    
    try:
        # Test implementation with logging
        log_mock_setup("repository_name", "description")
        # ... test code ...
        log_assertion_success("Assertion description")
        log_test_success(test_name)
    except Exception as e:
        log_test_failure(test_name, e)
        raise
```

### Log Files
- All logs are saved to `backend/tests/logs/`
- Format: `{service_name}_service_test_{timestamp}.log`
- Contains detailed test execution information

## Examples

See existing test files in this directory for implementation examples following these guidelines.