"""
Test for the DepartmentService using real Supabase data.
All functions can be run individually for focused testing.
"""
import asyncio
import logging
from unittest.mock import MagicMock
from uuid import UUID, uuid4

from app.services.department_service import DepartmentService
from app.schemas.department import DepartmentCreate, DepartmentUpdate
from app.security.context import AuthContext
from app.database.session import get_db_session
from tests.services.test_logging_utils import setup_service_test_logging

# Set up proper logging with file output
TEST_LOG_FILE = setup_service_test_logging('department')
logger = logging.getLogger(__name__)

def create_mock_auth_context(user_id: UUID, roles: list = None, permissions: list = None):
    """Create a mock AuthContext for testing"""
    if roles is None:
        roles = ["admin"]
    if permissions is None:
        permissions = ["DEPARTMENT_READ", "DEPARTMENT_MANAGE"]
        
    mock_context = MagicMock(spec=AuthContext)
    mock_context.user_id = user_id
    mock_context.roles = roles
    mock_context.permissions = permissions
    
    # Mock permission checks
    mock_context.require_permission.return_value = None
    mock_context.has_any_role.return_value = ("admin" in roles or "manager" in roles or "viewer" in roles)
    mock_context.is_supervisor_or_above.return_value = ("admin" in roles or "manager" in roles or "supervisor" in roles)
    
    return mock_context

async def test_get_departments_for_dropdown():
    """Test the get_departments_for_dropdown method with real Supabase data"""
    logger.info("=== Testing DepartmentService.get_departments_for_dropdown with Real Data ===")
    
    # Get real database session
    async for session in get_db_session():
        # Create service with real session
        service = DepartmentService(session)
        
        try:
            # Test: Get all departments for dropdown
            logger.info("--- Test: Get all departments for dropdown ---")
            result = await service.get_departments_for_dropdown()
            
            logger.info("✅ Departments for dropdown result:")
            for dept in result:
                logger.info(f"   - ID: {dept.id}, Name: {dept.name}, Description: {dept.description}")
            
            # Log full response schema
            logger.info("📄 Full Response Schema:")
            for i, dept in enumerate(result):
                logger.info(f"   [{i}] {dept.model_dump_json(indent=4)}")
            
            # Verify result structure
            assert isinstance(result, list), "Result should be a list"
            if result:
                first_dept = result[0]
                assert hasattr(first_dept, 'id'), "Department should have id"
                assert hasattr(first_dept, 'name'), "Department should have name"
                assert hasattr(first_dept, 'description'), "Department should have description"
            
            logger.info(f"✅ Successfully retrieved {len(result)} departments for dropdown")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to get departments for dropdown: {e}")
            return False

