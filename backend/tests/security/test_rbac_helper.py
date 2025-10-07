"""
Test suite for RBACHelper class - Core RBAC Framework functionality.

This test suite comprehensively verifies:
- Role-based data filtering logic
- Resource access control patterns  
- Conditional permission checks
- Cache functionality and performance
- Integration with existing AuthContext system
"""

import pytest
from uuid import uuid4
from unittest.mock import Mock, AsyncMock, patch

from app.security.rbac_helper import RBACHelper, subordinate_cache, resource_access_cache
from app.security.rbac_types import ResourceType
from app.security.context import AuthContext, RoleInfo
from app.core.exceptions import PermissionDeniedError


class TestRBACHelperUserDataFiltering:
    """Test suite for get_accessible_user_ids() method - Role-based data filtering"""
    
    def setup_method(self):
        """Clear caches before each test"""
        subordinate_cache.clear()
        resource_access_cache.clear()
    
    @pytest.fixture
    def admin_auth_context(self):
        """Create admin authorization context"""
        roles = [RoleInfo(id=1, name="admin", description="System Administrator")]
        return AuthContext(
            user_id=uuid4(),
            clerk_user_id="admin_123",
            roles=roles
        )
    
    @pytest.fixture
    def manager_auth_context(self):
        """Create manager authorization context"""
        roles = [RoleInfo(id=2, name="manager", description="Department Manager")]
        return AuthContext(
            user_id=uuid4(),
            clerk_user_id="manager_123",
            roles=roles
        )
    
    @pytest.fixture
    def supervisor_auth_context(self):
        """Create supervisor authorization context"""
        roles = [RoleInfo(id=3, name="supervisor", description="Team Supervisor")]
        return AuthContext(
            user_id=uuid4(),
            clerk_user_id="supervisor_123",
            roles=roles
        )
    
    @pytest.fixture
    def employee_auth_context(self):
        """Create employee authorization context"""
        roles = [RoleInfo(id=4, name="employee", description="Regular Employee")]
        return AuthContext(
            user_id=uuid4(),
            clerk_user_id="employee_123",
            roles=roles
        )
    
    @pytest.fixture
    def viewer_auth_context(self):
        """Create viewer authorization context"""
        roles = [RoleInfo(id=5, name="viewer", description="Read-only Viewer")]
        return AuthContext(
            user_id=uuid4(),
            clerk_user_id="viewer_123",
            roles=roles
        )
    
    @pytest.fixture
    def mock_user_repository(self):
        """Create mock user repository with test data"""
        repo = Mock()
        
        # Mock subordinate data
        subordinate_users = [
            Mock(id=uuid4()),
            Mock(id=uuid4()),
            Mock(id=uuid4())
        ]
        
        repo.get_subordinates = AsyncMock(return_value=subordinate_users)
        return repo
    
    @pytest.mark.asyncio
    async def test_admin_gets_all_user_access(self, admin_auth_context):
        """Admin users should have access to all users (returns None)"""
        result = await RBACHelper.get_accessible_user_ids(admin_auth_context)
        assert result is None, "Admin should have access to all users"
    
    @pytest.mark.asyncio
    async def test_manager_gets_subordinate_access(self, manager_auth_context, mock_user_repository):
        """Manager users should have access to their subordinates + self"""
        RBACHelper.initialize_with_repository(mock_user_repository)
        
        result = await RBACHelper.get_accessible_user_ids(manager_auth_context)
        
        assert result is not None, "Manager should get filtered user list"
        assert manager_auth_context.user_id in result, "Manager should have access to self"
        assert len(result) == 4, "Manager should have access to 3 subordinates + self"
    
    @pytest.mark.asyncio
    async def test_supervisor_gets_subordinate_access(self, supervisor_auth_context, mock_user_repository):
        """Supervisor users should have access to their subordinates + self"""
        RBACHelper.initialize_with_repository(mock_user_repository)
        
        result = await RBACHelper.get_accessible_user_ids(supervisor_auth_context)
        
        assert result is not None, "Supervisor should get filtered user list"
        assert supervisor_auth_context.user_id in result, "Supervisor should have access to self"
        assert len(result) == 4, "Supervisor should have access to 3 subordinates + self"
    
    @pytest.mark.asyncio
    async def test_employee_gets_self_only_access(self, employee_auth_context):
        """Employee users should only have access to themselves"""
        result = await RBACHelper.get_accessible_user_ids(employee_auth_context)
        
        assert result is not None, "Employee should get filtered user list"
        assert result == [employee_auth_context.user_id], "Employee should only access self"
        assert len(result) == 1, "Employee should only have one accessible user"
    
    @pytest.mark.asyncio
    async def test_viewer_gets_self_only_access(self, viewer_auth_context):
        """Viewer users should only have access to themselves"""
        result = await RBACHelper.get_accessible_user_ids(viewer_auth_context)
        
        assert result is not None, "Viewer should get filtered user list"
        assert result == [viewer_auth_context.user_id], "Viewer should only access self"
        assert len(result) == 1, "Viewer should only have one accessible user"
    
    @pytest.mark.asyncio
    async def test_user_with_no_permissions_raises_error(self):
        """Users with no USER_READ permissions should raise PermissionDeniedError"""
        # Create auth context with no user read permissions
        no_permission_roles = [RoleInfo(id=999, name="nopermission", description="No Permissions")]
        no_permission_context = AuthContext(
            user_id=uuid4(),
            clerk_user_id="noperm_123",
            roles=no_permission_roles
        )
        
        with pytest.raises(PermissionDeniedError) as exc_info:
            await RBACHelper.get_accessible_user_ids(no_permission_context)
        
        assert "No permission to read user data" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_subordinate_cache_functionality(self, manager_auth_context, mock_user_repository):
        """Test that subordinate relationships are properly cached"""
        RBACHelper.initialize_with_repository(mock_user_repository)
        
        # First call should hit database
        result1 = await RBACHelper.get_accessible_user_ids(manager_auth_context)
        assert mock_user_repository.get_subordinates.call_count == 1
        
        # Second call should use cache
        result2 = await RBACHelper.get_accessible_user_ids(manager_auth_context)
        assert mock_user_repository.get_subordinates.call_count == 1  # No additional calls
        
        # Results should be identical
        assert result1 == result2
    
    @pytest.mark.asyncio
    async def test_result_cache_functionality(self, employee_auth_context):
        """Test that results are properly cached"""
        # First call
        result1 = await RBACHelper.get_accessible_user_ids(employee_auth_context)
        
        # Verify result is cached
        cache_key = f"accessible_users_{employee_auth_context.user_id}_None"
        assert cache_key in resource_access_cache
        assert resource_access_cache[cache_key] == result1
        
        # Second call should return cached result
        result2 = await RBACHelper.get_accessible_user_ids(employee_auth_context)
        assert result1 == result2


