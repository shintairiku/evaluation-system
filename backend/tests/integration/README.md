# Integration Tests

Integration tests for the HR Evaluation System API. These tests validate end-to-end workflows and interactions between different system components.

## Overview

Integration tests verify that different parts of the system work together correctly. Unlike unit tests that test individual components in isolation, integration tests:

- Test complete user workflows
- Validate API endpoint interactions
- Verify database operations
- Test authentication and authorization flows
- Ensure data consistency across operations

## Running Integration Tests

```bash
# Run all integration tests
pytest tests/integration/ -v

# Run specific test file
pytest tests/integration/test_auth_workflow.py -v

# Run with detailed output
pytest tests/integration/ -v --tb=long

# Run in parallel (if pytest-xdist is installed)
pytest tests/integration/ -n auto
```

## Test Structure

Integration tests are organized by functionality:

```
tests/integration/
├── README.md                    # This file
├── test_auth_workflow.py        # Authentication and user signup
├── test_evaluation_workflow.py  # Performance evaluation processes
├── test_goal_management.py      # Goal creation and approval workflows
└── test_reporting.py           # Report generation and data access
```

## Prerequisites

### 1. Backend Services
Ensure all backend services are running:
```bash
docker-compose up -d
```

### 2. Database State
Integration tests may create and modify data. For consistent results:
- Use a dedicated test database
- Run migrations before testing
- Consider database cleanup between test runs

### 3. Environment Setup
```bash
# Install test dependencies
pip install -r requirements.txt

# Set test environment variables if needed
export TEST_DATABASE_URL="postgresql://..."
```

## Writing Integration Tests

### Test Guidelines

1. **Test Real Workflows**: Focus on actual user scenarios
2. **Use Realistic Data**: Test with data similar to production
3. **Clean Up**: Ensure tests don't interfere with each other
4. **Be Explicit**: Clearly document what each test validates
5. **Handle Async**: Use proper async/await patterns for FastAPI

### Example Test Structure

```python
@pytest.mark.asyncio
async def test_complete_workflow(self):
    """Test description of the complete workflow being validated."""
    async with httpx.AsyncClient() as client:
        # Step 1: Setup/Prerequisites
        setup_response = await client.post("/api/v1/setup", json=setup_data)
        assert setup_response.status_code == 200
        
        # Step 2: Main workflow action
        main_response = await client.post("/api/v1/action", json=action_data)
        assert main_response.status_code == 200
        
        # Step 3: Verify results
        verify_response = await client.get("/api/v1/verify")
        assert verify_response.status_code == 200
        # Add specific assertions about the workflow outcome
```

### Common Patterns

- **Authentication Testing**: Validate login, signup, and permission flows
- **CRUD Operations**: Test create, read, update, delete sequences
- **Business Logic**: Verify complex business rules and validations
- **Error Handling**: Test how the system handles various error conditions
- **Performance**: Validate response times for critical workflows

## Test Data Management

### Approach 1: Test-Specific Data
Each test creates its own data and cleans up after itself.

### Approach 2: Shared Fixtures
Use pytest fixtures for common test data setup.

### Approach 3: Database Transactions
Wrap tests in database transactions that rollback after each test.

## Debugging Integration Tests

### Common Issues

1. **Service Not Running**: Ensure backend services are accessible
2. **Database State**: Check for data conflicts between tests
3. **Async Issues**: Verify proper async/await usage
4. **Network Timeouts**: Adjust timeout settings for slow operations

### Debugging Commands

```bash
# Run single test with detailed output
pytest tests/integration/test_specific.py::test_method -v -s

# Run with Python debugger
pytest tests/integration/test_specific.py::test_method --pdb

# Run with custom logging
pytest tests/integration/ -v --log-cli-level=DEBUG
```

## Continuous Integration

Integration tests should be part of your CI/CD pipeline:

```yaml
# Example GitHub Actions step
- name: Run Integration Tests
  run: |
    docker-compose up -d
    sleep 10  # Wait for services to start
    pytest tests/integration/ -v
    docker-compose down
```

## Best Practices

1. **Isolation**: Tests should not depend on each other
2. **Idempotency**: Tests should produce the same results when run multiple times
3. **Speed**: Balance thoroughness with execution time
4. **Reliability**: Tests should pass consistently
5. **Documentation**: Each test should clearly explain what it validates

## Contributing

When adding new integration tests:

1. Follow the existing test structure
2. Add appropriate documentation
3. Ensure tests are reliable and fast
4. Update this README if adding new test categories
5. Consider test data cleanup and management