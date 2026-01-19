from datetime import datetime
from enum import Enum
from typing import Optional, List, Any, Union, Dict, TYPE_CHECKING
from pydantic import BaseModel, Field, model_validator, ConfigDict
from uuid import UUID

from .common import PaginatedResponse

if TYPE_CHECKING:
    pass


class GoalStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
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

    model_config = {"use_enum_values": True}


class CompetencyGoalTargetData(BaseModel):
    competency_ids: Optional[List[UUID]] = Field(None, description="コンピテンシーID一覧（任意）")
    selected_ideal_actions: Optional[Dict[str, List[str]]] = Field(None, description="各コンピテンシーの選択した理想的行動（UUID -> [1-5]）")
    action_plan: str = Field(..., description="行動計画")
    
    @model_validator(mode='after')
    @classmethod
    def validate_ideal_actions(cls, values):
        """Validate that selected_ideal_actions correspond to selected competencies"""
        if values.selected_ideal_actions is not None:
            # Can only select ideal actions if competency_ids is provided
            if not values.competency_ids:
                raise ValueError("selected_ideal_actions can only be specified when competency_ids is provided")
            
            # Convert competency_ids to string for comparison (as keys in dict are strings)
            competency_id_strings = {str(comp_id) for comp_id in values.competency_ids}
            ideal_action_keys = set(values.selected_ideal_actions.keys())
            
            # Check that all ideal action keys correspond to selected competencies
            invalid_keys = ideal_action_keys - competency_id_strings
            if invalid_keys:
                raise ValueError(f"selected_ideal_actions contains keys for non-selected competencies: {invalid_keys}")
            
            # Validate ideal action values for each competency
            valid_action_keys = {'1', '2', '3', '4', '5'}
            for competency_id, actions in values.selected_ideal_actions.items():
                if not isinstance(actions, list):
                    raise ValueError(f"Ideal actions for competency {competency_id} must be a list")
                if not all(action in valid_action_keys for action in actions):
                    raise ValueError(f"Ideal actions for competency {competency_id} must contain only '1', '2', '3', '4', or '5'")
        
        return values


class CoreValueGoalTargetData(BaseModel):
    core_value_plan: str = Field(..., description="コアバリュー実践計画")

TargetData = Union[PerformanceGoalTargetData, CompetencyGoalTargetData, CoreValueGoalTargetData]


# === Goal Schemas ===
# Note: Goal categories are now stored as simple string values rather than a separate table


