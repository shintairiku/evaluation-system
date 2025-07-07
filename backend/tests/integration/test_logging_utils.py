#!/usr/bin/env python3
"""
Centralized logging utilities for Integration tests
Provides consistent logging across all integration test files
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

def setup_integration_test_logging(integration_name: str) -> str:
    """
    Set up centralized logging for integration tests
    
    Args:
        integration_name: Name of the integration (e.g., 'user_flow', 'department_workflow', 'end_to_end')
    
    Returns:
        str: Path to the log file
    """
    # Create logs directory if it doesn't exist
    logs_dir = Path(__file__).parent / "logs"
    logs_dir.mkdir(exist_ok=True)
    
    # Generate timestamp for unique log file
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_filename = f"{integration_name}_integration_test_{timestamp}.log"
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
    logging.info(f"✅ Integration test logging setup complete for '{integration_name}'")
    logging.info(f"📁 Log file: {log_file_path}")
    
    return str(log_file_path)

def log_test_start(test_name: str):
    """Log the start of a test function"""
    logging.info(f"🧪 Starting test: {test_name}")
    logging.info("-" * 50)

def log_integration_step(step_number: int, step_name: str, details: Optional[Dict[str, Any]] = None):
    """Log integration test step details"""
    logging.info(f"📍 Step {step_number}: {step_name}")
    if details is not None:
        for key, value in details.items():
            logging.info(f"   {key}: {value}")

def log_workflow_verification(workflow_name: str, data: Dict[str, Any]):
    """Log workflow verification details"""
    logging.info(f"✅ Workflow verified: {workflow_name}")
    for key, value in data.items():
        logging.info(f"   {key}: {value}")

def log_end_to_end_test(test_scenario: str, components: list, success: bool):
    """Log end-to-end test details"""
    status = "✅ PASSED" if success else "❌ FAILED"
    logging.info(f"{status} End-to-end test: {test_scenario}")
    logging.info(f"   Components tested: {', '.join(components)}")

def log_database_state(operation: str, table: str, record_count: int):
    """Log database state during integration tests"""
    logging.info(f"🗄️ Database state: {operation}")
    logging.info(f"   Table: {table}")
    logging.info(f"   Record count: {record_count}")

def log_api_sequence(sequence_name: str, endpoints: list, success: bool):
    """Log API sequence details"""
    status = "✅ COMPLETED" if success else "❌ FAILED"
    logging.info(f"{status} API sequence: {sequence_name}")
    logging.info(f"   Endpoints: {' -> '.join(endpoints)}")

def log_component_integration(component1: str, component2: str, integration_type: str, success: bool):
    """Log component integration details"""
    status = "✅ INTEGRATED" if success else "❌ FAILED"
    logging.info(f"{status} Component integration")
    logging.info(f"   Components: {component1} <-> {component2}")
    logging.info(f"   Integration type: {integration_type}")

def log_system_state(state_name: str, details: Dict[str, Any]):
    """Log system state during integration tests"""
    logging.info(f"🔧 System state: {state_name}")
    for key, value in details.items():
        logging.info(f"   {key}: {value}")

def log_user_journey(journey_name: str, steps: list, current_step: int):
    """Log user journey progress"""
    logging.info(f"👤 User journey: {journey_name}")
    logging.info(f"   Current step: {current_step}/{len(steps)}")
    logging.info(f"   Step: {steps[current_step - 1] if current_step <= len(steps) else 'Complete'}")

def log_assertion_success(message: str):
    """Log successful assertion"""
    logging.info(f"✅ {message}")

def log_data_flow_verification(flow_name: str, source: str, destination: str, success: bool):
    """Log data flow verification"""
    status = "✅ VERIFIED" if success else "❌ FAILED"
    logging.info(f"{status} Data flow: {flow_name}")
    logging.info(f"   Source: {source}")
    logging.info(f"   Destination: {destination}")

def log_performance_metric(metric_name: str, value: float, unit: str, threshold: Optional[float] = None):
    """Log performance metrics during integration tests"""
    status = ""
    if threshold is not None:
        status = " ✅ PASS" if value <= threshold else " ❌ FAIL"
    logging.info(f"📊 Performance metric: {metric_name}")
    logging.info(f"   Value: {value} {unit}{status}")
    if threshold is not None:
        logging.info(f"   Threshold: {threshold} {unit}")

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