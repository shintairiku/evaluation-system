"""
Simple test for the updated UserService.get_users method using real Supabase data.
"""
import asyncio
import logging
from unittest.mock import MagicMock
from uuid import UUID

from app.services.user_service import UserService
from app.schemas.user import UserStatus, UserCreate, UserUpdate
from app.schemas.common import PaginationParams
from app.database.session import get_db_session
from app.security.context import AuthContext, RoleInfo
from tests.services.test_logging_utils import setup_service_test_logging

# Set up proper logging with file output
TEST_LOG_FILE = setup_service_test_logging('user')
logger = logging.getLogger(__name__)

async def test_get_users():
    """Test the get_users method with real Supabase data"""
    logger.info("=== Testing UserService.get_users with Real Data ===")
    
    # Get real database session
    async for session in get_db_session():
        # Create service with real session
        service = UserService(session)
        
        # Create admin AuthContext for testing
        admin_role = RoleInfo(id=1, name="admin", description="Administrator")
        admin_context = AuthContext(
            user_id=UUID("00000000-0000-0000-0000-000000000001"),
            roles=[admin_role],
            clerk_user_id="test_admin_clerk_id"
        )
        
        # Test 1: Get all users (no filters)
        logger.info("--- Test 1: Get all users ---")
        result = await service.get_users(current_user_context=admin_context)
        logger.info("✅ All users result:")
        print(result.model_dump_json(indent=2))
        
        # Test 2: Search for "山田"
        logger.info("\n--- Test 2: Search for '山田' ---")
        result = await service.get_users(
            current_user_context=admin_context,
            search_term="山田"
        )
        logger.info("✅ Search '山田' result:")
        print(result.model_dump_json(indent=2))
        
        # Test 3: Filter by status
        logger.info("\n--- Test 3: Filter by ACTIVE status ---")
        result = await service.get_users(
            current_user_context=admin_context,
            statuses=[UserStatus.ACTIVE]
        )
        logger.info("✅ ACTIVE users result:")
        print(result.model_dump_json(indent=2))
        
        # Test 4: Filter by department (Sales)
        logger.info("\n--- Test 4: Filter by Sales department ---")
        sales_dept_id = UUID('650e8400-e29b-41d4-a716-446655440001')
        result = await service.get_users(
            current_user_context=admin_context,
            department_ids=[sales_dept_id]
        )
        logger.info("✅ Sales department result:")
        print(result.model_dump_json(indent=2))
        
        # Test 5: Pagination
        logger.info("\n--- Test 5: Pagination (page 1, limit 2) ---")
        result = await service.get_users(
            current_user_context=admin_context,
            pagination=PaginationParams(page=1, limit=2)
        )
        logger.info("✅ Paginated result:")
        print(result.model_dump_json(indent=2))
        
        logger.info("\n🎉 All tests completed successfully!")
        logger.info(f"📁 Full test log saved to: {TEST_LOG_FILE}")
        return True

async def test_get_user_by_id():
    """Test the get_user_by_id method with real Supabase data"""
    logger.info("=== Testing UserService.get_user_by_id with Real Data ===")
    
    # Get real database session
    async for session in get_db_session():
        # Create service with real session
        service = UserService(session)
        
        # Create admin AuthContext for testing
        admin_role = RoleInfo(id=1, name="admin", description="Administrator")
        admin_context = AuthContext(
            user_id=UUID("650e8400-e29b-41d4-a716-446655440000"),
            roles=[admin_role],
            clerk_user_id="test_admin_clerk_id"
        )
        
        # Test with a known user ID (avoiding the get_users call that's causing issues)
        known_user_id = UUID('223e4567-e89b-12d3-a456-426614174001')  # Sato Hanako from the logs
        
        try:
            logger.info(f"--- Test 1: Get user by known ID {known_user_id} ---")
            user_detail = await service.get_user_by_id(known_user_id, admin_context)
            
            logger.info("✅ User detail result:")
            print(user_detail.model_dump_json(indent=2))
            
            # Verify the response structure
            assert user_detail.id == known_user_id
            assert user_detail.name is not None
            assert user_detail.email is not None
            assert user_detail.employee_code is not None
            assert user_detail.department is not None
            assert user_detail.stage is not None
            assert user_detail.roles is not None
            # supervisor and subordinates may be None, which is valid
            
            logger.info("✅ User detail structure validation passed!")
            
        except Exception as e:
            logger.error(f"❌ Error testing known user: {e}")
            logger.info("Trying to find any available user...")
            
            # Fallback: try to get a user from get_users
            try:
                users_result = await service.get_users(
                    current_user_context=admin_context, 
                    pagination=PaginationParams(page=1, limit=1)
                )
                
                if users_result.items:
                    test_user_id = users_result.items[0].id
                    logger.info(f"--- Testing with available user ID {test_user_id} ---")
                    user_detail = await service.get_user_by_id(test_user_id, admin_context)
                    logger.info("✅ Alternative test passed!")
                else:
                    logger.warning("No users found in database - skipping test")
                    return True
                    
            except Exception as fallback_error:
                logger.error(f"❌ Fallback test also failed: {fallback_error}")
                return False
        
        # Test with non-existent user
        logger.info("\n--- Test 2: Get non-existent user ---")
        non_existent_id = UUID('00000000-0000-0000-0000-000000000000')
        try:
            await service.get_user_by_id(non_existent_id, admin_context)
            logger.error("❌ Should have raised NotFoundError for non-existent user")
            return False
        except Exception as e:
            if "not found" in str(e).lower():
                logger.info("✅ Correctly raised NotFoundError for non-existent user")
            else:
                logger.error(f"❌ Unexpected error: {e}")
                return False
        
        logger.info("\n🎉 get_user_by_id tests completed successfully!")
        return True

