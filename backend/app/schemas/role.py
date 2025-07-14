from typing import Optional
from pydantic import BaseModel, Field


class RoleCreate(BaseModel):
    """Schema for creating a new role"""
    name: str = Field(..., min_length=1, max_length=50)
    description: str = Field(..., min_length=1, max_length=200)


class RoleUpdate(BaseModel):
    """Schema for updating a role"""
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = Field(None, min_length=1, max_length=200)


class RoleDetail(BaseModel):
    """Schema for role details"""
    id: int
    name: str
    description: str

    class Config:
        from_attributes = True