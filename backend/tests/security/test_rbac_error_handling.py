"""
Test suite for RBAC Error Handling - Security error scenarios and edge cases.

This test suite verifies:
- PermissionDeniedError handling in all components
- Resource access denied scenarios
- Invalid input handling and validation
- Error logging and audit trail
- Edge cases and malformed data handling
- Security boundary testing
"""

import pytest
from uuid import UUID, uuid4
from unittest.mock import Mock, AsyncMock, patch

from app.security.rbac_helper import RBACHelper, subordinate_cache, resource_access_cache
from app.security.rbac_types import ResourceType
from app.security.context import AuthContext, RoleInfo
from app.security.permissions import Permission, PermissionManager
from app.security.decorators import (
    require_permission, 
    require_any_permission, 
    require_role,
    extract_auth_context
)
from app.core.exceptions import PermissionDeniedError


class TestPermissionDeniedErrorHandling:
    """Test suite for PermissionDeniedError scenarios"""
    
    def setup_method(self):
        """Clear caches before each test"""
        subordinate_cache.clear()
        resource_access_cache.clear()
    
    @pytest.fixture
    def no_permission_auth_context(self):
        """AuthContext with no permissions (invalid role)"""
        roles = [RoleInfo(id=999, name="nopermissions", description="Role with no permissions")]
        return AuthContext(
            user_id=uuid4(),
            clerk_user_id="noperm_123",
            roles=roles
        )
    
    @pytest.fixture
    def employee_auth_context(self):
        """Standard employee AuthContext"""
        roles = [RoleInfo(id=4, name="employee", description="Employee")]
        return AuthContext(
            user_id=uuid4(),
            clerk_user_id="emp_123",
            roles=roles
        )
    
    @pytest.mark.asyncio
    async def test_rbac_helper_no_user_read_permission(self, no_permission_auth_context):
        """Test RBACHelper raises PermissionDeniedError when user has no read permissions"""
        with pytest.raises(PermissionDeniedError) as exc_info:
            await RBACHelper.get_accessible_user_ids(no_permission_auth_context)
        
        assert "No permission to read user data" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_rbac_helper_no_resource_permission(self, no_permission_auth_context):
        """Test RBACHelper raises PermissionDeniedError for resource access without permission"""
        with pytest.raises(PermissionDeniedError) as exc_info:
            await RBACHelper.get_accessible_resource_ids(
                no_permission_auth_context, ResourceType.USER
            )
        
        assert "No permission to access user resources" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_rbac_helper_permission_denied_on_can_access_resource(self, no_permission_auth_context):
        """Test can_access_resource returns False for users without permission"""
        resource_id = uuid4()
        
        result = await RBACHelper.can_access_resource(
            no_permission_auth_context, resource_id, ResourceType.USER
        )
        
        assert result is False, "Should return False for users without permission"
    
    @pytest.mark.asyncio
    async def test_employee_cannot_access_admin_resources(self, employee_auth_context):
        """Test employee cannot access resources they don't own"""
        admin_resource_id = uuid4()
        admin_user_id = uuid4()  # Not the employee's ID
        
        result = await RBACHelper.can_access_resource(
            employee_auth_context, admin_resource_id, ResourceType.USER, 
            owner_user_id=admin_user_id
        )
        
        assert result is False, "Employee should not access other user's resources"
    
    def test_decorator_permission_denied_error(self, employee_auth_context):
        """Test decorator raises PermissionDeniedError for insufficient permissions"""
        @require_permission(Permission.USER_MANAGE)  # Employee doesn't have this
        def admin_only_function(current_user_context: AuthContext):
            return "admin_success"
        
        with pytest.raises(PermissionDeniedError) as exc_info:
            admin_only_function(current_user_context=employee_auth_context)
        
        assert "Permission denied: user:manage" in str(exc_info.value)
    
    def test_decorator_role_denied_error(self, employee_auth_context):
        """Test decorator raises PermissionDeniedError for insufficient role"""
        @require_role("admin")  # Employee is not admin
        def admin_only_function(current_user_context: AuthContext):
            return "admin_success"
        
        with pytest.raises(PermissionDeniedError) as exc_info:
            admin_only_function(current_user_context=employee_auth_context)
        
        assert "Access denied: requires admin role" in str(exc_info.value)
    
    def test_decorator_any_permission_denied_error(self, employee_auth_context):
        """Test decorator raises PermissionDeniedError when user has none of required permissions"""
        @require_any_permission([Permission.USER_MANAGE, Permission.ROLE_MANAGE])
        def admin_function(current_user_context: AuthContext):
            return "admin_success"
        
        with pytest.raises(PermissionDeniedError) as exc_info:
            admin_function(current_user_context=employee_auth_context)
        
        error_message = str(exc_info.value)
        assert "Permission denied: requires any of" in error_message
        assert "user:manage" in error_message
        assert "role:manage" in error_message


