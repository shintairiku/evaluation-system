from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field, validator, model_validator
from uuid import UUID


class GoalStatus(str, Enum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"


class PerformanceGoalType(str, Enum):
    QUANTITATIVE = "quantitative"
    QUALITATIVE = "qualitative"


# Target data schemas for different goal categories
class PerformanceGoalTargetData(BaseModel):
    performance_goal_type: PerformanceGoalType
    specific_goal_text: str = Field(..., description="具体的な目標内容")
    achievement_criteria_text: str = Field(..., description="達成基準")
    means_methods_text: str = Field(..., description="達成手段・方法")


class CompetencyGoalTargetData(BaseModel):
    competency_id: UUID = Field(..., description="コンピテンシーID")
    action_plan: str = Field(..., description="行動計画")


class CoreValueGoalTargetData(BaseModel):
    core_value_plan: str = Field(..., description="コアバリュー実践計画")


TargetData = Union[PerformanceGoalTargetData, CompetencyGoalTargetData, CoreValueGoalTargetData]


class GoalCreateRequest(BaseModel):
    """API request schema for creating a goal - matches endpoints.md
    Note: Core value goals (category 3) are not created through goal-input page,
    only performance (1) and competency (2) goals are created by users.
    """
    period_id: UUID = Field(..., alias="periodId")
    goal_category_id: int = Field(..., ge=1, le=3, alias="goalCategoryId")
    weight: float = Field(..., ge=0, le=100)
    # status is automatically set by backend based on user action (save draft vs submit)
    
    # Performance Goal fields (goal_category_id = 1)
    performance_goal_type: Optional[PerformanceGoalType] = Field(None, alias="performanceGoalType")
    specific_goal_text: Optional[str] = Field(None, alias="specificGoalText")
    achievement_criteria_text: Optional[str] = Field(None, alias="achievementCriteriaText")
    means_methods_text: Optional[str] = Field(None, alias="meansMethodsText")
    
    # Competency Goal fields (goal_category_id = 2)
    competency_id: Optional[UUID] = Field(None, alias="competencyId")
    action_plan: Optional[str] = Field(None, alias="actionPlan")
    
    # Core Value Goal fields (goal_category_id = 3) 
    core_value_plan: Optional[str] = Field(None, alias="coreValuePlan")
    
    @model_validator(mode='after')
    def validate_goal_category_fields(self):
        """Validate that required fields are present based on goal_category_id"""
        if self.goal_category_id == 1:  # Performance goal
            required_fields = [self.performance_goal_type, self.specific_goal_text, 
                             self.achievement_criteria_text, self.means_methods_text]
            if any(field is None for field in required_fields):
                raise ValueError("Performance goals require: performanceGoalType, specificGoalText, achievementCriteriaText, meansMethodsText")
        elif self.goal_category_id == 2:  # Competency goal
            if self.competency_id is None or self.action_plan is None:
                raise ValueError("Competency goals require: competencyId, actionPlan")
        # NOTE: Core value goal should be automatically created by the system
        elif self.goal_category_id == 3:  # Core value goal
            if self.core_value_plan is None:
                raise ValueError("Core value goals require: coreValuePlan")
        return self


class GoalCreate(BaseModel):
    """Internal schema for creating a goal in database"""
    period_id: UUID
    goal_category_id: int
    target_data: TargetData
    weight: float
    status: GoalStatus


class GoalUpdateRequest(BaseModel):
    """API request schema for updating a goal - matches endpoints.md"""
    weight: Optional[float] = Field(None, ge=0, le=100)
    # status is automatically set by backend based on user action (save draft vs submit)
    
    # Performance Goal fields (goal_category_id = 1)
    performance_goal_type: Optional[PerformanceGoalType] = Field(None, alias="performanceGoalType")
    specific_goal_text: Optional[str] = Field(None, alias="specificGoalText")
    achievement_criteria_text: Optional[str] = Field(None, alias="achievementCriteriaText")
    means_methods_text: Optional[str] = Field(None, alias="meansMethodsText")
    
    # Competency Goal fields (goal_category_id = 2)
    competency_id: Optional[UUID] = Field(None, alias="competencyId")
    action_plan: Optional[str] = Field(None, alias="actionPlan")
    
    # Core Value Goal fields (goal_category_id = 3)
    core_value_plan: Optional[str] = Field(None, alias="coreValuePlan")


class GoalUpdate(BaseModel):
    """Internal schema for updating a goal in database"""
    target_data: Optional[Dict[str, Any]] = None
    weight: Optional[float] = Field(None, ge=0, le=100)
    status: Optional[GoalStatus] = None


class GoalInDB(BaseModel):
    id: UUID
    user_id: UUID
    period_id: UUID
    goal_category_id: int = Field(..., ge=1, le=3)
    target_data: TargetData
    weight: float = Field(..., ge=0, le=100)
    status: GoalStatus = GoalStatus.DRAFT
    approved_by: Optional[UUID] = None
    approved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    @model_validator(mode='before')
    @classmethod
    def _validate_target_data(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data

        goal_category_id = data.get('goal_category_id')
        target_data_dict = data.get('target_data')

        if not isinstance(target_data_dict, dict):
            return data

        try:
            if goal_category_id == 1:
                data['target_data'] = PerformanceGoalTargetData(**target_data_dict)
            elif goal_category_id == 2:
                data['target_data'] = CompetencyGoalTargetData(**target_data_dict)
            elif goal_category_id == 3:
                data['target_data'] = CoreValueGoalTargetData(**target_data_dict)
        except Exception as e:
            # Let the default validation handle the error
            pass
            
        return data

    class Config:
        from_attributes = True


class Goal(BaseModel):
    """
    Represents a goal in API responses, designed to be flexible for client-facing data.
    This schema flattens the nested 'target_data' from the internal GoalInDB model
    into a single-level structure for ease of use on the frontend.

    It is the primary schema for API responses and can be extended with additional fields
    (e.g., joined data from other tables) without altering the internal data model,
    providing flexibility to tailor API responses based on UI requirements.
    """
    id: UUID
    user_id: UUID = Field(..., alias="userId")
    period_id: UUID = Field(..., alias="periodId") 
    goal_category_id: int = Field(..., alias="goalCategoryId")
    weight: float
    status: GoalStatus
    approved_by: Optional[UUID] = Field(None, alias="approvedBy")
    approved_at: Optional[datetime] = Field(None, alias="approvedAt")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")
    
    # Performance Goal fields (goal_category_id = 1)
    performance_goal_type: Optional[PerformanceGoalType] = Field(None, alias="performanceGoalType")
    specific_goal_text: Optional[str] = Field(None, alias="specificGoalText")
    achievement_criteria_text: Optional[str] = Field(None, alias="achievementCriteriaText")
    means_methods_text: Optional[str] = Field(None, alias="meansMethodsText")
    
    # Competency Goal fields (goal_category_id = 2)
    competency_id: Optional[UUID] = Field(None, alias="competencyId")
    competency_name: Optional[str] = Field(None, alias="competencyName")  # Looked up from competency table
    action_plan: Optional[str] = Field(None, alias="actionPlan")
    
    # Core Value Goal fields (goal_category_id = 3)
    core_value_plan: Optional[str] = Field(None, alias="coreValuePlan")

    @model_validator(mode='before')
    @classmethod
    def flatten_target_data(cls, data: Any) -> Any:
        """
        When creating a Goal response from a model instance (like GoalInDB),
        this validator flattens the nested target_data into top-level fields.
        """
        if hasattr(data, 'target_data') and hasattr(data.target_data, 'model_dump'):
            # It's a Pydantic model with target_data, likely GoalInDB
            model_dict = data.model_dump(exclude={'target_data'})
            model_dict.update(data.target_data.model_dump())
            return model_dict
        
        # If it's already a dict or other type, pass it through
        return data

    class Config:
        from_attributes = True
        populate_by_name = True

class GoalList(BaseModel):
    goals: List[Goal]
    total: int