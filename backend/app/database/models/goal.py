from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, text, DECIMAL, CheckConstraint, UniqueConstraint
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
    status = Column(String(50), nullable=False, default="draft")
    
    # Approval fields
    approved_by = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    
    # Timestamps with timezone
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Database constraints
    __table_args__ = (
        # Unique constraint: one goal per user/period/category combination
        UniqueConstraint('user_id', 'period_id', 'goal_category', name='unique_user_period_category'),
        
        # Weight validation: individual weight must be between 0 and 100
        # Note: Business rule validation (sum of 業績目標 weights = 100%) handled in repository layer
        CheckConstraint('weight >= 0 AND weight <= 100', name='check_individual_weight_bounds'),
        
        # Status validation
        CheckConstraint(
            "status IN ('draft', 'pending_approval', 'approved', 'rejected')", 
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
    
    # Related assessment records (TODO: Uncomment when these models are created)
    # self_assessments = relationship("SelfAssessment", back_populates="goal", cascade="all, delete-orphan")
    # supervisor_reviews = relationship("SupervisorReview", back_populates="goal", cascade="all, delete-orphan")
    # supervisor_feedbacks = relationship("SupervisorFeedback", back_populates="goal", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Goal(id={self.id}, user_id={self.user_id}, category={self.goal_category}, status={self.status})>"