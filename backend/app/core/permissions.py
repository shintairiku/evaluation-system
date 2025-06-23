""" DESCRIPTION:

Centralized Permission and Role Management System

This module defines all roles, permissions, and access control logic
for the HR Evaluation System based on the API specification.

HOW TO USE THIS SYSTEM:

1. ADDING NEW PERMISSIONS:
   - Add new permission to the Permission enum class
   - Follow naming convention: {RESOURCE}_{ACTION}_{SCOPE} (e.g., USER_READ_ALL)
   - Use descriptive names that clearly indicate what the permission allows

   Example:
   ```python
   class Permission(Enum):
       # Existing permissions...
       DOCUMENT_CREATE = "document:create"
       DOCUMENT_READ_ALL = "document:read:all"
       DOCUMENT_DELETE = "document:delete"
   ```

2. ADDING PERMISSIONS TO A ROLE:
   - Locate the role in ROLE_PERMISSIONS mapping
   - Add the new permission to the role's permissions set
   - Consider the role hierarchy and what makes sense for each role

   Example:
   ```python
   Role.ADMIN: RolePermissions(
       role=Role.ADMIN,
       description="管理者 - 全システム機能へのアクセス",
       permissions={
           # Existing permissions...
           Permission.DOCUMENT_CREATE,      # Add new permission
           Permission.DOCUMENT_READ_ALL,    # Add new permission
           Permission.DOCUMENT_DELETE,      # Add new permission
       }
   )
   ```

3. REMOVING PERMISSIONS FROM A ROLE:
   - Find the role in ROLE_PERMISSIONS mapping
   - Remove the permission from the permissions set
   - Ensure removal doesn't break existing functionality

4. ADDING NEW ROLES:
   - Add new role to the Role enum
   - Create new RolePermissions entry in ROLE_PERMISSIONS mapping
   - Define appropriate permissions for the new role
   - Update legacy compatibility section if needed

   Example:
   ```python
   class Role(Enum):
       # Existing roles...
       CONTRACTOR = "contractor"

   ROLE_PERMISSIONS = {
       # Existing roles...
       Role.CONTRACTOR: RolePermissions(
           role=Role.CONTRACTOR,
           description="契約者 - 限定的なアクセス",
           permissions={
               Permission.USER_READ_SELF,
               Permission.GOAL_READ_OWN,
               # Add appropriate permissions...
           }
       )
   }
   ```

5. CHECKING PERMISSIONS IN CODE:
   ```python
   from app.core.permissions import PermissionManager, Permission

   # Check single permission
   if PermissionManager.has_permission(user_role, Permission.USER_CREATE):
       # Allow user creation

   # Check multiple permissions (any)
   if PermissionManager.has_any_permission(user_role, [
       Permission.USER_READ_ALL, 
       Permission.USER_READ_SUBORDINATES
   ]):
       # Allow user reading

   # Check if user can manage others
   if PermissionManager.can_manage_users(user_role):
       # Allow user management operations
   ```

6. ROLE HIERARCHY (Higher roles typically include lower role permissions):
   ADMIN > MANAGER > SUPERVISOR > EMPLOYEE/VIEWER > PARTTIME

IMPORTANT NOTES:
- Always test permission changes thoroughly
- Consider security implications when adding new permissions
- Update tests when modifying permissions
- Document any breaking changes in permission structure
- Use descriptive permission names that are self-explanatory
"""

from enum import Enum
from typing import List, Set, Dict
from dataclasses import dataclass


class Role(Enum):
    """System roles as defined in the API specification."""
    ADMIN = "admin"
    MANAGER = "manager" 
    SUPERVISOR = "supervisor"
    VIEWER = "viewer"
    EMPLOYEE = "employee"
    PARTTIME = "parttime"


