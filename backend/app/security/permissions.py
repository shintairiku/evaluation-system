"""
Centralized Permission and Role Management System

This module defines all roles, permissions, and access control logic
for the HR Evaluation System.

📖 For detailed documentation on how to add/update/delete permissions,
   see: backend/app/security/README.md

Quick reference:
- Permission enum: Defines all system permissions  
- Role enum: Defines all system roles
- ROLE_PERMISSIONS: Maps roles to their permissions
- PermissionManager: Helper class for permission checking
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
    """Simplified system permissions for essential operations."""
    
    # User Management (Consolidated from 8 to 3)
    USER_READ_ALL = "user:read:all"          # Admin can read all users
    USER_READ_SUBORDINATES = "user:read:subordinates"  # Managers/Supervisors read subordinates
    USER_READ_SELF = "user:read:self"        # Everyone can read own profile
    USER_MANAGE = "user:manage"              # Create, update, delete users (admin only)
    
    # Department Management (Consolidated from 7 to 2)
    DEPARTMENT_READ = "department:read"      # Read department info (scope determined by role)
    DEPARTMENT_MANAGE = "department:manage"  # Create, update, delete departments (admin only)
    
    # Role Management (Consolidated from 4 to 2)
    ROLE_READ_ALL = "role:read:all"          # Read all roles (admin, manager, supervisor, viewer, employee, parttime)
    ROLE_MANAGE = "role:manage"              # Manage roles (admin only)
    
    # Goal Management (Following Japanese feedback specification)
    GOAL_READ_SELF = "goal:read:self"        # 自身のゴール(目標)のみ取得可能 (employee, parttime適用)
    GOAL_READ_ALL = "goal:read:all"          # Read all goals (admin only)
    GOAL_READ_SUBORDINATES = "goal:read:subordinates"  # 部下の目標を取得可能 (部下を持つロール適用)
    GOAL_MANAGE = "goal:manage"              # Create, update, delete all goals (admin only)
    GOAL_MANAGE_SELF = "goal:manage:self"    # Create, update, delete own goals only
    GOAL_APPROVE = "goal:approve"            # Approve goals (supervisors and above)
    
    # Evaluation Management (Consolidated from 8 to 3)
    EVALUATION_READ = "evaluation:read"      # Read evaluations (scope determined by role)
    EVALUATION_MANAGE = "evaluation:manage" # Create, update evaluations
    EVALUATION_REVIEW = "evaluation:review" # Review evaluations (supervisors and above)
    
    # Competency Management (Added for competency feature)
    COMPETENCY_READ = "competency:read"      # Read competencies (scope determined by role)
    COMPETENCY_READ_SELF = "competency:read:self"  # Read competencies for own stage
    COMPETENCY_MANAGE = "competency:manage"  # Create, update, delete competencies (admin only)
    
    # Self Assessment (Kept as-is, 1 permission)
    SELF_ASSESSMENT = "self_assessment"      # Create, update, submit self assessments
    
    # Report Management (Kept as-is, 1 permission)
    REPORT_ACCESS = "report:access"          # Read and generate reports
    
    # Stage Management
    STAGE_READ_ALL = "stage:read:all"        # Admin can read all stages
    STAGE_READ_SELF = "stage:read:self"      # Users can read their own stage info
    STAGE_MANAGE = "stage:manage"            # Create, update, delete stages (admin only)


@dataclass
class RolePermissions:
    """Defines permissions for each role."""
    role: Role
    permissions: Set[Permission]
    description: str


# Simplified Role Permission Mapping
ROLE_PERMISSIONS: Dict[Role, RolePermissions] = {
    Role.ADMIN: RolePermissions(
        role=Role.ADMIN,
        description="管理者 - 全システム機能へのアクセス",
        permissions={
            # User Management - Full Access
            Permission.USER_READ_ALL,
            Permission.USER_MANAGE,
            
            # Department Management - Full Access
            Permission.DEPARTMENT_READ,
            Permission.DEPARTMENT_MANAGE,
            
            # Role Management - Full Access
            Permission.ROLE_READ_ALL,
            Permission.ROLE_MANAGE,
            
            # Goal Management - Full Access
            Permission.GOAL_READ_SELF,
            Permission.GOAL_READ_ALL,
            Permission.GOAL_MANAGE,
            Permission.GOAL_MANAGE_SELF,
            Permission.GOAL_APPROVE,
            
            # Evaluation Management - Full Access
            Permission.EVALUATION_READ,
            Permission.EVALUATION_MANAGE,
            Permission.EVALUATION_REVIEW,
            
            # Competency Management - Full Access
            Permission.COMPETENCY_READ,
            Permission.COMPETENCY_MANAGE,
            
            # Self Assessment & Reports
            Permission.SELF_ASSESSMENT,
            Permission.REPORT_ACCESS,
            
            # Stage Management - Full Access
            Permission.STAGE_READ_ALL,
            Permission.STAGE_MANAGE,
        }
    ),
    
    Role.MANAGER: RolePermissions(
        role=Role.MANAGER,
        description="管理者 - 部下と管理部門へのアクセス",
        permissions={
            # User Management - Subordinates
            Permission.USER_READ_SUBORDINATES,
            Permission.USER_READ_SELF,
            
            # Department Management - Read access
            Permission.DEPARTMENT_READ,
            
            # Role Management - Read access
            Permission.ROLE_READ_ALL,
            
            # Goal Management - Self and subordinates
            Permission.GOAL_READ_SELF,
            Permission.GOAL_READ_SUBORDINATES,
            Permission.GOAL_MANAGE_SELF,
            Permission.GOAL_APPROVE,
            
            # Evaluation Management - Review subordinates
            Permission.EVALUATION_READ,
            Permission.EVALUATION_MANAGE,
            Permission.EVALUATION_REVIEW,
            
            # Competency Management - Read access
            Permission.COMPETENCY_READ_SELF,
            
            # Self Assessment & Reports
            Permission.SELF_ASSESSMENT,
            Permission.REPORT_ACCESS,
            
            # Stage Management - Read All
            Permission.STAGE_READ_ALL,
        }
    ),
    
    Role.SUPERVISOR: RolePermissions(
        role=Role.SUPERVISOR,
        description="スーパーバイザー - 部下の評価と目標承認",
        permissions={
            # User Management - Read subordinates
            Permission.USER_READ_SUBORDINATES,
            Permission.USER_READ_SELF,
            
            # Department Management - Read access
            Permission.DEPARTMENT_READ,
            
            # Role Management - Read access
            Permission.ROLE_READ_ALL,
            
            # Goal Management - Self and subordinates
            Permission.GOAL_READ_SELF,
            Permission.GOAL_READ_SUBORDINATES,
            Permission.GOAL_MANAGE_SELF,
            Permission.GOAL_APPROVE,
            
            # Evaluation Management - Review subordinates
            Permission.EVALUATION_READ,
            Permission.EVALUATION_MANAGE,
            Permission.EVALUATION_REVIEW,
            
            # Competency Management - Read access
            Permission.COMPETENCY_READ_SELF,
            
            # Self Assessment & Reports
            Permission.SELF_ASSESSMENT,
            Permission.REPORT_ACCESS,
            
            # Stage Management - Read All
            Permission.STAGE_READ_ALL,
        }
    ),
    
    Role.VIEWER: RolePermissions(
        role=Role.VIEWER,
        description="閲覧者 - 指定された部門・ユーザーの閲覧のみ",
        permissions={
            # User Management - Read self
            Permission.USER_READ_SELF,
            
            # Department Management - Read access
            Permission.DEPARTMENT_READ,
            
            # Role Management - Read access
            Permission.ROLE_READ_ALL,
            
            # Goal Management - Self only
            Permission.GOAL_READ_SELF,
            
            # Evaluation Management - Read only
            Permission.EVALUATION_READ,
            
            # Competency Management - Read access
            Permission.COMPETENCY_READ_SELF,
            
            # Self Assessment only
            Permission.SELF_ASSESSMENT,
            
            # Stage Management - Read All
            Permission.STAGE_READ_ALL,
        }
    ),
    
    Role.EMPLOYEE: RolePermissions(
        role=Role.EMPLOYEE,
        description="一般従業員 - 自身の情報と評価管理",
        permissions={
            # User Management - Self only
            Permission.USER_READ_SELF,
            
            # Department Management - Read own
            Permission.DEPARTMENT_READ,
            
            # Role Management - Read access
            Permission.ROLE_READ_ALL,
            
            # Goal Management - Self only (自分の目標のみ)
            Permission.GOAL_READ_SELF,
            Permission.GOAL_MANAGE_SELF,
            
            # Evaluation Management - Own evaluations
            Permission.EVALUATION_READ,
            Permission.EVALUATION_MANAGE,
            
            # Competency Management - Read access
            Permission.COMPETENCY_READ_SELF,
            
            # Self Assessment
            Permission.SELF_ASSESSMENT,
            
            # Stage Management - Read All
            Permission.STAGE_READ_ALL,
        }
    ),
    
    Role.PARTTIME: RolePermissions(
        role=Role.PARTTIME,
        description="パートタイム従業員 - 限定された機能アクセス",
        permissions={
            # User Management - Self only
            Permission.USER_READ_SELF,
            
            # Department Management - Read own
            Permission.DEPARTMENT_READ,
            
            # Role Management - Read access
            Permission.ROLE_READ_ALL,
            
            # Goal Management - Self only (自分の目標のみ)
            Permission.GOAL_READ_SELF,
            Permission.GOAL_MANAGE_SELF,
            
            # Evaluation Management - Basic functions
            Permission.EVALUATION_READ,
            Permission.EVALUATION_MANAGE,
            
            # Competency Management - Read access
            Permission.COMPETENCY_READ_SELF,
            
            # Self Assessment
            Permission.SELF_ASSESSMENT,
            
            # Stage Management - Read All
            Permission.STAGE_READ_ALL,
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
            Permission.USER_MANAGE
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