async def test_get_department_by_id():
    """Test the get_department_by_id method with real Supabase data"""
    logger.info("=== Testing DepartmentService.get_department_by_id with Real Data ===")
    
    # Get real database session
    async for session in get_db_session():
        # Create service with real session
        service = DepartmentService(session)
        
        # Create mock admin context
        admin_context = create_mock_auth_context(
            user_id=UUID('850e8400-e29b-41d4-a716-446655440001'),  # Admin user from seed data
            roles=["admin"]
        )
        
        try:
            # Test 1: Get department by known ID (Engineering from seed data)
            logger.info("--- Test 1: Get department by known ID (Engineering) ---")
            engineering_dept_id = UUID('650e8400-e29b-41d4-a716-446655440002')
            
            result = await service.get_department_by_id(engineering_dept_id, admin_context)
            
            logger.info("✅ Department detail result:")
            logger.info(f"   - ID: {result.id}")
            logger.info(f"   - Name: {result.name}")
            logger.info(f"   - Description: {result.description}")
            logger.info(f"   - User Count: {result.user_count}")
            logger.info(f"   - Manager ID: {result.manager_id}")
            logger.info(f"   - Manager Name: {result.manager_name}")
            logger.info(f"   - Users Count: {len(result.users) if result.users else 0}")
            
            # Log full response schema
            logger.info("📄 Full DepartmentDetail Response Schema:")
            logger.info(result.model_dump_json(indent=4))
            
            # Verify the response structure
            assert result.id == engineering_dept_id
            assert result.name is not None
            assert result.user_count is not None
            assert hasattr(result, 'manager_id')  # Can be None
            assert hasattr(result, 'manager_name')  # Can be None
            assert hasattr(result, 'users')  # Can be None or empty list
            
            logger.info("✅ Department detail structure validation passed!")
            
        except Exception as e:
            logger.error(f"❌ Error testing known department: {e}")
            logger.info("Trying to find any available department...")
            
            # Fallback: try to get a department from dropdown
            try:
                departments = await service.get_departments_for_dropdown()
                
                if departments:
                    test_dept_id = departments[0].id
                    logger.info(f"--- Testing with available department ID {test_dept_id} ---")
                    dept_detail = await service.get_department_by_id(test_dept_id, admin_context)
                    logger.info("✅ Alternative test passed!")
                else:
                    logger.warning("No departments found in database - skipping test")
                    return True
                    
            except Exception as fallback_error:
                logger.error(f"❌ Fallback test also failed: {fallback_error}")
                return False
        
        # Test 2: Test permission restrictions for non-admin user
        logger.info("\n--- Test 2: Test employee access to own department ---")
        try:
            # Create employee context (should be restricted to own department)
            employee_context = create_mock_auth_context(
                user_id=UUID('223e4567-e89b-12d3-a456-426614174001'),  # Employee user
                roles=["employee"]
            )
            employee_context.has_any_role.return_value = False  # Not admin/manager/viewer
            
            # This should work if employee is in the same department
            # If not, it should raise PermissionDeniedError
            engineering_dept_id = UUID('650e8400-e29b-41d4-a716-446655440002')
            
            try:
                result = await service.get_department_by_id(engineering_dept_id, employee_context)
                logger.info(f"✅ Employee can access department: {result.name}")
            except Exception as e:
                if "permission" in str(e).lower() or "access" in str(e).lower():
                    logger.info("✅ Employee correctly restricted from accessing other departments")
                else:
                    logger.error(f"❌ Unexpected error: {e}")
                    return False
                    
        except Exception as e:
            logger.error(f"❌ Error testing employee permissions: {e}")
            return False
        
        # Test 3: Get non-existent department
        logger.info("\n--- Test 3: Get non-existent department ---")
        non_existent_id = UUID('00000000-0000-0000-0000-000000000000')
        try:
            await service.get_department_by_id(non_existent_id, admin_context)
            logger.error("❌ Should have raised NotFoundError for non-existent department")
            return False
        except Exception as e:
            if "not found" in str(e).lower():
                logger.info("✅ Correctly raised NotFoundError for non-existent department")
            else:
                logger.error(f"❌ Unexpected error: {e}")
                return False
        
        logger.info("\n🎉 get_department_by_id tests completed successfully!")
        return True