class Permission(Enum):
    """System permissions for various operations."""
    
    # User Management
    USER_READ_ALL = "user:read:all"
    USER_READ_SUBORDINATES = "user:read:subordinates"
    USER_READ_DEPARTMENT = "user:read:department"
    USER_READ_SELF = "user:read:self"
    USER_CREATE = "user:create"
    USER_UPDATE = "user:update"
    USER_DELETE = "user:delete"
    USER_SYNC = "user:sync"
    
    # Department Management
    DEPARTMENT_READ_ALL = "department:read:all"
    DEPARTMENT_READ_MANAGED = "department:read:managed"
    DEPARTMENT_READ_ASSIGNED = "department:read:assigned"
    DEPARTMENT_READ_OWN = "department:read:own"
    DEPARTMENT_CREATE = "department:create"
    DEPARTMENT_UPDATE = "department:update"
    DEPARTMENT_DELETE = "department:delete"
    
    # Role Management
    ROLE_READ = "role:read"
    ROLE_CREATE = "role:create"
    ROLE_UPDATE = "role:update"
    ROLE_DELETE = "role:delete"
    
    # Goal Management
    GOAL_CREATE = "goal:create"
    GOAL_READ_ALL = "goal:read:all"
    GOAL_READ_SUBORDINATES = "goal:read:subordinates"
    GOAL_READ_OWN = "goal:read:own"
    GOAL_UPDATE_OWN = "goal:update:own"
    GOAL_UPDATE_SUBORDINATES = "goal:update:subordinates"
    GOAL_DELETE_OWN = "goal:delete:own"
    GOAL_DELETE_SUBORDINATES = "goal:delete:subordinates"
    GOAL_APPROVE = "goal:approve"
    
    # Evaluation Management
    EVALUATION_CREATE = "evaluation:create"
    EVALUATION_READ_ALL = "evaluation:read:all"
    EVALUATION_READ_SUBORDINATES = "evaluation:read:subordinates" 
    EVALUATION_READ_OWN = "evaluation:read:own"
    EVALUATION_UPDATE_OWN = "evaluation:update:own"
    EVALUATION_SUBMIT = "evaluation:submit"
    EVALUATION_REVIEW = "evaluation:review"
    EVALUATION_DELETE = "evaluation:delete"
    
    # Self Assessment
    SELF_ASSESSMENT_CREATE = "self_assessment:create"
    SELF_ASSESSMENT_UPDATE = "self_assessment:update"
    SELF_ASSESSMENT_SUBMIT = "self_assessment:submit"
    
    # Report Management
    REPORT_READ = "report:read"
    REPORT_GENERATE = "report:generate"


@dataclass
class RolePermissions:
    """Defines permissions for each role."""
    role: Role
    permissions: Set[Permission]
    description: str


