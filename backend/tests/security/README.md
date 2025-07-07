# Security Testing Guide

This guide shows how to create comprehensive security tests with detailed logging for authentication, authorization, and security controls. Follow this format for all security tests to ensure consistent testing and security validation.

## Quick Start

Copy the template from any test file and modify it for your security component. The template includes:
- ✅ Comprehensive logging to dedicated log files
- ✅ Authentication and authorization testing
- ✅ RBAC (Role-Based Access Control) validation
- ✅ Security vulnerability testing
- ✅ Token validation and encryption testing
- ✅ Access control and permission verification

## File Structure

```
backend/tests/security/
├── README.md                    # This guide
├── test_logging_utils.py        # Centralized logging utilities
├── test_authentication.py       # Authentication tests
├── test_permissions.py          # Permission and authorization tests
├── test_rbac.py                 # RBAC system tests
├── test_security_controls.py    # General security controls tests
├── test_encryption.py           # Encryption and token tests
├── __init__.py                  # Package initialization
└── logs/                        # Centralized log files for ALL security tests
    ├── auth_security_test_YYYYMMDD_HHMMSS.log
    ├── permissions_security_test_YYYYMMDD_HHMMSS.log
    ├── rbac_security_test_YYYYMMDD_HHMMSS.log
    └── encryption_security_test_YYYYMMDD_HHMMSS.log
```

## Template Structure

### 1. Import and Centralized Logging Setup

```python
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi import HTTPException, status
from uuid import uuid4
import jwt
from datetime import datetime, timedelta

from app.core.auth import AuthenticationManager
from app.core.permissions import PermissionManager
from app.core.rbac_config import RBACConfig
from app.core.exceptions import (
    AuthenticationError, AuthorizationError, 
    PermissionDeniedError, TokenExpiredError
)
from tests.security.test_logging_utils import (
    setup_security_test_logging,
    log_test_start,
    log_security_test,
    log_authentication_attempt,
    log_authorization_check,
    log_rbac_test,
    log_security_vulnerability_test,
    log_token_validation,
    log_encryption_test,
    log_access_control_test,
    log_assertion_success,
    log_security_breach_attempt,
    log_test_summary,
    log_error
)

# Set up centralized logging - CHANGE 'your_component' to your security component
# Examples: 'auth', 'permissions', 'rbac', 'encryption'
TEST_LOG_FILE = setup_security_test_logging('your_component')
```

### 2. Test Class Structure

```python
class TestYourSecurityComponent:
    """Test Your Security Component with comprehensive security validation"""

    @pytest.fixture
    def auth_manager(self):
        """Create AuthenticationManager instance for testing"""
        return AuthenticationManager()

    @pytest.fixture
    def permission_manager(self):
        """Create PermissionManager instance for testing"""
        return PermissionManager()

    @pytest.fixture
    def admin_user(self):
        """Admin user for testing"""
        return {
            "sub": "admin_user_123",
            "role": "admin",
            "email": "admin@example.com",
            "permissions": ["create", "read", "update", "delete"]
        }

    @pytest.fixture
    def manager_user(self):
        """Manager user for testing"""
        return {
            "sub": "manager_user_456",
            "role": "manager",
            "email": "manager@example.com",
            "permissions": ["create", "read", "update"]
        }

    @pytest.fixture
    def employee_user(self):
        """Employee user for testing"""
        return {
            "sub": "employee_user_789",
            "role": "employee",
            "email": "employee@example.com",
            "permissions": ["read"]
        }

    @pytest.fixture
    def invalid_user(self):
        """Invalid/unauthorized user for testing"""
        return {
            "sub": "invalid_user_000",
            "role": "invalid",
            "email": "invalid@example.com",
            "permissions": []
        }

    @pytest.fixture
    def valid_token(self):
        """Valid JWT token for testing"""
        payload = {
            "sub": "user_123",
            "role": "admin",
            "exp": datetime.utcnow() + timedelta(hours=1)
        }
        return jwt.encode(payload, "secret_key", algorithm="HS256")

    @pytest.fixture
    def expired_token(self):
        """Expired JWT token for testing"""
        payload = {
            "sub": "user_123",
            "role": "admin",
            "exp": datetime.utcnow() - timedelta(hours=1)
        }
        return jwt.encode(payload, "secret_key", algorithm="HS256")
```

### 3. Individual Test Functions Template

