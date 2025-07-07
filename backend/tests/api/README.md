# API Testing Guide

This guide shows how to create comprehensive API tests with detailed logging for REST endpoints. Follow this format for all API tests to ensure consistent testing and debugging capabilities.

## Quick Start

Copy the template from any test file and modify it for your API endpoints. The template includes:
- ✅ Comprehensive logging to dedicated log files
- ✅ FastAPI TestClient setup and configuration
- ✅ Authentication and authorization testing
- ✅ Request/response validation
- ✅ Error handling and debugging information
- ✅ RBAC (Role-Based Access Control) testing

## File Structure

```
backend/tests/api/
├── README.md                    # This guide
├── test_logging_utils.py        # Centralized logging utilities
├── test_user_endpoints.py       # User API endpoint tests
├── test_department_endpoints.py # Department API endpoint tests
├── test_auth_endpoints.py       # Authentication endpoint tests
├── test_evaluation_endpoints.py # Evaluation endpoint tests
├── __init__.py                  # Package initialization
└── logs/                        # Centralized log files for ALL API tests
    ├── user_api_test_YYYYMMDD_HHMMSS.log
    ├── department_api_test_YYYYMMDD_HHMMSS.log
    ├── auth_api_test_YYYYMMDD_HHMMSS.log
    └── evaluation_api_test_YYYYMMDD_HHMMSS.log
```

## Template Structure

### 1. Import and Centralized Logging Setup

```python
import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from fastapi import status
from uuid import uuid4

from app.main import app
from app.schemas.your_schema import YourSchema
from tests.api.test_logging_utils import (
    setup_api_test_logging,
    log_test_start,
    log_api_request,
    log_response_verification,
    log_assertion_success,
    log_api_connectivity,
    log_authentication_test,
    log_rbac_test,
    log_test_summary,
    log_error
)

# Set up centralized logging - CHANGE 'your_api' to your API name
# Examples: 'user', 'department', 'auth', 'evaluation'
TEST_LOG_FILE = setup_api_test_logging('your_api')

# Create test client
client = TestClient(app)
```

### 2. Test Class Structure

```python
class TestYourAPIEndpoints:
    """Test Your API endpoints with comprehensive logging"""

    @pytest.fixture
    def admin_user_token(self):
        """Admin user authentication token"""
        return {
            "sub": "admin_user_123",
            "role": "admin",
            "email": "admin@example.com"
        }

    @pytest.fixture
    def manager_user_token(self):
        """Manager user authentication token"""
        return {
            "sub": "manager_user_456",
            "role": "manager",
            "email": "manager@example.com"
        }

    @pytest.fixture
    def employee_user_token(self):
        """Employee user authentication token"""
        return {
            "sub": "employee_user_789",
            "role": "employee",
            "email": "employee@example.com"
        }

    @pytest.fixture
    def sample_data(self):
        """Sample data for testing"""
        return {
            "name": "Test Item",
            "description": "Test description"
        }
```

### 3. Individual Test Functions Template

```python
@patch('app.dependencies.auth.get_current_user')
def test_get_endpoint_success(self, mock_get_current_user, admin_user_token):
    """Test successful GET endpoint"""
    log_test_start("get_endpoint_success")
    
    try:
        # Mock authentication
        mock_get_current_user.return_value = admin_user_token
        
        # Make request
        response = client.get("/api/v1/your-endpoint/")
        
        # Log API request
        log_api_request("GET", "/api/v1/your-endpoint/", response.status_code)
        
        # Verify response
        assert response.status_code == 200
        data = response.json()
        
        # Log response verification
        log_response_verification({
            "status_code": response.status_code,
            "items_count": len(data.get("items", [])),
            "total": data.get("total", 0)
        })
        
        log_assertion_success("GET endpoint returned successful response")
        log_test_summary("get_endpoint_success", True)
        
    except Exception as e:
        log_error(e, "get_endpoint_success test")
        log_test_summary("get_endpoint_success", False, str(e))
        raise

@patch('app.dependencies.auth.get_current_user')
def test_post_endpoint_success(self, mock_get_current_user, admin_user_token, sample_data):
    """Test successful POST endpoint"""
    log_test_start("post_endpoint_success")
    
    try:
        # Mock authentication
        mock_get_current_user.return_value = admin_user_token
        
        # Make request
        response = client.post("/api/v1/your-endpoint/", json=sample_data)
        
        # Log API request
        log_api_request("POST", "/api/v1/your-endpoint/", response.status_code)
        
        # Verify response
        assert response.status_code == 200
        data = response.json()
        
        # Log response verification
        log_response_verification({
            "status_code": response.status_code,
            "created_id": data.get("id"),
            "name": data.get("name")
        })
        
        log_assertion_success("POST endpoint created resource successfully")
        log_test_summary("post_endpoint_success", True)
        
    except Exception as e:
        log_error(e, "post_endpoint_success test")
        log_test_summary("post_endpoint_success", False, str(e))
        raise
```

### 4. Required Test Categories

Every API test should include these categories:

#### A. Basic CRUD Operations
```python
def test_create_endpoint_success(self, ...):
    """Test successful creation"""

def test_read_endpoint_success(self, ...):
    """Test successful reading"""

def test_update_endpoint_success(self, ...):
    """Test successful update"""

def test_delete_endpoint_success(self, ...):
    """Test successful deletion"""
```