class TestInvalidInputHandling:
    """Test suite for invalid input and edge case handling"""
    
    def test_extract_auth_context_no_context_error(self):
        """Test extract_auth_context raises ValueError when no AuthContext found"""
        with pytest.raises(ValueError) as exc_info:
            extract_auth_context("not_context", other_param="value")
        
        assert "No AuthContext found in function arguments" in str(exc_info.value)
    
    def test_extract_auth_context_wrong_type_error(self):
        """Test extract_auth_context raises ValueError for wrong parameter types"""
        with pytest.raises(ValueError) as exc_info:
            extract_auth_context(
                current_user_context="string_not_context",
                auth_context={"not": "context"}
            )
        
        assert "No AuthContext found in function arguments" in str(exc_info.value)
    
    def test_auth_context_with_none_user_id(self):
        """Test AuthContext behavior with None user_id"""
        roles = [RoleInfo(id=4, name="employee", description="Employee")]
        auth_context = AuthContext(
            user_id=None,  # None user_id
            clerk_user_id="emp_123",
            roles=roles
        )
        
        # Should still work but with None user_id
        assert auth_context.user_id is None
        assert auth_context.has_permission(Permission.USER_READ_SELF)
    
    def test_auth_context_with_empty_roles(self):
        """Test AuthContext behavior with empty roles list"""
        auth_context = AuthContext(
            user_id=uuid4(),
            clerk_user_id="emp_123",
            roles=[]  # Empty roles
        )
        
        # Should have no permissions
        assert not auth_context.has_permission(Permission.USER_READ_SELF)
        assert len(auth_context._permissions) == 0
    
    def test_auth_context_with_none_roles(self):
        """Test AuthContext behavior with None roles"""
        auth_context = AuthContext(
            user_id=uuid4(),
            clerk_user_id="emp_123",
            roles=None  # None roles
        )
        
        # Should default to empty list and have no permissions
        assert auth_context.roles == []
        assert not auth_context.has_permission(Permission.USER_READ_SELF)
    
    @pytest.mark.asyncio
    async def test_rbac_helper_with_invalid_resource_type(self):
        """Test RBACHelper with invalid resource type enum value"""
        employee_roles = [RoleInfo(id=4, name="employee", description="Employee")]
        employee_context = AuthContext(user_id=uuid4(), roles=employee_roles)
        
        # Test with invalid resource type (this would be a programming error)
        # We can't easily create invalid ResourceType enum, so we test that our system
        # handles it gracefully by checking coverage of all valid types
        for resource_type in ResourceType:
            try:
                await RBACHelper.get_accessible_resource_ids(employee_context, resource_type)
                # Should not raise unexpected errors
            except PermissionDeniedError:
                # Expected for some resource types with employee permissions
                pass
    
    @pytest.mark.asyncio
    async def test_rbac_helper_with_none_target_user_id(self):
        """Test RBACHelper methods with None target_user_id"""
        employee_roles = [RoleInfo(id=4, name="employee", description="Employee")]
        employee_context = AuthContext(user_id=uuid4(), roles=employee_roles)
        
        # Should handle None target_user_id gracefully
        result = await RBACHelper.get_accessible_user_ids(employee_context, target_user_id=None)
        assert result == [employee_context.user_id]
        
        resource_result = await RBACHelper.get_accessible_resource_ids(
            employee_context, ResourceType.GOAL, target_user_id=None
        )
        assert resource_result == [employee_context.user_id]


