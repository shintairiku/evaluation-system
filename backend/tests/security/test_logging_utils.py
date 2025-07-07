#!/usr/bin/env python3
"""
Centralized logging utilities for Security tests
Provides consistent logging across all security test files
"""

import os
import sys
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any

# Add backend to path for imports
backend_path = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_path))

def setup_security_test_logging(security_component: str) -> str:
    """
    Set up centralized logging for security tests
    
    Args:
        security_component: Name of the security component (e.g., 'auth', 'permissions', 'rbac')
    
    Returns:
        str: Path to the log file
    """
    # Create logs directory if it doesn't exist
    logs_dir = Path(__file__).parent / "logs"
    logs_dir.mkdir(exist_ok=True)
    
    # Generate timestamp for unique log file
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_filename = f"{security_component}_security_test_{timestamp}.log"
    log_file_path = logs_dir / log_filename
    
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s',
        handlers=[
            logging.FileHandler(log_file_path),
            logging.StreamHandler(sys.stdout)
        ]
    )
    
    # Log setup completion
    logging.info(f"✅ Security test logging setup complete for '{security_component}'")
    logging.info(f"📁 Log file: {log_file_path}")
    
    return str(log_file_path)

def log_test_start(test_name: str):
    """Log the start of a test function"""
    logging.info(f"🧪 Starting test: {test_name}")
    logging.info("-" * 50)

def log_security_test(test_type: str, details: Optional[Dict[str, Any]] = None):
    """Log security test details"""
    logging.info(f"🔐 Security test: {test_type}")
    if details is not None:
        for key, value in details.items():
            logging.info(f"   {key}: {value}")

def log_authentication_attempt(user_id: str, method: str, success: bool):
    """Log authentication attempt details"""
    status = "✅ SUCCESS" if success else "❌ FAILED"
    logging.info(f"{status} Authentication attempt")
    logging.info(f"   User ID: {user_id}")
    logging.info(f"   Method: {method}")

def log_authorization_check(user_role: str, resource: str, action: str, allowed: bool):
    """Log authorization check details"""
    status = "✅ ALLOWED" if allowed else "❌ DENIED"
    logging.info(f"{status} Authorization check")
    logging.info(f"   User role: {user_role}")
    logging.info(f"   Resource: {resource}")
    logging.info(f"   Action: {action}")

def log_rbac_test(role: str, permission: str, expected: bool, actual: bool):
    """Log RBAC test details"""
    success = expected == actual
    status = "✅ PASSED" if success else "❌ FAILED"
    logging.info(f"{status} RBAC test")
    logging.info(f"   Role: {role}")
    logging.info(f"   Permission: {permission}")
    logging.info(f"   Expected: {expected}, Actual: {actual}")

def log_security_vulnerability_test(vulnerability_type: str, test_passed: bool):
    """Log security vulnerability test"""
    status = "✅ SECURE" if test_passed else "❌ VULNERABLE"
    logging.info(f"{status} Security vulnerability test")
    logging.info(f"   Vulnerability type: {vulnerability_type}")

def log_token_validation(token_type: str, valid: bool, details: Optional[Dict[str, Any]] = None):
    """Log token validation details"""
    status = "✅ VALID" if valid else "❌ INVALID"
    logging.info(f"{status} Token validation")
    logging.info(f"   Token type: {token_type}")
    if details is not None:
        for key, value in details.items():
            logging.info(f"   {key}: {value}")

def log_encryption_test(algorithm: str, success: bool, details: Optional[Dict[str, Any]] = None):
    """Log encryption test details"""
    status = "✅ PASSED" if success else "❌ FAILED"
    logging.info(f"{status} Encryption test")
    logging.info(f"   Algorithm: {algorithm}")
    if details is not None:
        for key, value in details.items():
            logging.info(f"   {key}: {value}")

def log_access_control_test(access_type: str, user_context: str, allowed: bool):
    """Log access control test details"""
    status = "✅ ALLOWED" if allowed else "❌ DENIED"
    logging.info(f"{status} Access control test")
    logging.info(f"   Access type: {access_type}")
    logging.info(f"   User context: {user_context}")

def log_assertion_success(message: str):
    """Log successful assertion"""
    logging.info(f"✅ {message}")

def log_security_breach_attempt(breach_type: str, prevented: bool):
    """Log security breach attempt"""
    status = "✅ PREVENTED" if prevented else "❌ SUCCESSFUL"
    logging.info(f"{status} Security breach attempt")
    logging.info(f"   Breach type: {breach_type}")

def log_test_summary(test_name: str, success: bool, details: str = ""):
    """Log test summary"""
    status = "✅ PASSED" if success else "❌ FAILED"
    logging.info(f"📊 Test Summary: {test_name} - {status}")
    if details:
        logging.info(f"   Details: {details}")
    logging.info("-" * 50)

def log_error(error: Exception, context: str = ""):
    """Log error details"""
    logging.error(f"❌ Error in {context}: {str(error)}")
    logging.error(f"   Error type: {type(error).__name__}")

def log_warning(message: str):
    """Log warning message"""
    logging.warning(f"⚠️ {message}")

def log_info(message: str):
    """Log info message"""
    logging.info(f"ℹ️ {message}") 