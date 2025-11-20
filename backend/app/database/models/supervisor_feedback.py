from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, text, DECIMAL, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID, JSONB
from sqlalchemy.orm import relationship, validates
from sqlalchemy.schema import Index
from decimal import Decimal

from .base import Base


class SupervisorFeedback(Base):
    """
    Supervisor feedback model representing supervisor evaluation of employee self-assessments.

    Supports two models:
    1. New bucket-based model: user_id + bucket_decisions (one feedback per user/period)
    2. Legacy individual model: self_assessment_id + rating/comment (one feedback per goal)
    """
    __tablename__ = "supervisor_feedback"

    # Core fields
    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))

    # Legacy model (individual goal feedback)
    self_assessment_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("self_assessments.id", ondelete="CASCADE"), nullable=True)
    rating = Column(DECIMAL(5, 2), nullable=True)  # Legacy: 0-100 rating
    comment = Column(String, nullable=True)  # Legacy: global comment

    # New bucket-based model
    user_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    bucket_decisions = Column(JSONB, nullable=True, default=list)  # Array of bucket decisions

    # Common fields
    period_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("evaluation_periods.id", ondelete="CASCADE"), nullable=False)
    supervisor_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    previous_feedback_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("supervisor_feedback.id", ondelete="SET NULL"), nullable=True)
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
            "status IN ('draft', 'submitted', 'approved', 'rejected')", 
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
        Index('idx_supervisor_feedback_previous_feedback_id', 'previous_feedback_id'),
    )

    # Relationships
    self_assessment = relationship("SelfAssessment", back_populates="supervisor_feedback")  # Legacy
    user = relationship("User", foreign_keys=[user_id])  # New model
    period = relationship("EvaluationPeriod", back_populates="supervisor_feedbacks")
    supervisor = relationship("User", foreign_keys=[supervisor_id])
    previous_feedback = relationship("SupervisorFeedback", remote_side=[id], foreign_keys=[previous_feedback_id])

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
            valid_statuses = ['draft', 'submitted', 'approved', 'rejected']
            if status not in valid_statuses:
                raise ValueError(f"Invalid status: {status}. Must be one of: {valid_statuses}")
            
            # Auto-set submitted_at when status changes to submitted/approved
            if status in ('submitted', 'approved') and self.submitted_at is None:
                self.submitted_at = datetime.now(timezone.utc)
        return status

    def __repr__(self):
        if self.user_id:
            return f"<SupervisorFeedback(id={self.id}, user_id={self.user_id}, period_id={self.period_id}, status={self.status}, buckets={len(self.bucket_decisions or [])})>"
        else:
            return f"<SupervisorFeedback(id={self.id}, self_assessment_id={self.self_assessment_id}, supervisor_id={self.supervisor_id}, status={self.status}, rating={self.rating})>"
