import asyncio
import logging
from uuid import UUID, uuid4
import pytest

from sqlalchemy.ext.asyncio import AsyncSession
import pytest_asyncio

from app.database.models.user import User
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
        """Test fetching user with all relationships, including supervisors and subordinates"""
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
            print(f"   Supervisors: {[rel.supervisor.name for rel in user.supervisor_relations] if user.supervisor_relations else 'None'}")
            print(f"   Subordinates: {[rel.user.name for rel in user.subordinate_relations] if user.subordinate_relations else 'None'}")
        else:
            print("❌ User not found")
            
        assert user is not None
        assert user.name == "佐藤 花子"
        assert user.department is not None
        assert user.stage is not None
        # New assertions for relationships
        assert hasattr(user, "supervisor_relations"), "User should have supervisor_relations attribute"
        assert hasattr(user, "subordinate_relations"), "User should have subordinate_relations attribute"
        # Optionally, check that subordinate_relations is a list (even if empty)
        assert isinstance(user.subordinate_relations, list), "subordinate_relations should be a list"
        # Optionally, print or check the subordinate names if any
        if user.subordinate_relations:
            for rel in user.subordinate_relations:
                assert hasattr(rel, "user"), "Each subordinate relation should have a user attribute"
                print(f"      Subordinate: {rel.user.name}")

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
                logging.info("✅ Successfully fetched user from Supabase by email")
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


    @pytest.mark.asyncio
    async def test_get_user_by_employee_code(self, user_repo):
        """Test fetching user by employee code"""
        log_test_start("get_user_by_employee_code")
        
        # Test with Yamada's employee code from seed data
        employee_code = "EMP001"
        logging.info(f"Attempting to fetch user with employee code: {employee_code}")
        
        try:
            user = await user_repo.get_user_by_employee_code(employee_code)
            
            if user:
                log_data_verification("user_by_employee_code", {
                    "User ID": user.id,
                    "Name": user.name,
                    "Employee Code": user.employee_code,
                    "Email": user.email,
                    "Status": user.status
                })
                
                assert user is not None, "User should not be None"
                assert user.employee_code == employee_code, f"Expected '{employee_code}', got '{user.employee_code}'"
                assert user.name == "山田 太郎", f"Expected '山田 太郎', got '{user.name}'"
                
                log_assertion_success("Employee code lookup successful")
            else:
                logging.error("❌ User not found by employee code")
                raise AssertionError("User should exist with employee code EMP001")
                
        except Exception as e:
            logging.error(f"❌ Error during employee code lookup: {str(e)}")
            raise

    @pytest.mark.asyncio
    async def test_check_user_exists_by_clerk_id(self, user_repo):
        """Test lightweight check for user existence by Clerk ID"""
        log_test_start("check_user_exists_by_clerk_id")
        
        clerk_id = self.CLERK_IDS["sato"]
        logging.info(f"Checking user existence with Clerk ID: {clerk_id}")
        
        try:
            result = await user_repo.check_user_exists_by_clerk_id(clerk_id)
            
            if result:
                log_data_verification("user_existence_check", {
                    "User ID": result["id"],
                    "Name": result["name"],
                    "Email": result["email"],
                    "Status": result["status"]
                })
                
                # Verify result is a dict with expected fields (per memory note)
                assert isinstance(result, dict), "Result should be a dictionary"
                assert "id" in result, "Result should contain 'id' field"
                assert "name" in result, "Result should contain 'name' field"
                assert "email" in result, "Result should contain 'email' field"
                assert "status" in result, "Result should contain 'status' field"
                assert result["name"] == "佐藤 花子", f"Expected '佐藤 花子', got '{result['name']}'"
                
                log_assertion_success("User existence check successful")
            else:
                logging.error("❌ User existence check returned None")
                raise AssertionError("User should exist")
                
        except Exception as e:
            logging.error(f"❌ Error during user existence check: {str(e)}")
            raise
    
    @pytest.mark.asyncio
    async def test_get_users_by_department(self, user_repo):
        """Test fetching users by department"""
        log_test_start("get_users_by_department")
        
        # Use Engineering department ID from seed data (assuming it exists)
        # First get a user to find their department ID
        user = await user_repo.get_user_by_id_with_details(self.SEED_USER_IDS["yamada"])
        assert user and user.department, "Need user with department for testing"
        
        department_id = user.department_id
        logging.info(f"Testing department filtering with ID: {department_id}")
        
        try:
            users = await user_repo.get_users_by_department(department_id)
            
            log_data_verification("users_by_department", {
                "Department ID": department_id,
                "Users Found": len(users),
                "User Names": [u.name for u in users]
            })
            
            assert len(users) > 0, "Should find at least one user in department"
            assert all(u.department_id == department_id for u in users), "All users should be in the same department"
            assert all(u.status == UserStatus.ACTIVE.value for u in users), "All users should be active"
            
            log_assertion_success(f"Found {len(users)} users in department")
            
        except Exception as e:
            logging.error(f"❌ Error fetching users by department: {str(e)}")
            raise
    
    @pytest.mark.asyncio
    async def test_get_users_by_role_names(self, user_repo):
        """Test fetching users by role names"""
        log_test_start("get_users_by_role_names")
        
        # Test with common role names
        role_names = ["employee", "manager"]
        logging.info(f"Testing role filtering with names: {role_names}")
        
        try:
            users = await user_repo.get_users_by_role_names(role_names)
            
            log_data_verification("users_by_role_names", {
                "Role Names": role_names,
                "Users Found": len(users),
                "User Names": [u.name for u in users]
            })
            
            assert len(users) > 0, "Should find users with specified roles"
            assert all(u.status == UserStatus.ACTIVE.value for u in users), "All users should be active"
            
            log_assertion_success(f"Found {len(users)} users with roles: {role_names}")
            
        except Exception as e:
            logging.error(f"❌ Error fetching users by role names: {str(e)}")
            raise
    
    @pytest.mark.asyncio
    async def test_get_user_roles(self, user_repo):
        """Test fetching roles for a specific user"""
        log_test_start("get_user_roles")
        
        user_id = self.SEED_USER_IDS["sato"]
        logging.info(f"Testing role retrieval for user ID: {user_id}")
        
        try:
            roles = await user_repo.get_user_roles(user_id)
            
            log_data_verification("user_roles", {
                "User ID": user_id,
                "Roles Found": len(roles),
                "Role Names": [r.name for r in roles]
            })
            
            assert len(roles) > 0, "User should have at least one role"
            assert all(hasattr(role, 'name') for role in roles), "All roles should have name attribute"
            
            log_assertion_success(f"Found {len(roles)} roles for user")
            
        except Exception as e:
            logging.error(f"❌ Error fetching user roles: {str(e)}")
            raise
    
    @pytest.mark.asyncio
    async def test_get_user_supervisors(self, user_repo):
        """Test fetching supervisors for a user"""
        log_test_start("get_user_supervisors")
        
        # Test with an employee who should have supervisors
        user_id = self.SEED_USER_IDS["yamada"]
        logging.info(f"Testing supervisor lookup for user ID: {user_id}")
        
        try:
            supervisors = await user_repo.get_user_supervisors(user_id)
            
            log_data_verification("user_supervisors", {
                "User ID": user_id,
                "Supervisors Found": len(supervisors),
                "Supervisor Names": [s.name for s in supervisors]
            })
            
            # Note: May be 0 supervisors for some users, so just check structure
            assert isinstance(supervisors, list), "Should return a list of supervisors"
            if supervisors:
                assert all(hasattr(s, 'name') for s in supervisors), "All supervisors should have name attribute"
                assert all(s.status == UserStatus.ACTIVE.value for s in supervisors), "All supervisors should be active"
            
            log_assertion_success(f"Found {len(supervisors)} supervisors for user")
            
        except Exception as e:
            logging.error(f"❌ Error fetching user supervisors: {str(e)}")
            raise
    
    @pytest.mark.asyncio
    async def test_get_subordinates(self, user_repo):
        """Test fetching subordinates for a supervisor"""
        log_test_start("get_subordinates")
        
        # Test with Sato who should be a manager/supervisor
        supervisor_id = self.SEED_USER_IDS["sato"]
        logging.info(f"Testing subordinate lookup for supervisor ID: {supervisor_id}")
        
        try:
            subordinates = await user_repo.get_subordinates(supervisor_id)
            
            log_data_verification("subordinates", {
                "Supervisor ID": supervisor_id,
                "Subordinates Found": len(subordinates),
                "Subordinate Names": [s.name for s in subordinates]
            })
            
            # Note: May be 0 subordinates for some users, so just check structure
            assert isinstance(subordinates, list), "Should return a list of subordinates"
            if subordinates:
                assert all(hasattr(s, 'name') for s in subordinates), "All subordinates should have name attribute"
                assert all(s.status == UserStatus.ACTIVE.value for s in subordinates), "All subordinates should be active"
            
            log_assertion_success(f"Found {len(subordinates)} subordinates for supervisor")
            
        except Exception as e:
            logging.error(f"❌ Error fetching subordinates: {str(e)}")
            raise
    
    @pytest.mark.asyncio
    async def test_search_users(self, user_repo):
        """Test comprehensive user search functionality with all filtering options"""
        log_test_start("search_users")
        
        try:
            # Import required schemas for testing
            from app.schemas.common import PaginationParams
            from app.schemas.user import UserStatus
            
            # 1. Test basic search by name (Japanese characters)
            search_term = "山田"
            logging.info(f"1. Testing basic search with term: '{search_term}'")
            
            basic_search_users = await user_repo.search_users(search_term)
            
            log_data_verification("basic_search_users", {
                "Search Term": search_term,
                "Users Found": len(basic_search_users),
                "User Names": [u.name for u in basic_search_users]
            })
            
            assert len(basic_search_users) > 0, "Should find users matching search term"
            assert any(search_term in u.name for u in basic_search_users), "At least one user should match search term"
            
            # 2. Test search by employee code
            logging.info("2. Testing search by employee code")
            emp_code_search = await user_repo.search_users("EMP001")
            
            assert len(emp_code_search) > 0, "Should find user by employee code"
            assert any("EMP001" in (u.employee_code or "") for u in emp_code_search), "Should match employee code"
            
            # 3. Test search with status filtering
            logging.info("3. Testing search with status filtering")
            active_users = await user_repo.search_users(
                statuses=[UserStatus.ACTIVE]
            )
            
            assert len(active_users) > 0, "Should find active users"
            assert all(u.status == UserStatus.ACTIVE.value for u in active_users), "All users should be active"
            
            # 4. Test search with department filtering
            logging.info("4. Testing search with department filtering")
            if basic_search_users and basic_search_users[0].department_id:
                dept_id = basic_search_users[0].department_id
                dept_filtered_users = await user_repo.search_users(
                    department_ids=[dept_id]
                )
                
                assert len(dept_filtered_users) > 0, "Should find users in department"
                assert all(u.department_id == dept_id for u in dept_filtered_users), "All users should be in same department"
                
                log_data_verification("department_filtered", {
                    "Department ID": dept_id,
                    "Users Found": len(dept_filtered_users),
                    "User Names": [u.name for u in dept_filtered_users]
                })
            
            # 5. Test search with stage filtering
            logging.info("5. Testing search with stage filtering")
            if basic_search_users and basic_search_users[0].stage_id:
                stage_id = basic_search_users[0].stage_id
                stage_filtered_users = await user_repo.search_users(
                    stage_ids=[stage_id]
                )
                
                assert len(stage_filtered_users) > 0, "Should find users in stage"
                assert all(u.stage_id == stage_id for u in stage_filtered_users), "All users should be in same stage"
            
            # 6. Test search with role filtering
            logging.info("6. Testing search with role filtering")
            # Get a user with roles first
            user_with_roles = None
            for user in basic_search_users:
                if hasattr(user, 'roles') and user.roles:
                    user_with_roles = user
                    break
            
            if user_with_roles and user_with_roles.roles:
                role_id = user_with_roles.roles[0].id
                role_filtered_users = await user_repo.search_users(
                    role_ids=[role_id]
                )
                
                assert len(role_filtered_users) > 0, "Should find users with specific role"
                
                log_data_verification("role_filtered", {
                    "Role ID": role_id,
                    "Users Found": len(role_filtered_users),
                    "User Names": [u.name for u in role_filtered_users]
                })
            
            # 7. Test search with user ID filtering
            logging.info("7. Testing search with user ID filtering")
            if basic_search_users:
                specific_user_ids = [basic_search_users[0].id]
                id_filtered_users = await user_repo.search_users(
                    user_ids=specific_user_ids
                )
                
                assert len(id_filtered_users) == 1, "Should find exactly one user by ID"
                assert id_filtered_users[0].id == specific_user_ids[0], "Should match the requested user ID"
            
            # 8. Test pagination
            logging.info("8. Testing pagination")
            pagination = PaginationParams(page=1, limit=2)
            paginated_users = await user_repo.search_users(
                pagination=pagination
            )
            
            assert len(paginated_users) <= 2, "Should respect pagination limit"
            
            log_data_verification("paginated_search", {
                "Page": pagination.page,
                "Limit": pagination.limit,
                "Users Returned": len(paginated_users)
            })
            
            # 9. Test combined filtering
            logging.info("9. Testing combined filtering")
            combined_users = await user_repo.search_users(
                search_term=search_term,
                statuses=[UserStatus.ACTIVE],
                pagination=PaginationParams(page=1, limit=5)
            )
            
            if combined_users:
                assert all(u.status == UserStatus.ACTIVE.value for u in combined_users), "Combined filter should respect status"
                assert len(combined_users) <= 5, "Combined filter should respect pagination"
                assert any(search_term in u.name for u in combined_users), "Combined filter should respect search term"
            
            # 10. Test empty search (should return all users with pagination)
            logging.info("10. Testing empty search term")
            all_users_paginated = await user_repo.search_users(
                search_term="",
                pagination=PaginationParams(page=1, limit=10)
            )
            
            assert len(all_users_paginated) <= 10, "Empty search should return users with pagination"
            assert len(all_users_paginated) > 0, "Should find some users"
            
            # 11. Test search with non-existent term
            logging.info("11. Testing search with non-existent term")
            no_result_users = await user_repo.search_users("NonExistentUserName12345")
            
            assert len(no_result_users) == 0, "Should return empty list for non-existent search term"
            
            # 12. Test count functionality (fix method name)
            logging.info("12. Testing count_users method")
            total_count = await user_repo.count_users()
            active_count = await user_repo.count_users(statuses=[UserStatus.ACTIVE])
            search_count = await user_repo.count_users(search_term=search_term)
            
            assert total_count >= 0, "Total count should be non-negative"
            assert active_count >= 0, "Active count should be non-negative"
            assert search_count >= 0, "Search count should be non-negative"
            assert active_count <= total_count, "Active count should not exceed total"
            assert search_count <= total_count, "Search count should not exceed total"
            
            log_data_verification("count_verification", {
                "Total Users": total_count,
                "Active Users": active_count,
                "Search Result Count": search_count
            })
            
            # Final verification
            log_assertion_success("All search functionality tests passed successfully!")
            logging.info(f"   - Basic search: {len(basic_search_users)} users found")
            logging.info(f"   - Employee code search: {len(emp_code_search)} users found")
            logging.info(f"   - Active users: {len(active_users)} users found")
            logging.info(f"   - Pagination test: {len(paginated_users)} users returned")
            logging.info(f"   - Combined filters: {len(combined_users)} users found")
            logging.info(f"   - Total/Active/Search counts: {total_count}/{active_count}/{search_count}")
            
        except Exception as e:
            logging.error(f"❌ Error during comprehensive search testing: {str(e)}")
            logging.error(f"   Error type: {type(e).__name__}")
            raise

    @pytest.mark.asyncio
    async def test_count_users(self, user_repo):
        """Test counting users with filters"""
        log_test_start("count_users")
        
        logging.info("Testing user counting functionality")
        
        try:
            # Count all users
            total_count = await user_repo.count_users()
            
            # Count active users
            active_count = await user_repo.count_users(statuses=[UserStatus.ACTIVE])
            
            log_data_verification("count_users", {
                "Total Users": total_count,
                "Active Users": active_count
            })
            
            assert total_count >= 0, "Total count should be non-negative"
            assert active_count >= 0, "Active count should be non-negative"
            assert active_count <= total_count, "Active count should not exceed total"
            
            log_assertion_success(f"Count verification successful: {active_count}/{total_count} active users")
            
        except Exception as e:
            logging.error(f"❌ Error counting users: {str(e)}")
            raise
    
    @pytest.mark.asyncio
    async def test_get_active_users(self, user_repo):
        """Test fetching all active users"""
        log_test_start("get_active_users")
        
        logging.info("Testing active users retrieval")
        
        try:
            active_users = await user_repo.get_active_users()
            
            log_data_verification("active_users", {
                "Active Users Found": len(active_users),
                "User Names": [u.name for u in active_users][:5]  # Show first 5 names
            })
            
            assert len(active_users) > 0, "Should find at least one active user"
            assert all(u.status == UserStatus.ACTIVE.value for u in active_users), "All users should be active"
            assert all(hasattr(u, 'department') for u in active_users), "Users should have department loaded"
            assert all(hasattr(u, 'stage') for u in active_users), "Users should have stage loaded"
            assert all(hasattr(u, 'roles') for u in active_users), "Users should have roles loaded"
            
            log_assertion_success(f"Successfully retrieved {len(active_users)} active users with full details")
            
        except Exception as e:
            logging.error(f"❌ Error fetching active users: {str(e)}")
            raise

    @pytest.mark.asyncio
    async def test_create_user(self, user_repo: UserRepository, session: AsyncSession):
        """Test creating a new user."""
        log_test_start("create_user")
        
        # 1. Define new user data without a pre-set ID
        unique_part = uuid4().hex
        new_user_data = {
            "clerk_user_id": f"clerk_test_{unique_part}",
            "name": "Test User",
            "email": f"test.user.{unique_part}@example.com",
            "employee_code": f"TEST{unique_part[:4].upper()}",
            "status": UserStatus.ACTIVE.value,
            "job_title": "Tester"
        }
        
        new_user = User(**new_user_data)
        
        created_user = None
        try:
            # 2. Execute create_user method
            created_user = await user_repo.create_user(new_user)
            
            log_data_verification("created_user", {
                "User ID": created_user.id,
                "Name": created_user.name,
                "Email": created_user.email,
                "Status": created_user.status
            })
            
            # 3. Assertions
            assert created_user is not None
            assert isinstance(created_user.id, UUID) # Verify that the DB assigned a UUID
            assert created_user.name == "Test User"
            assert created_user.email == new_user_data["email"]
            
            # 4. Verify user is persisted in the database
            verified_user = await user_repo.get_user_by_id(created_user.id)
            assert verified_user is not None
            assert verified_user.name == "Test User"
            
            log_assertion_success("User creation and persistence verified.")
            
        finally:
            # 5. Cleanup
            if created_user:
                deleted = await user_repo.hard_delete_user_by_id(created_user.id)
                await session.commit()
                if deleted:
                    logging.info(f"Successfully cleaned up created user {created_user.id}")
                else:
                    logging.warning(f"Failed to clean up created user {created_user.id}")

    @pytest.mark.asyncio
    async def test_soft_delete_user(self, user_repo: UserRepository, session: AsyncSession):
        """Create a temp user, soft-delete (inactivate) it, verify status change, then clean up."""
        log_test_start("soft_delete_user")
        unique_part = uuid4().hex
        new_user = User(
            clerk_user_id=f"clerk_soft_{unique_part}",
            name="Soft Delete Temp",
            email=f"soft.temp.{unique_part}@example.com",
            employee_code=f"SOFT{unique_part[:4].upper()}",
            status=UserStatus.ACTIVE.value,
        )
        await user_repo.create_user(new_user)
        # Soft delete
        await user_repo.update_user_status(new_user.id, UserStatus.INACTIVE)
        await session.commit()
        refreshed = await user_repo.get_user_by_id(new_user.id)
        assert refreshed is not None and refreshed.status == UserStatus.INACTIVE.value
        log_assertion_success("Soft delete verified (status set to INACTIVE)")
        # Cleanup hard delete
        await user_repo.hard_delete_user_by_id(new_user.id)
        await session.commit()

    @pytest.mark.asyncio
    async def test_hard_delete_temp_user(self, user_repo: UserRepository, session: AsyncSession):
        """Create a temp user, hard delete it, verify removal."""
        log_test_start("hard_delete_temp_user")
        unique_part = uuid4().hex
        new_user = User(
            clerk_user_id=f"clerk_hard_{unique_part}",
            name="Hard Delete Temp",
            email=f"hard.temp.{unique_part}@example.com",
            employee_code=f"HARD{unique_part[:4].upper()}",
            status=UserStatus.ACTIVE.value,
        )
        await user_repo.create_user(new_user)
        # Hard delete
        deleted = await user_repo.hard_delete_user_by_id(new_user.id)
        await session.commit()
        assert deleted is True
        missing = await user_repo.get_user_by_id(new_user.id)
        assert missing is None
        log_assertion_success("Hard delete verified (user removed)")

    @pytest.mark.asyncio
    async def test_get_user_stage_with_weights_override(self, user_repo: UserRepository, session: AsyncSession):
        """Test effective weights when user-level override is set."""
        log_test_start("get_user_stage_with_weights with override")

        user_id = self.SEED_USER_IDS["yamada"]
        user = await user_repo.get_user_by_id(user_id)
        assert user is not None, "Seed user should exist"
        org_id = user.clerk_organization_id
        assert org_id, "Organization ID should exist for seed user"

        previous_overrides = (
            user.quantitative_weight_override,
            user.qualitative_weight_override,
            user.competency_weight_override,
        )

        try:
            await user_repo.set_user_goal_weight_override(
                user_id,
                org_id,
                quantitative=55,
                qualitative=35,
                competency=15,
            )
            await session.commit()

            result = await user_repo.get_user_stage_with_weights(user_id, org_id)
            assert result is not None
            assert result["source"] == "user"
            assert result["quantitative_weight"] == 55.0
            assert result["qualitative_weight"] == 35.0
            assert result["competency_weight"] == 15.0

            log_assertion_success("User override weights returned correctly")
        finally:
            if all(value is None for value in previous_overrides):
                await user_repo.clear_user_goal_weight_override(user_id, org_id)
            else:
                await user_repo.set_user_goal_weight_override(
                    user_id,
                    org_id,
                    quantitative=float(previous_overrides[0]),
                    qualitative=float(previous_overrides[1]),
                    competency=float(previous_overrides[2]),
                )
            await session.commit()


