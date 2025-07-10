"""
Permission Constants - Central location for permission definitions.

This module defines all permission strings in a central location as specified 
in Task #73. These constants are used by the role management system and 
security layer for access control.

📖 For detailed documentation on permissions and RBAC system,
   see: backend/app/security/README.md
"""

from enum import Enum


class Permission(Enum):
    """System permissions for access control."""
    
    # User Management Permissions
    USER_READ_ALL = "user:read:all"              # Admin can read all users
    USER_READ_SUBORDINATES = "user:read:subordinates"  # Managers/Supervisors read subordinates
    USER_READ_SELF = "user:read:self"            # Everyone can read own profile
    USER_MANAGE = "user:manage"                  # Create, update, delete users (admin only)
    
    # Department Management Permissions
    DEPARTMENT_READ = "department:read"          # Read department info (scope determined by role)
    DEPARTMENT_MANAGE = "department:manage"      # Create, update, delete departments (admin only)
    
    # Role Management Permissions
    ROLE_MANAGE = "role:manage"                  # Manage roles (admin only)
    
    # Goal Management Permissions
    GOAL_READ = "goal:read"                      # Read goals (scope determined by role)
    GOAL_MANAGE = "goal:manage"                  # Create, update, delete goals
    GOAL_APPROVE = "goal:approve"                # Approve goals (supervisors and above)
    
    # Evaluation Management Permissions
    EVALUATION_READ = "evaluation:read"          # Read evaluations (scope determined by role)
    EVALUATION_MANAGE = "evaluation:manage"      # Create, update evaluations
    EVALUATION_REVIEW = "evaluation:review"      # Review evaluations (supervisors and above)
    
    # Self Assessment Permissions
    SELF_ASSESSMENT = "self_assessment"          # Create, update, submit self assessments
    
    # Report Management Permissions
    REPORT_ACCESS = "report:access"              # Read and generate reports


# Permission constants as strings for compatibility
class PermissionStrings:
    """String constants for permission checking."""
    
    # User Management
    USER_READ_ALL = Permission.USER_READ_ALL.value
    USER_READ_SUBORDINATES = Permission.USER_READ_SUBORDINATES.value
    USER_READ_SELF = Permission.USER_READ_SELF.value
    USER_MANAGE = Permission.USER_MANAGE.value
    
    # Department Management
    DEPARTMENT_READ = Permission.DEPARTMENT_READ.value
    DEPARTMENT_MANAGE = Permission.DEPARTMENT_MANAGE.value
    
    # Role Management
    ROLE_MANAGE = Permission.ROLE_MANAGE.value
    
    # Goal Management
    GOAL_READ = Permission.GOAL_READ.value
    GOAL_MANAGE = Permission.GOAL_MANAGE.value
    GOAL_APPROVE = Permission.GOAL_APPROVE.value
    
    # Evaluation Management
    EVALUATION_READ = Permission.EVALUATION_READ.value
    EVALUATION_MANAGE = Permission.EVALUATION_MANAGE.value
    EVALUATION_REVIEW = Permission.EVALUATION_REVIEW.value
    
    # Self Assessment
    SELF_ASSESSMENT = Permission.SELF_ASSESSMENT.value
    
    # Reports
    REPORT_ACCESS = Permission.REPORT_ACCESS.value


# List of all available permissions for validation
ALL_PERMISSIONS = [permission.value for permission in Permission]


# Permission groups for easier management
ADMIN_PERMISSIONS = [
    Permission.USER_READ_ALL,
    Permission.USER_MANAGE,
    Permission.DEPARTMENT_READ,
    Permission.DEPARTMENT_MANAGE,
    Permission.ROLE_MANAGE,
    Permission.GOAL_READ,
    Permission.GOAL_MANAGE,
    Permission.GOAL_APPROVE,
    Permission.EVALUATION_READ,
    Permission.EVALUATION_MANAGE,
    Permission.EVALUATION_REVIEW,
    Permission.SELF_ASSESSMENT,
    Permission.REPORT_ACCESS,
]

MANAGER_PERMISSIONS = [
    Permission.USER_READ_SUBORDINATES,
    Permission.USER_READ_SELF,
    Permission.DEPARTMENT_READ,
    Permission.GOAL_READ,
    Permission.GOAL_MANAGE,
    Permission.GOAL_APPROVE,
    Permission.EVALUATION_READ,
    Permission.EVALUATION_MANAGE,
    Permission.EVALUATION_REVIEW,
    Permission.SELF_ASSESSMENT,
    Permission.REPORT_ACCESS,
]

SUPERVISOR_PERMISSIONS = [
    Permission.USER_READ_SUBORDINATES,
    Permission.USER_READ_SELF,
    Permission.DEPARTMENT_READ,
    Permission.GOAL_READ,
    Permission.GOAL_MANAGE,
    Permission.GOAL_APPROVE,
    Permission.EVALUATION_READ,
    Permission.EVALUATION_MANAGE,
    Permission.EVALUATION_REVIEW,
    Permission.SELF_ASSESSMENT,
    Permission.REPORT_ACCESS,
]

EMPLOYEE_PERMISSIONS = [
    Permission.USER_READ_SELF,
    Permission.DEPARTMENT_READ,
    Permission.GOAL_READ,
    Permission.GOAL_MANAGE,
    Permission.EVALUATION_READ,
    Permission.EVALUATION_MANAGE,
    Permission.SELF_ASSESSMENT,
]

VIEWER_PERMISSIONS = [
    Permission.USER_READ_SELF,
    Permission.DEPARTMENT_READ,
    Permission.GOAL_READ,
    Permission.EVALUATION_READ,
    Permission.SELF_ASSESSMENT,
]


def validate_permission(permission: str) -> bool:
    """
    Validate if a permission string is valid.
    
    Args:
        permission: Permission string to validate
        
    Returns:
        bool: True if permission is valid
    """
    return permission in ALL_PERMISSIONS


def get_permissions_for_role(role_name: str) -> list[Permission]:
    """
    Get all permissions for a specific role.
    
    Args:
        role_name: Name of the role
        
    Returns:
        List of permissions for the role
    """
    role_permissions = {
        "admin": ADMIN_PERMISSIONS,
        "manager": MANAGER_PERMISSIONS,
        "supervisor": SUPERVISOR_PERMISSIONS,
        "employee": EMPLOYEE_PERMISSIONS,
        "viewer": VIEWER_PERMISSIONS,
        "parttime": EMPLOYEE_PERMISSIONS,  # Same as employee for now
    }
    
    return role_permissions.get(role_name.lower(), []) 