from datetime import datetime
from enum import Enum
from typing import Optional, List, Any, Union, TYPE_CHECKING
from pydantic import BaseModel, Field, model_validator
from uuid import UUID

from .common import PaginatedResponse

if TYPE_CHECKING:
    from .evaluation import EvaluationPeriod
    from .self_assessment import SelfAssessment
    from .supervisor_feedback import SupervisorFeedback
    from .user import UserProfile
    from .stage_competency import Competency


class GoalStatus(str, Enum):
    INCOMPLETE = "incomplete"
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"


class PerformanceGoalType(str, Enum):
    QUANTITATIVE = "quantitative"
    QUALITATIVE = "qualitative"


# Target data schemas for different goal categories
class PerformanceGoalTargetData(BaseModel):
    title: str = Field(..., description="目標タイトル")
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


# === Goal Schemas ===
# Note: Goal categories are now stored as simple string values rather than a separate table


class GoalCreate(BaseModel):
    """Schema for creating a goal via API"""
    period_id: UUID = Field(..., alias="periodId")
    goal_category: str = Field(..., min_length=1, max_length=100, alias="goalCategory")
    weight: float = Field(..., ge=0, le=100)
    status: GoalStatus = Field(..., description="Goal status based on button clicked: 'draft' or 'pending_approval'")
    
    # Performance Goal fields (goal_category = "業績目標")
    title: Optional[str] = Field(None, alias="title")
    performance_goal_type: Optional[PerformanceGoalType] = Field(None, alias="performanceGoalType")
    specific_goal_text: Optional[str] = Field(None, alias="specificGoalText")
    achievement_criteria_text: Optional[str] = Field(None, alias="achievementCriteriaText")
    means_methods_text: Optional[str] = Field(None, alias="meansMethodsText")
    
    # Competency Goal fields (goal_category = "コンピテンシー")
    competency_id: Optional[UUID] = Field(None, alias="competencyId")
    action_plan: Optional[str] = Field(None, alias="actionPlan")
    
    # Core Value Goal fields (goal_category = "コアバリュー") 
    core_value_plan: Optional[str] = Field(None, alias="coreValuePlan")
    
    @model_validator(mode='before')
    @classmethod
    def validate_goal_category_fields(cls, values):
        """Validate that required fields are present based on goal_category"""
        goal_category = values.get('goal_category')
        if goal_category == "業績目標":  # Performance goal
            required_fields = ['title', 'performance_goal_type', 'specific_goal_text', 
                             'achievement_criteria_text', 'means_methods_text']
            if any(values.get(field) is None for field in required_fields):
                raise ValueError("Performance goals require: title, performanceGoalType, specificGoalText, achievementCriteriaText, meansMethodsText")
        elif goal_category == "コンピテンシー":  # Competency goal
            if values.get('competency_id') is None or values.get('action_plan') is None:
                raise ValueError("Competency goals require: competencyId, actionPlan")
        # NOTE: Core value goal should be automatically created by the system
        elif goal_category == "コアバリュー":  # Core value goal
            if values.get('core_value_plan') is None:
                raise ValueError("Core value goals require: coreValuePlan")
        return values


class GoalUpdate(BaseModel):
    """Schema for updating a goal content via API (no status changes)"""
    weight: Optional[float] = Field(None, ge=0, le=100)
    
    # Performance Goal fields (goal_category = "業績目標")
    title: Optional[str] = Field(None, alias="title")
    performance_goal_type: Optional[PerformanceGoalType] = Field(None, alias="performanceGoalType")
    specific_goal_text: Optional[str] = Field(None, alias="specificGoalText")
    achievement_criteria_text: Optional[str] = Field(None, alias="achievementCriteriaText")
    means_methods_text: Optional[str] = Field(None, alias="meansMethodsText")
    
    # Competency Goal fields (goal_category = "コンピテンシー")
    competency_id: Optional[UUID] = Field(None, alias="competencyId")
    action_plan: Optional[str] = Field(None, alias="actionPlan")
    
    # Core Value Goal fields (goal_category = "コアバリュー")
    core_value_plan: Optional[str] = Field(None, alias="coreValuePlan")


class GoalStatusUpdate(BaseModel):
    """Schema for updating goal status only"""
    status: GoalStatus = Field(..., description="New goal status")


