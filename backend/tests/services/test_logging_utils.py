"""
Centralized logging utility for service tests.
All service tests should import and use this for consistent logging.
"""
import logging
import os
from datetime import datetime


def setup_service_test_logging(service_name: str) -> str:
    """
    Set up comprehensive logging for service tests.
    
    Args:
        service_name (str): Name of the service being tested (e.g., 'auth', 'user', 'profile')
    
    Returns:
        str: Path to the generated log file
    
    Usage:
        from tests.services.test_logging_utils import setup_service_test_logging
        TEST_LOG_FILE = setup_service_test_logging('auth')
    """
    # Ensure logs directory exists - check if we're in backend or root
    if os.path.basename(os.getcwd()) == "backend":
        log_dir = os.path.join("tests", "logs")
    else:
        log_dir = os.path.join("backend", "tests", "logs")
    os.makedirs(log_dir, exist_ok=True)
    
    # Generate timestamped log file name
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_file = os.path.join(log_dir, f"{service_name}_service_test_{timestamp}.log")
    
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
    
    # Configure specific service logger
    service_logger = logging.getLogger(f'app.services.{service_name}_service')
    service_logger.setLevel(logging.DEBUG)
    
    # Configure repository loggers (services use repositories)
    repo_logger = logging.getLogger('app.database.repositories')
    repo_logger.setLevel(logging.DEBUG)
    
    # Configure session logger
    session_logger = logging.getLogger('app.database.session')
    session_logger.setLevel(logging.DEBUG)
    
    # Log test session start
    logging.info(f"=== {service_name.title()} Service Test Session Started ===")
    logging.info(f"Log file: {log_file}")
    logging.info(f"Testing business logic and repository interactions for {service_name} service")
    
    return log_file


def log_test_start(test_name: str) -> None:
    """
    Log the start of a specific test function.
    
    Args:
        test_name (str): Name of the test function (e.g., 'get_profile_options')
    """
    logging.info(f"{'='*60}")
    logging.info(f"Testing: {test_name}")
    logging.info(f"{'='*60}")


def log_test_success(test_name: str, details: dict = None) -> None:
    """
    Log successful test completion with optional details.
    
    Args:
        test_name (str): Name of the test function
        details (dict, optional): Additional details to log
    """
    logging.info(f"✅ {test_name} - PASSED")
    if details:
        for key, value in details.items():
            logging.info(f"   {key}: {value}")


def log_test_failure(test_name: str, error: Exception) -> None:
    """
    Log test failure with error details.
    
    Args:
        test_name (str): Name of the test function
        error (Exception): The exception that occurred
    """
    logging.error(f"❌ {test_name} - FAILED: {str(error)}")
    logging.error(f"   Error type: {type(error).__name__}")


def log_service_operation(operation: str, details: dict = None) -> None:
    """
    Log service operation details.
    
    Args:
        operation (str): Description of the service operation
        details (dict, optional): Additional operation details
    """
    logging.info(f"🔄 Service Operation: {operation}")
    if details:
        for key, value in details.items():
            logging.info(f"   {key}: {value}")


def log_mock_setup(mock_name: str, return_value: str = None) -> None:
    """
    Log mock setup details.
    
    Args:
        mock_name (str): Name of the mock being configured
        return_value (str, optional): Description of the return value
    """
    logging.info(f"🎭 Mock Setup: {mock_name}")
    if return_value:
        logging.info(f"   Return value: {return_value}")


def log_assertion_success(message: str) -> None:
    """
    Log successful assertion.
    
    Args:
        message (str): Success message
    """
    logging.info(f"✅ {message}")


def log_business_logic_verification(operation: str, result: dict) -> None:
    """
    Log business logic verification details.
    
    Args:
        operation (str): Name of the business operation
        result (dict): Result data to log
    """
    logging.info(f"✅ Business Logic Verified: {operation}")
    for key, value in result.items():
        logging.info(f"   {key}: {value}")


def log_repository_interaction(repo_name: str, method_name: str, called: bool) -> None:
    """
    Log repository interaction verification.
    
    Args:
        repo_name (str): Name of the repository
        method_name (str): Method that was called
        called (bool): Whether the method was called as expected
    """
    status = "✅" if called else "❌"
    logging.info(f"{status} Repository Interaction: {repo_name}.{method_name}")


def log_test_summary(total_tests: int, passed_tests: int, failed_tests: int, service_name: str) -> None:
    """
    Log final test execution summary.
    
    Args:
        total_tests (int): Total number of tests run
        passed_tests (int): Number of tests that passed
        failed_tests (int): Number of tests that failed
        service_name (str): Name of the service tested
    """
    logging.info(f"\n{'='*60}")
    logging.info(f"TEST EXECUTION SUMMARY - {service_name.upper()} SERVICE")
    logging.info(f"{'='*60}")
    logging.info(f"Total tests: {total_tests}")
    logging.info(f"Passed: {passed_tests}")
    logging.info(f"Failed: {failed_tests}")
    logging.info(f"Success rate: {(passed_tests/total_tests*100):.1f}%")
    
    if failed_tests == 0:
        logging.info(f"🎉 All {service_name} service tests completed successfully!")
        logging.info(f"✅ Business logic and repository interactions verified for {service_name} service")
    else:
        logging.error(f"❌ {failed_tests} test(s) failed in {service_name} service")