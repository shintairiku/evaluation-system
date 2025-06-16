from datetime import datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field, EmailStr
from uuid import UUID


class EmploymentType(str, Enum):
    ADMIN = "admin"
    SUPERVISOR = "supervisor" 
    EMPLOYEE = "employee"
    PARTTIME = "parttime"


class UserStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class Department(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None


class Stage(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None


class Role(BaseModel):
    id: int
    name: str
    description: str


class UserBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    employee_code: str = Field(..., min_length=1, max_length=20)
    employment_type: EmploymentType
    job_title: Optional[str] = Field(None, max_length=100)


class UserCreate(UserBase):
    clerk_user_id: str = Field(..., min_length=1)
    department_id: UUID
    stage_id: UUID
    role_ids: List[int] = []
    supervisor_id: Optional[UUID] = None


class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    employee_code: Optional[str] = Field(None, min_length=1, max_length=20)
    employment_type: Optional[EmploymentType] = None
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
    last_login_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class User(UserInDB):
    department: Department
    stage: Stage
    roles: List[Role] = []
    supervisor: Optional['UserProfile'] = None


class UserProfile(BaseModel):
    id: UUID
    clerk_user_id: str
    employee_code: str
    name: str
    email: EmailStr
    employment_type: EmploymentType
    status: UserStatus
    job_title: Optional[str] = None
    department: Department
    stage: Stage
    roles: List[Role] = []


class UserList(BaseModel):
    users: List[UserProfile]
    total: int