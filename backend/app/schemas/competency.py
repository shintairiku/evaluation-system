from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from uuid import UUID

from .user import Stage


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
    stage: Stage
    goal_count: int = Field(0, alias="goalCount")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")
    
    class Config:
        from_attributes = True
        populate_by_name = True
        

class CompetencyDetail(Competency):
    users_with_goals: List["UserWithGoals"] = Field(default=[], alias="usersWithGoals")
    
    class Config:
        from_attributes = True
        populate_by_name = True


class EvaluationPeriod(BaseModel):
    id: UUID
    name: str
    start_date: datetime = Field(..., alias="startDate")
    end_date: datetime = Field(..., alias="endDate")
    
    class Config:
        populate_by_name = True


class UserWithGoals(BaseModel):
    user: "UserProfile"
    period: EvaluationPeriod


class CompetencyList(BaseModel):
    competencies: List[Competency]
    meta: dict


# Forward reference resolution
from .user import UserProfile
UserWithGoals.model_rebuild()
