from datetime import datetime
from enum import Enum
from typing import Optional, List, TYPE_CHECKING
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from uuid import UUID

from .common import Permission, PaginatedResponse

if TYPE_CHECKING:
    from .competency import Competency


# ========================================
# ENUMS
# ========================================

class UserStatus(str, Enum):
    PENDING_APPROVAL = "pending_approval"
    ACTIVE = "active"
    INACTIVE = "inactive"


# ========================================
# DEPARTMENT SCHEMAS
# ========================================

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
    users: Optional[PaginatedResponse['UserDetailResponse']] = None


class DepartmentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)


class DepartmentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)


# ========================================
# STAGE SCHEMAS
# ========================================

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
    users: Optional[PaginatedResponse['UserDetailResponse']] = None
    competencies: Optional[List['Competency']] = None


class StageCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)


class StageUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)


# ========================================
# ROLE SCHEMAS
# ========================================

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


# ========================================
# USER BASE SCHEMAS
# ========================================

class UserBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    employee_code: str = Field(..., min_length=1, max_length=20)
    job_title: Optional[str] = Field(None, max_length=100)


class UserProfileOption(UserBase):
    """User schema for signup profile options - UserBase + Role information."""
    id: UUID
    roles: List[Role] = []
    
    model_config = ConfigDict(from_attributes=True)


class UserCreate(UserBase):
    """Schema for creating new user"""
    clerk_user_id: str = Field(..., min_length=1, max_length=50)
    department_id: UUID
    stage_id: UUID
    role_ids: List[int] = Field(default=[], min_length=0, max_length=10)
    supervisor_id: Optional[UUID] = None
    subordinate_ids: List[UUID] = []
    status: Optional[UserStatus] = UserStatus.PENDING_APPROVAL


class UserUpdate(BaseModel):
    """Schema for updating user information"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    employee_code: Optional[str] = Field(None, min_length=1, max_length=20)
    job_title: Optional[str] = Field(None, max_length=100)
    department_id: Optional[UUID] = None
    stage_id: Optional[UUID] = None
    role_ids: Optional[List[int]] = Field(None, min_length=0, max_length=10)
    supervisor_id: Optional[UUID] = None
    status: Optional[UserStatus] = None


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

    model_config = ConfigDict(from_attributes=True)


# ========================================
# USER RESPONSE SCHEMAS
# ========================================


class User(UserInDB):
    """Complete user information with relationships"""
    department: Department
    stage: Stage
    roles: List[Role] = []
    supervisor: Optional['UserDetailResponse'] = None

class UserDetailResponse(BaseModel):
    id: UUID
    clerk_user_id: str
    employee_code: str
    name: str
    email: EmailStr
    status: UserStatus
    job_title: Optional[str] = None
    department: Optional[Department] = None
    stage: Optional[Stage] = None
    roles: List[Role] = []
    supervisor: Optional["UserDetailResponse"] = None
    subordinates: Optional[List["UserDetailResponse"]] = None

    model_config = ConfigDict(from_attributes=True)


class UserPaginatedResponse(PaginatedResponse):
    data: List[UserDetailResponse]


class UserExistsResponse(BaseModel):
    """Minimal user info for existence check during auth flow"""
    exists: bool
    user_id: Optional[UUID] = None
    name: Optional[str] = None  
    email: Optional[EmailStr] = None
    status: Optional[UserStatus] = None

    model_config = ConfigDict(from_attributes=True)


# ========================================
# FORWARD REFERENCES UPDATE
# ========================================

# Update forward references for self-referencing models (Pydantic v2)
try:
    UserDetailResponse.model_rebuild()
except Exception:
    # Ignore forward reference errors for now
    pass