class TestRBACHelperResourceAccess:
    """Test suite for get_accessible_resource_ids() method - Resource-specific access control"""
    
    def setup_method(self):
        """Clear caches before each test"""
        subordinate_cache.clear()
        resource_access_cache.clear()
    
    @pytest.fixture
    def admin_auth_context(self):
        roles = [RoleInfo(id=1, name="admin", description="System Administrator")]
        return AuthContext(user_id=uuid4(), roles=roles)
    
    @pytest.fixture
    def manager_auth_context(self):
        roles = [RoleInfo(id=2, name="manager", description="Department Manager")]
        return AuthContext(user_id=uuid4(), roles=roles)
    
    @pytest.fixture
    def employee_auth_context(self):
        roles = [RoleInfo(id=4, name="employee", description="Regular Employee")]
        return AuthContext(user_id=uuid4(), roles=roles)
    
    @pytest.fixture
    def mock_user_repository(self):
        repo = Mock()
        subordinate_users = [Mock(id=uuid4()), Mock(id=uuid4())]
        repo.get_subordinates = AsyncMock(return_value=subordinate_users)
        return repo
    
    @pytest.mark.asyncio
    async def test_admin_gets_all_resource_access(self, admin_auth_context):
        """Admin should have access to all resources of any type"""
        for resource_type in ResourceType:
            result = await RBACHelper.get_accessible_resource_ids(
                admin_auth_context, resource_type
            )
            assert result is None, f"Admin should have access to all {resource_type.value} resources"
    
    @pytest.mark.asyncio
    async def test_manager_gets_subordinate_resource_access(self, manager_auth_context, mock_user_repository):
        """Manager should have access to subordinate resources + own resources"""
        RBACHelper.initialize_with_repository(mock_user_repository)
        
        # Test with GOAL resource type
        result = await RBACHelper.get_accessible_resource_ids(
            manager_auth_context, ResourceType.GOAL
        )
        
        assert result is not None, "Manager should get filtered resource list"
        assert manager_auth_context.user_id in result, "Manager should have access to own resources"
        assert len(result) == 3, "Manager should have access to 2 subordinate + 1 own resource"
    
    @pytest.mark.asyncio
    async def test_employee_gets_self_resource_access(self, employee_auth_context):
        """Employee should only have access to their own resources"""
        result = await RBACHelper.get_accessible_resource_ids(
            employee_auth_context, ResourceType.GOAL
        )
        
        assert result is not None, "Employee should get filtered resource list"
        assert result == [employee_auth_context.user_id], "Employee should only access own resources"
    
    @pytest.mark.asyncio
    async def test_evaluation_resource_special_case(self, employee_auth_context):
        """Test EVALUATION resources use general 'read' permission"""
        result = await RBACHelper.get_accessible_resource_ids(
            employee_auth_context, ResourceType.EVALUATION
        )
        
        # For evaluations, employee should get same access as users (self only)
        assert result == [employee_auth_context.user_id]
    
    @pytest.mark.asyncio
    async def test_invalid_resource_type_permissions_error(self):
        """Test error when user has no permissions for resource type"""
        no_permission_roles = [RoleInfo(id=999, name="nopermission", description="No Permissions")]
        no_permission_context = AuthContext(user_id=uuid4(), roles=no_permission_roles)
        
        with pytest.raises(PermissionDeniedError) as exc_info:
            await RBACHelper.get_accessible_resource_ids(
                no_permission_context, ResourceType.USER
            )
        
        assert "No permission to access user resources" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_resource_cache_functionality(self, employee_auth_context):
        """Test that resource access results are cached"""
        # First call
        result1 = await RBACHelper.get_accessible_resource_ids(
            employee_auth_context, ResourceType.GOAL
        )
        
        # Verify result is cached
        cache_key = f"accessible_goal_{employee_auth_context.user_id}_None"
        assert cache_key in resource_access_cache
        
        # Second call should return cached result
        result2 = await RBACHelper.get_accessible_resource_ids(
            employee_auth_context, ResourceType.GOAL
        )
        assert result1 == result2


