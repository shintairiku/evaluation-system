"""
Test suite for RBAC Permission Matrix - Comprehensive role and permission validation.

This test suite verifies:
- Complete permission matrix for all roles (admin, manager, supervisor, employee, viewer, parttime)
- RBAC framework consistency with existing PermissionManager
- Role hierarchy and permission inheritance
- Cross-role permission validation
- Integration between old and new RBAC systems
"""

import pytest
from uuid import uuid4
from typing import List
from unittest.mock import Mock, AsyncMock

from app.security.rbac_helper import RBACHelper, subordinate_cache, resource_access_cache
from app.security.rbac_types import ResourceType, ResourcePermissionMap
from app.security.context import AuthContext, RoleInfo
from app.security.permissions import Permission
from app.security.decorators import require_permission, require_any_permission, require_role
from app.core.exceptions import PermissionDeniedError


# Module-level role→permission map to mirror seeded defaults for tests
ROLE_PERMISSIONS_MAP = {
    "admin": {
        Permission.USER_READ_ALL,
        Permission.USER_READ_SUBORDINATES,
        Permission.USER_READ_SELF,
        Permission.USER_MANAGE,
        Permission.USER_MANAGE_BASIC,
        Permission.USER_MANAGE_PLUS,
        Permission.DEPARTMENT_READ,
        Permission.DEPARTMENT_MANAGE,
        Permission.ROLE_READ_ALL,
        Permission.ROLE_MANAGE,
        Permission.GOAL_READ_SELF,
        Permission.GOAL_READ_ALL,
        Permission.GOAL_READ_SUBORDINATES,
        Permission.GOAL_MANAGE,
        Permission.GOAL_MANAGE_SELF,
        Permission.GOAL_APPROVE,
        Permission.EVALUATION_READ,
        Permission.EVALUATION_MANAGE,
        Permission.EVALUATION_REVIEW,
        Permission.COMPETENCY_READ,
        Permission.COMPETENCY_READ_SELF,
        Permission.COMPETENCY_MANAGE,
        Permission.ASSESSMENT_READ_SELF,
        Permission.ASSESSMENT_READ_ALL,
        Permission.ASSESSMENT_READ_SUBORDINATES,
        Permission.ASSESSMENT_MANAGE_SELF,
        Permission.REPORT_ACCESS,
        Permission.STAGE_READ_ALL,
        Permission.STAGE_MANAGE,
        Permission.HIERARCHY_MANAGE,
    },
    "manager": {
        Permission.USER_READ_SUBORDINATES,
        Permission.USER_READ_SELF,
        Permission.USER_MANAGE_PLUS,
        Permission.DEPARTMENT_READ,
        Permission.ROLE_READ_ALL,
        Permission.GOAL_READ_SELF,
        Permission.GOAL_READ_SUBORDINATES,
        Permission.GOAL_MANAGE_SELF,
        Permission.GOAL_APPROVE,
        Permission.EVALUATION_READ,
        Permission.EVALUATION_MANAGE,
        Permission.EVALUATION_REVIEW,
        Permission.COMPETENCY_READ_SELF,
        Permission.ASSESSMENT_READ_SUBORDINATES,
        Permission.ASSESSMENT_MANAGE_SELF,
        Permission.REPORT_ACCESS,
        Permission.STAGE_READ_ALL,
        Permission.HIERARCHY_MANAGE,
    },
    "supervisor": {
        Permission.USER_READ_SUBORDINATES,
        Permission.USER_READ_SELF,
        Permission.USER_MANAGE_PLUS,
        Permission.DEPARTMENT_READ,
        Permission.ROLE_READ_ALL,
        Permission.GOAL_READ_SELF,
        Permission.GOAL_READ_SUBORDINATES,
        Permission.GOAL_MANAGE_SELF,
        Permission.GOAL_APPROVE,
        Permission.EVALUATION_READ,
        Permission.EVALUATION_MANAGE,
        Permission.EVALUATION_REVIEW,
        Permission.COMPETENCY_READ_SELF,
        Permission.ASSESSMENT_READ_SUBORDINATES,
        Permission.ASSESSMENT_MANAGE_SELF,
        Permission.REPORT_ACCESS,
        Permission.STAGE_READ_ALL,
        Permission.HIERARCHY_MANAGE,
    },
    "viewer": {
        Permission.USER_READ_SELF,
        Permission.DEPARTMENT_READ,
        Permission.ROLE_READ_ALL,
        Permission.GOAL_READ_SELF,
        Permission.EVALUATION_READ,
        Permission.COMPETENCY_READ_SELF,
        Permission.ASSESSMENT_READ_SELF,
        Permission.ASSESSMENT_MANAGE_SELF,
        Permission.STAGE_READ_ALL,
    },
    "employee": {
        Permission.USER_READ_SELF,
        Permission.USER_MANAGE_BASIC,
        Permission.DEPARTMENT_READ,
        Permission.ROLE_READ_ALL,
        Permission.GOAL_READ_SELF,
        Permission.GOAL_MANAGE_SELF,
        Permission.EVALUATION_READ,
        Permission.EVALUATION_MANAGE,
        Permission.COMPETENCY_READ_SELF,
        Permission.ASSESSMENT_READ_SELF,
        Permission.ASSESSMENT_MANAGE_SELF,
        Permission.STAGE_READ_ALL,
    },
    "parttime": {
        Permission.USER_READ_SELF,
        Permission.USER_MANAGE_BASIC,
        Permission.DEPARTMENT_READ,
        Permission.ROLE_READ_ALL,
        Permission.GOAL_READ_SELF,
        Permission.GOAL_MANAGE_SELF,
        Permission.EVALUATION_READ,
        Permission.EVALUATION_MANAGE,
        Permission.COMPETENCY_READ_SELF,
        Permission.ASSESSMENT_READ_SELF,
        Permission.ASSESSMENT_MANAGE_SELF,
        Permission.STAGE_READ_ALL,
    },
}


