from datetime import datetime
from enum import Enum
from typing import Optional, List, TYPE_CHECKING
from pydantic import BaseModel, Field, EmailStr
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
    id: int
    name: str
    description: str


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
    
    class Config:
        from_attributes = True


class UserCreate(UserBase):
    clerk_user_id: str = Field(..., min_length=1)
    department_id: Optional[UUID] = None
    stage_id: Optional[UUID] = None
    role_ids: List[int] = []
    supervisor_id: Optional[UUID] = None
    subordinate_ids: List[UUID] = []
    status: Optional[UserStatus] = UserStatus.PENDING_APPROVAL


class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    employee_code: Optional[str] = Field(None, min_length=1, max_length=20)
    job_title: Optional[str] = Field(None, max_length=100)
    department_id: Optional[UUID] = None
    stage_id: Optional[UUID] = None
    role_ids: Optional[List[int]] = None
    status: Optional[UserStatus] = None


class UserInDB(UserBase):
    id: UUID
    clerk_user_id: str
    status: UserStatus = UserStatus.ACTIVE
    department_id: UUID
    stage_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ========================================
# USER RESPONSE SCHEMAS
# ========================================

class User(UserInDB):
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

    class Config:
        from_attributes = True


class UserPaginatedResponse(PaginatedResponse):
    data: List[UserDetailResponse]


# ========================================
# SIGNUP SCHEMAS
# ========================================

class UserSignUpRequest(UserBase):
    """Request for user signup with all profile options."""
    clerk_user_id: str = Field(..., min_length=1)
    department_id: Optional[UUID] = None
    stage_id: Optional[UUID] = None
    role_ids: List[int] = []
    supervisor_id: Optional[UUID] = None
    subordinate_ids: Optional[List[UUID]] = None


class SignUpOptionsResponse(BaseModel):
    """Response with all available options for signup."""
    departments: List[Department]
    stages: List[Stage]
    roles: List[Role]
    users: List[User]  # Conditional based on role selection


# ========================================
# FORWARD REFERENCES UPDATE
# ========================================

# Update forward references for self-referencing models (Pydantic v1)
try:
    UserDetailResponse.update_forward_refs()
except Exception:
    # Ignore forward reference errors for now
    pass