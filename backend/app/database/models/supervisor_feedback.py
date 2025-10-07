from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, text, DECIMAL, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import relationship, validates
from sqlalchemy.schema import Index
from decimal import Decimal

from .base import Base


class SupervisorFeedback(Base):
    """
    Supervisor feedback model representing supervisor evaluation of employee self-assessments.
    
    This model stores supervisor ratings and comments on self-assessments,
    following the same patterns as Goal and SupervisorReview models.
    """
    __tablename__ = "supervisor_feedback"

    # Core fields
    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    self_assessment_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("self_assessments.id", ondelete="CASCADE"), nullable=False)
    period_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("evaluation_periods.id", ondelete="CASCADE"), nullable=False)
    supervisor_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    rating = Column(DECIMAL(5, 2), nullable=True)  # 0-100 rating or null
    comment = Column(String, nullable=True)
    status = Column(String(50), nullable=False, default="draft")
    
    # Submission timestamp
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    
    # Timestamps with timezone
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Database constraints
    __table_args__ = (
        # Rating validation: must be between 0 and 100 if provided (NULL allowed)
        CheckConstraint('rating IS NULL OR (rating >= 0 AND rating <= 100)', name='check_feedback_rating_bounds'),
        
        # Status validation
        CheckConstraint(
            "status IN ('draft', 'submitted')", 
            name='check_feedback_status_values'
        ),
        
        # Submission logic: submitted feedback must have submitted_at
        CheckConstraint(
            "(status != 'submitted') OR (submitted_at IS NOT NULL)",
            name='check_feedback_submission_required'
        ),
        
        # Unique constraint: one feedback per self assessment
        Index('idx_supervisor_feedback_assessment_unique', 'self_assessment_id', unique=True),
        
        # Performance indexes for common queries
        Index('idx_supervisor_feedback_period_status', 'period_id', 'status'),
        Index('idx_supervisor_feedback_supervisor', 'supervisor_id'),
        Index('idx_supervisor_feedback_created_at', 'created_at'),
    )

    # Relationships
    self_assessment = relationship("SelfAssessment", back_populates="supervisor_feedback")
    period = relationship("EvaluationPeriod", back_populates="supervisor_feedbacks")
    supervisor = relationship("User", foreign_keys=[supervisor_id])

    @validates('rating')
    def validate_rating(self, key, rating):
        """Validate rating is within bounds if provided"""
        if rating is not None:
            rating_decimal = Decimal(str(rating))
            if rating_decimal < 0 or rating_decimal > 100:
                raise ValueError(f"Feedback rating must be between 0 and 100, got: {rating_decimal}")
        return rating

    @validates('status')
    def validate_status(self, key, status):
        """Validate status is one of allowed values and handle submitted_at timestamp"""
        if status is not None:
            valid_statuses = ['draft', 'submitted']
            if status not in valid_statuses:
                raise ValueError(f"Invalid status: {status}. Must be one of: {valid_statuses}")
            
            # Auto-set submitted_at when status changes to submitted
            if status == 'submitted' and self.submitted_at is None:
                self.submitted_at = datetime.now(timezone.utc)
        return status

    def __repr__(self):
        return f"<SupervisorFeedback(id={self.id}, self_assessment_id={self.self_assessment_id}, supervisor_id={self.supervisor_id}, status={self.status}, rating={self.rating})>"