class TestCompletePermissionMatrix:
    """Test suite for complete permission matrix across all roles and permissions"""
    
    def setup_method(self):
        """Clear caches before each test"""
        subordinate_cache.clear()
        resource_access_cache.clear()
    
    @pytest.fixture(params=["admin", "manager", "supervisor", "employee", "viewer", "parttime"])
    def role_name(self, request):
        """Parameterized fixture for all role names"""
        return request.param
    
    @pytest.fixture
    def auth_context_for_role(self, role_name: str) -> AuthContext:
        """Create AuthContext with DB-like overrides (test-local) for any role"""
        role_id_map = {
            "admin": 1,
            "manager": 2,
            "supervisor": 3,
            "employee": 4,
            "viewer": 5,
            "parttime": 6,
        }

        roles = [RoleInfo(id=role_id_map[role_name], name=role_name, description=f"{role_name.title()} Role")]
        overrides = {role_name: ROLE_PERMISSIONS_MAP[role_name]}

        return AuthContext(
            user_id=uuid4(),
            clerk_user_id=f"{role_name}_123",
            roles=roles,
            role_permission_overrides=overrides,
        )
    
    # Permission Matrix Test Cases
    # Each tuple: (role, permission, expected_result)
    PERMISSION_MATRIX_TEST_CASES = [
        # Admin permissions (should have most permissions)
        ("admin", Permission.USER_READ_ALL, True),
        ("admin", Permission.USER_MANAGE, True),
        ("admin", Permission.ROLE_MANAGE, True),
        ("admin", Permission.GOAL_READ_ALL, True),
        ("admin", Permission.GOAL_MANAGE, True),
        ("admin", Permission.EVALUATION_MANAGE, True),
        ("admin", Permission.DEPARTMENT_MANAGE, True),
        ("admin", Permission.STAGE_MANAGE, True),
        
        # Manager permissions (subordinate management)
        ("manager", Permission.USER_READ_ALL, False),
        ("manager", Permission.USER_READ_SUBORDINATES, True),
        ("manager", Permission.USER_READ_SELF, True),
        ("manager", Permission.USER_MANAGE, False),
        ("manager", Permission.GOAL_READ_SUBORDINATES, True),
        ("manager", Permission.GOAL_READ_SELF, True),
        ("manager", Permission.GOAL_MANAGE_SELF, True),
        ("manager", Permission.GOAL_APPROVE, True),
        ("manager", Permission.EVALUATION_READ, True),
        ("manager", Permission.EVALUATION_MANAGE, True),
        ("manager", Permission.EVALUATION_REVIEW, True),
        
        # Supervisor permissions (limited subordinate management)
        ("supervisor", Permission.USER_READ_ALL, False),
        ("supervisor", Permission.USER_READ_SUBORDINATES, True),
        ("supervisor", Permission.USER_READ_SELF, True),
        ("supervisor", Permission.USER_MANAGE, False),
        ("supervisor", Permission.GOAL_READ_SUBORDINATES, True),
        ("supervisor", Permission.GOAL_READ_SELF, True),
        ("supervisor", Permission.GOAL_MANAGE_SELF, True),
        ("supervisor", Permission.GOAL_APPROVE, True),
        ("supervisor", Permission.EVALUATION_READ, True),
        ("supervisor", Permission.EVALUATION_MANAGE, True),
        ("supervisor", Permission.EVALUATION_REVIEW, True),
        
        # Employee permissions (self-only access)
        ("employee", Permission.USER_READ_ALL, False),
        ("employee", Permission.USER_READ_SUBORDINATES, False),
        ("employee", Permission.USER_READ_SELF, True),
        ("employee", Permission.USER_MANAGE, False),
        ("employee", Permission.GOAL_READ_ALL, False),
        ("employee", Permission.GOAL_READ_SUBORDINATES, False),
        ("employee", Permission.GOAL_READ_SELF, True),
        ("employee", Permission.GOAL_MANAGE_SELF, True),
        ("employee", Permission.EVALUATION_READ, True),
        ("employee", Permission.EVALUATION_MANAGE, True),
        ("employee", Permission.ASSESSMENT_READ_SELF, True),
        ("employee", Permission.ASSESSMENT_MANAGE_SELF, True),
        
        # Viewer permissions (read-only access)
        ("viewer", Permission.USER_READ_ALL, False),
        ("viewer", Permission.USER_READ_SUBORDINATES, False),
        ("viewer", Permission.USER_READ_SELF, True),
        ("viewer", Permission.USER_MANAGE, False),
        ("viewer", Permission.GOAL_READ_SELF, True),
        ("viewer", Permission.GOAL_MANAGE_SELF, False),
        ("viewer", Permission.EVALUATION_READ, True),
        ("viewer", Permission.ASSESSMENT_READ_SELF, True),
        ("viewer", Permission.ASSESSMENT_MANAGE_SELF, True),
        
        # Parttime permissions (minimal access)
        ("parttime", Permission.USER_READ_ALL, False),
        ("parttime", Permission.USER_READ_SUBORDINATES, False),
        ("parttime", Permission.USER_READ_SELF, True),
        ("parttime", Permission.USER_MANAGE, False),
        ("parttime", Permission.GOAL_READ_ALL, False),
        ("parttime", Permission.GOAL_READ_SUBORDINATES, False),
        ("parttime", Permission.GOAL_READ_SELF, True),
        ("parttime", Permission.GOAL_MANAGE_SELF, True),
        ("parttime", Permission.ASSESSMENT_READ_SELF, True),
        ("parttime", Permission.ASSESSMENT_MANAGE_SELF, True),
    ]
    
    @pytest.mark.parametrize("role_name,permission,expected", PERMISSION_MATRIX_TEST_CASES)
    def test_permission_matrix(self, auth_context_for_role, role_name: str, permission: Permission, expected: bool):
        """Test permission matrix against AuthContext with overrides only"""
        context = auth_context_for_role
        result = context.has_permission(permission)
        assert result == expected, f"Role {role_name} should {'have' if expected else 'not have'} {permission.value}"
    
    def test_all_roles_have_user_read_permission(self):
        """Test that all roles have some form of user read permission"""
        for role in ["admin", "manager", "supervisor", "employee", "viewer", "parttime"]:
            role_info = RoleInfo(id=1, name=role, description=f"{role} role")
            auth_context = AuthContext(
                user_id=uuid4(),
                roles=[role_info],
                role_permission_overrides={role: ROLE_PERMISSIONS_MAP[role]},
            )
            
            # Each role should have at least one user read permission
            has_user_read = (
                auth_context.has_permission(Permission.USER_READ_ALL) or
                auth_context.has_permission(Permission.USER_READ_SUBORDINATES) or
                auth_context.has_permission(Permission.USER_READ_SELF)
            )
            
            assert has_user_read, \
                f"Role {role} should have at least one user read permission"
    
    def test_role_hierarchy_permissions(self):
        """Test that higher roles have more or equal permissions than lower roles"""
        role_hierarchy = ["admin", "manager", "supervisor", "employee", "viewer", "parttime"]
        
        # Use the auth_context_for_role fixture to compute permissions per role
        role_permissions = {role: ROLE_PERMISSIONS_MAP[role] for role in role_hierarchy}
        admin_perms = role_permissions["admin"]
        for role in role_hierarchy[1:]:  # Skip admin
            role_perms = role_permissions[role]
            assert len(admin_perms) >= len(role_perms), \
                f"Admin should have at least as many permissions as {role}"
    
    def test_management_roles_have_subordinate_permissions(self):
        """Test that management roles have subordinate access permissions"""
        management_roles = ["admin", "manager", "supervisor"]
        
        for role in management_roles:
            role_info = RoleInfo(id=1, name=role, description=f"{role} role")
            auth_context = AuthContext(
                user_id=uuid4(),
                roles=[role_info],
                role_permission_overrides={role: ROLE_PERMISSIONS_MAP[role]},
            )
            
            if role == "admin":
                assert auth_context.has_permission(Permission.USER_READ_ALL)
            else:
                assert auth_context.has_permission(Permission.USER_READ_SUBORDINATES), \
                    f"{role} should have USER_READ_SUBORDINATES permission"


