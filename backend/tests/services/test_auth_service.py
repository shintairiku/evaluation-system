import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.auth_service import AuthService
from app.database.session import get_db_session
from tests.services.test_logging_utils import (
    setup_service_test_logging,
    log_test_start,
    log_test_failure,
    log_service_operation
)

# Setup logging for auth service tests
TEST_LOG_FILE = setup_service_test_logging('auth')


@pytest.mark.asyncio
async def test_get_profile_options():
    """Test AuthService.get_profile_options() fetches actual data from database."""
    test_name = "test_get_profile_options"
    log_test_start(test_name)
    
    try:
        # Use real database session
        session_gen = get_db_session()
        session: AsyncSession = await session_gen.__anext__()
        
        try:
            log_service_operation("Creating AuthService with real DB session")
            auth_service = AuthService(session=session)
            
            # Act - call actual service method
            log_service_operation("Calling get_profile_options()")
            result = await auth_service.get_profile_options()
            
            # Print the actual result for verification
            print("\n" + "="*60)
            print("ACTUAL RESULT FROM auth_service.get_profile_options():")
            print("="*60)
            print(f"Departments ({len(result.departments)}):")
            for dept in result.departments:
                print(f"  - {dept.name} (ID: {dept.id})")
            
            print(f"\nStages ({len(result.stages)}):")
            for stage in result.stages:
                print(f"  - {stage.name} (ID: {stage.id})")
            
            print(f"\nRoles ({len(result.roles)}):")
            for role in result.roles:
                print(f"  - {role.name} (ID: {role.id})")
            
            print(f"\nUsers ({len(result.users)}):")
            for user in result.users:
                user_roles = [role.name for role in user.roles]
                print(f"  - {user.name} ({user.employee_code}) - Roles: {user_roles}")
            
            print("="*60)
            
        finally:
            await session.close()
            await session_gen.aclose()
            
    except Exception as e:
        log_test_failure(test_name, e)
        raise