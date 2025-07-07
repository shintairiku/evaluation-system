"""
Centralized logging utility for repository tests.
All repository tests should import and use this for consistent logging.
"""
import logging
import os
from datetime import datetime


def setup_repository_test_logging(repo_name: str) -> str:
    """
    Set up comprehensive logging for repository tests.
    
    Args:
        repo_name (str): Name of the repository being tested (e.g., 'user', 'department', 'evaluation')
    
    Returns:
        str: Path to the generated log file
    
    Usage:
        from tests.repositories.test_logging_utils import setup_repository_test_logging
        TEST_LOG_FILE = setup_repository_test_logging('user')
    """
    # Ensure logs directory exists
    log_dir = "backend/tests/logs"
    os.makedirs(log_dir, exist_ok=True)
    
    # Generate timestamped log file name
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_file = f"{log_dir}/{repo_name}_repo_test_{timestamp}.log"
    
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
    
    # Configure specific repository logger
    repo_logger = logging.getLogger(f'app.database.repositories.{repo_name}_repo')
    repo_logger.setLevel(logging.DEBUG)
    
    # Configure session logger
    session_logger = logging.getLogger('app.database.session')
    session_logger.setLevel(logging.DEBUG)
    
    # Configure SQLAlchemy engine logger for SQL query logging
    sqlalchemy_logger = logging.getLogger('sqlalchemy.engine')
    sqlalchemy_logger.setLevel(logging.INFO)
    
    # Log test session start
    logging.info(f"=== {repo_name.title()} Repository Test Session Started ===")
    logging.info(f"Log file: {log_file}")
    logging.info(f"Testing Supabase connectivity and data fetching for {repo_name} repository")
    
    return log_file


def log_test_start(test_name: str) -> None:
    """
    Log the start of a specific test function.
    
    Args:
        test_name (str): Name of the test function (e.g., 'get_user_by_clerk_id')
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


def log_database_operation(operation: str, details: dict = None) -> None:
    """
    Log database operation details.
    
    Args:
        operation (str): Description of the database operation
        details (dict, optional): Additional operation details
    """
    logging.info(f"🔄 Database Operation: {operation}")
    if details:
        for key, value in details.items():
            logging.info(f"   {key}: {value}")


def log_data_verification(entity_name: str, data: dict) -> None:
    """
    Log data verification details.
    
    Args:
        entity_name (str): Name of the entity being verified
        data (dict): Data fields to log
    """
    logging.info(f"✅ Successfully fetched {entity_name} from Supabase")
    for key, value in data.items():
        logging.info(f"   {key}: {value}")


def log_assertion_success(message: str) -> None:
    """
    Log successful assertion.
    
    Args:
        message (str): Success message
    """
    logging.info(f"✅ {message}")


def log_supabase_connectivity(record_count: int, table_name: str = "table") -> None:
    """
    Log Supabase connectivity verification.
    
    Args:
        record_count (int): Number of records retrieved
        table_name (str): Name of the table queried
    """
    logging.info(f"✅ Supabase connection successful")
    logging.info(f"   Retrieved {record_count} records from {table_name}")
    logging.info(f"   Database response time: measured in query execution")


def log_test_summary(total_tests: int, passed_tests: int, failed_tests: int, repo_name: str) -> None:
    """
    Log final test execution summary.
    
    Args:
        total_tests (int): Total number of tests run
        passed_tests (int): Number of tests that passed
        failed_tests (int): Number of tests that failed
        repo_name (str): Name of the repository tested
    """
    logging.info(f"\n{'='*60}")
    logging.info(f"TEST EXECUTION SUMMARY - {repo_name.upper()} REPOSITORY")
    logging.info(f"{'='*60}")
    logging.info(f"Total tests: {total_tests}")
    logging.info(f"Passed: {passed_tests}")
    logging.info(f"Failed: {failed_tests}")
    logging.info(f"Success rate: {(passed_tests/total_tests*100):.1f}%")
    
    if failed_tests == 0:
        logging.info(f"🎉 All {repo_name} repository tests completed successfully!")
        logging.info(f"✅ Supabase connectivity and data fetching verified for {repo_name} repository")
    else:
        logging.error(f"❌ {failed_tests} test(s) failed in {repo_name} repository")