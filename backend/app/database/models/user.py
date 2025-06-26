from datetime import datetime
from typing import Optional, List
from uuid import UUID
from enum import Enum
from pydantic import BaseModel, Field


class UserStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class UserBase(BaseModel):
    """Base user model matching database schema"""
    id: UUID
    department_id: UUID
    stage_id: UUID
    clerk_user_id: str
    name: str
    email: str
    employee_code: str
    status: UserStatus
    password: Optional[str] = None
    job_title: Optional[str] = None
    hashed_refresh_token: Optional[str] = None
    last_login_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserRole(BaseModel):
    """User role relationship model"""
    user_id: UUID
    role_id: int

    class Config:
        from_attributes = True


class UserSupervisor(BaseModel):
    """User supervisor relationship model"""
    user_id: UUID
    supervisor_id: UUID
    valid_from: datetime
    valid_to: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserWithRelations(UserBase):
    """User model with related data"""
    roles: List[UserRole] = []
    supervisors: List[UserSupervisor] = []
    subordinates: List['UserWithRelations'] = []

    class Config:
        from_attributes = True
