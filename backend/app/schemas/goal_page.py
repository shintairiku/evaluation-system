from datetime import date, datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class EvaluationPeriodSummary(BaseModel):
    id: UUID
    name: str
    start_date: date = Field(..., alias="startDate")
    end_date: date = Field(..., alias="endDate")
    status: str

    model_config = {"populate_by_name": True}


class GoalListPageItem(BaseModel):
    goal_id: UUID = Field(..., alias="goalId")
    user_id: UUID = Field(..., alias="userId")
    user_name: str = Field(..., alias="userName")
    employee_code: Optional[str] = Field(None, alias="employeeCode")
    department_name: Optional[str] = Field(None, alias="departmentName")
    period_id: UUID = Field(..., alias="periodId")
    period_name: Optional[str] = Field(None, alias="periodName")
    goal_category: str = Field(..., alias="goalCategory")
    status: str
    weight: float
    title: Optional[str] = None
    performance_goal_type: Optional[str] = Field(None, alias="performanceGoalType")
    action_plan: Optional[str] = Field(None, alias="actionPlan")
    updated_at: datetime = Field(..., alias="updatedAt")

    model_config = {"populate_by_name": True}


class GoalListPageMeta(BaseModel):
    total: int
    page: int
    limit: int
    pages: int


class GoalListPageFilters(BaseModel):
    period_id: Optional[UUID] = Field(None, alias="periodId")
    statuses: Optional[List[str]] = None
    periods: List[EvaluationPeriodSummary] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class GoalListPageResponse(BaseModel):
    goals: List[GoalListPageItem]
    meta: GoalListPageMeta
    filters: GoalListPageFilters