class TestRBACHelperResourceAccessCheck:
    """Test suite for can_access_resource() method - Individual resource access checks"""
    
    def setup_method(self):
        """Clear caches before each test"""
        subordinate_cache.clear()
        resource_access_cache.clear()
    
    @pytest.fixture
    def admin_auth_context(self):
        roles = [RoleInfo(id=1, name="admin", description="System Administrator")]
        return AuthContext(user_id=uuid4(), roles=roles)
    
    @pytest.fixture
    def employee_auth_context(self):
        roles = [RoleInfo(id=4, name="employee", description="Regular Employee")]
        return AuthContext(user_id=uuid4(), roles=roles)
    
    @pytest.fixture
    def mock_user_repository(self):
        repo = Mock()
        subordinate_users = [Mock(id=uuid4()), Mock(id=uuid4())]
        repo.get_subordinates = AsyncMock(return_value=subordinate_users)
        return repo
    
    @pytest.mark.asyncio
    async def test_admin_can_access_any_resource(self, admin_auth_context):
        """Admin should be able to access any resource"""
        resource_id = uuid4()
        
        result = await RBACHelper.can_access_resource(
            admin_auth_context, resource_id, ResourceType.USER
        )
        
        assert result is True, "Admin should be able to access any resource"
    
    @pytest.mark.asyncio
    async def test_employee_can_access_own_resource(self, employee_auth_context):
        """Employee should be able to access resources they own"""
        resource_id = uuid4()
        
        # Mock the helper to return employee's ID as accessible
        with patch.object(RBACHelper, 'get_accessible_resource_ids') as mock_get_accessible:
            mock_get_accessible.return_value = [employee_auth_context.user_id]
            
            result = await RBACHelper.can_access_resource(
                employee_auth_context, resource_id, ResourceType.USER, 
                owner_user_id=employee_auth_context.user_id
            )
        
        assert result is True, "Employee should be able to access own resources"
    
    @pytest.mark.asyncio
    async def test_employee_cannot_access_others_resource(self, employee_auth_context):
        """Employee should not be able to access others' resources"""
        resource_id = uuid4()
        other_user_id = uuid4()
        
        # Mock the helper to return only employee's ID as accessible
        with patch.object(RBACHelper, 'get_accessible_resource_ids') as mock_get_accessible:
            mock_get_accessible.return_value = [employee_auth_context.user_id]
            
            result = await RBACHelper.can_access_resource(
                employee_auth_context, resource_id, ResourceType.USER,
                owner_user_id=other_user_id
            )
        
        assert result is False, "Employee should not be able to access others' resources"
    
    @pytest.mark.asyncio
    async def test_manager_can_access_subordinate_resource(self, mock_user_repository):
        """Manager should be able to access subordinate resources"""
        RBACHelper.initialize_with_repository(mock_user_repository)
        
        manager_roles = [RoleInfo(id=2, name="manager", description="Department Manager")]
        manager_context = AuthContext(user_id=uuid4(), roles=manager_roles)
        
        subordinate_id = uuid4()
        resource_id = uuid4()
        
        # Mock the helper to return manager + subordinates as accessible
        with patch.object(RBACHelper, 'get_accessible_resource_ids') as mock_get_accessible:
            mock_get_accessible.return_value = [manager_context.user_id, subordinate_id]
            
            result = await RBACHelper.can_access_resource(
                manager_context, resource_id, ResourceType.USER,
                owner_user_id=subordinate_id
            )
        
        assert result is True, "Manager should be able to access subordinate resources"
    
    @pytest.mark.asyncio
    async def test_no_permission_user_cannot_access(self):
        """User with no permissions should not be able to access any resource"""
        no_permission_roles = [RoleInfo(id=999, name="nopermission", description="No Permissions")]
        no_permission_context = AuthContext(user_id=uuid4(), roles=no_permission_roles)
        
        resource_id = uuid4()
        
        result = await RBACHelper.can_access_resource(
            no_permission_context, resource_id, ResourceType.USER
        )
        
        assert result is False, "User without permissions should not be able to access resources"
    
    @pytest.mark.asyncio
    async def test_resource_access_cache_functionality(self, admin_auth_context):
        """Test that individual resource access checks are cached"""
        resource_id = uuid4()
        
        # First call
        result1 = await RBACHelper.can_access_resource(
            admin_auth_context, resource_id, ResourceType.USER
        )
        
        # Verify result is cached
        cache_key = f"can_access_user_{resource_id}_{admin_auth_context.user_id}"
        assert cache_key in resource_access_cache
        assert resource_access_cache[cache_key] == result1
        
        # Second call should return cached result
        result2 = await RBACHelper.can_access_resource(
            admin_auth_context, resource_id, ResourceType.USER
        )
        assert result1 == result2


