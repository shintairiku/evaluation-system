from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, text, DECIMAL, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID, JSONB
from sqlalchemy.orm import relationship, validates
from sqlalchemy.schema import Index
from decimal import Decimal

from .base import Base


class SupervisorFeedback(Base):
    """
    Supervisor feedback model representing supervisor evaluation of employee self-assessments.

    Two-axis tracking:
    - status: incomplete → draft → submitted (workflow progress)
    - action: PENDING → APPROVED (decision)

    When action=APPROVED, the linked SelfAssessment.status is set to 'approved' (locked).
    """
    __tablename__ = "supervisor_feedback"

    # Core fields
    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    self_assessment_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("self_assessments.id", ondelete="CASCADE"), nullable=False)
    period_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("evaluation_periods.id", ondelete="CASCADE"), nullable=False)
    supervisor_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    subordinate_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Rating fields (renamed from rating/comment)
    supervisor_rating_code = Column(String(3), nullable=True)  # SS, S, A, B, C, D
    supervisor_rating = Column(DECIMAL(5, 2), nullable=True)  # 0-100 numeric value, auto-calculated
    supervisor_comment = Column(String, nullable=True)
    return_comment = Column(Text, nullable=True)  # Feedback visible to subordinate for corrections
    rating_data = Column(JSONB, nullable=True)  # Competency per-action ratings

    # Decision and workflow
    action = Column(String(10), nullable=False, default="PENDING")  # PENDING or APPROVED
    status = Column(String(50), nullable=False, default="incomplete")

    # Timestamps
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Database constraints
    __table_args__ = (
        # Rating validation: 0-100 scale
        CheckConstraint(
            'supervisor_rating IS NULL OR (supervisor_rating >= 0 AND supervisor_rating <= 100)',
            name='chk_supervisor_feedback_rating_bounds'
        ),

        # Rating code validation
        CheckConstraint(
            "supervisor_rating_code IS NULL OR supervisor_rating_code IN ('SS', 'S', 'A+', 'A', 'A-', 'B', 'C', 'D')",
            name='chk_supervisor_rating_code'
        ),

        # Status validation (incomplete, draft, submitted)
        CheckConstraint(
            "status IN ('incomplete', 'draft', 'submitted')",
            name='chk_supervisor_feedback_status'
        ),

        # Action validation (PENDING or APPROVED only)
        CheckConstraint(
            "action IN ('PENDING', 'APPROVED')",
            name='chk_supervisor_feedback_action'
        ),

        # Submission logic: submitted feedback must have submitted_at
        CheckConstraint(
            "(status != 'submitted') OR (submitted_at IS NOT NULL)",
            name='chk_supervisor_feedback_submission'
        ),

        # Approval logic: APPROVED must have reviewed_at
        CheckConstraint(
            "(action != 'APPROVED') OR (reviewed_at IS NOT NULL)",
            name='chk_supervisor_feedback_approval'
        ),

        # Unique constraint: one feedback per self assessment
        Index('idx_supervisor_feedback_assessment_unique', 'self_assessment_id', unique=True),

        # Performance indexes
        Index('idx_supervisor_feedback_period_status', 'period_id', 'status'),
        Index('idx_supervisor_feedback_supervisor', 'supervisor_id'),
        Index('idx_supervisor_feedback_subordinate', 'subordinate_id'),
        Index('idx_supervisor_feedback_action', 'action'),
        Index('idx_supervisor_feedback_created_at', 'created_at'),
        Index('idx_supervisor_feedback_rating_code', 'supervisor_rating_code'),
    )

    # Relationships
    self_assessment = relationship("SelfAssessment", back_populates="supervisor_feedback")
    period = relationship("EvaluationPeriod", back_populates="supervisor_feedbacks")
    supervisor = relationship("User", foreign_keys=[supervisor_id])
    subordinate = relationship("User", foreign_keys=[subordinate_id])

    @validates('supervisor_rating_code')
    def validate_supervisor_rating_code(self, key, code):
        """Validate supervisor_rating_code is one of allowed values"""
        if code is not None:
            valid_codes = ['SS', 'S', 'A+', 'A', 'A-', 'B', 'C', 'D']
            if code not in valid_codes:
                raise ValueError(f"Invalid supervisor_rating_code: {code}. Must be one of: {valid_codes}")
        return code

    @validates('supervisor_rating')
    def validate_supervisor_rating(self, key, rating):
        """Validate supervisor_rating is within 0-100 bounds if provided"""
        if rating is not None:
            rating_decimal = Decimal(str(rating))
            if rating_decimal < 0 or rating_decimal > 100:
                raise ValueError(f"Supervisor rating must be between 0 and 100, got: {rating_decimal}")
        return rating

    @validates('status')
    def validate_status(self, key, status):
        """Validate status is one of allowed values"""
        if status is not None:
            valid_statuses = ['incomplete', 'draft', 'submitted']
            if status not in valid_statuses:
                raise ValueError(f"Invalid status: {status}. Must be one of: {valid_statuses}")
        return status

    @validates('action')
    def validate_action(self, key, action):
        """Validate action is one of allowed values"""
        if action is not None:
            valid_actions = ['PENDING', 'APPROVED']
            if action not in valid_actions:
                raise ValueError(f"Invalid action: {action}. Must be one of: {valid_actions}")
        return action

    def __repr__(self):
        return f"<SupervisorFeedback(id={self.id}, self_assessment_id={self.self_assessment_id}, action={self.action}, status={self.status})>"
