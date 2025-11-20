from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, text, DECIMAL, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import relationship, validates
from sqlalchemy.schema import Index
from decimal import Decimal

from .base import Base


class SelfAssessment(Base):
    """
    Self-assessment model representing employee self-evaluation for goals.
    
    This model stores employee self-ratings and comments for their goals,
    following the same patterns as Goal and SupervisorReview models.
    """
    __tablename__ = "self_assessments"

    # Core fields
    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    goal_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("goals.id", ondelete="CASCADE"), nullable=False)
    period_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("evaluation_periods.id", ondelete="CASCADE"), nullable=False)
    self_rating = Column(DECIMAL(5, 2), nullable=True)  # 0-100 rating or null
    self_rating_text = Column(String, nullable=True)  # SS..D code
    self_comment = Column(String, nullable=True)
    status = Column(String(50), nullable=False, default="draft")
    previous_self_assessment_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("self_assessments.id", ondelete="SET NULL"), nullable=True)
    
    # Submission timestamp
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    
    # Timestamps with timezone
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Database constraints
    __table_args__ = (
        # Rating validation: must be between 0 and 100 if provided
        CheckConstraint('self_rating >= 0 AND self_rating <= 100', name='check_self_rating_bounds'),
        
        # Status validation
        CheckConstraint(
            "status IN ('draft', 'submitted')", 
            name='check_status_values'
        ),
        
        # Submission logic: submitted assessments must have submitted_at
        CheckConstraint(
            "(status != 'submitted') OR (submitted_at IS NOT NULL)",
            name='check_submission_required'
        ),
        
        # Unique constraint: one self assessment per goal
        Index('idx_self_assessments_previous_self_assessment_id', 'previous_self_assessment_id'),
        # Performance indexes for common queries
        Index('idx_self_assessments_period_status', 'period_id', 'status'),
        Index('idx_self_assessments_created_at', 'created_at'),
    )

    # Relationships
    goal = relationship("Goal", back_populates="self_assessments")
    period = relationship("EvaluationPeriod", back_populates="self_assessments")
    supervisor_feedback = relationship("SupervisorFeedback", back_populates="self_assessment", uselist=False)
    previous_self_assessment = relationship("SelfAssessment", remote_side=[id], foreign_keys=[previous_self_assessment_id])

    @validates('self_rating')
    def validate_self_rating(self, key, self_rating):
        """Validate self_rating is within bounds if provided"""
        if self_rating is not None:
            rating_decimal = Decimal(str(self_rating))
            if rating_decimal < 0 or rating_decimal > 100:
                raise ValueError(f"Self rating must be between 0 and 100, got: {rating_decimal}")
        return self_rating

    @validates('status')
    def validate_status(self, key, status):
        """Validate status is one of allowed values"""
        if status is not None:
            valid_statuses = ['draft', 'submitted']
            if status not in valid_statuses:
                raise ValueError(f"Invalid status: {status}. Must be one of: {valid_statuses}")
        return status

    def __repr__(self):
        return f"<SelfAssessment(id={self.id}, goal_id={self.goal_id}, status={self.status}, rating={self.self_rating})>"
