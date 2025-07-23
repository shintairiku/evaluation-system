from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from pydantic import BaseModel, Field
from uuid import UUID

if TYPE_CHECKING:
    from .user import User

class Department(BaseModel):
    """Basic department information"""
    id: UUID
    name: str
    description: Optional[str] = None


class DepartmentDetail(BaseModel):
    """Detailed department information with metadata"""
    id: UUID
    name: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    # NOTE: below metadata is optional; not finalized yet. Refine metadata based on UI requirement. 
    user_count: Optional[int] = None
    manager_id: Optional[UUID] = None
    manager_name: Optional[str] = None
    users: Optional[List["User"]] = None 


class DepartmentCreate(BaseModel):
    """Schema for creating new department"""
    name: str = Field(..., min_length=1, max_length=100, description="Department name")
    description: Optional[str] = Field(None, max_length=500, description="Department description")
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "Engineering",
                "description": "Software engineering department"
            }
        }


class DepartmentUpdate(BaseModel):
    """Schema for updating department information"""
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="Department name")
    description: Optional[str] = Field(None, max_length=500, description="Department description")
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "Engineering & Development",
                "description": "Software engineering and development department"
            }
        }


class DepartmentWithUserCount(BaseModel):
    """Department with user count for listing"""
    id: UUID
    name: str
    description: Optional[str] = None
    user_count: int = 0
    created_at: datetime
    updated_at: datetime


class DepartmentUser(BaseModel):
    """User information within department context"""
    id: UUID
    clerk_user_id: str
    name: str
    email: str
    employee_code: str
    status: str
    job_title: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# Response Models
class DepartmentCreateResponse(BaseModel):
    """Response after successful department creation"""
    department: DepartmentDetail
    message: str = "Department created successfully"


class DepartmentUpdateResponse(BaseModel):
    """Response after successful department update"""
    department: DepartmentDetail
    message: str = "Department updated successfully"


class DepartmentDeleteResponse(BaseModel):
    """Response after successful department deletion"""
    success: bool
    message: str = "Department deleted successfully"


# Rebuild models with forward references for Pydantic v2 compatibility
# Note: model_rebuild() is called after all models are defined to resolve forward references
def rebuild_models():
    """Rebuild models after all schemas are imported to resolve forward references"""
    try:
        from .user import User  # Import at runtime for model rebuild
        DepartmentDetail.model_rebuild()
        DepartmentCreateResponse.model_rebuild()
        DepartmentUpdateResponse.model_rebuild()
    except ImportError:
        # If User schema is not available, skip rebuild
        pass

# Call rebuild function
rebuild_models() 