# Role Permission Mapping
ROLE_PERMISSIONS: Dict[Role, RolePermissions] = {
    Role.ADMIN: RolePermissions(
        role=Role.ADMIN,
        description="管理者 - 全システム機能へのアクセス",
        permissions={
            # User Management - Full Access
            Permission.USER_READ_ALL,
            Permission.USER_CREATE,
            Permission.USER_UPDATE,
            Permission.USER_DELETE,
            Permission.USER_SYNC,
            
            # Department Management - Full Access
            Permission.DEPARTMENT_READ_ALL,
            Permission.DEPARTMENT_CREATE,
            Permission.DEPARTMENT_UPDATE,
            Permission.DEPARTMENT_DELETE,
            
            # Role Management - Full Access
            Permission.ROLE_READ,
            Permission.ROLE_CREATE,
            Permission.ROLE_UPDATE,
            Permission.ROLE_DELETE,
            
            # Goal Management - Full Access
            Permission.GOAL_CREATE,
            Permission.GOAL_READ_ALL,
            Permission.GOAL_UPDATE_OWN,
            Permission.GOAL_UPDATE_SUBORDINATES,
            Permission.GOAL_DELETE_OWN,
            Permission.GOAL_DELETE_SUBORDINATES,
            Permission.GOAL_APPROVE,
            
            # Evaluation Management - Full Access
            Permission.EVALUATION_CREATE,
            Permission.EVALUATION_READ_ALL,
            Permission.EVALUATION_UPDATE_OWN,
            Permission.EVALUATION_SUBMIT,
            Permission.EVALUATION_REVIEW,
            Permission.EVALUATION_DELETE,
            
            # Self Assessment
            Permission.SELF_ASSESSMENT_CREATE,
            Permission.SELF_ASSESSMENT_UPDATE,
            Permission.SELF_ASSESSMENT_SUBMIT,
            
            # Report Management
            Permission.REPORT_READ,
            Permission.REPORT_GENERATE,
        }
    ),
    
    Role.MANAGER: RolePermissions(
        role=Role.MANAGER,
        description="管理者 - 部下と管理部門へのアクセス",
        permissions={
            # User Management - Subordinates only
            Permission.USER_READ_SUBORDINATES,
            Permission.USER_READ_SELF,
            
            # Department Management - Managed departments
            Permission.DEPARTMENT_READ_MANAGED,
            Permission.DEPARTMENT_READ_OWN,
            
            # Goal Management - Subordinates
            Permission.GOAL_CREATE,
            Permission.GOAL_READ_SUBORDINATES,
            Permission.GOAL_READ_OWN,
            Permission.GOAL_UPDATE_OWN,
            Permission.GOAL_DELETE_OWN,
            Permission.GOAL_APPROVE,
            
            # Evaluation Management - Review subordinates
            Permission.EVALUATION_CREATE,
            Permission.EVALUATION_READ_SUBORDINATES,
            Permission.EVALUATION_READ_OWN,
            Permission.EVALUATION_UPDATE_OWN,
            Permission.EVALUATION_SUBMIT,
            Permission.EVALUATION_REVIEW,
            
            # Self Assessment
            Permission.SELF_ASSESSMENT_CREATE,
            Permission.SELF_ASSESSMENT_UPDATE,
            Permission.SELF_ASSESSMENT_SUBMIT,
            
            # Report Management
            Permission.REPORT_READ,
        }
    ),
    
    Role.SUPERVISOR: RolePermissions(
        role=Role.SUPERVISOR,
        description="スーパーバイザー - 部下の評価と目標承認",
        permissions={
            # User Management - Read subordinates
            Permission.USER_READ_SUBORDINATES,
            Permission.USER_READ_SELF,
            
            # Department Management - Read own
            Permission.DEPARTMENT_READ_OWN,
            
            # Goal Management - Approve subordinates
            Permission.GOAL_CREATE,
            Permission.GOAL_READ_SUBORDINATES,
            Permission.GOAL_READ_OWN,
            Permission.GOAL_UPDATE_OWN,
            Permission.GOAL_DELETE_OWN,
            Permission.GOAL_APPROVE,
            
            # Evaluation Management - Review subordinates
            Permission.EVALUATION_CREATE,
            Permission.EVALUATION_READ_SUBORDINATES,
            Permission.EVALUATION_READ_OWN,
            Permission.EVALUATION_UPDATE_OWN,
            Permission.EVALUATION_SUBMIT,
            Permission.EVALUATION_REVIEW,
            
            # Self Assessment
            Permission.SELF_ASSESSMENT_CREATE,
            Permission.SELF_ASSESSMENT_UPDATE,
            Permission.SELF_ASSESSMENT_SUBMIT,
            
            # Report Management
            Permission.REPORT_READ,
        }
    ),
    
    Role.VIEWER: RolePermissions(
        role=Role.VIEWER,
        description="閲覧者 - 指定された部門・ユーザーの閲覧のみ",
        permissions={
            # User Management - Assigned users only
            Permission.USER_READ_DEPARTMENT,
            Permission.USER_READ_SELF,
            
            # Department Management - Assigned departments
            Permission.DEPARTMENT_READ_ASSIGNED,
            Permission.DEPARTMENT_READ_OWN,
            
            # Goal Management - Read only assigned
            Permission.GOAL_READ_OWN,
            
            # Evaluation Management - Read only assigned
            Permission.EVALUATION_READ_OWN,
            
            # Self Assessment
            Permission.SELF_ASSESSMENT_CREATE,
            Permission.SELF_ASSESSMENT_UPDATE,
            Permission.SELF_ASSESSMENT_SUBMIT,
        }
    ),
    
    Role.EMPLOYEE: RolePermissions(
        role=Role.EMPLOYEE,
        description="一般従業員 - 自身の情報と評価管理",
        permissions={
            # User Management - Self only
            Permission.USER_READ_SELF,
            
            # Department Management - Own department
            Permission.DEPARTMENT_READ_OWN,
            
            # Goal Management - Own goals
            Permission.GOAL_CREATE,
            Permission.GOAL_READ_OWN,
            Permission.GOAL_UPDATE_OWN,
            Permission.GOAL_DELETE_OWN,
            
            # Evaluation Management - Own evaluations
            Permission.EVALUATION_CREATE,
            Permission.EVALUATION_READ_OWN,
            Permission.EVALUATION_UPDATE_OWN,
            Permission.EVALUATION_SUBMIT,
            
            # Self Assessment
            Permission.SELF_ASSESSMENT_CREATE,
            Permission.SELF_ASSESSMENT_UPDATE,
            Permission.SELF_ASSESSMENT_SUBMIT,
        }
    ),
    
    Role.PARTTIME: RolePermissions(
        role=Role.PARTTIME,
        description="パートタイム従業員 - 限定された機能アクセス",
        permissions={
            # User Management - Self only
            Permission.USER_READ_SELF,
            
            # Department Management - Own department
            Permission.DEPARTMENT_READ_OWN,
            
            # Goal Management - Basic goal functions
            Permission.GOAL_CREATE,
            Permission.GOAL_READ_OWN,
            Permission.GOAL_UPDATE_OWN,
            
            # Evaluation Management - Basic evaluation functions
            Permission.EVALUATION_READ_OWN,
            Permission.EVALUATION_UPDATE_OWN,
            Permission.EVALUATION_SUBMIT,
            
            # Self Assessment
            Permission.SELF_ASSESSMENT_CREATE,
            Permission.SELF_ASSESSMENT_UPDATE,
            Permission.SELF_ASSESSMENT_SUBMIT,
        }
    ),
}


