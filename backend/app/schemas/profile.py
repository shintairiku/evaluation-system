from typing import Optional, List, TYPE_CHECKING
from uuid import UUID
from pydantic import BaseModel, Field, EmailStr

if TYPE_CHECKING:
    from .user import Department, Stage, UserStatus

class ProfileCompletionRequest(BaseModel):
    """Request model for completing user profile after Clerk signup."""
    employee_code: str = Field(default="0000", description="Employee code, default '0000' if unknown")
    department_id: UUID = Field(..., description="Selected department ID")
    stage_id: UUID = Field(..., description="Selected career stage ID") 
    job_title: Optional[str] = Field(None, max_length=100, description="Job title")
    supervisor_email: Optional[EmailStr] = Field(None, description="Supervisor's email for lookup")


class ProfileCompletionResponse(BaseModel):
    """Response after profile completion."""
    message: str = "Profile completed successfully. Awaiting admin approval."
    status: UserStatus = UserStatus.PENDING_APPROVAL
    user_id: UUID


class DepartmentStageOptionsResponse(BaseModel):
    """Response with available departments and stages for dropdowns."""
    departments: List[Department]
    stages: List[Stage]


class PendingUserResponse(BaseModel):
    """Response model for pending users (admin view)."""
    id: UUID
    clerk_user_id: str
    name: str
    email: EmailStr
    employee_code: str
    job_title: Optional[str] = None
    department: Department
    stage: Stage
    supervisor_email: Optional[str] = None
    created_at: str
    
    class Config:
        from_attributes = True


class UserApprovalRequest(BaseModel):
    """Request model for admin to approve/update pending user."""
    employee_code: str = Field(..., min_length=1, max_length=20, description="Final employee code")
    department_id: Optional[UUID] = Field(None, description="Update department if needed")
    stage_id: Optional[UUID] = Field(None, description="Update stage if needed") 
    job_title: Optional[str] = Field(None, max_length=100, description="Update job title")
    supervisor_id: Optional[UUID] = Field(None, description="Assign supervisor")
    role_ids: List[int] = Field(default=[3], description="Assign roles, default employee role")
    approve: bool = Field(..., description="True to approve, False to reject")
    rejection_reason: Optional[str] = Field(None, description="Reason for rejection if approve=False")


class UserApprovalResponse(BaseModel):
    """Response after admin approval/rejection."""
    user_id: UUID
    approved: bool
    status: UserStatus
    message: str