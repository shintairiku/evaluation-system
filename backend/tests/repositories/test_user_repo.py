import pytest
import asyncio
import logging
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
import pytest_asyncio

from app.database.repositories.user_repo import UserRepository
from app.schemas.user import UserStatus
from app.database.session import get_db_session
from tests.repositories.test_logging_utils import (
    setup_repository_test_logging, 
    log_test_start, 
    log_data_verification, 
    log_assertion_success,
    log_supabase_connectivity
)

# Set up centralized logging for user repository tests
TEST_LOG_FILE = setup_repository_test_logging('user')


class TestUserRepository:
    """Test UserRepository with actual Supabase data"""
    
    @pytest_asyncio.fixture
    async def session(self):
        """Get actual database session"""
        async for session in get_db_session():
            yield session
            break
    
    @pytest_asyncio.fixture
    async def user_repo(self, session):
        """Create UserRepository instance"""
        return UserRepository(session)
    
    # Test data from seed files
    SEED_USER_IDS = {
        "admin": UUID("850e8400-e29b-41d4-a716-446655440001"),
        "yamada": UUID("123e4567-e89b-12d3-a456-426614174000"), 
        "sato": UUID("223e4567-e89b-12d3-a456-426614174001"),
        "tanaka": UUID("333e4567-e89b-12d3-a456-426614174002")
    }
    
    CLERK_IDS = {
        "admin": "user_2yvuXi0Tc0TbKhRnbk9323O652l",
        "yamada": "user_2yvuP5pHHlMHlBdkbpvwlpXuaGY",
        "sato": "user_2yvuRoUwHSGUPhtCEGoYuOfgr56",
        "tanaka": "user_2yvuUGOEhvbpJCmEOeHaevocDXA"
    }

    @pytest.mark.asyncio
    async def test_get_user_by_clerk_id(self, user_repo):
        """Test fetching user by Clerk ID"""
        log_test_start("get_user_by_clerk_id")
        
        clerk_id = self.CLERK_IDS["yamada"]
        logging.info(f"Attempting to fetch user with Clerk ID: {clerk_id}")
        
        try:
            user = await user_repo.get_user_by_clerk_id(clerk_id)
            
            if user:
                # Log data verification using utility function
                log_data_verification("user", {
                    "User ID": user.id,
                    "Name": user.name,
                    "Email": user.email,
                    "Employee Code": user.employee_code,
                    "Status": user.status,
                    "Job Title": user.job_title,
                    "Clerk User ID": user.clerk_user_id,
                    "Created At": user.created_at
                })
                
                # Verify Supabase data integrity
                assert user is not None, "User should not be None"
                assert user.name == "山田 太郎", f"Expected '山田 太郎', got '{user.name}'"
                assert user.email == "yamada.taro@company.com", f"Expected 'yamada.taro@company.com', got '{user.email}'"
                assert user.clerk_user_id == clerk_id, f"Clerk ID mismatch: expected '{clerk_id}', got '{user.clerk_user_id}'"
                
                log_assertion_success("All assertions passed - Supabase data is consistent")
            else:
                logging.error("❌ User not found in Supabase database")
                logging.error(f"   Searched Clerk ID: {clerk_id}")
                raise AssertionError("User should exist in Supabase")
                
        except Exception as e:
            logging.error(f"❌ Error during Supabase query: {str(e)}")
            logging.error(f"   Error type: {type(e).__name__}")
            raise

    @pytest.mark.asyncio
    async def test_get_user_by_id_with_details(self, user_repo):
        """Test fetching user with all relationships"""
        print("\n=== Testing get_user_by_id_with_details ===")
        
        # Test with Sato (manager with relationships)
        user = await user_repo.get_user_by_id_with_details(self.SEED_USER_IDS["sato"])
        
        if user:
            print(f"✅ Found user with details: {user.name}")
            print(f"   ID: {user.id}")
            print(f"   Department: {user.department.name if user.department else 'None'}")
            print(f"   Stage: {user.stage.name if user.stage else 'None'}")
            print(f"   Roles: {[role.name for role in user.roles] if user.roles else 'None'}")
            print(f"   Status: {user.status}")
        else:
            print("❌ User not found")
            
        assert user is not None
        assert user.name == "佐藤 花子"
        assert user.department is not None
        assert user.stage is not None

    @pytest.mark.asyncio
    async def test_get_users_by_status(self, user_repo):
        """Test fetching users by status"""
        print("\n=== Testing get_users_by_status ===")
        
        active_users = await user_repo.get_users_by_status(UserStatus.ACTIVE)
        
        print(f"✅ Found {len(active_users)} active users:")
        for user in active_users:
            print(f"   - {user.name} ({user.employee_code})")
            print(f"     Department: {user.department.name if user.department else 'None'}")
            print(f"     Stage: {user.stage.name if user.stage else 'None'}")
        
        assert len(active_users) > 0
        assert all(user.status == UserStatus.ACTIVE.value for user in active_users)

    @pytest.mark.asyncio
    async def test_get_user_by_email(self, user_repo):
        """Test fetching user by email"""
        logging.info("=== Testing get_user_by_email ===")
        
        test_email = "yamada.taro@company.com"
        logging.info(f"Attempting to fetch user with email: {test_email}")
        
        try:
            user = await user_repo.get_user_by_email(test_email)
            
            if user:
                logging.info(f"✅ Successfully fetched user from Supabase by email")
                logging.info(f"   User ID: {user.id}")
                logging.info(f"   Name: {user.name}")
                logging.info(f"   Email: {user.email}")
                logging.info(f"   Clerk User ID: {user.clerk_user_id}")
                logging.info(f"   Employee Code: {user.employee_code}")
                
                # Verify data consistency
                assert user is not None, "User should not be None"
                assert user.name == "山田 太郎", f"Expected '山田 太郎', got '{user.name}'"
                assert user.email == test_email, f"Email mismatch: expected '{test_email}', got '{user.email}'"
                assert user.clerk_user_id == self.CLERK_IDS["yamada"], "Clerk ID should match expected value"
                
                logging.info("✅ Email-based lookup successful - Supabase data consistent")
            else:
                logging.error("❌ User not found by email in Supabase")
                logging.error(f"   Searched email: {test_email}")
                raise AssertionError("User should be found by email")
                
        except Exception as e:
            logging.error(f"❌ Error during email-based Supabase query: {str(e)}")
            raise

    @pytest.mark.asyncio
    async def test_get_user_by_id_basic(self, user_repo):
        """Test basic user fetch by ID"""
        print("\n=== Testing get_user_by_id (basic) ===")
        
        user = await user_repo.get_user_by_id(self.SEED_USER_IDS["tanaka"])
        
        if user:
            print(f"✅ Found user: {user.name}")
            print(f"   ID: {user.id}")
            print(f"   Employee Code: {user.employee_code}")
            print(f"   Email: {user.email}")
        else:
            print("❌ User not found")
            
        assert user is not None
        assert user.name == "田中 一郎"

    @pytest.mark.asyncio
    async def test_all_seed_users_exist(self, user_repo):
        """Verify all seed users exist in database"""
        print("\n=== Testing all seed users exist ===")
        
        for name, user_id in self.SEED_USER_IDS.items():
            user = await user_repo.get_user_by_id(user_id)
            print(f"   {name}: {'✅ Found' if user else '❌ Missing'}")
            assert user is not None, f"Seed user {name} not found"
        
        print("✅ All seed users found in database")

    @pytest.mark.asyncio
    async def test_supabase_connectivity(self, user_repo):
        """Test basic Supabase database connectivity"""
        log_test_start("Supabase Database Connectivity")
        
        try:
            # Test basic connectivity by counting users
            logging.info("Testing basic database connection...")
            active_users = await user_repo.get_users_by_status(UserStatus.ACTIVE)
            
            # Log connectivity success using utility function
            log_supabase_connectivity(len(active_users), "users")
            
            # Verify we can access the database
            assert len(active_users) >= 0, "Should be able to query users table"
            log_assertion_success("Database connectivity verified")
            
        except Exception as e:
            logging.error(f"❌ Supabase connectivity failed: {str(e)}")
            logging.error(f"   Connection error type: {type(e).__name__}")
            raise

    @pytest.mark.asyncio 
    async def test_database_relationships(self, user_repo):
        """Test database relationships are properly loaded"""
        logging.info("=== Testing Database Relationships ===")
        
        user_id = self.SEED_USER_IDS["yamada"]
        logging.info(f"Testing relationship loading for user ID: {user_id}")
        
        try:
            user = await user_repo.get_user_by_id_with_details(user_id)
            
            if user:
                logging.info(f"✅ User with relationships loaded: {user.name}")
                logging.info(f"   Department: {user.department.name if user.department else '❌ Missing'}")
                logging.info(f"   Stage: {user.stage.name if user.stage else '❌ Missing'}")
                logging.info(f"   Roles: {[r.name for r in user.roles] if user.roles else '❌ Missing'}")
                
                # Verify relationships exist in Supabase
                assert user.department is not None, "Department relationship should be loaded from Supabase"
                assert user.stage is not None, "Stage relationship should be loaded from Supabase"
                assert user.roles is not None and len(user.roles) > 0, "Roles relationship should be loaded from Supabase"
                
                logging.info("✅ All database relationships properly loaded from Supabase")
            else:
                logging.error("❌ User not found for relationship testing")
                raise AssertionError("User should exist for relationship testing")
                
        except Exception as e:
            logging.error(f"❌ Error testing database relationships: {str(e)}")
            raise


