# Integration Testing Guide

This guide shows how to create comprehensive integration tests with detailed logging for end-to-end workflows, component integration, and system-wide operations. Follow this format for all integration tests to ensure consistent testing and validation.

## Quick Start

Copy the template from any test file and modify it for your integration scenario. The template includes:
- ✅ Comprehensive logging to dedicated log files
- ✅ End-to-end workflow testing
- ✅ Component integration validation
- ✅ Database and API integration
- ✅ User journey testing
- ✅ Performance and system state monitoring

## File Structure

```
backend/tests/integration/
├── README.md                     # This guide
├── test_logging_utils.py         # Centralized logging utilities
├── test_user_workflows.py        # User-related end-to-end workflows
├── test_department_workflows.py  # Department management workflows
├── test_evaluation_workflows.py  # Evaluation process workflows
├── test_auth_integration.py      # Authentication integration tests
├── test_api_integration.py       # API integration tests
├── test_database_integration.py  # Database integration tests
├── test_system_workflows.py      # System-wide workflow tests
├── __init__.py                   # Package initialization
└── logs/                         # Centralized log files for ALL integration tests
    ├── user_flow_integration_test_YYYYMMDD_HHMMSS.log
    ├── department_workflow_integration_test_YYYYMMDD_HHMMSS.log
    ├── evaluation_workflow_integration_test_YYYYMMDD_HHMMSS.log
    └── end_to_end_integration_test_YYYYMMDD_HHMMSS.log
```

## Template Structure

### 1. Import and Centralized Logging Setup

```python
import pytest
from unittest.mock import patch, AsyncMock
import asyncio
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession
import pytest_asyncio
from uuid import uuid4
from datetime import datetime

from app.main import app
from app.database.session import get_db_session
from app.services.user_service import UserService
from app.services.department_service import DepartmentService
from app.schemas.user import UserCreate, UserUpdate
from app.schemas.department import DepartmentCreate
from tests.integration.test_logging_utils import (
    setup_integration_test_logging,
    log_test_start,
    log_integration_step,
    log_workflow_verification,
    log_end_to_end_test,
    log_database_state,
    log_api_sequence,
    log_component_integration,
    log_system_state,
    log_user_journey,
    log_assertion_success,
    log_data_flow_verification,
    log_performance_metric,
    log_test_summary,
    log_error
)

# Set up centralized logging - CHANGE 'your_workflow' to your workflow name
# Examples: 'user_flow', 'department_workflow', 'evaluation_process', 'end_to_end'
TEST_LOG_FILE = setup_integration_test_logging('your_workflow')

# Create test client for API integration
client = TestClient(app)
```

### 2. Test Class Structure

```python
class TestYourWorkflowIntegration:
    """Test Your Workflow end-to-end integration"""

    @pytest_asyncio.fixture
    async def db_session(self):
        """Get actual database session for integration tests"""
        async for session in get_db_session():
            yield session
            break

    @pytest.fixture
    def user_service(self):
        """Create UserService instance for testing"""
        return UserService()

    @pytest.fixture
    def department_service(self):
        """Create DepartmentService instance for testing"""
        return DepartmentService()

    @pytest.fixture
    def admin_user_data(self):
        """Admin user data for testing"""
        return {
            "sub": "admin_integration_test",
            "role": "admin",
            "email": "admin@integration.test",
            "name": "Integration Test Admin"
        }

    @pytest.fixture
    def sample_user_data(self):
        """Sample user data for workflow testing"""
        return UserCreate(
            name="Integration Test User",
            email="user@integration.test",
            employee_code="INT001",
            department_id=None  # Will be set during test
        )

    @pytest.fixture
    def sample_department_data(self):
        """Sample department data for workflow testing"""
        return DepartmentCreate(
            name="Integration Test Department",
            description="Department created for integration testing"
        )
```

### 3. Individual Test Functions Template