#### B. Authentication Tests
```python
def test_endpoint_requires_authentication(self):
    """Test endpoint requires authentication"""
    log_test_start("endpoint_requires_authentication")
    
    try:
        # Make request without authentication
        response = client.get("/api/v1/your-endpoint/")
        
        # Log API request
        log_api_request("GET", "/api/v1/your-endpoint/", response.status_code)
        
        # Verify 401 response
        assert response.status_code == 401
        
        log_authentication_test("no_auth", response.status_code == 401)
        log_test_summary("endpoint_requires_authentication", True)
        
    except Exception as e:
        log_error(e, "endpoint_requires_authentication test")
        log_test_summary("endpoint_requires_authentication", False, str(e))
        raise
```

#### C. Authorization/RBAC Tests
```python
@patch('app.dependencies.auth.get_current_user')
def test_endpoint_admin_only(self, mock_get_current_user, employee_user_token):
    """Test endpoint requires admin role"""
    log_test_start("endpoint_admin_only")
    
    try:
        # Mock employee authentication
        mock_get_current_user.return_value = employee_user_token
        
        # Make request
        response = client.post("/api/v1/your-endpoint/", json={})
        
        # Log RBAC test
        log_rbac_test("employee", "/api/v1/your-endpoint/", 403, response.status_code)
        
        # Verify 403 response
        assert response.status_code == 403
        
        log_test_summary("endpoint_admin_only", True)
        
    except Exception as e:
        log_error(e, "endpoint_admin_only test")
        log_test_summary("endpoint_admin_only", False, str(e))
        raise
```

#### D. Validation Tests
```python
def test_endpoint_validation_errors(self, ...):
    """Test input validation"""

def test_endpoint_invalid_uuid(self, ...):
    """Test invalid UUID handling"""

def test_endpoint_missing_fields(self, ...):
    """Test missing required fields"""
```

#### E. Error Handling Tests
```python
def test_endpoint_not_found(self, ...):
    """Test 404 error handling"""

def test_endpoint_conflict_error(self, ...):
    """Test 409 conflict handling"""

def test_endpoint_server_error(self, ...):
    """Test 500 server error handling"""
```

## Available Logging Utility Functions

```python
from tests.api.test_logging_utils import (
    setup_api_test_logging,        # Set up logging for API (required)
    log_test_start,               # Log start of test function
    log_api_request,              # Log API request details
    log_response_verification,    # Log response verification
    log_assertion_success,        # Log successful assertions
    log_api_connectivity,         # Log API connectivity
    log_authentication_test,      # Log authentication tests
    log_rbac_test,               # Log RBAC tests
    log_test_summary,            # Log test summary
    log_error,                   # Log error details
    log_warning,                 # Log warnings
    log_info                     # Log info messages
)
```

## Test Execution

### Run Individual API Test Files
```bash
# Run specific API test file
python -m pytest backend/tests/api/test_user_endpoints.py -v

# Run with logging output
python -m pytest backend/tests/api/test_user_endpoints.py -v -s

# Run specific test function
python -m pytest backend/tests/api/test_user_endpoints.py::TestUserAPIEndpoints::test_get_users_success -v
```

### Run All API Tests
```bash
# Run all API tests
python -m pytest backend/tests/api/ -v

# Run with coverage
python -m pytest backend/tests/api/ --cov=app.api --cov-report=html
```

### Direct Execution
```bash
# Make test file executable
chmod +x backend/tests/api/test_user_endpoints.py

# Run directly
python backend/tests/api/test_user_endpoints.py
```

## Best Practices

### 1. Test Organization
- **One test file per API resource** (users, departments, etc.)
- **Group related tests in classes**
- **Use descriptive test names** that explain what is being tested

### 2. Test Data
- **Use fixtures** for reusable test data
- **Mock external dependencies** (databases, external APIs)
- **Clean up test data** after each test

### 3. Logging
- **Log all API requests and responses**
- **Log authentication and authorization checks**
- **Log validation and error scenarios**
- **Use consistent logging format**

### 4. Coverage
- **Test all HTTP methods** (GET, POST, PUT, DELETE)
- **Test all response codes** (200, 201, 400, 401, 403, 404, 409, 500)
- **Test edge cases** and error conditions
- **Test with different user roles**

### 5. Assertions
- **Verify status codes**
- **Verify response structure**
- **Verify response data**
- **Verify side effects** (database changes, etc.)

## Common Patterns

### Parameterized Tests
```python
@pytest.mark.parametrize("role,expected_status", [
    ("admin", 200),
    ("manager", 200),
    ("employee", 403),
])
def test_endpoint_role_access(self, role, expected_status):
    """Test endpoint access by role"""
    # Implementation
```

### Async Tests
```python
@pytest.mark.asyncio
async def test_async_endpoint(self):
    """Test async endpoint"""
    # Implementation
```

### Error Scenarios
```python
def test_endpoint_error_scenarios(self):
    """Test various error scenarios"""
    test_cases = [
        {"data": {}, "expected": 400, "error": "Missing required field"},
        {"data": {"invalid": "data"}, "expected": 422, "error": "Validation error"},
    ]
    
    for case in test_cases:
        with self.subTest(case=case):
            # Test implementation
```

## Integration with CI/CD

### GitHub Actions
```yaml
- name: Run API Tests
  run: |
    python -m pytest backend/tests/api/ -v --cov=app.api --cov-report=xml
    
- name: Upload API Test Logs
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: api-test-logs
    path: backend/tests/api/logs/
```

### Docker Testing
```bash
# Run API tests in Docker
docker-compose run --rm backend python -m pytest backend/tests/api/ -v
```

This guide ensures consistent, comprehensive, and maintainable API testing across the entire application. 