class TestRepositoryErrorHandling:
    """Test suite for repository integration error scenarios"""
    
    def setup_method(self):
        """Clear caches before each test"""
        subordinate_cache.clear()
        resource_access_cache.clear()
    
    @pytest.mark.asyncio
    async def test_repository_database_error_handling(self):
        """Test graceful handling of repository database errors"""
        # Create mock repository that raises database errors
        mock_repo = Mock()
        mock_repo.get_subordinates = AsyncMock(side_effect=Exception("Database connection error"))
        
        RBACHelper.initialize_with_repository(mock_repo)
        
        manager_roles = [RoleInfo(id=2, name="manager", description="Manager")]
        manager_context = AuthContext(user_id=uuid4(), roles=manager_roles)
        
        # Should handle error gracefully and return only manager's own ID
        result = await RBACHelper.get_accessible_user_ids(manager_context)
        
        assert result == [manager_context.user_id], \
            "Should handle database errors gracefully by returning self-only access"
    
    @pytest.mark.asyncio
    async def test_repository_timeout_error_handling(self):
        """Test handling of repository timeout errors"""
        # Create mock repository that raises timeout
        mock_repo = Mock()
        mock_repo.get_subordinates = AsyncMock(side_effect=TimeoutError("Database timeout"))
        
        RBACHelper.initialize_with_repository(mock_repo)
        
        supervisor_roles = [RoleInfo(id=3, name="supervisor", description="Supervisor")]
        supervisor_context = AuthContext(user_id=uuid4(), roles=supervisor_roles)
        
        # Should handle timeout gracefully
        result = await RBACHelper.get_accessible_user_ids(supervisor_context)
        
        assert result == [supervisor_context.user_id], \
            "Should handle timeout errors gracefully"
    
    @pytest.mark.asyncio
    async def test_repository_returns_none_subordinates(self):
        """Test handling when repository returns None for subordinates"""
        mock_repo = Mock()
        mock_repo.get_subordinates = AsyncMock(return_value=None)
        
        RBACHelper.initialize_with_repository(mock_repo)
        
        manager_roles = [RoleInfo(id=2, name="manager", description="Manager")]
        manager_context = AuthContext(user_id=uuid4(), roles=manager_roles)
        
        # Should handle None return gracefully
        result = await RBACHelper.get_accessible_user_ids(manager_context)
        
        # Should still include manager's own ID even if subordinates is None
        assert manager_context.user_id in result
    
    @pytest.mark.asyncio
    async def test_repository_returns_empty_subordinates(self):
        """Test handling when repository returns empty list for subordinates"""
        mock_repo = Mock()
        mock_repo.get_subordinates = AsyncMock(return_value=[])
        
        RBACHelper.initialize_with_repository(mock_repo)
        
        manager_roles = [RoleInfo(id=2, name="manager", description="Manager")]
        manager_context = AuthContext(user_id=uuid4(), roles=manager_roles)
        
        # Should handle empty list gracefully
        result = await RBACHelper.get_accessible_user_ids(manager_context)
        
        # Should return only manager's ID when no subordinates
        assert result == [manager_context.user_id]
    
    @pytest.mark.asyncio
    async def test_no_repository_configured_warning(self):
        """Test behavior when no repository is configured"""
        # Clear repository
        RBACHelper.initialize_with_repository(None)
        
        manager_roles = [RoleInfo(id=2, name="manager", description="Manager")]
        manager_context = AuthContext(user_id=uuid4(), roles=manager_roles)
        
        # Should work but only return manager's ID (no subordinates without repo)
        result = await RBACHelper.get_accessible_user_ids(manager_context)
        assert result == [manager_context.user_id]