class PermissionManager:
    """Central permission management and checking."""
    
    @staticmethod
    def get_role_permissions(role: str) -> Set[Permission]:
        """Get all permissions for a given role."""
        try:
            role_enum = Role(role.lower())
            return ROLE_PERMISSIONS[role_enum].permissions
        except (ValueError, KeyError):
            # Default to employee permissions for unknown roles
            return ROLE_PERMISSIONS[Role.EMPLOYEE].permissions
    
    @staticmethod
    def has_permission(user_role: str, required_permission: Permission) -> bool:
        """Check if a user role has a specific permission."""
        user_permissions = PermissionManager.get_role_permissions(user_role)
        return required_permission in user_permissions
    
    @staticmethod
    def has_any_permission(user_role: str, required_permissions: List[Permission]) -> bool:
        """Check if a user role has any of the required permissions."""
        user_permissions = PermissionManager.get_role_permissions(user_role)
        return any(perm in user_permissions for perm in required_permissions)
    
    @staticmethod
    def has_all_permissions(user_role: str, required_permissions: List[Permission]) -> bool:
        """Check if a user role has all of the required permissions."""
        user_permissions = PermissionManager.get_role_permissions(user_role)
        return all(perm in user_permissions for perm in required_permissions)
    
    @staticmethod
    def get_all_roles() -> List[Role]:
        """Get all available roles."""
        return list(Role)
    
    @staticmethod
    def get_role_description(role: str) -> str:
        """Get description for a role."""
        try:
            role_enum = Role(role.lower())
            return ROLE_PERMISSIONS[role_enum].description
        except (ValueError, KeyError):
            return "Unknown role"
    
    @staticmethod
    def is_admin_or_manager(user_role: str) -> bool:
        """Check if user is admin or manager (common check)."""
        return user_role.lower() in [Role.ADMIN.value, Role.MANAGER.value]
    
    @staticmethod
    def is_supervisor_or_above(user_role: str) -> bool:
        """Check if user is supervisor, manager, or admin."""
        return user_role.lower() in [Role.ADMIN.value, Role.MANAGER.value, Role.SUPERVISOR.value]
    
    @staticmethod
    def can_manage_users(user_role: str) -> bool:
        """Check if user can manage other users."""
        return PermissionManager.has_any_permission(user_role, [
            Permission.USER_READ_ALL,
            Permission.USER_READ_SUBORDINATES,
            Permission.USER_CREATE,
            Permission.USER_UPDATE,
            Permission.USER_DELETE
        ])


# Convenience functions for common permission checks
def require_admin(user_role: str) -> bool:
    """Check if user is admin."""
    return user_role.lower() == Role.ADMIN.value

def require_manager_or_above(user_role: str) -> bool:
    """Check if user is manager or admin."""
    return PermissionManager.is_admin_or_manager(user_role)

def require_supervisor_or_above(user_role: str) -> bool:
    """Check if user is supervisor, manager, or admin."""
    return PermissionManager.is_supervisor_or_above(user_role)

# Legacy permission list for backwards compatibility
# Based on the current endpoints.md specification
LEGACY_PERMISSIONS = {
    "admin": [
        "user:read", "user:write", "user:delete",
        "goal:read", "goal:write", "goal:delete", "goal:approve",
        "evaluation:read", "evaluation:write", "evaluation:delete", "evaluation:review",
        "report:read", "report:generate",
        "department:read", "department:write", "department:delete",
        "role:read", "role:write", "role:delete"
    ],
    "manager": [
        "user:read:subordinates",
        "goal:read", "goal:approve", 
        "evaluation:read", "evaluation:review",
        "report:read",
        "department:read:managed"
    ],
    "supervisor": [
        "user:read:subordinates",
        "goal:read", "goal:approve",
        "evaluation:read", "evaluation:review", 
        "report:read"
    ],
    "viewer": [
        "user:read:assigned",
        "goal:read:assigned",
        "evaluation:read:assigned",
        "department:read:assigned"
    ],
    "employee": [
        "goal:read", "goal:write",
        "evaluation:read", "evaluation:write",
        "self_assessment:create", "self_assessment:update", "self_assessment:submit"
    ],
    "parttime": [
        "goal:read", "goal:write:limited",
        "evaluation:read", "evaluation:write:limited",
        "self_assessment:create", "self_assessment:update"
    ]
}