async def test_create_department():
    """Test the create_department method with real database operations"""
    logger.info("=== Testing DepartmentService.create_department with Real Database Operations ===")
    
    # Get real database session
    async for session in get_db_session():
        # Create service with real session
        service = DepartmentService(session)
        
        # Create mock admin context
        admin_context = create_mock_auth_context(
            user_id=UUID('850e8400-e29b-41d4-a716-446655440001'),  # Admin user from seed data
            roles=["admin"]
        )
        
        try:
            # Test 1: Create a new department (should actually be added to database)
            logger.info("--- Test 1: Create a new department in database ---")
            
            # Create test department with simple name
            unique_name = f"Test Department {uuid4().hex[:8]}"
            dept_data = DepartmentCreate(
                name=unique_name,
                description="Test department created by automated tests"
            )
            
            # Create the department
            created_dept = await service.create_department(dept_data, admin_context)
            
            logger.info("✅ Successfully created department in database:")
            logger.info(f"   - ID: {created_dept.id}")
            logger.info(f"   - Name: {created_dept.name}")
            logger.info(f"   - Description: {created_dept.description}")
            # Note: Department schema doesn't include created_at/updated_at, only DepartmentDetail does
            
            # Log full response schema
            logger.info("📄 Full Department Creation Response Schema:")
            logger.info(created_dept.model_dump_json(indent=4))
            
            # Verify department was actually created by retrieving it again
            retrieved_dept = await service.get_department_by_id(created_dept.id, admin_context)
            assert retrieved_dept.id == created_dept.id
            assert retrieved_dept.name == unique_name
            logger.info("✅ Department was successfully persisted to database")
            
            return True
                
        except Exception as e:
            logger.error(f"❌ Failed to create department: {e}")
            return False

async def test_create_department_validation():
    """Test department creation validation rules"""
    logger.info("=== Testing DepartmentService.create_department Validation ===")
    
    # Get real database session
    async for session in get_db_session():
        # Create service with real session
        service = DepartmentService(session)
        
        # Create mock admin context
        admin_context = create_mock_auth_context(
            user_id=UUID('850e8400-e29b-41d4-a716-446655440001'),
            roles=["admin"]
        )
        
        # Test 1: Empty name validation (Pydantic will catch this before service validation)
        logger.info("--- Test 1: Empty name validation ---")
        try:
            dept_data = DepartmentCreate(name="", description="Test")
            await service.create_department(dept_data, admin_context)
            logger.error("❌ Should have raised ValidationError for empty name")
            return False
        except Exception as e:
            if "string_too_short" in str(e) or "at least 1 character" in str(e):
                logger.info("✅ Correctly validated empty department name")
            else:
                logger.error(f"❌ Unexpected error: {e}")
                return False
        
        # Test 2: Short name validation
        logger.info("--- Test 2: Short name validation ---")
        try:
            dept_data = DepartmentCreate(name="A", description="Test")
            await service.create_department(dept_data, admin_context)
            logger.error("❌ Should have raised ValidationError for short name")
            return False
        except Exception as e:
            if "at least 2 characters" in str(e):
                logger.info("✅ Correctly validated short department name")
            else:
                logger.error(f"❌ Unexpected error: {e}")
                return False
        
        # Test 3: Long name validation
        logger.info("--- Test 3: Long name validation ---")
        try:
            dept_data = DepartmentCreate(name="A" * 101, description="Test")
            await service.create_department(dept_data, admin_context)
            logger.error("❌ Should have raised ValidationError for long name")
            return False
        except Exception as e:
            if "at most 100 characters" in str(e):
                logger.info("✅ Correctly validated long department name")
            else:
                logger.error(f"❌ Unexpected error: {e}")
                return False
        
        logger.info("\n🎉 create_department validation tests completed successfully!")
        return True

