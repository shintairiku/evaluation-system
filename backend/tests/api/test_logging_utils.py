#!/usr/bin/env python3
"""
Centralized logging utilities for API tests
Provides consistent logging across all API test files
"""

import os
import sys
import logging
from datetime import datetime
from pathlib import Path

# Add backend to path for imports
backend_path = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_path))

def setup_api_test_logging(api_name: str) -> str:
    """
    Set up centralized logging for API tests
    
    Args:
        api_name: Name of the API (e.g., 'user', 'department', 'auth')
    
    Returns:
        str: Path to the log file
    """
    # Create logs directory if it doesn't exist
    logs_dir = Path(__file__).parent / "logs"
    logs_dir.mkdir(exist_ok=True)
    
    # Generate timestamp for unique log file
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_filename = f"{api_name}_api_test_{timestamp}.log"
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
    logging.info(f"✅ API test logging setup complete for '{api_name}'")
    logging.info(f"📁 Log file: {log_file_path}")
    
    return str(log_file_path)

def log_test_start(test_name: str):
    """Log the start of a test function"""
    logging.info(f"🧪 Starting test: {test_name}")
    logging.info("-" * 50)

def log_api_request(method: str, url: str, status_code: int):
    """Log API request details"""
    logging.info(f"🌐 API Request: {method} {url} - Status: {status_code}")

def log_response_verification(response_data: dict):
    """Log response verification details"""
    logging.info(f"✅ Successfully received API response")
    for key, value in response_data.items():
        logging.info(f"   {key}: {value}")

def log_assertion_success(message: str):
    """Log successful assertion"""
    logging.info(f"✅ {message}")

def log_api_connectivity(endpoint: str, success: bool):
    """Log API connectivity success"""
    status = "✅ PASSED" if success else "❌ FAILED"
    logging.info(f"{status} API connectivity test")
    logging.info(f"   Endpoint: {endpoint}")

def log_authentication_test(auth_type: str, success: bool):
    """Log authentication test details"""
    status = "✅ PASSED" if success else "❌ FAILED"
    logging.info(f"{status} Authentication test")
    logging.info(f"   Auth type: {auth_type}")

def log_rbac_test(role: str, endpoint: str, expected_status: int, actual_status: int):
    """Log RBAC test details"""
    success = expected_status == actual_status
    status = "✅ PASSED" if success else "❌ FAILED"
    logging.info(f"{status} RBAC test")
    logging.info(f"   Role: {role}")
    logging.info(f"   Endpoint: {endpoint}")
    logging.info(f"   Expected: {expected_status}, Actual: {actual_status}")

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