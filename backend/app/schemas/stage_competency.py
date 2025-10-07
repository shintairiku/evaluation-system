from datetime import datetime
from typing import Optional, List, Dict, TYPE_CHECKING
from pydantic import BaseModel, Field, validator
from uuid import UUID

if TYPE_CHECKING:
    from .user import User

# ========================================
# COMPETENCY SCHEMAS
# ========================================

class CompetencyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[Dict[str, str]] = Field(None, description="Sub-items with keys '1' through '5'")
    stage_id: UUID = Field(..., alias="stageId")
    
    @validator('description')
    def validate_description(cls, v):
        if v is not None:
            # Check that keys are only '1', '2', '3', '4', '5'
            valid_keys = {'1', '2', '3', '4', '5'}
            if not all(key in valid_keys for key in v.keys()):
                raise ValueError("Description keys must be '1', '2', '3', '4', or '5'")
        return v
    
    class Config:
        populate_by_name = True


class CompetencyUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[Dict[str, str]] = Field(None, description="Sub-items with keys '1' through '5'")
    stage_id: Optional[UUID] = Field(None, alias="stageId")
    
    @validator('description')
    def validate_description(cls, v):
        if v is not None:
            # Check that keys are only '1', '2', '3', '4', '5'
            valid_keys = {'1', '2', '3', '4', '5'}
            if not all(key in valid_keys for key in v.keys()):
                raise ValueError("Description keys must be '1', '2', '3', '4', or '5'")
        return v


class Competency(BaseModel):
    """Basic competency information"""
    id: UUID
    name: str
    description: Optional[Dict[str, str]] = None
    stage_id: UUID = Field(..., alias="stageId")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")
    
    class Config:
        from_attributes = True
        populate_by_name = True


class CompetencyDetail(BaseModel):
    """Detailed competency information with relationships"""
    id: UUID
    name: str
    description: Optional[Dict[str, str]] = None
    stage_id: UUID = Field(..., alias="stageId")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")
    users: Optional[List["User"]] = Field(default=None, alias="users")
    
    class Config:
        from_attributes = True
        populate_by_name = True


class CompetencyList(BaseModel):
    competencies: List[Competency]
    meta: dict


# ========================================
# STAGE SCHEMAS
# ========================================

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
    user_count: Optional[int] = None
    users: Optional[List["User"]] = None
    competencies: List[Competency] = []


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


# Note: No separate response schemas needed. 
# Create and Update operations return StageDetail directly.
# Delete operations return a simple success response or 204 status.


# ========================================
# FORWARD REFERENCES UPDATE
# ========================================

# Update forward references for models with forward references (Pydantic v2)
# This needs to be done after all models are defined to avoid circular import issues