class GoalInDB(BaseModel):
    id: UUID
    user_id: UUID
    period_id: UUID
    goal_category: str = Field(..., min_length=1, max_length=100)
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

        goal_category = data.get('goal_category')
        target_data_dict = data.get('target_data')

        if not isinstance(target_data_dict, dict):
            return data

        try:
            if goal_category == "業績目標":
                data['target_data'] = PerformanceGoalTargetData(**target_data_dict)
            elif goal_category == "コンピテンシー":
                data['target_data'] = CompetencyGoalTargetData(**target_data_dict)
            elif goal_category == "コアバリュー":
                data['target_data'] = CoreValueGoalTargetData(**target_data_dict)
        except Exception:
            # Let the default validation handle the error
            pass
            
        return data

    model_config = {"from_attributes": True}


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
    goal_category: str = Field(..., alias="goalCategory")
    weight: float
    status: GoalStatus
    approved_by: Optional[UUID] = Field(None, alias="approvedBy")
    approved_at: Optional[datetime] = Field(None, alias="approvedAt")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")
    
    # Performance Goal fields (goal_category = "業績目標")
    title: Optional[str] = Field(None, alias="title")
    performance_goal_type: Optional[PerformanceGoalType] = Field(None, alias="performanceGoalType")
    specific_goal_text: Optional[str] = Field(None, alias="specificGoalText")
    achievement_criteria_text: Optional[str] = Field(None, alias="achievementCriteriaText")
    means_methods_text: Optional[str] = Field(None, alias="meansMethodsText")
    
    # Competency Goal fields (goal_category = "コンピテンシー")
    competency_id: Optional[UUID] = Field(None, alias="competencyId")
    competency_name: Optional[str] = Field(None, alias="competencyName")  # Looked up from competency table
    action_plan: Optional[str] = Field(None, alias="actionPlan")
    
    # Core Value Goal fields (goal_category = "コアバリュー")
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

    model_config = {"from_attributes": True, "populate_by_name": True}


class GoalDetail(Goal):
    """
    Detailed goal schema for single item views.
    Includes comprehensive information with related entities.
    """
    # Related evaluation period information
    # evaluation_period: Optional['EvaluationPeriod'] = Field(
    #     None, 
    #     alias="evaluationPeriod",
    #     description="The evaluation period this goal belongs to"
    # )
    
    # User information (goal owner)
    # user: Optional['UserProfile'] = Field(
    #     None,
    #     description="The user who owns this goal"
    # )
    
    # Competency details (for competency goals)
    # competency: Optional['Competency'] = Field(
    #     None,
    #     description="Detailed competency information (for competency goals)"
    # )
    
    # Assessment information
    # self_assessment: Optional['SelfAssessment'] = Field(
    #     None, 
    #     alias="selfAssessment",
    #     description="Self-assessment for this goal (if exists)"
    # )
    
    # Supervisor feedback information
    # supervisor_feedback: Optional['SupervisorFeedback'] = Field(
    #     None, 
    #     alias="supervisorFeedback",
    #     description="Supervisor feedback on this goal (if exists)"
    # )
    
    # Progress indicators
    has_self_assessment: bool = Field(
        False, 
        alias="hasSelfAssessment",
        description="Whether self-assessment has been submitted"
    )
    
    has_supervisor_feedback: bool = Field(
        False, 
        alias="hasSupervisorFeedback",
        description="Whether supervisor feedback has been provided"
    )
    
    # Goal timeline information
    is_editable: bool = Field(
        True, 
        alias="isEditable",
        description="Whether this goal can still be edited"
    )
    
    is_assessment_open: bool = Field(
        False, 
        alias="isAssessmentOpen",
        description="Whether self-assessment is open for this goal"
    )
    
    is_overdue: bool = Field(
        False, 
        alias="isOverdue",
        description="Whether this goal is past the evaluation deadline"
    )
    
    # Approval information
    approved_by_name: Optional[str] = Field(None, alias="approvedByName", description="Name of the approver")
    days_since_submission: Optional[int] = Field(None, alias="daysSinceSubmission", description="Days since goal was submitted for approval")
    
    model_config = {"from_attributes": True, "populate_by_name": True}


class GoalList(PaginatedResponse[Goal]):
    """Schema for paginated goal list responses"""
    pass


# ========================================
# FORWARD REFERENCES UPDATE
# ========================================

# Update forward references for models with forward references (Pydantic v2)
# This needs to be done after all models are defined
try:
    # Rebuild models that have forward references
    GoalDetail.model_rebuild()
except Exception as e:
    # Log the error but don't fail the import
    print(f"Warning: Could not rebuild forward references in goal schemas: {e}")
    pass