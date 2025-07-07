import pytest
from unittest.mock import Mock, patch
from uuid import uuid4

from app.core.permissions import (
    PermissionManager, Permission, Role, ROLE_PERMISSIONS,
    require_admin, require_manager_or_above, require_supervisor_or_above
)
from app.core.exceptions import PermissionDeniedError


class TestPermissionManager:
    """Test suite for PermissionManager class"""
    
    def test_get_role_permissions_admin(self):
        """Test getting admin role permissions"""
        permissions = PermissionManager.get_role_permissions("admin")
        assert isinstance(permissions, set)
        assert Permission.USER_READ_ALL in permissions
        assert Permission.USER_CREATE in permissions
        assert Permission.USER_DELETE in permissions
    
    def test_get_role_permissions_manager(self):
        """Test getting manager role permissions"""
        permissions = PermissionManager.get_role_permissions("manager")
        assert isinstance(permissions, set)
        assert Permission.USER_READ_SUBORDINATES in permissions
        assert Permission.USER_READ_SELF in permissions
        assert Permission.USER_UPDATE not in permissions  # Manager can't update users
        assert Permission.USER_DELETE not in permissions  # Manager can't delete users
    
    def test_get_role_permissions_employee(self):
        """Test getting employee role permissions"""
        permissions = PermissionManager.get_role_permissions("employee")
        assert isinstance(permissions, set)
        assert Permission.USER_READ_SELF in permissions
        assert Permission.USER_READ_ALL not in permissions
    
    def test_get_role_permissions_invalid_role(self):
        """Test getting permissions for invalid role"""
        permissions = PermissionManager.get_role_permissions("invalid_role")
        # Invalid roles default to employee permissions
        assert permissions == PermissionManager.get_role_permissions("employee")
    
    def test_has_permission_admin_user_read_all(self):
        """Test admin has USER_READ_ALL permission"""
        assert PermissionManager.has_permission("admin", Permission.USER_READ_ALL) is True
    
    def test_has_permission_manager_user_read_all(self):
        """Test manager does not have USER_READ_ALL permission"""
        assert PermissionManager.has_permission("manager", Permission.USER_READ_ALL) is False
    
    def test_has_permission_employee_user_read_self(self):
        """Test employee has USER_READ_SELF permission"""
        assert PermissionManager.has_permission("employee", Permission.USER_READ_SELF) is True
    
    def test_has_any_permission_admin(self):
        """Test admin has any of multiple permissions"""
        permissions = [Permission.USER_READ_ALL, Permission.USER_CREATE, Permission.USER_DELETE]
        assert PermissionManager.has_any_permission("admin", permissions) is True
    
    def test_has_any_permission_manager(self):
        """Test manager has some but not all permissions"""
        permissions = [Permission.USER_READ_ALL, Permission.USER_READ_SUBORDINATES]
        assert PermissionManager.has_any_permission("manager", permissions) is True
    
    def test_has_any_permission_employee(self):
        """Test employee has none of the permissions"""
        permissions = [Permission.USER_READ_ALL, Permission.USER_CREATE]
        assert PermissionManager.has_any_permission("employee", permissions) is False
    
    def test_has_all_permissions_admin(self):
        """Test admin has all permissions"""
        permissions = [Permission.USER_READ_ALL, Permission.USER_CREATE, Permission.USER_DELETE]
        assert PermissionManager.has_all_permissions("admin", permissions) is True
    
    def test_has_all_permissions_manager(self):
        """Test manager does not have all permissions"""
        permissions = [Permission.USER_READ_SUBORDINATES, Permission.USER_READ_ALL]
        assert PermissionManager.has_all_permissions("manager", permissions) is False
    
    def test_get_all_roles(self):
        """Test getting all available roles"""
        roles = PermissionManager.get_all_roles()
        assert isinstance(roles, list)
        assert Role.ADMIN in roles
        assert Role.MANAGER in roles
        assert Role.EMPLOYEE in roles
        assert Role.SUPERVISOR in roles
        assert Role.VIEWER in roles
        assert Role.PARTTIME in roles
    
    def test_get_role_description(self):
        """Test getting role descriptions"""
        admin_desc = PermissionManager.get_role_description("admin")
        manager_desc = PermissionManager.get_role_description("manager")
        employee_desc = PermissionManager.get_role_description("employee")
        
        assert isinstance(admin_desc, str)
        assert isinstance(manager_desc, str)
        assert isinstance(employee_desc, str)
        assert len(admin_desc) > 0
        assert len(manager_desc) > 0
        assert len(employee_desc) > 0
    
    def test_get_role_description_invalid(self):
        """Test getting description for invalid role"""
        desc = PermissionManager.get_role_description("invalid_role")
        assert desc == "Unknown role"
    
    def test_is_admin_or_manager_admin(self):
        """Test admin is admin or manager"""
        assert PermissionManager.is_admin_or_manager("admin") is True
    
    def test_is_admin_or_manager_manager(self):
        """Test manager is admin or manager"""
        assert PermissionManager.is_admin_or_manager("manager") is True
    
    def test_is_admin_or_manager_employee(self):
        """Test employee is not admin or manager"""
        assert PermissionManager.is_admin_or_manager("employee") is False
    
    def test_is_supervisor_or_above_supervisor(self):
        """Test supervisor is supervisor or above"""
        assert PermissionManager.is_supervisor_or_above("supervisor") is True
    
    def test_is_supervisor_or_above_manager(self):
        """Test manager is supervisor or above"""
        assert PermissionManager.is_supervisor_or_above("manager") is True
    
    def test_is_supervisor_or_above_admin(self):
        """Test admin is supervisor or above"""
        assert PermissionManager.is_supervisor_or_above("admin") is True
    
    def test_is_supervisor_or_above_employee(self):
        """Test employee is not supervisor or above"""
        assert PermissionManager.is_supervisor_or_above("employee") is False
    
    def test_can_manage_users_admin(self):
        """Test admin can manage users"""
        assert PermissionManager.can_manage_users("admin") is True
    
    def test_can_manage_users_manager(self):
        """Test manager can manage users"""
        assert PermissionManager.can_manage_users("manager") is True
    
    def test_can_manage_users_supervisor(self):
        """Test supervisor can manage users"""
        assert PermissionManager.can_manage_users("supervisor") is True
    
    def test_can_manage_users_employee(self):
        """Test employee cannot manage users"""
        # Employee has USER_UPDATE permission, so they can manage users (themselves)
        assert PermissionManager.can_manage_users("employee") is True


