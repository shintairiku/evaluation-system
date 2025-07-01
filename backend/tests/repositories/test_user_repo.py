#!/usr/bin/env python3
"""
Test script for UserRepository implementation with comprehensive logging
Self-executable with command-line support for individual test selection
"""

import sys
import asyncio
import argparse
import logging
from uuid import UUID
from typing import Dict, Any
# Add backend to path for imports
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from app.database.repositories.user_repo import user_repository, UserStatus
from app.schemas.user import UserCreate, UserUpdate
from app.schemas.common import PaginationParams
from tests.repositories.test_logging_utils import (
    setup_repository_test_logging,
    log_test_start,
    log_data_verification,
    log_assertion_success,
    log_supabase_connectivity,
    log_database_operation,
    log_test_summary,
    log_error,
    log_warning,
    log_info
)

# Set up centralized logging for user repository tests
TEST_LOG_FILE = setup_repository_test_logging('user')

class TestUserRepository:
    """Test UserRepository with actual Supabase data"""

    # Test data - replace with actual test data from your database
    SEED_DATA_IDS = {
        "test_user_1": UUID("123e4567-e89b-12d3-a456-426614174000"),
        "test_user_2": UUID("223e4567-e89b-12d3-a456-426614174001"),
        "test_department_1": UUID("323e4567-e89b-12d3-a456-426614174002"),
        "test_stage_1": UUID("423e4567-e89b-12d3-a456-426614174003"),
    }

    async def test_supabase_connectivity(self):
        """Test basic Supabase database connectivity"""
        log_test_start("Supabase Database Connectivity")

        try:
            # Test basic connectivity by querying users table
            logging.info("Testing basic database connection...")
            results = await user_repository.search_users(search_term="", filters={})

            # Log connectivity success using utility function
            log_supabase_connectivity(len(results), "users")

            # Verify we can access the database
            assert len(results) >= 0, "Should be able to query users table"
            log_assertion_success("Database connectivity verified")

        except Exception as e:
            log_error(e, "Supabase connectivity test")
            raise

    async def test_count_users(self):
        """Test counting users in database"""
        log_test_start("count_users")

        try:
            # Execute the repository function
            count = await user_repository.count_users()

            # Log data verification
            log_data_verification("user_count", {
                "Total Users": count,
                "Status": "Active and Inactive"
            })

            # Verify data integrity
            assert count >= 0, "User count should be non-negative"
            log_assertion_success("User count is valid")

        except Exception as e:
            log_error(e, "count_users test")
            raise

    async def test_search_users(self):
        """Test searching users with filters"""
        log_test_start("search_users")

        try:
            # Test search with empty term
            results = await user_repository.search_users(search_term="", filters={})

            # Log data verification
            log_data_verification("search_results", {
                "Total Results": len(results),
                "Search Term": "empty",
                "Filters": "none"
            })

            # Verify data integrity
            assert isinstance(results, list), "Results should be a list"
            log_assertion_success("Search results are valid")

            # Test search with filters
            if results:
                first_user = results[0]
                filtered_results = await user_repository.search_users(
                    search_term="",
                    filters={"department_id": first_user.department_id}
                )

                log_data_verification("filtered_results", {
                    "Filtered Results": len(filtered_results),
                    "Department ID": str(first_user.department_id),
                    "Original Results": len(results)
                })

                assert len(filtered_results) <= len(results), "Filtered results should not exceed total results"

        except Exception as e:
            log_error(e, "search_users test")
            raise

    async def test_get_by_email(self):
        """Test fetching user by email address"""
        log_test_start("get_by_email")

        try:
            # First get some users to test with
            users = await user_repository.search_users(search_term="", filters={})
            
            if users:
                first_user = users[0]
                test_email = first_user.email
                
                logging.info(f"Testing with email: {test_email}")
                
                # Execute the repository function
                result = await user_repository.get_by_email(test_email)

                if result:
                    # Log data verification
                    log_data_verification("user_by_email", {
                        "ID": str(result.id),
                        "Name": result.name,
                        "Email": result.email,
                        "Employee Code": result.employee_code,
                        "Status": result.status.value
                    })

                    # Verify data integrity
                    assert result.email == test_email, f"Expected email {test_email}, got {result.email}"
                    assert result.id == first_user.id, "User ID should match"
                    log_assertion_success("User data is consistent")
                else:
                    log_warning(f"No user found with email: {test_email}")
            else:
                log_warning("No users found in database to test with")

        except Exception as e:
            log_error(e, "get_by_email test")
            raise

    async def test_get_by_employee_code(self):
        """Test fetching user by employee code"""
        log_test_start("get_by_employee_code")

        try:
            # First get some users to test with
            users = await user_repository.search_users(search_term="", filters={})
            
            if users:
                first_user = users[0]
                test_code = first_user.employee_code
                
                logging.info(f"Testing with employee code: {test_code}")
                
                # Execute the repository function
                result = await user_repository.get_by_employee_code(test_code)

                if result:
                    # Log data verification
                    log_data_verification("user_by_employee_code", {
                        "ID": str(result.id),
                        "Name": result.name,
                        "Employee Code": result.employee_code,
                        "Email": result.email,
                        "Status": result.status.value
                    })

                    # Verify data integrity
                    assert result.employee_code == test_code, f"Expected code {test_code}, got {result.employee_code}"
                    assert result.id == first_user.id, "User ID should match"
                    log_assertion_success("User data is consistent")
                else:
                    log_warning(f"No user found with employee code: {test_code}")
            else:
                log_warning("No users found in database to test with")

        except Exception as e:
            log_error(e, "get_by_employee_code test")
            raise

    async def test_get_by_department(self):
        """Test fetching users by department"""
        log_test_start("get_by_department")

        try:
            # First get some users to test with
            users = await user_repository.search_users(search_term="", filters={})
            
            if users:
                first_user = users[0]
                test_department_id = first_user.department_id
                
                logging.info(f"Testing with department ID: {test_department_id}")
                
                # Execute the repository function
                results = await user_repository.get_by_department(test_department_id)

                # Log data verification
                log_data_verification("users_by_department", {
                    "Department ID": str(test_department_id),
                    "Total Users": len(results),
                    "First User": results[0].name if results else "None"
                })

                # Verify data integrity
                assert isinstance(results, list), "Results should be a list"
                for user in results:
                    assert user.department_id == test_department_id, f"User {user.id} should be in department {test_department_id}"
                log_assertion_success("All users belong to the correct department")
            else:
                log_warning("No users found in database to test with")

        except Exception as e:
            log_error(e, "get_by_department test")
            raise

    async def test_get_by_role(self):
        """Test fetching users by role"""
        log_test_start("get_by_role")

        try:
            # Test with a common role name
            test_role = "Employee"  # Adjust based on your actual role names
            
            logging.info(f"Testing with role: {test_role}")
            
            # Execute the repository function
            results = await user_repository.get_by_role(test_role)

            # Log data verification
            log_data_verification("users_by_role", {
                "Role Name": test_role,
                "Total Users": len(results),
                "First User": results[0].name if results else "None"
            })

            # Verify data integrity
            assert isinstance(results, list), "Results should be a list"
            log_assertion_success("Role-based user search completed")

        except Exception as e:
            log_error(e, "get_by_role test")
            raise

    async def test_get_user_roles(self):
        """Test fetching user roles"""
        log_test_start("get_user_roles")

        try:
            # First get some users to test with
            users = await user_repository.search_users(search_term="", filters={})
            
            if users:
                first_user = users[0]
                test_user_id = first_user.id
                
                logging.info(f"Testing with user ID: {test_user_id}")
                
                # Execute the repository function
                roles = await user_repository.get_user_roles(test_user_id)

                # Log data verification
                log_data_verification("user_roles", {
                    "User ID": str(test_user_id),
                    "User Name": first_user.name,
                    "Total Roles": len(roles),
                    "Role Names": [role.name for role in roles] if roles else []
                })

                # Verify data integrity
                assert isinstance(roles, list), "Roles should be a list"
                log_assertion_success("User roles retrieved successfully")
            else:
                log_warning("No users found in database to test with")

        except Exception as e:
            log_error(e, "get_user_roles test")
            raise

    async def test_get_user_supervisors(self):
        """Test fetching user supervisors"""
        log_test_start("get_user_supervisors")

        try:
            # First get some users to test with
            users = await user_repository.search_users(search_term="", filters={})
            
            if users:
                first_user = users[0]
                test_user_id = first_user.id
                
                logging.info(f"Testing with user ID: {test_user_id}")
                # Execute the repository function
                supervisors = await user_repository.get_user_supervisors(test_user_id)

                # Log data verification
                log_data_verification("user_supervisors", {
                    "User ID": str(test_user_id),
                    "User Name": first_user.name,
                    "Total Supervisors": len(supervisors),
                    "Supervisor Names": [sup.name for sup in supervisors] if supervisors else []
                })

                # Verify data integrity
                assert isinstance(supervisors, list), "Supervisors should be a list"
                log_assertion_success("User supervisors retrieved successfully")
            else:
                log_warning("No users found in database to test with")

        except Exception as e:
            log_error(e, "get_user_supervisors test")
            raise

    async def test_get_subordinates(self):
        """Test fetching user subordinates"""
        log_test_start("get_subordinates")

        try:
            # First get some users to test with
            users = await user_repository.search_users(search_term="", filters={})
            
            if users:
                first_user = users[0]
                test_user_id = first_user.id
                
                logging.info(f"Testing with user ID: {test_user_id}")
                
                # Execute the repository function
                subordinates = await user_repository.get_subordinates(test_user_id)

                # Log data verification
                log_data_verification("user_subordinates", {
                    "Supervisor ID": str(test_user_id),
                    "Supervisor Name": first_user.name,
                    "Total Subordinates": len(subordinates),
                    "Subordinate Names": [sub.name for sub in subordinates] if subordinates else []
                })

                # Verify data integrity
                assert isinstance(subordinates, list), "Subordinates should be a list"
                log_assertion_success("User subordinates retrieved successfully")
            else:
                log_warning("No users found in database to test with")

        except Exception as e:
            log_error(e, "get_subordinates test")
            raise

    async def test_update_last_login(self):
        """Test updating user last login timestamp"""
        log_test_start("update_last_login")

        try:
            # First get some users to test with
            users = await user_repository.search_users(search_term="", filters={})
            
            if users:
                first_user = users[0]
                test_user_id = first_user.id
                
                logging.info(f"Testing with user ID: {test_user_id}")
                
                # Execute the repository function
                result = await user_repository.update_last_login(test_user_id)

                # Log data verification
                log_data_verification("update_last_login", {
                    "User ID": str(test_user_id),
                    "User Name": first_user.name,
                    "Update Success": result
                })

                # Verify data integrity
                assert isinstance(result, bool), "Result should be boolean"
                log_assertion_success("Last login update completed")
            else:
                log_warning("No users found in database to test with")

        except Exception as e:
            log_error(e, "update_last_login test")
            raise

