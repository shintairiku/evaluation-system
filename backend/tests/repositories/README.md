# Repository Testing Guide

This guide shows how to create comprehensive repository tests with detailed logging for database operations. Follow this format for all repository tests to ensure consistent testing and debugging capabilities.

## Quick Start

Copy the template from `test_user_repo.py` and modify it for your repository. The template includes:
- ✅ Comprehensive logging to dedicated log files
- ✅ Supabase connectivity verification
- ✅ Individual function testing with detailed output
- ✅ Error handling and debugging information

## File Structure

```
backend/tests/repositories/
├── README.md                 # This guide
├── test_user_repo.py        # Template example
├── test_your_repo.py        # Your new repo test
├── test_department_repo.py  # Department repo test
├── test_evaluation_repo.py  # Evaluation repo test
└── logs/                    # Centralized log files for ALL repositories
    ├── user_repo_test_YYYYMMDD_HHMMSS.log
    ├── department_repo_test_YYYYMMDD_HHMMSS.log
    ├── evaluation_repo_test_YYYYMMDD_HHMMSS.log
    └── your_repo_test_YYYYMMDD_HHMMSS.log
```

## Template Structure

### 1. Import and Centralized Logging Setup

```python
import pytest
import asyncio
import logging
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
import pytest_asyncio

from app.database.repositories.your_repo import YourRepository
from app.schemas.your_schema import YourSchema
from app.database.session import get_db_session
from tests.repositories.test_logging_utils import (
    setup_repository_test_logging, 
    log_test_start, 
    log_data_verification, 
    log_assertion_success,
    log_supabase_connectivity
)

# Set up centralized logging - CHANGE 'your_repo' to your repository name
# Examples: 'user', 'department', 'evaluation', 'role'
TEST_LOG_FILE = setup_repository_test_logging('your_repo')
```

**Key Benefits of Centralized Logging:**
- ✅ **Consistent logging** across all repository tests
- ✅ **No code duplication** - import and use
- ✅ **Centralized log directory** - all logs in `tests/logs/`
- ✅ **Utility functions** for common logging patterns
- ✅ **Easy maintenance** - update logging in one place

### Available Logging Utility Functions

```python
# Import these functions for use in your tests
from tests.repositories.test_logging_utils import (
    setup_repository_test_logging,  # Set up logging for repo (required)
    log_test_start,                 # Log start of test function
    log_data_verification,          # Log retrieved data details
    log_assertion_success,          # Log successful assertions
    log_supabase_connectivity,      # Log connectivity success
    log_database_operation,         # Log database operations
    log_test_summary               # Log final test summary
)
```

**Function Usage Examples:**
```python
# Set up logging (once per test file)
TEST_LOG_FILE = setup_repository_test_logging('department')

# Start a test
log_test_start("get_department_by_id")

# Log data verification
log_data_verification("department", {
    "ID": dept.id,
    "Name": dept.name,
    "Manager": dept.manager_name
})

# Log successful assertion
log_assertion_success("Department data is consistent")

# Log connectivity
log_supabase_connectivity(5, "departments")
```

### 2. Test Class Structure

```python
class TestYourRepository:
    """Test YourRepository with actual Supabase data"""

    @pytest_asyncio.fixture
    async def session(self):
        """Get actual database session"""
        async for session in get_db_session():
            yield session
            break

    @pytest_asyncio.fixture
    async def your_repo(self, session):
        """Create YourRepository instance"""
        return YourRepository(session)

    # Test data - replace with your actual test data
    SEED_DATA_IDS = {
        "test_item_1": UUID("123e4567-e89b-12d3-a456-426614174000"),
        "test_item_2": UUID("223e4567-e89b-12d3-a456-426614174001"),
    }
```

### 3. Individual Test Functions Template (Using Centralized Logging)