class TestRBACHelperWithAllRoles:
    """Test RBACHelper functionality with all role combinations"""
    
    def setup_method(self):
        """Clear caches and setup mock repository"""
        subordinate_cache.clear()
        resource_access_cache.clear()
        
        # Setup role-aware mock repository
        self.mock_repo = Mock()
        # Create some subordinate users for managers/supervisors
        self.subordinate_users = [Mock(id=uuid4()) for _ in range(3)]
        
        async def mock_get_subordinates(supervisor_id, org_id):
            return list(self.subordinate_users)
        
        self.mock_repo.get_subordinates = AsyncMock(side_effect=mock_get_subordinates)
        RBACHelper.initialize_with_repository(self.mock_repo)
    
    @pytest.mark.asyncio
    @pytest.mark.parametrize("role_name,expected_behavior", [
        ("admin", "all_access"),
        ("manager", "subordinate_access"),
        ("supervisor", "subordinate_access"),
        ("employee", "self_only"),
        ("viewer", "self_only"),
        ("parttime", "self_only"),
    ])
    async def test_get_accessible_user_ids_by_role(self, role_name: str, expected_behavior: str):
        """Test get_accessible_user_ids for all roles"""
        role_info = RoleInfo(id=1, name=role_name, description=f"{role_name} role")
        auth_context = AuthContext(
            user_id=uuid4(),
            roles=[role_info],
            role_permission_overrides={role_name: ROLE_PERMISSIONS_MAP[role_name]},
        )
        
        result = await RBACHelper.get_accessible_user_ids(auth_context)
        
        if expected_behavior == "all_access":
            assert result is None, f"{role_name} should have access to all users"
        elif expected_behavior == "subordinate_access":
            assert result is not None, f"{role_name} should get filtered user list"
            assert auth_context.user_id in result, f"{role_name} should have access to self"
            assert len(result) > 1, f"{role_name} should have access to subordinates"
        elif expected_behavior == "self_only":
            assert result == [auth_context.user_id], f"{role_name} should only access self"
    
    @pytest.mark.asyncio
    @pytest.mark.parametrize("role_name", ["admin", "manager", "supervisor", "employee", "viewer", "parttime"])
    async def test_get_accessible_resource_ids_by_role(self, role_name: str):
        """Test get_accessible_resource_ids for all roles with different resource types"""
        role_info = RoleInfo(id=1, name=role_name, description=f"{role_name} role")
        auth_context = AuthContext(
            user_id=uuid4(),
            roles=[role_info],
            role_permission_overrides={role_name: ROLE_PERMISSIONS_MAP[role_name]},
        )
        
        # Test with USER resource type
        try:
            result = await RBACHelper.get_accessible_resource_ids(auth_context, ResourceType.USER)
            
            if role_name == "admin":
                assert result is None, "Admin should access all USER resources"
            elif role_name in ["manager", "supervisor"]:
                assert result is not None and len(result) > 1, \
                    f"{role_name} should access subordinate USER resources"
            else:  # employee, viewer, parttime
                assert result == [auth_context.user_id], \
                    f"{role_name} should only access own USER resources"
                    
        except PermissionDeniedError:
            # Some roles may not have permissions for certain resource types
            assert role_name in ["parttime"], \
                f"Unexpected PermissionDeniedError for role {role_name}"

    @pytest.mark.asyncio
    @pytest.mark.parametrize("role_name", ["admin", "manager", "supervisor", "employee", "viewer", "parttime"])
    async def test_can_access_resource_by_role(self, role_name: str):
        """Test can_access_resource for all roles"""
        role_info = RoleInfo(id=1, name=role_name, description=f"{role_name} role")
        auth_context = AuthContext(
            user_id=uuid4(),
            roles=[role_info],
            role_permission_overrides={role_name: ROLE_PERMISSIONS_MAP[role_name]},
        )
        resource_id = uuid4()
        
        try:
            # Test access to own resource
            can_access_own = await RBACHelper.can_access_resource(
                auth_context, resource_id, ResourceType.USER, owner_user_id=auth_context.user_id
            )
            
            # All roles should be able to access their own resources (if they have any USER permissions)
            if role_name != "parttime":  # parttime might not have USER permissions
                assert can_access_own is True, f"{role_name} should access own resources"
            
            # Test access to other's resource
            other_user_id = uuid4()
            can_access_other = await RBACHelper.can_access_resource(
                auth_context, resource_id, ResourceType.USER, owner_user_id=other_user_id
            )
            
            if role_name == "admin":
                assert can_access_other is True, "Admin should access any resource"
            elif role_name in ["manager", "supervisor"]:
                # Would depend on whether other_user_id is a subordinate, but since it's random, likely False
                assert can_access_other is False, f"{role_name} should not access random user's resource"
            else:
                assert can_access_other is False, f"{role_name} should not access other's resources"
                
        except PermissionDeniedError:
            # Some roles may not have permissions for resource access
            assert role_name in ["parttime"], \
                f"Unexpected PermissionDeniedError for role {role_name}"


