"""
RBAC Security Test Suite

This package contains comprehensive tests for the RBAC standardization framework:

- test_rbac_helper.py: Core RBACHelper functionality tests
- test_decorators.py: Permission checking decorator tests  
- test_rbac_permission_matrix.py: Complete role/permission matrix validation
- test_rbac_error_handling.py: Error handling and security boundary tests
- test_rbac_performance.py: Performance benchmarking and optimization tests

Run all security tests with:
    pytest backend/tests/security/ -v

Run specific test suites:
    pytest backend/tests/security/test_rbac_helper.py -v
    pytest backend/tests/security/test_decorators.py -v
    pytest backend/tests/security/test_rbac_permission_matrix.py -v
    pytest backend/tests/security/test_rbac_error_handling.py -v
    pytest backend/tests/security/test_rbac_performance.py -v -s
"""