```python
@pytest.mark.asyncio
async def test_complete_user_management_workflow(
    self, 
    user_service, 
    department_service, 
    admin_user_data, 
    sample_user_data, 
    sample_department_data
):
    """Test complete user management workflow end-to-end"""
    log_test_start("complete_user_management_workflow")
    
    try:
        # Step 1: Create department
        log_integration_step(1, "Create department", {
            "department_name": sample_department_data.name
        })
        
        created_dept = await department_service.create_department(
            sample_department_data, admin_user_data
        )
        
        log_database_state("department_created", "departments", 1)
        assert created_dept is not None
        
        # Step 2: Create user in department
        log_integration_step(2, "Create user in department", {
            "user_name": sample_user_data.name,
            "department_id": str(created_dept.id)
        })
        
        sample_user_data.department_id = created_dept.id
        created_user = await user_service.create_user(
            sample_user_data, admin_user_data
        )
        
        log_database_state("user_created", "users", 1)
        assert created_user is not None
        assert created_user.department_id == created_dept.id
        
        # Step 3: Verify user-department relationship
        log_integration_step(3, "Verify user-department relationship", {
            "user_id": str(created_user.id),
            "department_id": str(created_dept.id)
        })
        
        # Verify data flow
        log_data_flow_verification(
            "user_department_link",
            "users.department_id",
            "departments.id",
            True
        )
        
        # Step 4: Update user information
        log_integration_step(4, "Update user information", {
            "user_id": str(created_user.id),
            "new_name": "Updated Integration User"
        })
        
        update_data = UserUpdate(name="Updated Integration User")
        updated_user = await user_service.update_user(
            created_user.id, update_data, admin_user_data
        )
        
        assert updated_user.name == "Updated Integration User"
        
        # Step 5: Clean up - Delete user and department
        log_integration_step(5, "Clean up test data", {
            "deleting_user": str(created_user.id),
            "deleting_department": str(created_dept.id)
        })
        
        await user_service.delete_user(created_user.id, admin_user_data)
        await department_service.delete_department(created_dept.id, admin_user_data)
        
        # Verify workflow completion
        log_workflow_verification("user_management_complete", {
            "department_created": True,
            "user_created": True,
            "relationship_verified": True,
            "user_updated": True,
            "cleanup_completed": True
        })
        
        log_assertion_success("Complete user management workflow successful")
        log_test_summary("complete_user_management_workflow", True)
        
    except Exception as e:
        log_error(e, "complete_user_management_workflow test")
        log_test_summary("complete_user_management_workflow", False, str(e))
        raise

@pytest.mark.asyncio
async def test_api_workflow_integration(self, admin_user_data):
    """Test API workflow integration"""
    log_test_start("api_workflow_integration")
    
    try:
        endpoints_sequence = [
            "POST /api/v1/departments/",
            "GET /api/v1/departments/",
            "POST /api/v1/users/",
            "GET /api/v1/users/",
            "PUT /api/v1/users/{id}",
            "DELETE /api/v1/users/{id}",
            "DELETE /api/v1/departments/{id}"
        ]
        
        # Mock authentication for all requests
        with patch('app.dependencies.auth.get_current_user') as mock_auth:
            mock_auth.return_value = admin_user_data
            
            # Step 1: Create department via API
            log_integration_step(1, "Create department via API")
            dept_data = {"name": "API Test Department", "description": "API testing"}
            dept_response = client.post("/api/v1/departments/", json=dept_data)
            
            assert dept_response.status_code == 200
            dept_id = dept_response.json()["department"]["id"]
            
            # Step 2: Create user via API
            log_integration_step(2, "Create user via API")
            user_data = {
                "name": "API Test User",
                "email": "api@test.com",
                "employee_code": "API001",
                "department_id": dept_id
            }
            user_response = client.post("/api/v1/users/", json=user_data)
            
            assert user_response.status_code == 200
            user_id = user_response.json()["user"]["id"]
            
            # Step 3: Verify data via GET endpoints
            log_integration_step(3, "Verify data via GET endpoints")
            dept_get_response = client.get(f"/api/v1/departments/{dept_id}")
            user_get_response = client.get(f"/api/v1/users/{user_id}")
            
            assert dept_get_response.status_code == 200
            assert user_get_response.status_code == 200
            
            # Log API sequence completion
            log_api_sequence("department_user_crud", endpoints_sequence[:4], True)
            
            # Step 4: Clean up via API
            log_integration_step(4, "Clean up via API")
            delete_user_response = client.delete(f"/api/v1/users/{user_id}")
            delete_dept_response = client.delete(f"/api/v1/departments/{dept_id}")
            
            assert delete_user_response.status_code == 200
            assert delete_dept_response.status_code == 200
            
            log_api_sequence("complete_crud_workflow", endpoints_sequence, True)
        
        log_end_to_end_test("api_workflow", ["API", "Service", "Repository", "Database"], True)
        log_test_summary("api_workflow_integration", True)
        
    except Exception as e:
        log_error(e, "api_workflow_integration test")
        log_test_summary("api_workflow_integration", False, str(e))
        raise

@pytest.mark.asyncio
async def test_component_integration(self, user_service, department_service, admin_user_data):
    """Test component integration between services"""
    log_test_start("component_integration")
    
    try:
        # Test UserService <-> DepartmentService integration
        log_component_integration("UserService", "DepartmentService", "data_relationship", True)
        
        # Create department first
        dept_data = DepartmentCreate(name="Component Test Dept", description="Testing")
        department = await department_service.create_department(dept_data, admin_user_data)
        
        # Create user with department reference
        user_data = UserCreate(
            name="Component Test User",
            email="component@test.com",
            employee_code="COMP001",
            department_id=department.id
        )
        user = await user_service.create_user(user_data, admin_user_data)
        
        # Verify integration
        assert user.department_id == department.id
        
        # Test department user count
        dept_users = await department_service.get_department_users(department.id, admin_user_data)
        assert len(dept_users["items"]) >= 1
        
        log_component_integration("UserService", "DepartmentService", "user_count_sync", True)
        
        # Clean up
        await user_service.delete_user(user.id, admin_user_data)
        await department_service.delete_department(department.id, admin_user_data)
        
        log_assertion_success("Component integration working correctly")
        log_test_summary("component_integration", True)
        
    except Exception as e:
        log_error(e, "component_integration test")
        log_test_summary("component_integration", False, str(e))
        raise
```

