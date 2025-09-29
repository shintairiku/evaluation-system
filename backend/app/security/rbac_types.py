"""
RBAC Type Definitions

This module defines resource types and permission mappings for the standardized
RBAC framework. These types enable consistent role-based data filtering across
all service functions.
"""

from enum import Enum
from typing import Dict
from .permissions import Permission


class ResourceType(Enum):
    """Resource types that support RBAC filtering."""
    USER = "user"
    GOAL = "goal"
    EVALUATION = "evaluation"
    ASSESSMENT = "assessment"
    DEPARTMENT = "department"
    STAGE = "stage"


class ResourcePermissionMap:
    """Maps resource types to their corresponding permissions for different access levels."""
    
    PERMISSION_MAP: Dict[ResourceType, Dict[str, Permission]] = {
        ResourceType.USER: {
            "read_all": Permission.USER_READ_ALL,
            "read_subordinates": Permission.USER_READ_SUBORDINATES,
            "read_self": Permission.USER_READ_SELF,
            "manage": Permission.USER_MANAGE
        },
        ResourceType.GOAL: {
            "read_all": Permission.GOAL_READ_ALL,
            "read_subordinates": Permission.GOAL_READ_SUBORDINATES,
            "read_self": Permission.GOAL_READ_SELF,
            "manage": Permission.GOAL_MANAGE,
            "manage_self": Permission.GOAL_MANAGE_SELF,
            "approve": Permission.GOAL_APPROVE
        },
        ResourceType.EVALUATION: {
            "read": Permission.EVALUATION_READ,
            "manage": Permission.EVALUATION_MANAGE,
            "review": Permission.EVALUATION_REVIEW
        },
        ResourceType.ASSESSMENT: {
            "read_all": Permission.ASSESSMENT_READ_ALL,
            "read_subordinates": Permission.ASSESSMENT_READ_SUBORDINATES,
            "read_self": Permission.ASSESSMENT_READ_SELF,
            "manage_self": Permission.ASSESSMENT_MANAGE_SELF
        },
        ResourceType.DEPARTMENT: {
            "read": Permission.DEPARTMENT_READ,
            "manage": Permission.DEPARTMENT_MANAGE
        },
        ResourceType.STAGE: {
            "read_all": Permission.STAGE_READ_ALL,
            "read_self": Permission.STAGE_READ_SELF,
            "manage": Permission.STAGE_MANAGE
        }
    }
    
    @classmethod
    def get_resource_permissions(cls, resource_type: ResourceType) -> Dict[str, Permission]:
        """Get all permissions available for a specific resource type."""
        return cls.PERMISSION_MAP.get(resource_type, {})
    
    @classmethod
    def get_permission_for_access_level(
        cls, 
        resource_type: ResourceType, 
        access_level: str
    ) -> Permission:
        """Get the specific permission for a resource type and access level."""
        resource_permissions = cls.get_resource_permissions(resource_type)
        if access_level not in resource_permissions:
            raise ValueError(
                f"Access level '{access_level}' not available for resource type '{resource_type.value}'"
            )
        return resource_permissions[access_level]


class AccessLevel(Enum):
    """Standard access levels used across resources."""
    ALL = "all"           # Full access to all resources of this type
    SUBORDINATES = "subordinates"  # Access to subordinates' resources only
    SELF = "self"         # Access to own resources only
    MANAGE = "manage"     # Management permissions (create/update/delete)
    READ = "read"         # Read-only access
    REVIEW = "review"     # Review/approval permissions