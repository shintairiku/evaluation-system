from datetime import datetime
from enum import Enum
from typing import Optional, List, TYPE_CHECKING
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from uuid import UUID

from .common import Permission, PaginatedResponse
from .stage_competency import Stage

if TYPE_CHECKING:
    from .stage_competency import StageDetail


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
# ROLE SCHEMAS
# ========================================

class RoleBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    description: str = Field(..., min_length=1, max_length=200)


class RoleCreate(RoleBase):
    hierarchy_order: Optional[int] = Field(None, description="Optional hierarchy order. If not specified, will be set to max+1")


class RoleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = Field(None, min_length=1, max_length=200)
    # Note: hierarchy_order is not included here - use reorder endpoints instead


class Role(RoleBase):
    id: UUID
    hierarchy_order: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RoleDetail(BaseModel):
    """Schema for detailed role information"""
    id: UUID
    name: str
    description: str
    hierarchy_order: int
    created_at: datetime
    updated_at: datetime
    permissions: Optional[List[Permission]] = []
    user_count: Optional[int] = Field(None, description="Number of users with this role")
    users: Optional[PaginatedResponse['User']] = None

    model_config = ConfigDict(from_attributes=True)


class RoleReorderItem(BaseModel):
    """Single item for role reordering"""
    id: UUID
    hierarchy_order: int = Field(..., ge=1, description="New hierarchy order position (1 = highest authority)")


class RoleReorderRequest(BaseModel):
    """Request to reorder multiple roles via drag-and-drop"""
    roles: List[RoleReorderItem] = Field(..., min_items=1, description="List of roles with their new hierarchy orders")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "roles": [
                    {"id": "550e8400-e29b-41d4-a716-446655440000", "hierarchy_order": 1},
                    {"id": "550e8400-e29b-41d4-a716-446655440001", "hierarchy_order": 2},
                    {"id": "550e8400-e29b-41d4-a716-446655440002", "hierarchy_order": 3}
                ]
            }
        }
    )


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
    clerk_user_id: str = Field(..., min_length=1)
    department_id: Optional[UUID] = None
    stage_id: Optional[UUID] = None
    role_ids: List[UUID] = []
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
    role_ids: Optional[List[UUID]] = Field(None, min_items=0, max_items=10)
    supervisor_id: Optional[UUID] = None
    subordinate_ids: List[UUID] = []
    status: Optional[UserStatus] = None


class UserInDB(UserBase):
    """User model as stored in database"""
    id: UUID
    clerk_user_id: str
    status: UserStatus = UserStatus.ACTIVE
    department_id: UUID
    stage_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ========================================
# USER RESPONSE SCHEMAS
# ========================================

class User(UserInDB):
    """Complete a user information; no user-to-user relationship"""
    department: Department
    stage: Stage
    roles: List[Role] = []


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
    supervisor: Optional["User"] = None
    subordinates: Optional[List["User"]] = None

    model_config = ConfigDict(from_attributes=True)


class UserExistsResponse(BaseModel):
    """Minimal user info for existence check during auth flow"""
    exists: bool
    user_id: Optional[UUID] = None
    name: Optional[str] = None  
    email: Optional[EmailStr] = None
    status: Optional[UserStatus] = None

    model_config = ConfigDict(from_attributes=True)


class ProfileOptionsResponse(BaseModel):
    """Response with all available options for signup."""
    departments: List[Department]
    stages: List[Stage]
    roles: List[Role]
    users: List[UserProfileOption]  # Simple user options without complex relationships