```python
@pytest.mark.asyncio
async def test_your_function_name(self, your_repo):
    """Test description - what this function does"""
    log_test_start("your_function_name")

    # Test data
    test_input = "your_test_input"
    logging.info(f"Attempting to test with input: {test_input}")

    try:
        # Execute the repository function
        result = await your_repo.your_function_name(test_input)

        if result:
            # Log data verification using utility function
            log_data_verification("your_entity", {
                "ID": result.id,
                "Name": result.name,
                "Status": result.status,
                # Add other relevant fields
            })

            # Verify data integrity
            assert result is not None, "Result should not be None"
            assert result.name == "expected_name", f"Expected 'expected_name', got '{result.name}'"
            # Add other assertions

            log_assertion_success("All assertions passed - Supabase data is consistent")
        else:
            logging.error("❌ No data found in Supabase database")
            logging.error(f"   Searched input: {test_input}")
            raise AssertionError("Data should exist in Supabase")

    except Exception as e:
        logging.error(f"❌ Error during Supabase query: {str(e)}")
        logging.error(f"   Error type: {type(e).__name__}")
        raise
```

### 4. Required Test Functions

Every repository test should include these core tests:

#### A. Connectivity Test (Using Centralized Logging)
```python
@pytest.mark.asyncio
async def test_supabase_connectivity(self, your_repo):
    """Test basic Supabase database connectivity"""
    log_test_start("Supabase Database Connectivity")

    try:
        # Test basic connectivity by querying your table
        logging.info("Testing basic database connection...")
        results = await your_repo.get_all()  # or similar basic function

        # Log connectivity success using utility function
        log_supabase_connectivity(len(results), "your_table_name")

        # Verify we can access the database
        assert len(results) >= 0, "Should be able to query your table"
        log_assertion_success("Database connectivity verified")

    except Exception as e:
        logging.error(f"❌ Supabase connectivity failed: {str(e)}")
        logging.error(f"   Connection error type: {type(e).__name__}")
        raise
```

#### B. CRUD Operation Tests
```python
@pytest.mark.asyncio
async def test_get_by_id(self, your_repo):
    """Test fetching record by ID"""
    # Follow the detailed logging template above

@pytest.mark.asyncio  
async def test_get_by_field(self, your_repo):
    """Test fetching record by specific field"""
    # Follow the detailed logging template above

@pytest.mark.asyncio
async def test_get_with_relationships(self, your_repo):
    """Test fetching record with JOIN relationships"""
    # Follow the detailed logging template above
```

## Running Tests

All test files are **self-executable** with built-in command-line capabilities:

### Method 1: Run all tests in a file
```bash
cd backend
python -m tests.repositories.test_user_repo
```

### Method 2: Run specific test function
```bash
cd backend
python -m tests.repositories.test_user_repo get_user_by_clerk_id
```

### Method 3: Show available tests and help
```bash
cd backend
python -m tests.repositories.test_user_repo --help
python -m tests.repositories.test_user_repo --list
```

### Method 4: Traditional pytest (still works)
```bash
cd backend
pytest tests/repositories/test_your_repo.py -v -s
```

### Self-Executable Test Features

Each test file includes:
- ✅ **Command-line argument support** for test selection
- ✅ **Interactive help system** showing available tests
- ✅ **Individual test execution** by function name
- ✅ **Comprehensive logging** with timestamped files
- ✅ **Test summary and statistics**

Example usage:
```bash
# Show help and available tests
python -m tests.repositories.test_user_repo --help

# Run specific test
python -m tests.repositories.test_user_repo supabase_connectivity

# Run all tests (default)
python -m tests.repositories.test_user_repo
```

## Log File Output

**All repository tests generate logs in the same central directory:**
```
backend/tests/logs/
```

**Each repository gets its own log file with unique naming:**
```
tests/logs/user_repo_test_20250630_132753.log          # User repository
tests/logs/department_repo_test_20250630_133045.log    # Department repository  
tests/logs/evaluation_repo_test_20250630_133312.log    # Evaluation repository
tests/logs/your_repo_test_20250630_133500.log          # Your repository
```