```python
def test_authentication_success(self, auth_manager, admin_user):
    """Test successful authentication"""
    log_test_start("authentication_success")
    
    try:
        # Log security test
        log_security_test("authentication", {
            "user_id": admin_user["sub"],
            "method": "token_validation"
        })
        
        # Simulate authentication
        result = auth_manager.authenticate_user(admin_user["sub"], "valid_token")
        
        # Log authentication attempt
        log_authentication_attempt(admin_user["sub"], "token_validation", True)
        
        # Verify authentication
        assert result is not None
        assert result["role"] == admin_user["role"]
        
        log_assertion_success("Authentication successful for valid user")
        log_test_summary("authentication_success", True)
        
    except Exception as e:
        log_error(e, "authentication_success test")
        log_test_summary("authentication_success", False, str(e))
        raise

def test_authentication_failure(self, auth_manager, invalid_user):
    """Test authentication failure"""
    log_test_start("authentication_failure")
    
    try:
        # Log security test
        log_security_test("authentication_failure", {
            "user_id": invalid_user["sub"],
            "method": "invalid_token"
        })
        
        # Test authentication failure
        with pytest.raises(AuthenticationError) as exc_info:
            auth_manager.authenticate_user(invalid_user["sub"], "invalid_token")
        
        # Log authentication attempt
        log_authentication_attempt(invalid_user["sub"], "invalid_token", False)
        
        assert "authentication" in str(exc_info.value).lower()
        
        log_assertion_success("Authentication properly rejected for invalid user")
        log_test_summary("authentication_failure", True)
        
    except Exception as e:
        log_error(e, "authentication_failure test")
        log_test_summary("authentication_failure", False, str(e))
        raise

def test_authorization_check(self, permission_manager, admin_user):
    """Test authorization check"""
    log_test_start("authorization_check")
    
    try:
        resource = "users"
        action = "create"
        
        # Log authorization check
        log_authorization_check(admin_user["role"], resource, action, True)
        
        # Test authorization
        allowed = permission_manager.has_permission(admin_user, resource, action)
        
        assert allowed is True
        
        log_assertion_success("Authorization check passed for admin user")
        log_test_summary("authorization_check", True)
        
    except Exception as e:
        log_error(e, "authorization_check test")
        log_test_summary("authorization_check", False, str(e))
        raise

def test_rbac_permission_check(self, permission_manager, employee_user):
    """Test RBAC permission check"""
    log_test_start("rbac_permission_check")
    
    try:
        resource = "users"
        action = "delete"
        expected = False  # Employee should not be able to delete users
        
        # Test permission
        actual = permission_manager.has_permission(employee_user, resource, action)
        
        # Log RBAC test
        log_rbac_test(employee_user["role"], f"{action}_{resource}", expected, actual)
        
        assert actual == expected
        
        log_assertion_success("RBAC permission check working correctly")
        log_test_summary("rbac_permission_check", True)
        
    except Exception as e:
        log_error(e, "rbac_permission_check test")
        log_test_summary("rbac_permission_check", False, str(e))
        raise

def test_token_validation(self, auth_manager, valid_token):
    """Test token validation"""
    log_test_start("token_validation")
    
    try:
        # Test token validation
        is_valid = auth_manager.validate_token(valid_token)
        
        # Log token validation
        log_token_validation("JWT", is_valid, {
            "algorithm": "HS256",
            "expiry": "valid"
        })
        
        assert is_valid is True
        
        log_assertion_success("Token validation working correctly")
        log_test_summary("token_validation", True)
        
    except Exception as e:
        log_error(e, "token_validation test")
        log_test_summary("token_validation", False, str(e))
        raise

def test_security_vulnerability_prevention(self, auth_manager):
    """Test security vulnerability prevention"""
    log_test_start("security_vulnerability_prevention")
    
    try:
        # Test SQL injection prevention
        malicious_input = "'; DROP TABLE users; --"
        
        # Log security vulnerability test
        log_security_vulnerability_test("sql_injection", True)
        
        # Test that malicious input is handled safely
        with pytest.raises((ValueError, AuthenticationError)):
            auth_manager.authenticate_user(malicious_input, "token")
        
        # Log security breach attempt
        log_security_breach_attempt("sql_injection", True)
        
        log_assertion_success("SQL injection attempt prevented")
        log_test_summary("security_vulnerability_prevention", True)
        
    except Exception as e:
        log_error(e, "security_vulnerability_prevention test")
        log_test_summary("security_vulnerability_prevention", False, str(e))
        raise
```

### 4. Required Test Categories

Every security test should include these categories:

#### A. Authentication Tests
```python
def test_valid_authentication(self, ...):
    """Test valid authentication scenarios"""

def test_invalid_authentication(self, ...):
    """Test invalid authentication scenarios"""

def test_token_expiry_handling(self, ...):
    """Test token expiry handling"""

def test_authentication_bypass_prevention(self, ...):
    """Test authentication bypass prevention"""
```

#### B. Authorization Tests
```python
def test_role_based_authorization(self, ...):
    """Test role-based authorization"""

def test_resource_access_control(self, ...):
    """Test resource access control"""

def test_action_permission_validation(self, ...):
    """Test action permission validation"""

def test_unauthorized_access_prevention(self, ...):
    """Test unauthorized access prevention"""
```

#### C. RBAC Tests
```python
def test_admin_permissions(self, ...):
    """Test admin role permissions"""

def test_manager_permissions(self, ...):
    """Test manager role permissions"""

def test_employee_permissions(self, ...):
    """Test employee role permissions"""

def test_role_inheritance(self, ...):
    """Test role inheritance"""
```

