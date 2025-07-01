#!/usr/bin/env python3
"""
Centralized logging utilities for repository tests
Provides consistent logging across all repository test files
"""

import os
import sys
import logging
from datetime import datetime
from pathlib import Path

# Add backend to path for imports
backend_path = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_path))

def setup_repository_test_logging(repo_name: str) -> str:
    """
    Set up centralized logging for repository tests
    
    Args:
        repo_name: Name of the repository (e.g., 'user', 'department', 'evaluation')
    
    Returns:
        str: Path to the log file
    """
    # Create logs directory if it doesn't exist
    logs_dir = Path(__file__).parent / "logs"
    logs_dir.mkdir(exist_ok=True)
    
    # Generate timestamp for unique log file
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_filename = f"{repo_name}_repo_test_{timestamp}.log"
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
    logging.info(f"✅ Repository test logging setup complete for '{repo_name}'")
    logging.info(f"📁 Log file: {log_file_path}")
    
    return str(log_file_path)

def log_test_start(test_name: str):
    """Log the start of a test function"""
    logging.info(f"🧪 Starting test: {test_name}")
    logging.info("-" * 50)

def log_data_verification(entity_type: str, data: dict):
    """Log data verification details"""
    logging.info(f"✅ Successfully fetched data from Supabase")
    for key, value in data.items():
        logging.info(f"   {key}: {value}")

def log_assertion_success(message: str):
    """Log successful assertion"""
    logging.info(f"✅ {message}")

def log_supabase_connectivity(record_count: int, table_name: str):
    """Log Supabase connectivity success"""
    logging.info(f"✅ Supabase connectivity verified")
    logging.info(f"   Table: {table_name}")
    logging.info(f"   Records found: {record_count}")

def log_database_operation(operation: str, details: str = ""):
    """Log database operation details"""
    logging.info(f"🔍 Database operation: {operation}")
    if details:
        logging.info(f"   Details: {details}")

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