if __name__ == "__main__":
    import sys
    
    # Enhanced direct test execution with selection capabilities
    async def run_tests(selected_test: str = None):
        logging.info("=== User Repository Test Execution ===")
        logging.info(f"Log file location: {TEST_LOG_FILE}")
        
        # Get session
        async for session in get_db_session():
            logging.info("✅ Database session acquired")
            repo = UserRepository(session)
            test_instance = TestUserRepository()
            
            # Available tests
            available_tests = [
                ("supabase_connectivity", "Supabase Connectivity", test_instance.test_supabase_connectivity),
                ("get_user_by_clerk_id", "Get User by Clerk ID", test_instance.test_get_user_by_clerk_id),
                ("get_user_by_email", "Get User by Email", test_instance.test_get_user_by_email),
                ("get_user_by_id_basic", "Get User by ID (Basic)", test_instance.test_get_user_by_id_basic),
                ("get_user_by_id_with_details", "Get User by ID with Details", test_instance.test_get_user_by_id_with_details),
                ("get_users_by_status", "Get Users by Status", test_instance.test_get_users_by_status),
                ("all_seed_users_exist", "All Seed Users Exist", test_instance.test_all_seed_users_exist),
                ("database_relationships", "Database Relationships", test_instance.test_database_relationships),
            ]
            
            # Filter tests if specific test requested
            if selected_test:
                tests_to_run = [(key, name, func) for key, name, func in available_tests if key == selected_test]
                if not tests_to_run:
                    logging.error(f"❌ Test '{selected_test}' not found!")
                    logging.info("Available tests: " + ", ".join([key for key, _, _ in available_tests]))
                    return
            else:
                tests_to_run = available_tests
            
            passed_tests = 0
            failed_tests = 0
            
            for test_key, test_name, test_func in tests_to_run:
                try:
                    logging.info(f"\n{'='*60}")
                    logging.info(f"Running: {test_name}")
                    logging.info(f"{'='*60}")
                    
                    await test_func(repo)
                    
                    passed_tests += 1
                    logging.info(f"✅ {test_name} - PASSED")
                    
                except Exception as e:
                    failed_tests += 1
                    logging.error(f"❌ {test_name} - FAILED: {str(e)}")
                    logging.error(f"   Error details: {type(e).__name__}")
            
            # Final summary
            logging.info(f"\n{'='*60}")
            logging.info(f"USER REPOSITORY TEST SUMMARY")
            logging.info(f"{'='*60}")
            logging.info(f"Total tests: {len(tests_to_run)}")
            logging.info(f"Passed: {passed_tests}")
            logging.info(f"Failed: {failed_tests}")
            logging.info(f"Success rate: {(passed_tests/len(tests_to_run)*100):.1f}%")
            logging.info(f"Log file: {TEST_LOG_FILE}")
            
            if failed_tests == 0:
                logging.info("🎉 All tests completed successfully!")
                logging.info("✅ Supabase connectivity and data fetching verified")
            else:
                logging.error(f"❌ {failed_tests} test(s) failed")
                
            break
    
    def show_usage():
        """Show usage information."""
        print("=" * 60)
        print("USER REPOSITORY TEST RUNNER")
        print("=" * 60)
        print("\n📋 Usage:")
        print("  python test_user_repo.py                    # Run all tests")
        print("  python test_user_repo.py [test_name]        # Run specific test")
        print("  python test_user_repo.py --list             # Show available tests")
        print("  python test_user_repo.py --help             # Show this help")
        
        print("\n🔧 Available Tests:")
        tests = [
            ("supabase_connectivity", "Test database connectivity"),
            ("get_user_by_clerk_id", "Test fetching user by Clerk ID"),
            ("get_user_by_email", "Test fetching user by email"),
            ("get_user_by_id_basic", "Test basic user ID lookup"),
            ("get_user_by_id_with_details", "Test user ID lookup with relationships"),
            ("get_users_by_status", "Test filtering users by status"),
            ("all_seed_users_exist", "Verify all seed users exist"),
            ("database_relationships", "Test database relationship loading"),
        ]
        
        for test_key, description in tests:
            print(f"  {test_key:<25} - {description}")
        
        print(f"\n📄 Logs will be saved to: tests/logs/user_repo_test_[timestamp].log")
        print("=" * 60)
    
    # Handle command line arguments
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        
        if arg in ["--help", "-h"]:
            show_usage()
        elif arg == "--list":
            show_usage()
        else:
            # Run specific test
            print(f"🎯 Running specific test: {arg}")
            asyncio.run(run_tests(arg))
    else:
        # Run all tests
        print("🚀 Running all user repository tests...")
        asyncio.run(run_tests())