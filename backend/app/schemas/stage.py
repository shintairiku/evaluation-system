from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from pydantic import BaseModel, Field
from uuid import UUID

if TYPE_CHECKING:
    from .user import User


class Stage(BaseModel):
    """Basic stage information"""
    id: UUID
    name: str
    description: Optional[str] = None


class StageDetail(BaseModel):
    """Detailed stage information with metadata"""
    id: UUID
    name: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    # NOTE: below metadata is optional; not finalized yet. Refine metadata based on UI requirement.
    user_count: Optional[int] = None
    users: Optional[List["User"]] = None


class StageCreate(BaseModel):
    """Schema for creating new stage"""
    name: str = Field(..., min_length=1, description="Stage name")
    description: Optional[str] = Field(None, description="Stage description")
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "Junior Developer",
                "description": "Entry-level software developer position"
            }
        }


class StageUpdate(BaseModel):
    """Schema for updating stage information"""
    name: Optional[str] = Field(None, min_length=1, description="Stage name")
    description: Optional[str] = Field(None, description="Stage description")
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "Senior Developer",
                "description": "Experienced software developer position"
            }
        }


class StageInDB(BaseModel):
    """Stage model as stored in database"""
    id: UUID
    name: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class StageWithUserCount(BaseModel):
    """Stage with user count for listing"""
    id: UUID
    name: str
    description: Optional[str] = None
    user_count: int = 0
    created_at: datetime
    updated_at: datetime


# Response Models
class StageCreateResponse(BaseModel):
    """Response after successful stage creation"""
    stage: StageDetail
    message: str = "Stage created successfully"


class StageUpdateResponse(BaseModel):
    """Response after successful stage update"""
    stage: StageDetail
    message: str = "Stage updated successfully"


class StageDeleteResponse(BaseModel):
    """Response after successful stage deletion"""
    success: bool
    message: str = "Stage deleted successfully"


# Rebuild models with forward references for Pydantic v2 compatibility
def rebuild_models():
    """Rebuild models after all schemas are imported to resolve forward references"""
    try:
        from .user import User  # Import at runtime for model rebuild
        StageDetail.model_rebuild()
        StageCreateResponse.model_rebuild()
        StageUpdateResponse.model_rebuild()
    except ImportError:
        # If User schema is not available, skip rebuild
        pass

# Call rebuild function
rebuild_models()