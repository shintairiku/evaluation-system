"""
Centralized logging utility for integration tests.
All integration tests should import and use this for consistent logging.
"""
import logging
import os
from datetime import datetime


def setup_auth_test_logging(test_category: str) -> str:
    """
    Set up comprehensive logging for auth workflow integration tests.
    
    Args:
        test_category (str): Category of tests being run (e.g., 'auth_workflow', 'api_endpoints')
    
    Returns:
        str: Path to the generated log file
    
    Usage:
        from tests.integration.logging_utils import setup_auth_test_logging
        TEST_LOG_FILE = setup_auth_test_logging('auth_workflow')
    """
    # Ensure logs directory exists
    log_dir = "tests/logs"
    os.makedirs(log_dir, exist_ok=True)
    
    # Generate timestamped log file name
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_file = f"{log_dir}/{test_category}_integration_test_{timestamp}.log"
    
    # Clear any existing handlers to avoid duplicates
    root_logger = logging.getLogger()
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Create formatter with detailed information
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s'
    )
    
    # File handler for detailed logs
    file_handler = logging.FileHandler(log_file)
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)
    
    # Console handler for immediate feedback
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(formatter)
    
    # Configure root logger
    root_logger.setLevel(logging.DEBUG)
    root_logger.addHandler(file_handler)
    root_logger.addHandler(console_handler)
    
    # Configure specific loggers
    auth_logger = logging.getLogger('app.api.v1.auth')
    auth_logger.setLevel(logging.DEBUG)
    
    user_service_logger = logging.getLogger('app.services.user_service')
    user_service_logger.setLevel(logging.DEBUG)
    
    auth_service_logger = logging.getLogger('app.services.auth_service')
    auth_service_logger.setLevel(logging.DEBUG)
    
    # Configure session logger
    session_logger = logging.getLogger('app.database.session')
    session_logger.setLevel(logging.DEBUG)
    
    # Configure SQLAlchemy engine logger for SQL query logging
    sqlalchemy_logger = logging.getLogger('sqlalchemy.engine')
    sqlalchemy_logger.setLevel(logging.INFO)
    
    # Log test session start
    logging.info(f"=== {test_category.replace('_', ' ').title()} Integration Test Session Started ===")
    logging.info(f"Log file: {log_file}")
    logging.info("Testing complete auth workflow and API endpoints")
    
    return log_file


def log_test_start(test_name: str) -> None:
    """Log the start of a specific test function."""
    logging.info(f"{'='*80}")
    logging.info(f"Testing: {test_name}")
    logging.info(f"{'='*80}")


def log_test_success(test_name: str, details: dict = None) -> None:
    """Log successful test completion with optional details."""
    logging.info(f"✅ {test_name} - PASSED")
    if details:
        for key, value in details.items():
            logging.info(f"   {key}: {value}")


def log_test_failure(test_name: str, error: Exception) -> None:
    """Log test failure with error details."""
    logging.error(f"❌ {test_name} - FAILED: {str(error)}")
    logging.error(f"   Error type: {type(error).__name__}")


def log_api_request(method: str, url: str, payload: dict = None) -> None:
    """Log API request details."""
    logging.info(f"🌐 API Request: {method} {url}")
    if payload:
        logging.info(f"   Payload: {payload}")


def log_api_response(status_code: int, response_data: dict = None) -> None:
    """Log API response details."""
    if 200 <= status_code < 300:
        logging.info(f"✅ API Response: {status_code}")
    else:
        logging.warning(f"⚠️  API Response: {status_code}")
    
    if response_data:
        logging.info(f"   Response: {response_data}")


def log_auth_workflow_step(step: str, details: dict = None) -> None:
    """Log auth workflow step completion."""
    logging.info(f"🔐 Auth Workflow Step: {step}")
    if details:
        for key, value in details.items():
            logging.info(f"   {key}: {value}")


def log_data_validation(entity_name: str, expected: dict, actual: dict) -> None:
    """Log data validation results."""
    logging.info(f"🔍 Validating {entity_name}:")
    for key, expected_value in expected.items():
        actual_value = actual.get(key)
        if actual_value == expected_value:
            logging.info(f"   ✅ {key}: {actual_value} (matches expected)")
        else:
            logging.warning(f"   ⚠️  {key}: {actual_value} (expected: {expected_value})")


def log_japanese_name_test(original: str, formatted: str) -> None:
    """Log Japanese name formatting test results."""
    logging.info("🇯🇵 Japanese Name Formatting Test:")
    logging.info(f"   Original: '{original}' (contains full-width space: {'　' in original})")
    logging.info(f"   Formatted: '{formatted}' (contains regular space: {' ' in formatted})")
    logging.info(f"   ✅ Formatting successful: {original.replace('　', ' ') == formatted}")


def log_test_summary(total_tests: int, passed_tests: int, failed_tests: int, test_category: str) -> None:
    """Log final test execution summary."""
    logging.info(f"\n{'='*80}")
    logging.info(f"TEST EXECUTION SUMMARY - {test_category.upper().replace('_', ' ')} INTEGRATION TESTS")
    logging.info(f"{'='*80}")
    logging.info(f"Total tests: {total_tests}")
    logging.info(f"Passed: {passed_tests}")
    logging.info(f"Failed: {failed_tests}")
    logging.info(f"Success rate: {(passed_tests/total_tests*100):.1f}%")
    
    if failed_tests == 0:
        logging.info(f"🎉 All {test_category} integration tests completed successfully!")
        logging.info("✅ Complete auth workflow and API functionality verified")
    else:
        logging.error(f"❌ {failed_tests} test(s) failed in {test_category} integration tests")


def log_workflow_completion(workflow_name: str, user_data: dict) -> None:
    """Log completion of entire auth workflow."""
    logging.info(f"🎯 {workflow_name} Workflow Completed Successfully")
    logging.info(f"   User ID: {user_data.get('id')}")
    logging.info(f"   Clerk ID: {user_data.get('clerk_user_id')}")
    logging.info(f"   Status: {user_data.get('status')}")
    logging.info(f"   Name: {user_data.get('name')}")
    logging.info(f"   Email: {user_data.get('email')}")