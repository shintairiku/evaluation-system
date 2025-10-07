# Repository Layer Tests

This directory contains unit tests for all repository layer components in the application.

## Purpose

Repository tests validate database operations and ensure repositories interact correctly with the database and handle data persistence properly. These tests should verify actual database connectivity and data integrity with Supabase.

## Testing Guidelines

### What to Test in Repositories
- **Database connectivity and queries**
- **CRUD operations (Create, Read, Update, Delete)**
- **Data persistence and retrieval**
- **Relationship loading and joins**
- **Search and filtering functionality**
- **Database constraint validation**

### What NOT to Test in Repositories
- Business logic (test in service layer)
- HTTP requests/responses (test in API layer)
- Complex workflows (test in integration layer)

### Testing Patterns

#### 1. Use Real Database Sessions
```python
# Always use actual database sessions for repository tests
@pytest_asyncio.fixture
async def session(self):
    async for session in get_db_session():
        yield session
        break
```

#### 2. Test One Function at a Time
```python
@pytest.mark.asyncio
async def test_specific_repository_method():
    # Focus on single repository method behavior
```

#### 3. Use Clear Test Structure
- **Arrange**: Set up test data and IDs
- **Act**: Call the repository method
- **Assert**: Verify database results and data integrity

### File Naming Convention
- `test_{repository_name}_repo.py` - e.g., `test_user_repo.py`, `test_department_repo.py`
- One test file per repository class

### Running Tests

```bash
# Run all repository tests
pytest backend/tests/repositories/ -v

# Run specific repository test file
pytest backend/tests/repositories/test_user_repo.py -v

# Run specific test function
pytest backend/tests/repositories/test_user_repo.py::test_search_users -v

# Run with coverage
pytest backend/tests/repositories/ --cov=app.database.repositories -v
```

## Test Organization

Each repository test file should:
1. Import only necessary dependencies
2. Use async/await for repository methods
3. Test with actual Supabase data
4. Focus on database operation validation
5. Include connectivity and error case testing

## Logging

All repository tests use centralized logging utilities for consistent output and debugging.

### Setup
```python
from .test_logging_utils import setup_repository_test_logging
TEST_LOG_FILE = setup_repository_test_logging('user')
```

### Usage in Tests
```python
from .test_logging_utils import (
    log_test_start,
    log_data_verification,
    log_assertion_success,
    log_supabase_connectivity,
    log_database_operation
)

@pytest.mark.asyncio
async def test_my_repository_method(self, repo):
    log_test_start("test_my_repository_method")
    
    try:
        # Test implementation with logging
        log_database_operation("fetching user by ID", {"user_id": user_id})
        user = await repo.get_user_by_id(user_id)
        
        log_data_verification("user", {
            "ID": user.id,
            "Name": user.name,
            "Status": user.status
        })
        
        log_assertion_success("User data retrieved successfully")
    except Exception as e:
        logging.error(f"❌ Error during repository test: {str(e)}")
        raise
```

### Log Files
- All logs are saved to `backend/tests/logs/`
- Format: `{repository_name}_repo_test_{timestamp}.log`
- Contains detailed database operation information

## Examples

See existing test files in this directory for implementation examples following these guidelines.

