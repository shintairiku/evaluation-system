from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, text, DECIMAL, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID, JSONB
from sqlalchemy.orm import relationship, validates
from sqlalchemy.schema import Index
from typing import Dict, Any

from .base import Base


class Goal(Base):
    """
    Goals model representing employee performance, competency, and core value goals.
    
    This model stores different types of goals with a flexible JSONB target_data field
    that contains category-specific information with validated schemas per category.
    """
    __tablename__ = "goals"

    # Core fields
    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    period_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("evaluation_periods.id", ondelete="CASCADE"), nullable=False)
    goal_category = Column(String(100), nullable=False)
    target_data = Column(JSONB, nullable=False)  # Validated JSON structure per category
    weight = Column(DECIMAL(5, 2), nullable=False)
    status = Column(String(50), nullable=False, default="incomplete")
    
    # Approval fields
    approved_by = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    
    # Timestamps with timezone
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Database constraints
    __table_args__ = (
        # Weight validation: individual weight must be between 0 and 100
        # Note: Multiple 業績目標 goals are allowed; sum validation handled in repository layer
        CheckConstraint('weight >= 0 AND weight <= 100', name='check_individual_weight_bounds'),
        
        # Status validation
        CheckConstraint(
            "status IN ('draft', 'incomplete', 'pending_approval', 'approved', 'rejected')", 
            name='check_status_values'
        ),
        
        # Goal category validation
        CheckConstraint(
            "goal_category IN ('業績目標', 'コンピテンシー', 'コアバリュー')", 
            name='check_goal_category_values'
        ),
        
        # Approval logic: approved goals must have approved_by and approved_at
        CheckConstraint(
            "(status != 'approved') OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)",
            name='check_approval_required'
        ),
        
        # Performance index for common queries
        Index('idx_goals_user_period', 'user_id', 'period_id'),
        Index('idx_goals_status_category', 'status', 'goal_category'),
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="goals")
    period = relationship("EvaluationPeriod", back_populates="goals")
    approver = relationship("User", foreign_keys=[approved_by])
    
    # Related assessment records
    self_assessments = relationship("SelfAssessment", back_populates="goal", cascade="all, delete-orphan")
    supervisor_reviews = relationship("SupervisorReview", back_populates="goal", cascade="all, delete-orphan")
    # supervisor_feedbacks = relationship("SupervisorFeedback", back_populates="goal", cascade="all, delete-orphan")

    @validates('target_data')
    def validate_target_data(self, key, target_data):
        """Validate target_data JSON structure based on goal_category"""
        if not isinstance(target_data, dict):
            raise ValueError("target_data must be a dictionary")
        
        # Schema validation based on goal category
        if hasattr(self, 'goal_category') and self.goal_category:
            self._validate_target_data_schema(target_data, self.goal_category)
        
        return target_data

    def _validate_target_data_schema(self, target_data: Dict[str, Any], category: str) -> None:
        """Validate target_data schema for specific goal categories"""
        if category == "業績目標":  # Performance Goal
            required_fields = ["title", "performance_goal_type", "specific_goal_text", "achievement_criteria_text", "means_methods_text"]
            optional_fields = []
            self._validate_performance_goal_schema(target_data, required_fields, optional_fields)
            
        elif category == "コンピテンシー":  # Competency Goal
            required_fields = ["action_plan"]
            optional_fields = ["competency_ids", "selected_ideal_actions"]
            self._validate_competency_goal_schema(target_data, required_fields, optional_fields)
            
        elif category == "コアバリュー":  # Core Value Goal
            required_fields = ["core_value_plan"]
            optional_fields = []
            self._validate_core_value_goal_schema(target_data, required_fields, optional_fields)
        else:
            raise ValueError(f"Unknown goal_category: {category}")

    def _validate_performance_goal_schema(self, data: Dict[str, Any], required: list, optional: list) -> None:
        """Validate performance goal target_data schema"""
        all_allowed = set(required + optional)
        provided = set(data.keys())
        
        # Check for unknown fields
        unknown = provided - all_allowed
        if unknown:
            raise ValueError(f"Unknown fields in performance goal target_data: {unknown}")
        
        # Check required fields
        missing = set(required) - provided
        if missing:
            raise ValueError(f"Missing required fields in performance goal: {missing}")
        
        # Validate specific field types
        if "performance_goal_type" in data and data["performance_goal_type"] is not None:
            # Accept both English enum values and Japanese display names
            valid_types = ["quantitative", "qualitative", "定量目標", "定性目標"]
            if data["performance_goal_type"] not in valid_types:
                raise ValueError(f"Invalid performance_goal_type: {data['performance_goal_type']}")
        
        # Validate text fields are strings
        text_fields = ["title", "specific_goal_text", "achievement_criteria_text", "means_methods_text"]
        for field in text_fields:
            if field in data and data[field] is not None and not isinstance(data[field], str):
                raise ValueError(f"{field} must be a string")

    def _validate_competency_goal_schema(self, data: Dict[str, Any], required: list, optional: list) -> None:
        """Validate competency goal target_data schema"""
        all_allowed = set(required + optional)
        provided = set(data.keys())
        
        # Check for unknown fields
        unknown = provided - all_allowed
        if unknown:
            raise ValueError(f"Unknown fields in competency goal target_data: {unknown}")
        
        # Check required fields
        missing = set(required) - provided
        if missing:
            raise ValueError(f"Missing required fields in competency goal: {missing}")
        
        # Validate selected_ideal_actions can only exist with competency_ids
        if "selected_ideal_actions" in data and data["selected_ideal_actions"] is not None:
            if not data.get("competency_ids"):
                raise ValueError("selected_ideal_actions can only be specified when competency_ids is provided")
            
            # Validate it's a dict
            if not isinstance(data["selected_ideal_actions"], dict):
                raise ValueError("selected_ideal_actions must be a dictionary")
            
            # Convert competency_ids to strings for comparison
            competency_id_strings = {str(comp_id) for comp_id in data["competency_ids"]}
            
            # Check that all ideal action keys correspond to selected competencies
            invalid_keys = set(data["selected_ideal_actions"].keys()) - competency_id_strings
            if invalid_keys:
                raise ValueError(f"selected_ideal_actions contains keys for non-selected competencies: {invalid_keys}")
            
            # Validate ideal action values for each competency
            valid_keys = {'1', '2', '3', '4', '5'}
            for competency_id, actions in data["selected_ideal_actions"].items():
                if not isinstance(actions, list):
                    raise ValueError(f"Ideal actions for competency {competency_id} must be a list")
                if not all(str(action) in valid_keys for action in actions):
                    raise ValueError(f"Ideal actions for competency {competency_id} must contain only '1', '2', '3', '4', or '5'")
        
        # Validate competency_ids are UUID string format
        if "competency_ids" in data and data["competency_ids"] is not None:
            if not isinstance(data["competency_ids"], list):
                raise ValueError("competency_ids must be a list")
            
            try:
                from uuid import UUID
                for comp_id in data["competency_ids"]:
                    UUID(str(comp_id))
            except (ValueError, TypeError):
                raise ValueError("All competency_ids must be valid UUID strings")
        
        # Validate action_plan is string
        if "action_plan" in data and data["action_plan"] is not None:
            if not isinstance(data["action_plan"], str):
                raise ValueError("action_plan must be a string")

    def _validate_core_value_goal_schema(self, data: Dict[str, Any], required: list, optional: list) -> None:
        """Validate core value goal target_data schema"""
        all_allowed = set(required + optional)
        provided = set(data.keys())
        
        # Check for unknown fields
        unknown = provided - all_allowed
        if unknown:
            raise ValueError(f"Unknown fields in core value goal target_data: {unknown}")
        
        # Check required fields
        missing = set(required) - provided
        if missing:
            raise ValueError(f"Missing required fields in core value goal: {missing}")
        
        # Validate core_value_plan is string
        if "core_value_plan" in data and data["core_value_plan"] is not None:
            if not isinstance(data["core_value_plan"], str):
                raise ValueError("core_value_plan must be a string")

    @validates('weight')
    def validate_weight(self, key, weight):
        """Validate weight is within bounds"""
        if weight is not None:
            from decimal import Decimal
            weight_decimal = Decimal(str(weight))
            if weight_decimal < 0 or weight_decimal > 100:
                raise ValueError(f"Weight must be between 0 and 100, got: {weight_decimal}")
        return weight

    @validates('status')
    def validate_status(self, key, status):
        """Validate status is one of allowed values"""
        if status is not None:
            valid_statuses = ['draft', 'incomplete', 'pending_approval', 'approved', 'rejected']
            if status not in valid_statuses:
                raise ValueError(f"Invalid status: {status}. Must be one of: {valid_statuses}")
        return status

    @validates('goal_category')
    def validate_goal_category(self, key, category):
        """Validate goal_category is one of allowed values"""
        if category is not None:
            valid_categories = ['業績目標', 'コンピテンシー', 'コアバリュー']
            if category not in valid_categories:
                raise ValueError(f"Invalid goal_category: {category}. Must be one of: {valid_categories}")
        return category

    def __repr__(self):
        return f"<Goal(id={self.id}, user_id={self.user_id}, category={self.goal_category}, status={self.status})>"