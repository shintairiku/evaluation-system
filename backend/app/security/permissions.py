"""
Centralized Permission and Role Management System

This module defines all roles, permissions, and access control logic
for the HR Evaluation System.

📖 For detailed documentation on how to add/update/delete permissions,
   see: backend/app/security/README.md

Quick reference:
- Permission enum: Defines all system permissions  
- Role enum: Defines all system roles
Note: Static role-to-permission maps are deprecated; permissions are resolved dynamically from the database.
"""

from enum import Enum
from typing import List, Set


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
    USER_MANAGE_BASIC = "user:manage:basic"  # Permissive update 'name', 'job_title', 'department_id' in UserUpdate schema
    USER_MANAGE_PLUS = "user:manage:plus"    # Permissive update 'subordinate_ids' in UserUpdate schema (+ USER_MANAGE_BASIC)

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
    
    # Self Assessment Management (Updated for role-based access control)
    ASSESSMENT_READ_SELF = "assessment:read:self"      # Read own self assessments
    ASSESSMENT_READ_ALL = "assessment:read:all"        # Read all self assessments (admin)
    ASSESSMENT_READ_SUBORDINATES = "assessment:read:subordinates"  # Read subordinates' assessments
    ASSESSMENT_MANAGE_SELF = "assessment:manage:self"  # Create, update, submit, delete own assessments
    
    # Report Management (Kept as-is, 1 permission)
    REPORT_ACCESS = "report:access"          # Read and generate reports
    
    # Stage Management
    STAGE_READ_ALL = "stage:read:all"        # Admin can read all stages
    STAGE_READ_SELF = "stage:read:self"      # Users can read their own stage info
    STAGE_MANAGE = "stage:manage"            # Create, update, delete stages (admin only)
    
    # Hierarchy Management
    HIERARCHY_MANAGE = "hierarchy:manage"    # Manage supervisor-subordinate relationships


"""
DEPRECATION NOTE:
The static ROLE_PERMISSIONS map has been removed. Permissions are now provided
at runtime by AuthContext using database-backed role-permission assignments.
"""


class PermissionManager:
    """
    DEPRECATED: Static permission checks are no longer supported.
    All authorization is enforced via AuthContext (dynamic, DB-backed).
    These methods intentionally raise to surface any lingering static usage.
    """

    @staticmethod
    def get_role_permissions(role: str) -> Set[Permission]:
        raise NotImplementedError("PermissionManager is deprecated. Use AuthContext.has_permission().")

    @staticmethod
    def has_permission(user_role: str, required_permission: Permission) -> bool:
        raise NotImplementedError("PermissionManager is deprecated. Use AuthContext.has_permission().")

    @staticmethod
    def has_any_permission(user_role: str, required_permissions: List[Permission]) -> bool:
        raise NotImplementedError("PermissionManager is deprecated. Use AuthContext.require_any_permission().")

    @staticmethod
    def has_all_permissions(user_role: str, required_permissions: List[Permission]) -> bool:
        raise NotImplementedError("PermissionManager is deprecated. Use AuthContext methods.")

    @staticmethod
    def get_all_roles() -> List[Role]:
        # Kept for compatibility where a list of role names is needed (enum only)
        return list(Role)

    @staticmethod
    def get_role_description(role: str) -> str:
        raise NotImplementedError("PermissionManager is deprecated. Role descriptions are not static.")

    @staticmethod
    def is_admin_or_manager(user_role: str) -> bool:
        raise NotImplementedError("PermissionManager is deprecated. Use AuthContext permissions.")

    @staticmethod
    def is_supervisor_or_above(user_role: str) -> bool:
        raise NotImplementedError("PermissionManager is deprecated. Use AuthContext permissions.")

    @staticmethod
    def can_manage_users(user_role: str) -> bool:
        raise NotImplementedError("PermissionManager is deprecated. Use AuthContext permissions.")


# Convenience functions removed; use AuthContext in request scope for checks.

# Legacy static permission lists removed.