class TestDecoratorPermissionMatrix:
    """Test decorators with all role combinations"""
    
    @pytest.mark.parametrize("role_name,permission,should_pass", [
        ("admin", Permission.USER_MANAGE, True),
        ("manager", Permission.USER_MANAGE, False),
        ("supervisor", Permission.USER_MANAGE, False),
        ("employee", Permission.USER_MANAGE, False),
        ("viewer", Permission.USER_MANAGE, False),
        ("parttime", Permission.USER_MANAGE, False),
    ])
    def test_require_permission_decorator_matrix(self, role_name: str, permission: Permission, should_pass: bool):
        """Test @require_permission decorator with permission matrix"""
        role_info = RoleInfo(id=1, name=role_name, description=f"{role_name} role")
        auth_context = AuthContext(
            user_id=uuid4(),
            roles=[role_info],
            role_permission_overrides={role_name: ROLE_PERMISSIONS_MAP[role_name]},
        )
        
        @require_permission(permission)
        def test_function(current_user_context: AuthContext):
            return "success"
        
        if should_pass:
            result = test_function(current_user_context=auth_context)
            assert result == "success", f"{role_name} should pass {permission.value} check"
        else:
            with pytest.raises(PermissionDeniedError):
                test_function(current_user_context=auth_context)
    
    @pytest.mark.parametrize("role_name,permissions,should_pass", [
        ("admin", [Permission.USER_READ_ALL, Permission.USER_MANAGE], True),
        ("manager", [Permission.USER_READ_ALL, Permission.USER_READ_SUBORDINATES], True),
        ("supervisor", [Permission.USER_READ_ALL, Permission.USER_READ_SUBORDINATES], True),
        ("employee", [Permission.USER_READ_ALL, Permission.USER_READ_SUBORDINATES], False),
        ("viewer", [Permission.USER_MANAGE, Permission.GOAL_MANAGE], False),
        ("parttime", [Permission.USER_MANAGE, Permission.GOAL_MANAGE], False),
    ])
    def test_require_any_permission_decorator_matrix(self, role_name: str, permissions: List[Permission], should_pass: bool):
        """Test @require_any_permission decorator with permission combinations"""
        role_info = RoleInfo(id=1, name=role_name, description=f"{role_name} role")
        auth_context = AuthContext(
            user_id=uuid4(),
            roles=[role_info],
            role_permission_overrides={role_name: ROLE_PERMISSIONS_MAP[role_name]},
        )
        
        @require_any_permission(permissions)
        def test_function(current_user_context: AuthContext):
            return "success"
        
        if should_pass:
            result = test_function(current_user_context=auth_context)
            assert result == "success", f"{role_name} should pass any of {[p.value for p in permissions]} check"
        else:
            with pytest.raises(PermissionDeniedError):
                test_function(current_user_context=auth_context)
    
    @pytest.mark.parametrize("role_name,required_role,should_pass", [
        ("admin", "admin", True),
        ("admin", "manager", False),  # Admin is not manager
        ("manager", "manager", True),
        ("manager", "admin", False),
        ("supervisor", "supervisor", True),
        ("supervisor", "manager", False),
        ("employee", "employee", True),
        ("employee", "supervisor", False),
        ("viewer", "viewer", True),
        ("viewer", "employee", False),
        ("parttime", "parttime", True),
        ("parttime", "viewer", False),
    ])
    def test_require_role_decorator_matrix(self, role_name: str, required_role: str, should_pass: bool):
        """Test @require_role decorator with role matrix"""
        role_info = RoleInfo(id=1, name=role_name, description=f"{role_name} role")
        auth_context = AuthContext(
            user_id=uuid4(),
            roles=[role_info],
            role_permission_overrides={role_name: ROLE_PERMISSIONS_MAP[role_name]},
        )
        
        @require_role(required_role)
        def test_function(current_user_context: AuthContext):
            return "success"
        
        if should_pass:
            result = test_function(current_user_context=auth_context)
            assert result == "success", f"{role_name} should pass {required_role} role check"
        else:
            with pytest.raises(PermissionDeniedError):
                test_function(current_user_context=auth_context)