#### D. Security Vulnerability Tests
```python
def test_sql_injection_prevention(self, ...):
    """Test SQL injection prevention"""

def test_xss_prevention(self, ...):
    """Test XSS prevention"""

def test_csrf_protection(self, ...):
    """Test CSRF protection"""

def test_input_validation(self, ...):
    """Test input validation and sanitization"""
```

#### E. Encryption and Token Tests
```python
def test_password_hashing(self, ...):
    """Test password hashing"""

def test_token_generation(self, ...):
    """Test token generation"""

def test_token_validation(self, ...):
    """Test token validation"""

def test_encryption_decryption(self, ...):
    """Test encryption/decryption"""
```

## Available Logging Utility Functions

```python
from tests.security.test_logging_utils import (
    setup_security_test_logging,    # Set up logging for security (required)
    log_test_start,                # Log start of test function
    log_security_test,             # Log security test details
    log_authentication_attempt,    # Log authentication attempts
    log_authorization_check,       # Log authorization checks
    log_rbac_test,                # Log RBAC tests
    log_security_vulnerability_test, # Log vulnerability tests
    log_token_validation,          # Log token validation
    log_encryption_test,           # Log encryption tests
    log_access_control_test,       # Log access control tests
    log_assertion_success,         # Log successful assertions
    log_security_breach_attempt,   # Log security breach attempts
    log_test_summary,              # Log test summary
    log_error,                     # Log error details
    log_warning,                   # Log warnings
    log_info                       # Log info messages
)
```

## Test Execution

### Run Individual Security Test Files
```bash
# Run specific security test file
python -m pytest backend/tests/security/test_authentication.py -v

# Run with logging output
python -m pytest backend/tests/security/test_authentication.py -v -s

# Run specific test function
python -m pytest backend/tests/security/test_authentication.py::TestAuthentication::test_valid_login -v
```

### Run All Security Tests
```bash
# Run all security tests
python -m pytest backend/tests/security/ -v

# Run with coverage
python -m pytest backend/tests/security/ --cov=app.core --cov-report=html
```

### Direct Execution
```bash
# Make test file executable
chmod +x backend/tests/security/test_authentication.py

# Run directly
python backend/tests/security/test_authentication.py
```

## Best Practices

### 1. Security Focus
- **Test all authentication methods**
- **Validate all authorization scenarios**
- **Test security controls and validations**
- **Verify proper error handling**

### 2. Vulnerability Testing
- **Test common attack vectors** (SQL injection, XSS, CSRF)
- **Test input validation** and sanitization
- **Test authentication bypass** attempts
- **Test privilege escalation** prevention

### 3. Token and Encryption
- **Test token generation** and validation
- **Test token expiry** handling
- **Test encryption/decryption** processes
- **Test key management**

### 4. Role-Based Testing
- **Test each role's permissions**
- **Test permission inheritance**
- **Test unauthorized access** prevention
- **Test role transitions**

### 5. Logging and Monitoring
- **Log all security events**
- **Log failed authentication** attempts
- **Log authorization failures**
- **Log security violations**

## Common Patterns

### Parameterized Role Testing
```python
@pytest.mark.parametrize("role,resource,action,expected", [
    ("admin", "users", "create", True),
    ("admin", "users", "delete", True),
    ("manager", "users", "create", True),
    ("manager", "users", "delete", False),
    ("employee", "users", "create", False),
    ("employee", "users", "read", True),
])
def test_role_permissions(self, role, resource, action, expected):
    """Test permissions by role"""
    # Implementation
```

### Security Vulnerability Testing
```python
@pytest.mark.parametrize("attack_vector", [
    "'; DROP TABLE users; --",
    "<script>alert('xss')</script>",
    "../../../etc/passwd",
    "admin'; --",
])
def test_injection_prevention(self, attack_vector):
    """Test various injection attacks"""
    # Implementation
```

### Token Lifecycle Testing
```python
def test_token_lifecycle(self):
    """Test complete token lifecycle"""
    # Generate token
    # Validate token
    # Use token for authorization
    # Test token expiry
    # Test token refresh
```

## Integration with CI/CD

### GitHub Actions
```yaml
- name: Run Security Tests
  run: |
    python -m pytest backend/tests/security/ -v --cov=app.core --cov-report=xml
    
- name: Upload Security Test Logs
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: security-test-logs
    path: backend/tests/security/logs/

- name: Security Vulnerability Scan
  run: |
    # Additional security scanning tools
    bandit -r app/ -f json -o security-report.json
```

### Docker Testing
```bash
# Run security tests in Docker
docker-compose run --rm backend python -m pytest backend/tests/security/ -v
```

## Security Compliance

### Standards Covered
- **OWASP Top 10** vulnerability prevention
- **Authentication** best practices
- **Authorization** and access control
- **Data protection** and encryption
- **Input validation** and sanitization

### Compliance Reporting
- Generate security test reports
- Track vulnerability test coverage
- Monitor authentication/authorization failures
- Document security control effectiveness

This guide ensures comprehensive, security-focused testing that validates all security controls and prevents common vulnerabilities. 