from datetime import datetime
from enum import Enum
from typing import Optional, List, TYPE_CHECKING
from pydantic import BaseModel, Field, EmailStr, field_validator
from uuid import UUID

from .common import Permission, PaginatedResponse

if TYPE_CHECKING:
    from .competency import Competency

class UserStatus(str, Enum):
    """User account status enumeration"""
    ACTIVE = "active"      # User can access the system
    INACTIVE = "inactive"  # User account is disabled


class Department(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None


class DepartmentDetail(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    # NOTE: below metadata is optional; not finalized yet. Refine metadata based on UI requirement. 
    user_count: Optional[int] = None
    manager_id: Optional[UUID] = None
    manager_name: Optional[str] = None
    users: Optional[PaginatedResponse['UserProfile']] = None


class DepartmentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)


class DepartmentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)


class Stage(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None


class StageDetail(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    # NOTE: below metadata is optional; not finalized yet. Refine metadata based on UI requirement.
    user_count: Optional[int] = None
    competency_count: Optional[int] = None
    users: Optional[PaginatedResponse['UserProfile']] = None
    competencies: Optional[List['Competency']] = None


class StageCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)


class StageUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)


class Role(BaseModel):
    """Role information"""
    id: int
    name: str
    description: Optional[str] = None


class RoleDetail(BaseModel):
    id: int
    name: str
    description: str
    permissions: List[Permission]
    user_count: Optional[int] = None


class RoleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    description: str = Field(..., min_length=1, max_length=200)


class RoleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = Field(None, min_length=1, max_length=200)


class UserBase(BaseModel):
    """Base user schema with common fields"""
    name: str = Field(..., min_length=1, max_length=100, description="Full name of the user")
    email: EmailStr = Field(..., description="User's email address")
    employee_code: str = Field(..., min_length=1, max_length=20, description="Unique employee identifier")
    job_title: Optional[str] = Field(None, max_length=100, description="User's job title")


class UserCreate(UserBase):
    """Schema for creating new user"""
    clerk_user_id: str = Field(..., min_length=1, max_length=50)
    department_id: UUID
    stage_id: UUID
    role_ids: List[int] = Field(default=[], min_items=0, max_items=10)
    supervisor_id: Optional[UUID] = None
    
    @field_validator('role_ids')
    @classmethod
    def validate_role_ids(cls, v):
        if len(set(v)) != len(v):
            raise ValueError('Duplicate role IDs not allowed')
        return v
    
    @field_validator('employee_code')
    @classmethod
    def validate_employee_code(cls, v):
        if not v.replace('-', '').replace('_', '').isalnum():
            raise ValueError('Employee code must be alphanumeric (with optional - or _)')
        return v.upper()


class UserUpdate(BaseModel):
    """Schema for updating user information"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    employee_code: Optional[str] = Field(None, min_length=1, max_length=20)
    job_title: Optional[str] = Field(None, max_length=100)
    department_id: Optional[UUID] = None
    stage_id: Optional[UUID] = None
    role_ids: Optional[List[int]] = Field(None, min_items=0, max_items=10)
    supervisor_id: Optional[UUID] = None
    status: Optional[UserStatus] = None
    
    @field_validator('role_ids')
    @classmethod
    def validate_role_ids(cls, v):
        if v is not None and len(set(v)) != len(v):
            raise ValueError('Duplicate role IDs not allowed')
        return v
    
    @field_validator('employee_code')
    @classmethod
    def validate_employee_code(cls, v):
        if v is not None:
            if not v.replace('-', '').replace('_', '').isalnum():
                raise ValueError('Employee code must be alphanumeric (with optional - or _)')
            return v.upper()
        return v


class UserInDB(UserBase):
    """User model as stored in database"""
    id: UUID
    clerk_user_id: str
    status: UserStatus = UserStatus.ACTIVE
    department_id: UUID
    stage_id: UUID
    supervisor_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    last_login_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class User(UserInDB):
    """Complete user information with relationships"""
    department: Department
    stage: Stage
    roles: List[Role] = []
    supervisor: Optional['UserProfile'] = None


class UserProfile(BaseModel):
    """User profile for display purposes"""
    id: UUID
    clerk_user_id: str
    employee_code: str
    name: str
    email: EmailStr
    status: UserStatus
    job_title: Optional[str] = None
    department: Department
    stage: Stage
    roles: List[Role] = []
    last_login_at: Optional[datetime] = None


# Response Models
class UserCreateResponse(BaseModel):
    """Response after successful user creation"""
    user: 'User'
    message: str = "User created successfully"


class UserUpdateResponse(BaseModel):
    """Response after successful user update"""
    user: 'User'
    message: str = "User updated successfully"


class UserInactivateResponse(BaseModel):
    """Response after successful user inactivation"""
    success: bool
    message: str = "User inactivated successfully"


# UserList removed - use PaginatedResponse[UserProfile] instead

# Rebuild models with forward references for Pydantic v2 compatibility
# Note: StageDetail.model_rebuild() excluded due to undefined Competency annotation
User.model_rebuild()
UserProfile.model_rebuild()
DepartmentDetail.model_rebuild()
RoleDetail.model_rebuild()
UserCreateResponse.model_rebuild()
UserUpdateResponse.model_rebuild()