if __name__ == "__main__":
    import sys
    import inspect
    
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
                ("get_user_by_employee_code", "Get User by Employee Code", test_instance.test_get_user_by_employee_code),
                ("check_user_exists_by_clerk_id", "Check User Existence by Clerk ID", test_instance.test_check_user_exists_by_clerk_id),
                ("get_users_by_department", "Get Users by Department", test_instance.test_get_users_by_department),
                ("get_users_by_role_names", "Get Users by Role Names", test_instance.test_get_users_by_role_names),
                ("get_user_roles", "Get User Roles", test_instance.test_get_user_roles),
                ("get_user_supervisors", "Get User Supervisors", test_instance.test_get_user_supervisors),
                ("get_subordinates", "Get Subordinates", test_instance.test_get_subordinates),
                ("search_users", "Search Users", test_instance.test_search_users),
                ("count_users", "Count Users", test_instance.test_count_users),
                ("get_active_users", "Get Active Users", test_instance.test_get_active_users),
                ("create_user", "Create User", test_instance.test_create_user),
                ("soft_delete_user", "Soft Delete User", test_instance.test_soft_delete_user),
                ("hard_delete_temp_user", "Hard Delete Temp User", test_instance.test_hard_delete_temp_user),
                ("get_user_stage_with_weights_override", "Get User Stage Weights Override", test_instance.test_get_user_stage_with_weights_override),
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
                    
                    sig = inspect.signature(test_func)
                    if 'session' in sig.parameters:
                        await test_func(repo, session)
                    else:
                        await test_func(repo)
                    
                    passed_tests += 1
                    logging.info(f"✅ {test_name} - PASSED")
                    
                except Exception as e:
                    failed_tests += 1
                    logging.error(f"❌ {test_name} - FAILED: {str(e)}")
                    logging.error(f"   Error details: {type(e).__name__}")
            
            # Final summary
            logging.info(f"\n{'='*60}")
            logging.info("USER REPOSITORY TEST SUMMARY")
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
            ("get_user_by_employee_code", "Test fetching user by employee code"),
            ("check_user_exists_by_clerk_id", "Test checking user existence by Clerk ID"),
            ("get_users_by_department", "Test fetching users by department"),
            ("get_users_by_role_names", "Test fetching users by role names"),
            ("get_user_roles", "Test fetching user roles"),
            ("get_user_supervisors", "Test fetching user supervisors"),
            ("get_subordinates", "Test fetching subordinates"),
            ("search_users", "Test user search functionality"),
            ("count_users", "Test counting users with filters"),
            ("get_active_users", "Test fetching all active users"),
            ("create_user", "Test creating a user"),
            ("soft_delete_user", "Test soft deleting a user"),
            ("hard_delete_temp_user", "Test hard deleting a temp user"),
        ]
        
        for test_key, description in tests:
            print(f"  {test_key:<25} - {description}")
        
        print("\n📄 Logs will be saved to: tests/logs/user_repo_test_[timestamp].log")
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
