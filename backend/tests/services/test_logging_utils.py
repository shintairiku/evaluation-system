#!/usr/bin/env python3
"""
Centralized logging utilities for Service tests
Provides consistent logging across all service test files
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

def setup_service_test_logging(service_name: str) -> str:
    """
    Set up centralized logging for service tests
    
    Args:
        service_name: Name of the service (e.g., 'user', 'department', 'auth')
    
    Returns:
        str: Path to the log file
    """
    # Ensure logs directory exists - check if we're in backend or root
    if os.path.basename(os.getcwd()) == "backend":
        log_dir = os.path.join("tests", "logs")
    else:
        log_dir = os.path.join("backend", "tests", "logs")
    os.makedirs(log_dir, exist_ok=True)
    
    # Generate timestamp for unique log file
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_filename = f"{service_name}_service_test_{timestamp}.log"
    log_file_path = os.path.join(log_dir, log_filename)
    
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
    logging.info(f"✅ Service test logging setup complete for '{service_name}'")
    logging.info(f"📁 Log file: {log_file_path}")
    
    return str(log_file_path)

def log_test_start(test_name: str):
    """Log the start of a test function"""
    logging.info(f"🧪 Starting test: {test_name}")
    logging.info("-" * 50)

def log_service_operation(operation: str, service_name: str, details: Optional[Dict[str, Any]] = None):
    """Log service operation details"""
    logging.info(f"🔧 Service operation: {service_name}.{operation}")
    if details is not None:
        for key, value in details.items():
            logging.info(f"   {key}: {value}")

def log_business_logic_verification(logic_name: str, data: dict):
    """Log business logic verification details"""
    logging.info(f"✅ Business logic verified: {logic_name}")
    for key, value in data.items():
        logging.info(f"   {key}: {value}")

def log_assertion_success(message: str):
    """Log successful assertion"""
    logging.info(f"✅ {message}")

def log_service_dependency(dependency_name: str, success: bool):
    """Log service dependency interactions"""
    status = "✅ PASSED" if success else "❌ FAILED"
    logging.info(f"{status} Service dependency: {dependency_name}")

def log_validation_test(validation_type: str, input_data: dict, success: bool):
    """Log validation test details"""
    status = "✅ PASSED" if success else "❌ FAILED"
    logging.info(f"{status} Validation test: {validation_type}")
    logging.info(f"   Input: {input_data}")

def log_permission_test(user_role: str, operation: str, allowed: bool):
    """Log permission test details"""
    status = "✅ ALLOWED" if allowed else "❌ DENIED"
    logging.info(f"{status} Permission test")
    logging.info(f"   Role: {user_role}")
    logging.info(f"   Operation: {operation}")

def log_exception_handling(exception_type: str, expected: bool, caught: bool):
    """Log exception handling test details"""
    status = "✅ PASSED" if expected == caught else "❌ FAILED"
    logging.info(f"{status} Exception handling test")
    logging.info(f"   Exception type: {exception_type}")
    logging.info(f"   Expected: {expected}, Caught: {caught}")

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