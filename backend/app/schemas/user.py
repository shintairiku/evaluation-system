from datetime import datetime
from enum import Enum
from typing import Optional, List, TYPE_CHECKING
from pydantic import BaseModel, Field, EmailStr
from uuid import UUID

from .common import Permission, PaginatedResponse

if TYPE_CHECKING:
    from .competency import Competency


class UserStatus(str, Enum):
    PENDING_APPROVAL = "pending_approval"
    ACTIVE = "active"
    INACTIVE = "inactive"


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


class UserBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    employee_code: str = Field(..., min_length=1, max_length=20)
    job_title: Optional[str] = Field(None, max_length=100)


class UserCreate(UserBase):
    clerk_user_id: str = Field(..., min_length=1)
    department_id: UUID
    stage_id: UUID
    role_ids: List[int] = []
    supervisor_id: Optional[UUID] = None
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
    department: Department
    stage: Stage
    roles: List[Role] = []
    supervisor: Optional["UserDetailResponse"] = None

    class Config:
        from_attributes = True


class UserPaginatedResponse(PaginatedResponse):
    data: List[UserDetailResponse]