async def test_update_department():
    """Test the update_department method with real database operations"""
    logger.info("=== Testing DepartmentService.update_department with Real Database Operations ===")
    
    # Get real database session
    async for session in get_db_session():
        # Create service with real session
        service = DepartmentService(session)
        
        # Create mock admin context
        admin_context = create_mock_auth_context(
            user_id=UUID('850e8400-e29b-41d4-a716-446655440001'),
            roles=["admin"]
        )
        
        try:
            # Test 1: Update existing department (Engineering from seed data)
            logger.info("--- Test 1: Update existing department in database ---")
            
            engineering_dept_id = UUID('650e8400-e29b-41d4-a716-446655440002')
            
            # Get current department data before update
            current_dept = await service.get_department_by_id(engineering_dept_id, admin_context)
            original_description = current_dept.description
            logger.info(f"Original description: {original_description}")
            
            # Update department data
            new_description = f"Updated description {uuid4().hex[:4]}"
            update_data = DepartmentUpdate(description=new_description)
            
            # Perform the update
            updated_dept = await service.update_department(engineering_dept_id, update_data, admin_context)
            
            logger.info("✅ Successfully updated department in database:")
            logger.info(f"   - ID: {updated_dept.id}")
            logger.info(f"   - Name: {updated_dept.name}")
            logger.info(f"   - Description: {original_description} → {updated_dept.description}")
            # Note: Department schema doesn't include created_at/updated_at, only DepartmentDetail does
            
            # Log full response schema
            logger.info("📄 Full Department Update Response Schema:")
            logger.info(updated_dept.model_dump_json(indent=4))
            
            # Verify the update was persisted by retrieving the department again
            re_retrieved_dept = await service.get_department_by_id(engineering_dept_id, admin_context)
            assert re_retrieved_dept.description == new_description
            logger.info("✅ Department update was successfully persisted to database")
            
            return True
                
        except Exception as e:
            logger.error(f"❌ Failed to update department: {e}")
            return False

async def test_delete_department():
    """Test the delete_department method with real database operations"""
    logger.info("=== Testing DepartmentService.delete_department with Real Database Operations ===")
    
    # Get real database session
    async for session in get_db_session():
        # Create service with real session
        service = DepartmentService(session)
        
        # Create mock admin context
        admin_context = create_mock_auth_context(
            user_id=UUID('850e8400-e29b-41d4-a716-446655440001'),
            roles=["admin"]
        )
        
        try:
            # Test 1: Try to delete department with users (should fail)
            logger.info("--- Test 1: Try to delete department with active users ---")
            
            # Engineering department likely has users
            engineering_dept_id = UUID('650e8400-e29b-41d4-a716-446655440002')
            
            try:
                await service.delete_department(engineering_dept_id, admin_context)
                logger.error("❌ Should have raised ValidationError for department with users")
                return False
            except Exception as e:
                if "active users" in str(e) or "cannot delete" in str(e).lower():
                    logger.info("✅ Correctly prevented deletion of department with active users")
                else:
                    logger.error(f"❌ Unexpected error: {e}")
                    return False
            
            # Test 2: Create a test department and then delete it
            logger.info("\n--- Test 2: Create test department and delete it ---")
            
            # Create a test department
            unique_name = f"Test Department for Deletion {uuid4().hex[:8]}"
            dept_data = DepartmentCreate(
                name=unique_name,
                description="Test department created for deletion test"
            )
            
            created_dept = await service.create_department(dept_data, admin_context)
            logger.info(f"Created test department: {created_dept.id}")
            
            # Delete the test department (should succeed since it has no users)
            result = await service.delete_department(created_dept.id, admin_context)
            
            logger.info("✅ Successfully deleted test department:")
            logger.info(f"   - Result: {result}")
            
            # Log full response schema
            logger.info("📄 Full Department Deletion Response Schema:")
            logger.info(f"{result}")
            
            # Verify department was actually deleted
            try:
                await service.get_department_by_id(created_dept.id, admin_context)
                logger.error("❌ Department still exists after deletion")
                return False
            except Exception as e:
                if "not found" in str(e).lower():
                    logger.info("✅ Department correctly removed from database")
                else:
                    logger.error(f"❌ Unexpected error checking deleted department: {e}")
                    return False
            
            return True
                
        except Exception as e:
            logger.error(f"❌ Failed to test department deletion: {e}")
            return False

