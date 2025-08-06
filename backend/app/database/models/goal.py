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