class GoalCreate(BaseModel):
    """Schema for creating a goal via API"""
    # Common fields for all goal types (4 fields)
    period_id: UUID = Field(..., alias="periodId")
    goal_category: str = Field(..., min_length=1, max_length=100, alias="goalCategory")
    weight: float = Field(..., ge=0, le=100)
    status: GoalStatus = Field(GoalStatus.DRAFT, description="Goal status: only 'draft' allowed for creation (auto-save)")
    
    # Performance goal fields (5 fields) - required when goal_category = "業績目標"
    title: Optional[str] = Field(None, description="目標タイトル")
    performance_goal_type: Optional[PerformanceGoalType] = Field(None, alias="performanceGoalType")
    specific_goal_text: Optional[str] = Field(None, alias="specificGoalText", description="具体的な目標内容")
    achievement_criteria_text: Optional[str] = Field(None, alias="achievementCriteriaText", description="達成基準")
    means_methods_text: Optional[str] = Field(None, alias="meansMethodsText", description="達成手段・方法")
    
    model_config = {"populate_by_name": True}
    
    # Competency goal fields - only action_plan required when goal_category = "コンピテンシー"
    competency_ids: Optional[List[UUID]] = Field(None, alias="competencyIds", description="コンピテンシーID一覧")
    selected_ideal_actions: Optional[Dict[str, List[str]]] = Field(None, alias="selectedIdealActions", description="各コンピテンシーの選択した理想的行動")
    action_plan: Optional[str] = Field(None, alias="actionPlan", description="行動計画")
    core_value_plan: Optional[str] = Field(None, alias="coreValuePlan", description="コアバリュー実践計画")
    
    @model_validator(mode='after')
    @classmethod
    def validate_status_restrictions(cls, values):
        """Restrict status for goal creation - only draft allowed"""
        if values.status != GoalStatus.DRAFT:
            raise ValueError("Goal creation only allows status: 'draft'")
        return values
    
    @model_validator(mode='before')
    @classmethod
    def validate_goal_category_fields(cls, values):
        """Validate that required fields are present based on goal_category"""
        goal_category = values.get('goal_category') or values.get('goalCategory')
        
        if goal_category == "業績目標":  # Performance goal
            # Check for 5 performance goal specific fields
            required_fields = ['title', 'performance_goal_type', 'specific_goal_text', 
                             'achievement_criteria_text', 'means_methods_text']
            # Handle both snake_case and camelCase field names
            field_map = {
                'performance_goal_type': 'performanceGoalType',
                'specific_goal_text': 'specificGoalText',
                'achievement_criteria_text': 'achievementCriteriaText',
                'means_methods_text': 'meansMethodsText'
            }
            
            missing_fields = []
            for field in required_fields:
                snake_case_value = values.get(field)
                camel_case_value = values.get(field_map.get(field, field))
                if snake_case_value is None and camel_case_value is None:
                    missing_fields.append(field_map.get(field, field))
            
            if missing_fields:
                raise ValueError(f"Performance goals require: {', '.join(missing_fields)}")
                
        elif goal_category == "コンピテンシー":  # Competency goal
            # Only action_plan is required for competency goals
            action_plan_value = values.get('action_plan') or values.get('actionPlan')
            
            if action_plan_value is None:
                raise ValueError("Competency goals require: actionPlan")
            
            # If competency_ids is provided, validate selected_ideal_actions relationship
            competency_ids_value = values.get('competency_ids') or values.get('competencyIds')
            selected_actions = values.get('selected_ideal_actions') or values.get('selectedIdealActions')
            
            if selected_actions and not competency_ids_value:
                raise ValueError("selectedIdealActions can only be specified when competencyIds is provided")
            
            # Validate ideal actions format if provided
            if selected_actions and competency_ids_value:
                # Validate that it's a dict with UUID keys and list values
                if not isinstance(selected_actions, dict):
                    raise ValueError("selectedIdealActions must be an object with competency UUIDs as keys")
                
                # Convert competency_ids to strings for comparison
                competency_id_strings = {str(comp_id) for comp_id in competency_ids_value}
                
                # Check that all ideal action keys correspond to selected competencies
                invalid_keys = set(selected_actions.keys()) - competency_id_strings
                if invalid_keys:
                    raise ValueError(f"selectedIdealActions contains keys for non-selected competencies: {invalid_keys}")
                
                # Validate ideal action values for each competency
                valid_keys = {'1', '2', '3', '4', '5'}
                for competency_id, actions in selected_actions.items():
                    if not isinstance(actions, list):
                        raise ValueError(f"Ideal actions for competency {competency_id} must be a list")
                    if not all(action in valid_keys for action in actions):
                        raise ValueError(f"Ideal actions for competency {competency_id} must contain only '1', '2', '3', '4', or '5'")

        elif goal_category == "コアバリュー":
            core_value_plan_value = values.get('core_value_plan') or values.get('coreValuePlan')
            if core_value_plan_value is None:
                raise ValueError("Core value goals require: coreValuePlan")

        return values


class PerformanceGoalUpdate(BaseModel):
    """Schema for updating performance goals only"""
    weight: Optional[float] = Field(None, ge=0, le=100)
    title: Optional[str] = Field(None, alias="title")
    performance_goal_type: Optional[PerformanceGoalType] = Field(None, alias="performanceGoalType")
    specific_goal_text: Optional[str] = Field(None, alias="specificGoalText")
    achievement_criteria_text: Optional[str] = Field(None, alias="achievementCriteriaText")
    means_methods_text: Optional[str] = Field(None, alias="meansMethodsText")