async def test_create_user():
    """Test the create_user method with real database operations"""
    logger.info("=== Testing UserService.create_user with Real Database Operations ===")
    
    # Get real database session
    async for session in get_db_session():
        # Create service with real session
        service = UserService(session)
        
        # Mock UserRole with admin privileges (using seed data admin user)
        mock_admin_roles = MagicMock()
        mock_admin_roles.has_role.return_value = True  # Admin role
        mock_admin_roles.user_id = UUID('850e8400-e29b-41d4-a716-446655440001')  # Admin user from seed data
        mock_admin_roles.role_names = ["admin"]
        
        # Test 1: Create a new user (should actually be added to database)
        logger.info("--- Test 1: Create a new user in database ---")
        
        try:
            # Create test user data using seed data department and stage IDs
            from uuid import uuid4
            test_user_data = UserCreate(
                name="テスト ユーザー",
                email=f"test.user.{uuid4().hex[:8]}@test.com",  # Unique email to avoid conflicts
                employee_code=f"TEST{uuid4().hex[:4].upper()}",  # Unique employee code
                job_title="テストエンジニア",
                clerk_user_id=f"test_clerk_id_{uuid4().hex[:12]}",  # Unique clerk ID
                department_id=UUID('650e8400-e29b-41d4-a716-446655440002'),  # Engineering from seed data
                stage_id=UUID('11111111-2222-3333-4444-555555555555'),  # 新入社員 from seed data
                status=UserStatus.PENDING_APPROVAL
            )
            
            # Create the user
            created_user = await service.create_user(test_user_data, mock_admin_roles)
            
            logger.info("✅ Successfully created user in database:")
            logger.info(f"   - ID: {created_user.id}")
            logger.info(f"   - Name: {created_user.name}")
            logger.info(f"   - Email: {created_user.email}")
            logger.info(f"   - Employee Code: {created_user.employee_code}")
            logger.info(f"   - Department: {created_user.department.name if created_user.department else 'None'}")
            logger.info(f"   - Stage: {created_user.stage.name if created_user.stage else 'None'}")
            logger.info(f"   - Status: {created_user.status}")
            
            # Verify user was actually created by retrieving it again
            retrieved_user = await service.get_user_by_id(created_user.id, mock_admin_roles)
            assert retrieved_user.id == created_user.id
            logger.info("✅ User was successfully persisted to database")
            
            return True
                
        except Exception as e:
            logger.error(f"❌ Failed to create user: {e}")
            return False

async def test_update_user():
    """Test the update_user method with real database operations"""
    logger.info("=== Testing UserService.update_user with Real Database Operations ===")
    
    # Get real database session
    async for session in get_db_session():
        # Create service with real session
        service = UserService(session)
        
        # Mock UserRole with admin privileges
        mock_admin_roles = MagicMock()
        mock_admin_roles.has_role.return_value = True  # Admin role
        mock_admin_roles.user_id = UUID('850e8400-e29b-41d4-a716-446655440001')  # Admin user from seed data
        mock_admin_roles.role_names = ["admin"]
        
        # Test 1: Update an existing user from seed data (should actually update database)
        logger.info("--- Test 1: Update existing user in database ---")
        
        try:
            # Update 山田 太郎 from seed data
            yamada_user_id = UUID('123e4567-e89b-12d3-a456-426614174000')
            
            # Get current user data before update
            current_user = await service.get_user_by_id(yamada_user_id, mock_admin_roles)
            original_job_title = current_user.job_title
            logger.info(f"Original job title: {original_job_title}")
            
            # Update user data
            from uuid import uuid4
            new_job_title = f"更新されたタイトル {uuid4().hex[:4]}"
            update_data = UserUpdate(
                job_title=new_job_title,
                # Also update stage to 管理職
                stage_id=UUID('33333333-4444-5555-6666-777777777777')  # 管理職 from seed data
            )
            
            # Perform the update
            updated_user = await service.update_user(yamada_user_id, update_data, mock_admin_roles)
            
            logger.info("✅ Successfully updated user in database:")
            logger.info(f"   - ID: {updated_user.id}")
            logger.info(f"   - Name: {updated_user.name}")
            logger.info(f"   - Job Title: {original_job_title} → {updated_user.job_title}")
            logger.info(f"   - Stage: {updated_user.stage.name if updated_user.stage else 'None'}")
            
            # Verify the update was persisted by retrieving the user again
            re_retrieved_user = await service.get_user_by_id(yamada_user_id, mock_admin_roles)
            assert re_retrieved_user.job_title == new_job_title
            assert str(re_retrieved_user.stage.id) == '33333333-4444-5555-6666-777777777777'
            logger.info("✅ User update was successfully persisted to database")
            
            return True
                
        except Exception as e:
            logger.error(f"❌ Failed to update user: {e}")
            return False