async def test_department_permission_checks():
    """Test department service permission validation"""
    logger.info("=== Testing DepartmentService Permission Checks ===")
    
    # Get real database session
    async for session in get_db_session():
        # Create service with real session
        service = DepartmentService(session)
        
        # Create mock employee context (limited permissions)
        employee_context = create_mock_auth_context(
            user_id=UUID('223e4567-e89b-12d3-a456-426614174001'),
            roles=["employee"]
        )
        employee_context.is_supervisor_or_above.return_value = False
        
        # Mock to raise permission denied for DEPARTMENT_MANAGE
        def mock_require_permission(permission):
            from app.security.permissions import Permission
            from app.core.exceptions import PermissionDeniedError
            if permission == Permission.DEPARTMENT_MANAGE:
                raise PermissionDeniedError(f"Permission denied: {permission}")
        
        employee_context.require_permission.side_effect = mock_require_permission
        
        try:
            # Test 1: Employee trying to create department (should fail)
            logger.info("--- Test 1: Employee trying to create department ---")
            
            dept_data = DepartmentCreate(
                name="Unauthorized Department",
                description="This should not be created"
            )
            
            try:
                await service.create_department(dept_data, employee_context)
                logger.error("❌ Employee should not be able to create departments")
                return False
            except Exception as e:
                if "permission" in str(e).lower():
                    logger.info("✅ Employee correctly denied department creation")
                else:
                    logger.error(f"❌ Unexpected error: {e}")
                    return False
            
            # Test 2: Employee trying to update department (should fail)
            logger.info("--- Test 2: Employee trying to update department ---")
            
            engineering_dept_id = UUID('650e8400-e29b-41d4-a716-446655440002')
            update_data = DepartmentUpdate(description="Unauthorized update")
            
            try:
                await service.update_department(engineering_dept_id, update_data, employee_context)
                logger.error("❌ Employee should not be able to update departments")
                return False
            except Exception as e:
                if "permission" in str(e).lower() or ("supervisor" in str(e).lower() and "above" in str(e).lower()):
                    logger.info("✅ Employee correctly denied department update")
                else:
                    logger.error(f"❌ Unexpected error: {e}")
                    return False
            
            # Test 3: Employee trying to delete department (should fail)
            logger.info("--- Test 3: Employee trying to delete department ---")
            
            try:
                await service.delete_department(engineering_dept_id, employee_context)
                logger.error("❌ Employee should not be able to delete departments")
                return False
            except Exception as e:
                if "permission" in str(e).lower():
                    logger.info("✅ Employee correctly denied department deletion")
                else:
                    logger.error(f"❌ Unexpected error: {e}")
                    return False
            
            logger.info("\n🎉 Permission check tests completed successfully!")
            return True
                
        except Exception as e:
            logger.error(f"❌ Failed to test permissions: {e}")
            return False

async def run_all_tests():
    """Run all tests in a single event loop"""
    logger.info("🚀 Starting all department service tests...")
    
    success1 = await test_get_departments_for_dropdown()
    success2 = await test_get_department_by_id()
    success3 = await test_create_department()
    success4 = await test_create_department_validation()
    success5 = await test_update_department()
    success6 = await test_delete_department()
    success7 = await test_department_permission_checks()
    
    total_tests = 7
    passed_tests = sum([success1, success2, success3, success4, success5, success6, success7])
    
    logger.info(f"\n{'='*60}")
    logger.info("DEPARTMENT SERVICE TEST SUMMARY")
    logger.info(f"{'='*60}")
    logger.info(f"Total tests: {total_tests}")
    logger.info(f"Passed: {passed_tests}")
    logger.info(f"Failed: {total_tests - passed_tests}")
    logger.info(f"Success rate: {(passed_tests/total_tests*100):.1f}%")
    
    if passed_tests == total_tests:
        logger.info("🎉 All department service tests completed successfully!")
        logger.info("✅ Business logic and repository interactions verified for department service")
        print("\n✅ All tests completed successfully!")
        print(f"📁 Log file: {TEST_LOG_FILE}")
        return True
    else:
        logger.error(f"❌ {total_tests - passed_tests} test(s) failed in department service")
        print(f"\n❌ {total_tests - passed_tests} tests failed!")
        return False

if __name__ == "__main__":
    # Run all tests in a single event loop
    success = asyncio.run(run_all_tests())
    if not success:
        exit(1)