class CompetencyGoalUpdate(BaseModel):
    """Schema for updating competency goals only"""
    weight: Optional[float] = Field(None, ge=0, le=100)
    competency_ids: Optional[List[UUID]] = Field(None, alias="competencyIds")
    selected_ideal_actions: Optional[Dict[str, List[str]]] = Field(None, alias="selectedIdealActions")
    action_plan: Optional[str] = Field(None, alias="actionPlan")


class CoreValueGoalUpdate(BaseModel):
    """Schema for updating core value goals only"""
    weight: Optional[float] = Field(None, ge=0, le=100)
    core_value_plan: Optional[str] = Field(None, alias="coreValuePlan")


# Union type for goal updates based on category
GoalUpdate = Union[PerformanceGoalUpdate, CompetencyGoalUpdate, CoreValueGoalUpdate]


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
    previous_goal_id: Optional[UUID] = Field(None, alias="previousGoalId")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")
    
    # Performance Goal fields (goal_category = "業績目標")
    title: Optional[str] = Field(None, alias="title")
    performance_goal_type: Optional[PerformanceGoalType] = Field(None, alias="performanceGoalType")
    specific_goal_text: Optional[str] = Field(None, alias="specificGoalText")
    achievement_criteria_text: Optional[str] = Field(None, alias="achievementCriteriaText")
    means_methods_text: Optional[str] = Field(None, alias="meansMethodsText")
    
    # Competency Goal fields (goal_category = "コンピテンシー")
    competency_ids: Optional[List[UUID]] = Field(None, alias="competencyIds")
    competency_names: Optional[Dict[str, str]] = Field(None, alias="competencyNames")  # UUID -> Name mapping
    selected_ideal_actions: Optional[Dict[str, List[str]]] = Field(None, alias="selectedIdealActions")
    ideal_action_texts: Optional[Dict[str, List[str]]] = Field(None, alias="idealActionTexts")
    action_plan: Optional[str] = Field(None, alias="actionPlan")
    
    # Core Value Goal fields (goal_category = "コアバリュー")
    core_value_plan: Optional[str] = Field(None, alias="coreValuePlan")

    # Performance optimization: Embedded supervisor reviews (optional)
    # These fields are populated when includeReviews=true or includeRejectionHistory=true
    supervisor_review: Optional[Any] = Field(
        None,
        alias="supervisorReview",
        description="Most recent supervisor review (populated when includeReviews=true)"
    )
    rejection_history: Optional[List[Any]] = Field(
        None,
        alias="rejectionHistory",
        description="Full rejection history chain (populated when includeRejectionHistory=true)"
    )

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
    # user: Optional['UserProfileOption'] = Field(
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


class GoalsByIdsRequest(BaseModel):
    goal_ids: List[UUID] = Field(..., alias="goalIds")
    include_reviews: bool = Field(False, alias="includeReviews")
    include_rejection_history: bool = Field(False, alias="includeRejectionHistory")

    model_config = {"populate_by_name": True}


class GoalList(PaginatedResponse[Goal]):
    """Schema for paginated goal list responses"""
    pass


class UserActivity(BaseModel):
    """User activity information for goal statistics."""
    user_id: UUID
    user_name: str
    employee_code: str
    user_role: str
    department_name: str
    subordinate_name: Optional[str] = None
    supervisor_name: Optional[str] = None
    last_goal_submission: Optional[datetime] = None
    last_review_submission: Optional[datetime] = None
    goal_count: int = Field(..., ge=0)
    goal_statuses: Dict[str, int] = Field(default_factory=dict)


class GoalStatistics(BaseModel):
    """Goal statistics for an evaluation period."""
    period_id: UUID
    total: int = Field(..., ge=0)
    by_status: Dict[str, int] = Field(default_factory=dict)
    user_activities: List[UserActivity] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


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