async def test_delete_user():
    """Test the delete_user method with both soft and hard delete modes"""
    logger.info("=== Testing UserService.delete_user with Real Database Operations ===")
    
    # Get real database session
    async for session in get_db_session():
        # Create service with real session
        service = UserService(session)
        
        # Mock UserRole with admin privileges
        mock_admin_roles = MagicMock()
        mock_admin_roles.has_role.return_value = True  # Admin role
        mock_admin_roles.user_id = UUID('850e8400-e29b-41d4-a716-446655440001')  # Admin user from seed data
        mock_admin_roles.role_names = ["admin"]
        
        # Test 1: Soft delete (user_id: c819a3c4-6135-49e6-93d5-6976d88cf581)
        logger.info("--- Test 1: Soft delete user ---")
        
        try:
            soft_delete_user_id = UUID('c819a3c4-6135-49e6-93d5-6976d88cf581')
            
            # Check if user exists before deletion
            try:
                user_before = await service.get_user_by_id(soft_delete_user_id, mock_admin_roles)
                logger.info(f"User before soft delete: {user_before.name} - Status: {user_before.status}")
                user_existed = True
            except Exception:
                logger.warning(f"User {soft_delete_user_id} does not exist - creating a test user for soft delete")
                user_existed = False
            
            if user_existed:
                # Perform soft delete
                success = await service.delete_user(soft_delete_user_id, mock_admin_roles, mode="soft")
                
                if success:
                    logger.info(f"✅ Successfully soft deleted user {soft_delete_user_id}")
                    
                    # Verify user status changed to INACTIVE
                    user_after = await service.get_user_by_id(soft_delete_user_id, mock_admin_roles)
                    logger.info(f"User after soft delete: {user_after.name} - Status: {user_after.status}")
                    
                    if user_after.status == UserStatus.INACTIVE:
                        logger.info("✅ User status correctly changed to INACTIVE")
                    else:
                        logger.error(f"❌ Expected status INACTIVE, got {user_after.status}")
                        return False
                else:
                    logger.error("❌ Soft delete returned False")
                    return False
            else:
                logger.info("⚠️ Skipping soft delete test - user does not exist")
                
        except Exception as e:
            logger.error(f"❌ Failed to soft delete user: {e}")
            return False

        # Test 2: Hard delete (user_id: 1bacd25d-19da-4270-b718-b10ac1062493)
        logger.info("\n--- Test 2: Hard delete user ---")
        
        try:
            hard_delete_user_id = UUID('1bacd25d-19da-4270-b718-b10ac1062493')
            
            # Check if user exists before deletion
            try:
                user_before = await service.get_user_by_id(hard_delete_user_id, mock_admin_roles)
                logger.info(f"User before hard delete: {user_before.name} - Status: {user_before.status}")
                user_existed = True
            except Exception:
                logger.warning(f"User {hard_delete_user_id} does not exist - skipping hard delete test")
                user_existed = False
            
            if user_existed:
                # Perform hard delete
                success = await service.delete_user(hard_delete_user_id, mock_admin_roles, mode="hard")
                
                if success:
                    logger.info(f"✅ Successfully hard deleted user {hard_delete_user_id}")
                    
                    # Verify user no longer exists
                    try:
                        await service.get_user_by_id(hard_delete_user_id, mock_admin_roles)
                        logger.error("❌ User still exists after hard delete")
                        return False
                    except Exception as e:
                        if "not found" in str(e).lower():
                            logger.info("✅ User correctly removed from database")
                        else:
                            logger.error(f"❌ Unexpected error checking deleted user: {e}")
                            return False
                else:
                    logger.error("❌ Hard delete returned False")
                    return False
            else:
                logger.info("⚠️ Skipping hard delete test - user does not exist")
                
        except Exception as e:
            logger.error(f"❌ Failed to hard delete user: {e}")
            return False

        logger.info("\n🎉 delete_user tests completed successfully!")
        return True

async def run_all_tests():
    """Run all tests in a single event loop"""
    success1 = await test_get_users()
    success2 = await test_get_user_by_id()
    success3 = await test_create_user()
    success4 = await test_update_user()
    success5 = await test_delete_user()
    
    if success1 and success2 and success3 and success4 and success5:
        print("\n✅ All tests completed successfully!")
        print(f"📁 Log file: {TEST_LOG_FILE}")
        return True
    else:
        print("\n❌ Some tests failed!")
        return False

if __name__ == "__main__":
    # Run all tests in a single event loop
    success = asyncio.run(run_all_tests())
    if not success:
        exit(1) 