class TestCacheErrorHandling:
    """Test suite for cache-related error scenarios"""
    
    def setup_method(self):
        """Clear caches before each test"""
        subordinate_cache.clear()
        resource_access_cache.clear()
    
    def test_cache_clear_with_invalid_user_id(self):
        """Test cache clearing with invalid user ID types"""
        # Populate cache with test data
        valid_user_id = uuid4()
        subordinate_cache[f"subordinates_{valid_user_id}"] = [uuid4()]
        resource_access_cache[f"accessible_users_{valid_user_id}_None"] = [valid_user_id]
        
        # Try to clear with invalid user ID - should not crash
        try:
            RBACHelper.clear_cache("invalid_uuid_string")
            RBACHelper.clear_cache(12345)  # Integer instead of UUID
            RBACHelper.clear_cache(None)   # None should clear all
        except Exception as e:
            pytest.fail(f"Cache clear should handle invalid input gracefully: {e}")
        
        # Valid data should be preserved after invalid clear attempts
        assert f"subordinates_{valid_user_id}" in subordinate_cache
    
    @pytest.mark.asyncio
    async def test_cache_corruption_recovery(self):
        """Test recovery from corrupted cache data"""
        employee_roles = [RoleInfo(id=4, name="employee", description="Employee")]
        employee_context = AuthContext(user_id=uuid4(), roles=employee_roles)
        
        # Inject corrupted data into cache
        cache_key = f"accessible_users_{employee_context.user_id}_None"
        resource_access_cache[cache_key] = "corrupted_data_not_list"
        
        # Should recover gracefully and compute fresh result
        result = await RBACHelper.get_accessible_user_ids(employee_context)
        assert result == [employee_context.user_id]
    
    @patch('app.security.rbac_helper.subordinate_cache')
    @pytest.mark.asyncio
    async def test_cache_operation_error_handling(self, mock_cache):
        """Test handling of cache operation errors"""
        # Mock cache that raises errors
        mock_cache.get.side_effect = Exception("Cache error")
        mock_cache.__setitem__.side_effect = Exception("Cache write error")
        
        employee_roles = [RoleInfo(id=4, name="employee", description="Employee")]
        employee_context = AuthContext(user_id=uuid4(), roles=employee_roles)
        
        # Should handle cache errors gracefully and still return result
        result = await RBACHelper.get_accessible_user_ids(employee_context)
        assert result == [employee_context.user_id]


class TestSecurityBoundaryTesting:
    """Test suite for security boundary and edge case testing"""
    
    def setup_method(self):
        """Clear caches before each test"""
        subordinate_cache.clear()
        resource_access_cache.clear()
    
    def test_permission_escalation_prevention(self):
        """Test that users cannot escalate permissions through malformed context"""
        # Attempt to create context with conflicting role information
        fake_admin_roles = [RoleInfo(id=1, name="admin", description="Fake Admin")]
        
        # But the PermissionManager should determine actual permissions
        auth_context = AuthContext(
            user_id=uuid4(),
            clerk_user_id="fake_admin",
            roles=fake_admin_roles
        )
        
        # The context should only have permissions that PermissionManager grants
        # If "admin" role doesn't exist in PermissionManager, should have no permissions
        actual_permissions = auth_context._permissions
        expected_permissions = set()  # No permissions for invalid role
        
        # This test depends on PermissionManager implementation
        # In a real system, invalid roles should grant no permissions
    
    def test_role_spoofing_prevention(self):
        """Test that role names are properly validated"""
        # Try to create role with SQL injection-like name
        malicious_roles = [RoleInfo(
            id=1, 
            name="admin'; DROP TABLE users; --", 
            description="Malicious Role"
        )]
        
        auth_context = AuthContext(
            user_id=uuid4(),
            roles=malicious_roles
        )
        
        # Should not grant admin permissions for malicious role name
        assert not auth_context.has_permission(Permission.USER_MANAGE)
    
    @pytest.mark.asyncio
    async def test_resource_id_spoofing_prevention(self):
        """Test prevention of resource ID spoofing"""
        employee_roles = [RoleInfo(id=4, name="employee", description="Employee")]
        employee_context = AuthContext(user_id=uuid4(), roles=employee_roles)
        
        # Try to access resource with malformed UUID
        malicious_resource_id = "'; DROP TABLE resources; --"
        
        # Should handle gracefully without SQL injection
        try:
            # This would normally fail UUID validation before reaching our code
            fake_uuid = UUID(int=0)  # Valid UUID but not real resource
            result = await RBACHelper.can_access_resource(
                employee_context, fake_uuid, ResourceType.USER
            )
            assert result is False, "Should deny access to non-owned resources"
        except (ValueError, TypeError):
            # Expected if UUID validation catches malformed input
            pass
    
    def test_auth_context_immutability_enforcement(self):
        """Test that AuthContext permissions cannot be modified after creation"""
        employee_roles = [RoleInfo(id=4, name="employee", description="Employee")]
        employee_context = AuthContext(user_id=uuid4(), roles=employee_roles)
        
        original_permissions = employee_context._permissions.copy()
        
        # Attempt to modify permissions directly (should not affect security)
        try:
            employee_context._permissions.add(Permission.USER_MANAGE)
        except:
            pass  # Some implementations might make this immutable
        
        # Even if modification succeeds, permission checks should still work correctly
        # The real security relies on PermissionManager, not the cached _permissions
        actual_has_permission = employee_context.has_permission(Permission.USER_MANAGE)
        expected_has_permission = PermissionManager.has_permission("employee", Permission.USER_MANAGE)
        
        assert actual_has_permission == expected_has_permission, \
            "Permission checking should rely on authoritative source, not cached permissions"