# Self-executable functionality
async def run_specific_test(test_name: str):
    """Run a specific test function"""
    test_instance = TestUserRepository()
    
    # Map test names to test methods
    test_methods = {
        'supabase_connectivity': test_instance.test_supabase_connectivity,
        'count_users': test_instance.test_count_users,
        'search_users': test_instance.test_search_users,
        'get_by_email': test_instance.test_get_by_email,
        'get_by_employee_code': test_instance.test_get_by_employee_code,
        'get_by_department': test_instance.test_get_by_department,
        'get_by_role': test_instance.test_get_by_role,
        'get_user_roles': test_instance.test_get_user_roles,
        'get_user_supervisors': test_instance.test_get_user_supervisors,
        'get_subordinates': test_instance.test_get_subordinates,
        'update_last_login': test_instance.test_update_last_login,
    }
    
    if test_name in test_methods:
        logging.info(f"🧪 Running specific test: {test_name}")
        await test_methods[test_name]()
        log_test_summary(test_name, True, "Test completed successfully")
    else:
        logging.error(f"❌ Test '{test_name}' not found")
        print(f"Available tests: {', '.join(test_methods.keys())}")

async def run_all_tests():
    """Run all tests"""
    test_instance = TestUserRepository()
    
    test_methods = [
        test_instance.test_supabase_connectivity,
        test_instance.test_count_users,
        test_instance.test_search_users,
        test_instance.test_get_by_email,
        test_instance.test_get_by_employee_code,
        test_instance.test_get_by_department,
        test_instance.test_get_by_role,
        test_instance.test_get_user_roles,
        test_instance.test_get_user_supervisors,
        test_instance.test_get_subordinates,
        test_instance.test_update_last_login,
    ]
    
    passed = 0
    failed = 0
    
    for test_method in test_methods:
        test_name = test_method.__name__
        try:
            logging.info(f"🧪 Running test: {test_name}")
            await test_method()
            passed += 1
            log_test_summary(test_name, True)
        except Exception as e:
            failed += 1
            log_test_summary(test_name, False, str(e))
    
    # Final summary
    logging.info(f"📊 Final Test Summary: {passed} passed, {failed} failed")
    print(f"\n📊 Final Test Summary: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("🎉 All tests passed!")
    else:
        print(f"⚠️ {failed} tests failed. Check logs for details.")

def show_help():
    """Show help information"""
    print("""
🧪 UserRepository Test Suite

Usage:
  python -m tests.repositories.test_user_repo [test_name]
  python -m tests.repositories.test_user_repo --help
  python -m tests.repositories.test_user_repo --list

Available Tests:
  supabase_connectivity  - Test database connectivity
  count_users           - Test user counting
  search_users          - Test user search functionality
  get_by_email          - Test fetching user by email
  get_by_employee_code  - Test fetching user by employee code
  get_by_department     - Test fetching users by department
  get_by_role           - Test fetching users by role
  get_user_roles        - Test fetching user roles
  get_user_supervisors  - Test fetching user supervisors
  get_subordinates      - Test fetching user subordinates
  update_last_login     - Test updating last login timestamp

Examples:
  python -m tests.repositories.test_user_repo                    # Run all tests
  python -m tests.repositories.test_user_repo supabase_connectivity  # Run specific test
  python -m tests.repositories.test_user_repo --list             # List all tests
    """)

def list_tests():
    """List all available tests"""
    tests = [
        'supabase_connectivity',
        'count_users',
        'search_users',
        'get_by_email',
        'get_by_employee_code',
        'get_by_department',
        'get_by_role',
        'get_user_roles',
        'get_user_supervisors',
        'get_subordinates',
        'update_last_login',
    ]
    
    print("Available tests:")
    for i, test in enumerate(tests, 1):
        print(f"  {i:2d}. {test}")

async def main():
    """Main function with command-line argument support"""
    parser = argparse.ArgumentParser(description="UserRepository Test Suite")
    parser.add_argument('test_name', nargs='?', help='Specific test to run')
    parser.add_argument('--list', '-l', action='store_true', help='List all tests')
    
    # Parse arguments
    if len(sys.argv) == 1:
        # No arguments, run all tests
        await run_all_tests()
        return
    
    if '--help' in sys.argv or '-h' in sys.argv:
        show_help()
        return
    
    if '--list' in sys.argv or '-l' in sys.argv:
        list_tests()
        return
    
    # Get test name from first argument
    test_name = sys.argv[1]
    
    if test_name == '--help' or test_name == '-h':
        show_help()
    elif test_name == '--list' or test_name == '-l':
        list_tests()
    else:
        await run_specific_test(test_name)

if __name__ == "__main__":
    asyncio.run(main()) 