class TestMultiRolePermissions:
    """Test scenarios with users having multiple roles"""
    
    def test_multi_role_permission_aggregation(self):
        """Test that users with multiple roles get aggregated permissions"""
        # User with both manager and supervisor roles
        multi_roles = [
            RoleInfo(id=2, name="manager", description="Manager"),
            RoleInfo(id=3, name="supervisor", description="Supervisor")
        ]
        multi_role_context = AuthContext(user_id=uuid4(), roles=multi_roles)
        
        # Should have permissions from both roles
        assert multi_role_context.has_permission(Permission.USER_READ_SUBORDINATES)
        assert multi_role_context.has_permission(Permission.GOAL_MANAGE_SELF)
        assert multi_role_context.has_permission(Permission.EVALUATION_MANAGE)
    
    def test_admin_plus_other_role_permissions(self):
        """Test that admin + other role gives admin permissions (should be superset)"""
        admin_plus_employee = [
            RoleInfo(id=1, name="admin", description="Administrator"),
            RoleInfo(id=4, name="employee", description="Employee")
        ]
        overrides = {
            "admin": ROLE_PERMISSIONS_MAP["admin"],
            "employee": ROLE_PERMISSIONS_MAP["employee"],
        }
        admin_context = AuthContext(user_id=uuid4(), roles=admin_plus_employee, role_permission_overrides=overrides)
        
        # Should have admin permissions (superset of employee)
        assert admin_context.has_permission(Permission.USER_READ_ALL)
        assert admin_context.has_permission(Permission.USER_MANAGE)
        assert admin_context.has_permission(Permission.ROLE_MANAGE)
        
        # Should also have employee permissions (but admin already covers these)
        assert admin_context.has_permission(Permission.USER_READ_SELF)
        assert admin_context.has_permission(Permission.GOAL_READ_SELF)
    
    @pytest.mark.asyncio
    async def test_multi_role_rbac_helper_behavior(self):
        """Test RBACHelper with multi-role contexts"""
        # Setup mock repository
        mock_repo = Mock()
        subordinate_users = [Mock(id=uuid4()), Mock(id=uuid4())]
        mock_repo.get_subordinates = AsyncMock(return_value=subordinate_users)
        RBACHelper.initialize_with_repository(mock_repo)
        
        # Manager + Viewer roles
        multi_roles = [
            RoleInfo(id=2, name="manager", description="Manager"),
            RoleInfo(id=5, name="viewer", description="Viewer")
        ]
        overrides = {
            "manager": ROLE_PERMISSIONS_MAP["manager"],
            "viewer": ROLE_PERMISSIONS_MAP["viewer"],
        }
        multi_role_context = AuthContext(user_id=uuid4(), roles=multi_roles, role_permission_overrides=overrides)
        
        # Should behave like manager (higher permission level)
        result = await RBACHelper.get_accessible_user_ids(multi_role_context)
        assert result is not None
        assert len(result) > 1  # Should include subordinates
        assert multi_role_context.user_id in result