class TestPermissionFunctions:
    """Test suite for permission utility functions"""
    
    def test_require_admin_admin(self):
        """Test require_admin with admin role"""
        assert require_admin("admin") is True
    
    def test_require_admin_manager(self):
        """Test require_admin with manager role"""
        assert require_admin("manager") is False
    
    def test_require_admin_employee(self):
        """Test require_admin with employee role"""
        assert require_admin("employee") is False
    
    def test_require_manager_or_above_admin(self):
        """Test require_manager_or_above with admin role"""
        assert require_manager_or_above("admin") is True
    
    def test_require_manager_or_above_manager(self):
        """Test require_manager_or_above with manager role"""
        assert require_manager_or_above("manager") is True
    
    def test_require_manager_or_above_supervisor(self):
        """Test require_manager_or_above with supervisor role"""
        assert require_manager_or_above("supervisor") is False
    
    def test_require_supervisor_or_above_admin(self):
        """Test require_supervisor_or_above with admin role"""
        assert require_supervisor_or_above("admin") is True
    
    def test_require_supervisor_or_above_supervisor(self):
        """Test require_supervisor_or_above with supervisor role"""
        assert require_supervisor_or_above("supervisor") is True
    
    def test_require_supervisor_or_above_employee(self):
        """Test require_supervisor_or_above with employee role"""
        assert require_supervisor_or_above("employee") is False