### 4. Required Test Categories

Every integration test should include these categories:

#### A. End-to-End Workflows
```python
@pytest.mark.asyncio
async def test_complete_user_lifecycle(self, ...):
    """Test complete user lifecycle from creation to deletion"""

@pytest.mark.asyncio
async def test_department_management_workflow(self, ...):
    """Test complete department management workflow"""

@pytest.mark.asyncio
async def test_evaluation_process_workflow(self, ...):
    """Test complete evaluation process workflow"""
```

#### B. API Integration Tests
```python
@pytest.mark.asyncio
async def test_api_crud_workflows(self, ...):
    """Test CRUD operations via API"""

@pytest.mark.asyncio
async def test_api_error_handling(self, ...):
    """Test API error handling integration"""

@pytest.mark.asyncio
async def test_api_authentication_flow(self, ...):
    """Test authentication flow through API"""
```

#### C. Database Integration Tests
```python
@pytest.mark.asyncio
async def test_database_transactions(self, ...):
    """Test database transaction handling"""

@pytest.mark.asyncio
async def test_data_consistency(self, ...):
    """Test data consistency across tables"""

@pytest.mark.asyncio
async def test_database_relationships(self, ...):
    """Test database relationship integrity"""
```

#### D. Component Integration Tests
```python
@pytest.mark.asyncio
async def test_service_integration(self, ...):
    """Test service layer integration"""

@pytest.mark.asyncio
async def test_repository_integration(self, ...):
    """Test repository layer integration"""

@pytest.mark.asyncio
async def test_middleware_integration(self, ...):
    """Test middleware integration"""
```

#### E. System-wide Tests
```python
@pytest.mark.asyncio
async def test_performance_integration(self, ...):
    """Test system performance under load"""

@pytest.mark.asyncio
async def test_error_propagation(self, ...):
    """Test error propagation through system layers"""

@pytest.mark.asyncio
async def test_security_integration(self, ...):
    """Test security measures integration"""
```

## Available Logging Utility Functions