class TestRBACHelperCacheManagement:
    """Test suite for cache management functionality"""
    
    def setup_method(self):
        """Clear caches before each test"""
        subordinate_cache.clear()
        resource_access_cache.clear()
    
    def test_clear_cache_for_specific_user(self):
        """Test clearing cache for a specific user"""
        user_id = uuid4()
        
        # Populate caches with test data
        resource_access_cache[f"accessible_users_{user_id}_None"] = [user_id]
        resource_access_cache[f"can_access_user_someresource_{user_id}"] = True
        subordinate_cache[f"subordinates_{user_id}"] = [uuid4(), uuid4()]
        
        # Add data for different user (should not be cleared)
        other_user_id = uuid4()
        resource_access_cache[f"accessible_users_{other_user_id}_None"] = [other_user_id]
        subordinate_cache[f"subordinates_{other_user_id}"] = [uuid4()]
        
        # Clear cache for specific user
        RBACHelper.clear_cache(user_id)
        
        # Verify specific user's cache is cleared
        assert f"accessible_users_{user_id}_None" not in resource_access_cache
        assert f"can_access_user_someresource_{user_id}" not in resource_access_cache
        assert f"subordinates_{user_id}" not in subordinate_cache
        
        # Verify other user's cache is preserved
        assert f"accessible_users_{other_user_id}_None" in resource_access_cache
        assert f"subordinates_{other_user_id}" in subordinate_cache
    
    def test_clear_all_caches(self):
        """Test clearing all caches"""
        # Populate caches with test data
        resource_access_cache["test_key_1"] = "test_value_1"
        resource_access_cache["test_key_2"] = "test_value_2"
        subordinate_cache["subordinate_key_1"] = [uuid4()]
        subordinate_cache["subordinate_key_2"] = [uuid4()]
        
        # Clear all caches
        RBACHelper.clear_cache()
        
        # Verify all caches are empty
        assert len(resource_access_cache) == 0
        assert len(subordinate_cache) == 0