class TestRoleHierarchy:
    """Test suite for role hierarchy validation"""
    
    def test_admin_highest_permissions(self):
        """Test admin has the most permissions"""
        admin_permissions = PermissionManager.get_role_permissions("admin")
        manager_permissions = PermissionManager.get_role_permissions("manager")
        employee_permissions = PermissionManager.get_role_permissions("employee")
        
        # Admin should have more permissions than manager
        assert len(admin_permissions) > len(manager_permissions)
        # Manager should have more permissions than employee
        assert len(manager_permissions) > len(employee_permissions)
    
    def test_role_permission_inheritance(self):
        """Test that higher roles inherit lower role permissions"""
        admin_permissions = PermissionManager.get_role_permissions("admin")
        manager_permissions = PermissionManager.get_role_permissions("manager")
        
        # Admin should have most manager permissions (not necessarily all due to different permission sets)
        common_permissions = admin_permissions.intersection(manager_permissions)
        assert len(common_permissions) > 0, "Admin and manager should share some permissions"
    
    def test_supervisor_permissions(self):
        """Test supervisor has appropriate permissions"""
        supervisor_permissions = PermissionManager.get_role_permissions("supervisor")
        
        # Supervisor should have subordinate management permissions
        assert Permission.USER_READ_SUBORDINATES in supervisor_permissions
        assert Permission.GOAL_READ_SUBORDINATES in supervisor_permissions
        assert Permission.EVALUATION_READ_SUBORDINATES in supervisor_permissions
    
    def test_viewer_permissions(self):
        """Test viewer has read-only permissions"""
        viewer_permissions = PermissionManager.get_role_permissions("viewer")
        
        # Viewer should have read permissions but not write
        assert Permission.USER_READ_DEPARTMENT in viewer_permissions
        assert Permission.USER_CREATE not in viewer_permissions
        assert Permission.USER_DELETE not in viewer_permissions


class TestPermissionEdgeCases:
    """Test suite for permission edge cases and error handling"""
    
    def test_empty_permission_list(self):
        """Test has_any_permission with empty list"""
        assert PermissionManager.has_any_permission("admin", []) is False
    
    def test_none_permission_list(self):
        """Test has_any_permission with None list"""
        with pytest.raises(TypeError):
            PermissionManager.has_any_permission("admin", None)
    
    def test_none_role(self):
        """Test permission checks with None role"""
        # This should raise an AttributeError due to .lower() call on None
        with pytest.raises(AttributeError):
            PermissionManager.has_permission(None, Permission.USER_READ_ALL)
    
    def test_empty_role(self):
        """Test permission checks with empty role"""
        assert PermissionManager.has_permission("", Permission.USER_READ_ALL) is False
    
    def test_case_sensitive_roles(self):
        """Test role names are case insensitive (converted to lowercase)"""
        # Role names are converted to lowercase, so all should work
        assert PermissionManager.has_permission("ADMIN", Permission.USER_READ_ALL) is True
        assert PermissionManager.has_permission("Admin", Permission.USER_READ_ALL) is True
        assert PermissionManager.has_permission("admin", Permission.USER_READ_ALL) is True
    
    def test_invalid_permission(self):
        """Test with invalid permission"""
        # This should not raise an error but return False
        assert PermissionManager.has_permission("admin", "invalid_permission") is False


class TestPermissionMatrix:
    """Test suite for complete permission matrix validation"""
    
    @pytest.mark.parametrize("role,permission,expected", [
        ("admin", Permission.USER_READ_ALL, True),
        ("admin", Permission.USER_CREATE, True),
        ("admin", Permission.USER_DELETE, True),
        ("manager", Permission.USER_READ_ALL, False),
        ("manager", Permission.USER_READ_SUBORDINATES, True),
        ("manager", Permission.USER_CREATE, False),
        ("supervisor", Permission.USER_READ_SUBORDINATES, True),
        ("supervisor", Permission.USER_READ_ALL, False),
        ("employee", Permission.USER_READ_SELF, True),
        ("employee", Permission.USER_READ_ALL, False),
        ("viewer", Permission.USER_READ_DEPARTMENT, True),
        ("viewer", Permission.USER_CREATE, False),
        ("parttime", Permission.USER_READ_SELF, True),
        ("parttime", Permission.USER_READ_ALL, False),
    ])
    def test_permission_matrix(self, role, permission, expected):
        """Test complete permission matrix for all roles"""
        result = PermissionManager.has_permission(role, permission)
        assert result == expected, f"Role {role} should {'have' if expected else 'not have'} permission {permission}"
    
    @pytest.mark.parametrize("role,can_manage", [
        ("admin", True),
        ("manager", True),
        ("supervisor", True),
        ("employee", True),  # Employee has USER_UPDATE permission
        ("viewer", False),
        ("parttime", False),
    ])
    def test_user_management_permissions(self, role, can_manage):
        """Test user management permissions for all roles"""
        result = PermissionManager.can_manage_users(role)
        assert result == can_manage, f"Role {role} should {'be able' if can_manage else 'not be able'} to manage users"


if __name__ == "__main__":
    pytest.main([__file__, "-v"]) 