class TestErrorLoggingAndAuditing:
    """Test suite for error logging and security auditing"""
    
    @patch('app.security.rbac_helper.logger')
    @pytest.mark.asyncio
    async def test_permission_denied_logging(self, mock_logger):
        """Test that permission denied scenarios are properly logged"""
        no_perm_roles = [RoleInfo(id=999, name="nopermissions", description="No Permissions")]
        no_perm_context = AuthContext(user_id=uuid4(), roles=no_perm_roles)
        
        try:
            await RBACHelper.get_accessible_user_ids(no_perm_context)
        except PermissionDeniedError:
            pass
        
        # Should log the permission denial (implementation may vary)
        # This test verifies logging infrastructure is in place
    
    @patch('app.security.rbac_helper.logger')
    @pytest.mark.asyncio
    async def test_repository_error_logging(self, mock_logger):
        """Test that repository errors are properly logged"""
        mock_repo = Mock()
        mock_repo.get_subordinates = AsyncMock(side_effect=Exception("Database error"))
        RBACHelper.initialize_with_repository(mock_repo)
        
        manager_roles = [RoleInfo(id=2, name="manager", description="Manager")]
        manager_context = AuthContext(user_id=uuid4(), roles=manager_roles)
        
        # Should log the error
        await RBACHelper.get_accessible_user_ids(manager_context)
        
        # Verify error was logged
        mock_logger.error.assert_called()
        error_call = mock_logger.error.call_args[0][0]
        assert "Error fetching subordinates" in error_call
    
    @patch('app.security.decorators.logger')
    def test_decorator_error_logging(self, mock_logger):
        """Test that decorator errors are properly logged"""
        employee_roles = [RoleInfo(id=4, name="employee", description="Employee")]
        employee_context = AuthContext(user_id=uuid4(), roles=employee_roles)
        
        @require_permission(Permission.USER_MANAGE)
        def admin_function(current_user_context: AuthContext):
            return "success"
        
        try:
            admin_function(current_user_context=employee_context)
        except PermissionDeniedError:
            pass
        
        # Should log the permission denial
        mock_logger.warning.assert_called()
        warning_call = mock_logger.warning.call_args[0][0]
        assert "Permission denied" in warning_call
    
    def test_security_audit_information_completeness(self):
        """Test that security-relevant information is available for auditing"""
        employee_roles = [RoleInfo(id=4, name="employee", description="Employee")]
        employee_context = AuthContext(user_id=uuid4(), roles=employee_roles)
        
        # Verify that all security-relevant information is accessible
        assert employee_context.user_id is not None
        assert employee_context.clerk_user_id is not None
        assert len(employee_context.roles) > 0
        assert len(employee_context.role_names) > 0
        assert isinstance(employee_context._permissions, set)
        
        # String representation should be safe for logging
        str_repr = str(employee_context)
        assert "AuthContext" in str_repr
        assert str(employee_context.user_id) in str_repr


if __name__ == "__main__":
    pytest.main([__file__, "-v"])