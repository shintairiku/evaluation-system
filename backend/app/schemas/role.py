"""
Role-related Pydantic schemas for request/response validation.

This module defines schemas for Role CRUD operations as specified in Task #73.
Includes validation rules and proper field definitions.
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator, ConfigDict


class RoleBase(BaseModel):
    """Base role information"""
    name: str = Field(..., min_length=1, max_length=50, description="Role name")
    code: str = Field(..., min_length=1, max_length=20, description="Role code (uppercase)")
    description: str = Field(..., min_length=1, max_length=200, description="Role description")
    permissions: Optional[List[str]] = Field(default_factory=list, description="List of permission strings")
    parent_id: Optional[int] = Field(None, description="Parent role ID for hierarchy")

    @field_validator('code')
    @classmethod
    def validate_code_uppercase(cls, v: str) -> str:
        """Ensure role code is uppercase"""
        if not v.isupper():
            raise ValueError('Role code must be uppercase')
        return v

    @field_validator('permissions')
    @classmethod
    def validate_permissions(cls, v: Optional[List[str]]) -> List[str]:
        """Validate permissions list"""
        if v is None:
            return []
        # Remove duplicates while preserving order
        return list(dict.fromkeys(v))


class RoleCreate(RoleBase):
    """Schema for creating a new role"""
    pass


class RoleUpdate(BaseModel):
    """Schema for updating role information"""
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    code: Optional[str] = Field(None, min_length=1, max_length=20)
    description: Optional[str] = Field(None, min_length=1, max_length=200)
    permissions: Optional[List[str]] = None
    parent_id: Optional[int] = None

    @field_validator('code')
    @classmethod
    def validate_code_uppercase(cls, v: Optional[str]) -> Optional[str]:
        """Ensure role code is uppercase if provided"""
        if v is not None and not v.isupper():
            raise ValueError('Role code must be uppercase')
        return v

    @field_validator('permissions')
    @classmethod
    def validate_permissions(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        """Validate permissions list if provided"""
        if v is None:
            return None
        # Remove duplicates while preserving order
        return list(dict.fromkeys(v))


class Role(RoleBase):
    """Complete role information for responses"""
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RoleDetail(Role):
    """Detailed role information with additional metadata"""
    user_count: Optional[int] = Field(None, description="Number of users with this role")
    parent: Optional['RoleDetail'] = Field(None, description="Parent role information")
    children: Optional[List['RoleDetail']] = Field(default_factory=list, description="Child roles")

    model_config = ConfigDict(from_attributes=True)


class RoleHierarchy(BaseModel):
    """Role hierarchy representation"""
    role: Role
    children: List['RoleHierarchy'] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


# Update forward references for self-referencing models
RoleDetail.model_rebuild()
RoleHierarchy.model_rebuild() 