class TestRBACHelperRepositoryIntegration:
    """Test suite for UserRepository integration"""
    
    def setup_method(self):
        """Clear caches before each test"""
        subordinate_cache.clear()
        resource_access_cache.clear()
    
    @pytest.mark.asyncio
    async def test_repository_initialization(self):
        """Test repository initialization"""
        mock_repo = Mock()
        
        RBACHelper.initialize_with_repository(mock_repo)
        assert RBACHelper.get_user_repository() == mock_repo
    
    @pytest.mark.asyncio
    async def test_subordinate_lookup_without_repository(self):
        """Test subordinate lookup when no repository is provided"""
        # Clear any existing repository
        RBACHelper.initialize_with_repository(None)
        
        manager_roles = [RoleInfo(id=2, name="manager", description="Department Manager")]
        manager_context = AuthContext(user_id=uuid4(), roles=manager_roles)
        
        # Should return only manager's own ID (no subordinates without repo)
        result = await RBACHelper.get_accessible_user_ids(manager_context)
        
        assert result == [manager_context.user_id], "Should return only self when no repository available"
    
    @pytest.mark.asyncio
    async def test_subordinate_lookup_with_repository_error(self, mock_user_repository):
        """Test subordinate lookup when repository raises an error"""
        # Make the repository raise an error
        mock_user_repository.get_subordinates = AsyncMock(side_effect=Exception("Database error"))
        
        RBACHelper.initialize_with_repository(mock_user_repository)
        
        manager_roles = [RoleInfo(id=2, name="manager", description="Department Manager")]
        manager_context = AuthContext(user_id=uuid4(), roles=manager_roles)
        
        # Should handle error gracefully and return only manager's ID
        result = await RBACHelper.get_accessible_user_ids(manager_context)
        
        assert result == [manager_context.user_id], "Should handle repository errors gracefully"


class TestRBACHelperEdgeCases:
    """Test suite for edge cases and error scenarios"""
    
    def setup_method(self):
        """Clear caches before each test"""
        subordinate_cache.clear()
        resource_access_cache.clear()
    
    @pytest.mark.asyncio
    async def test_with_target_user_id_parameter(self):
        """Test methods with target_user_id parameter"""
        employee_roles = [RoleInfo(id=4, name="employee", description="Regular Employee")]
        employee_context = AuthContext(user_id=uuid4(), roles=employee_roles)
        target_user_id = uuid4()
        
        # Test with target_user_id
        result = await RBACHelper.get_accessible_user_ids(employee_context, target_user_id)
        
        # Should still return only employee's ID regardless of target_user_id
        assert result == [employee_context.user_id]
    
    @pytest.mark.asyncio
    async def test_multiple_roles_permission_aggregation(self):
        """Test user with multiple roles gets aggregated permissions"""
        # User with both employee and viewer roles
        multi_roles = [
            RoleInfo(id=4, name="employee", description="Regular Employee"),
            RoleInfo(id=5, name="viewer", description="Read-only Viewer")
        ]
        multi_role_context = AuthContext(user_id=uuid4(), roles=multi_roles)
        
        result = await RBACHelper.get_accessible_user_ids(multi_role_context)
        
        # Should have access to self (both roles provide USER_READ_SELF)
        assert result == [multi_role_context.user_id]
    
    @pytest.mark.asyncio
    async def test_empty_roles_list(self):
        """Test user with empty roles list"""
        no_roles_context = AuthContext(user_id=uuid4(), roles=[])
        
        with pytest.raises(PermissionDeniedError):
            await RBACHelper.get_accessible_user_ids(no_roles_context)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])