```python
from tests.integration.test_logging_utils import (
    setup_integration_test_logging,  # Set up logging for integration (required)
    log_test_start,                 # Log start of test function
    log_integration_step,           # Log integration test steps
    log_workflow_verification,      # Log workflow verification
    log_end_to_end_test,           # Log end-to-end test details
    log_database_state,            # Log database state
    log_api_sequence,              # Log API sequence details
    log_component_integration,     # Log component integration
    log_system_state,              # Log system state
    log_user_journey,              # Log user journey progress
    log_assertion_success,         # Log successful assertions
    log_data_flow_verification,    # Log data flow verification
    log_performance_metric,        # Log performance metrics
    log_test_summary,              # Log test summary
    log_error,                     # Log error details
    log_warning,                   # Log warnings
    log_info                       # Log info messages
)
```

## Test Execution

### Run Individual Integration Test Files
```bash
# Run specific integration test file
python -m pytest backend/tests/integration/test_user_workflows.py -v

# Run with logging output
python -m pytest backend/tests/integration/test_user_workflows.py -v -s

# Run specific test function
python -m pytest backend/tests/integration/test_user_workflows.py::TestUserWorkflows::test_complete_user_lifecycle -v
```

### Run All Integration Tests
```bash
# Run all integration tests
python -m pytest backend/tests/integration/ -v

# Run with coverage
python -m pytest backend/tests/integration/ --cov=app --cov-report=html
```

### Direct Execution
```bash
# Make test file executable
chmod +x backend/tests/integration/test_user_workflows.py

# Run directly
python backend/tests/integration/test_user_workflows.py
```

## Best Practices

### 1. Test Organization
- **One test file per major workflow** (user, department, evaluation)
- **Group related integration scenarios**
- **Use descriptive test names** that explain the workflow

### 2. Data Management
- **Create test data** at the beginning of each test
- **Clean up test data** at the end of each test
- **Use unique identifiers** to avoid conflicts
- **Verify data state** at each step

### 3. Error Handling
- **Test both success and failure scenarios**
- **Verify error propagation** through layers
- **Test rollback mechanisms**
- **Log all state changes**

### 4. Performance Monitoring
- **Monitor response times**
- **Track resource usage**
- **Test under realistic load**
- **Set performance thresholds**

### 5. Component Isolation
- **Test individual component integration**
- **Test layer-to-layer communication**
- **Verify interface contracts**
- **Test dependency injection**

## Common Patterns

### Multi-Step Workflow Testing
```python
@pytest.mark.asyncio
async def test_multi_step_workflow(self):
    """Test multi-step business workflow"""
    steps = [
        "Initialize",
        "Create Resources",
        "Process Data",
        "Validate Results",
        "Clean Up"
    ]
    
    for i, step in enumerate(steps, 1):
        log_integration_step(i, step)
        # Execute step
        # Verify step completion
        log_user_journey("business_workflow", steps, i)
```

### Data Flow Testing
```python
@pytest.mark.asyncio
async def test_data_flow(self):
    """Test data flow through system layers"""
    # API -> Service -> Repository -> Database
    # Verify data transformation at each layer
    # Verify data integrity end-to-end
```

### Performance Testing
```python
@pytest.mark.asyncio
async def test_performance_workflow(self):
    """Test workflow performance"""
    start_time = time.time()
    
    # Execute workflow
    
    execution_time = time.time() - start_time
    log_performance_metric("workflow_execution", execution_time, "seconds", 5.0)
```

## Integration with CI/CD

### GitHub Actions
```yaml
- name: Run Integration Tests
  run: |
    python -m pytest backend/tests/integration/ -v --cov=app --cov-report=xml
    
- name: Upload Integration Test Logs
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: integration-test-logs
    path: backend/tests/integration/logs/

- name: Performance Report
  run: |
    # Generate performance report from logs
    python scripts/generate_performance_report.py
```

### Docker Testing
```bash
# Run integration tests in Docker
docker-compose run --rm backend python -m pytest backend/tests/integration/ -v
```

## Test Environment Setup

### Database Configuration
- Use dedicated test database
- Ensure clean state before each test
- Handle transactions properly
- Test with realistic data volumes

### Service Configuration
- Configure test-specific settings
- Mock external services when needed
- Use test-specific authentication
- Handle async operations properly

This guide ensures comprehensive, realistic integration testing that validates the entire system working together as intended. 