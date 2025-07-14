from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict

from .common import Permission


class Role(BaseModel):
    """Basic role information"""
    id: UUID
    name: str
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class RoleCreate(BaseModel):
    """Schema for creating a new role"""
    name: str = Field(..., min_length=1, max_length=50)
    description: str = Field(..., min_length=1, max_length=200)


class RoleUpdate(BaseModel):
    """Schema for updating a role"""
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = Field(None, min_length=1, max_length=200)


class RoleDetail(BaseModel):
    """Schema for detailed role information"""
    id: UUID
    name: str
    description: str
    created_at: datetime
    updated_at: datetime
    permissions: Optional[List[Permission]] = []
    user_count: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)