from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, text, DECIMAL
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID, JSONB
from sqlalchemy.orm import relationship

from .base import Base


class Goal(Base):
    """
    Goals model representing employee performance, competency, and core value goals.
    
    This model stores different types of goals with a flexible JSONB target_data field
    that contains category-specific information. The schema follows the updated
    database structure after migration 023 (string-based categories).
    """
    __tablename__ = "goals"

    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    period_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("evaluation_periods.id", ondelete="CASCADE"), nullable=False)
    goal_category = Column(String(100), nullable=False)  # String-based categories after migration 023
    target_data = Column(JSONB)  # Flexible JSON structure for different goal types
    weight = Column(DECIMAL(5, 2))  # Weight as decimal for precise calculations
    status = Column(String(50), nullable=False, default="draft")  # draft, pending_approval, approved, rejected
    approved_by = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

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