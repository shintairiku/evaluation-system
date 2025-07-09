from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from pydantic import BaseModel, Field
from uuid import UUID

if TYPE_CHECKING:
    from .user import Stage, UserProfile


class CompetencyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    stage_id: UUID = Field(..., alias="stageId")
    
    class Config:
        populate_by_name = True


class CompetencyUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    stage_id: Optional[UUID] = Field(None, alias="stageId")


class Competency(CompetencyCreate):
    id: UUID
    # stage: "Stage"
    goal_count: int = Field(0, alias="goalCount")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")
    
    class Config:
        from_attributes = True
        populate_by_name = True
        

class CompetencyDetail(Competency):
    # users: List["UserProfile"] = Field(default=[], alias="users")
    
    class Config:
        from_attributes = True
        populate_by_name = True


class CompetencyList(BaseModel):
    competencies: List[Competency]
    meta: dict


# ========================================
# FORWARD REFERENCES UPDATE
# ========================================

# Update forward references for models with forward references (Pydantic v2)
# This needs to be done after all models are defined
try:
    # Rebuild models that have forward references
    Competency.model_rebuild()
    CompetencyDetail.model_rebuild()
    CompetencyList.model_rebuild()
except Exception as e:
    # Log the error but don't fail the import
    print(f"Warning: Could not rebuild forward references in competency schemas: {e}")
    pass