### Log Content Includes:
- ✅ Database connection establishment
- ✅ SQL queries executed with parameters
- ✅ Function execution results
- ✅ Data verification and assertions
- ✅ Error details if any failures occur

### Sample Log Output:
```
2025-06-30 13:27:55,793 - root - INFO - test_get_by_id:105 - ✅ Successfully fetched data from Supabase
2025-06-30 13:27:55,793 - root - INFO - test_get_by_id:106 -    Record ID: 123e4567-e89b-12d3-a456-426614174000
2025-06-30 13:27:55,793 - root - INFO - test_get_by_id:107 -    Record Name: Test Record
2025-06-30 13:27:55,795 - root - INFO - test_get_by_id:119 - ✅ All assertions passed - Supabase data is consistent
```

## Customization Guide

### 1. Replace Repository References
- Change `YourRepository` to your actual repository class
- Update import paths to match your repository location

### 2. Update Test Data
- Replace `SEED_DATA_IDS` with your actual test data IDs
- Update field names and expected values in assertions

### 3. Add Repository-Specific Tests
- Include tests for your unique repository functions
- Test edge cases specific to your domain logic

### 4. Customize Logging Messages
- Update function descriptions
- Add domain-specific field logging
- Include relevant business logic verification

## Best Practices

### ✅ Do:
- **Test all public repository methods**
- **Log detailed information for each function call**
- **Verify data integrity with assertions**
- **Test both success and failure scenarios**
- **Use meaningful test data**

### ❌ Don't:
- **Skip logging setup - it's crucial for debugging**
- **Test with production data**
- **Ignore database relationship testing**
- **Forget to test edge cases**
- **Mix repository tests with business logic tests**

## Troubleshooting

### Common Issues:

1. **Import Errors**
   ```python
   # Make sure your import paths are correct
   from app.database.repositories.your_repo import YourRepository
   ```

2. **Database Connection Issues**
   ```python
   # Check your database session configuration
   # Verify Supabase connection settings
   ```

3. **Test Data Not Found**
   ```python
   # Ensure your test database has the required seed data
   # Check your SEED_DATA_IDS match actual database records
   ```

4. **Logging Not Working**
   ```python
   # Verify the logs directory exists and is writable
   mkdir -p tests/logs
   ```

## Example: Complete Test File

See `test_user_repo.py` for a complete working example that demonstrates:
- ✅ Proper logging setup
- ✅ Comprehensive test coverage  
- ✅ Supabase connectivity verification
- ✅ Detailed error handling
- ✅ Data integrity verification

Copy this file as your starting template and modify for your specific repository needs.

---

## Quick Copy-Paste Checklist

When creating a new repository test:

1. [ ] Copy `test_user_repo.py` to `test_your_repo.py`
2. [ ] **Change the repository name in logging setup:**
   ```python
   TEST_LOG_FILE = setup_repository_test_logging('your_repo_name')
   ```
3. [ ] Update import statements for your repository
4. [ ] Update class/function names to match your repository
5. [ ] Update `SEED_DATA_IDS` with your test data
6. [ ] Modify test functions for your repository methods
7. [ ] Use the logging utility functions (`log_test_start`, `log_data_verification`, etc.)
8. [ ] Run the test to verify it works
9. [ ] Check the generated log file in `tests/logs/your_repo_test_YYYYMMDD_HHMMSS.log`

**Time needed:** ~10-20 minutes per repository (faster with centralized logging!)

**Example Repository Names:**
- `'user'` → `user_repo_test_20250630_132753.log`
- `'department'` → `department_repo_test_20250630_133045.log`  
- `'evaluation'` → `evaluation_repo_test_20250630_133312.log`
- `'role'` → `role_repo_test_20250630_133500.log`

This template ensures consistent, thorough testing across all repositories with excellent debugging capabilities through centralized logging utilities. 