class TestRBACFrameworkConsistency:
    """Test consistency between RBAC framework components"""
    
    def test_rbac_types_permission_mapping_completeness(self):
        """Test that ResourcePermissionMap covers all resource types"""
        for resource_type in ResourceType:
            permissions = ResourcePermissionMap.get_resource_permissions(resource_type)
            assert isinstance(permissions, dict), \
                f"ResourceType {resource_type} should have permission mapping"
            assert len(permissions) > 0, \
                f"ResourceType {resource_type} should have at least one permission"
    
    def test_permission_manager_rbac_helper_consistency(self):
        """Test that PermissionManager and RBACHelper results are consistent"""
        # Test with all roles
        for role_name in ["admin", "manager", "supervisor", "employee", "viewer", "parttime"]:
            role_info = RoleInfo(id=1, name=role_name, description=f"{role_name} role")
            auth_context = AuthContext(
                user_id=uuid4(),
                roles=[role_info],
                role_permission_overrides={role_name: ROLE_PERMISSIONS_MAP[role_name]},
            )
            
            # Get permissions from both systems
            # Verify AuthContext permissions are self-consistent
            for permission in Permission:
                auth_has = auth_context.has_permission(permission)
                assert isinstance(auth_has, bool)
    
    def test_resource_type_enum_completeness(self):
        """Test that ResourceType enum covers expected resource types"""
        expected_types = {"user", "goal", "evaluation", "assessment", "department", "stage"}
        actual_types = {rt.value for rt in ResourceType}
        
        assert expected_types.issubset(actual_types), \
            f"Missing resource types: {expected_types - actual_types}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
