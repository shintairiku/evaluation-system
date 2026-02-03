from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, text, DECIMAL, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID, JSONB
from sqlalchemy.orm import relationship, validates
from sqlalchemy.schema import Index
from decimal import Decimal
from typing import Dict, Any, Optional

from .base import Base


class SelfAssessment(Base):
    """
    Self-assessment model representing employee self-evaluation for goals.

    3-state system: draft → submitted → approved
    Rating uses letter grades (SS/S/A/B/C/D) with auto-calculated numeric values (0-7).
    Competency goals use rating_data JSONB for granular per-action ratings.
    """
    __tablename__ = "self_assessments"

    # Core fields
    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    goal_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("goals.id", ondelete="CASCADE"), nullable=False)
    period_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("evaluation_periods.id", ondelete="CASCADE"), nullable=False)
    self_rating_code = Column(String(3), nullable=True)  # SS, S, A, B, C, D
    self_rating = Column(DECIMAL(5, 2), nullable=True)  # 0-7 numeric value, auto-calculated
    self_comment = Column(String, nullable=True)
    rating_data = Column(JSONB, nullable=True)  # Competency per-action ratings
    status = Column(String(50), nullable=False, default="draft")

    # Submission timestamp
    submitted_at = Column(DateTime(timezone=True), nullable=True)

    # Timestamps with timezone
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Database constraints
    __table_args__ = (
        # Rating validation: 0-7 scale
        CheckConstraint('self_rating IS NULL OR (self_rating >= 0 AND self_rating <= 7)', name='chk_self_rating_bounds'),

        # Rating code validation
        CheckConstraint(
            "self_rating_code IS NULL OR self_rating_code IN ('SS', 'S', 'A', 'B', 'C', 'D')",
            name='chk_self_rating_code'
        ),

        # Status validation (3-state: draft, submitted, approved)
        CheckConstraint(
            "status IN ('draft', 'submitted', 'approved')",
            name='chk_self_assessment_status'
        ),

        # Submission logic: submitted/approved assessments must have submitted_at
        CheckConstraint(
            "(status = 'draft') OR (submitted_at IS NOT NULL)",
            name='chk_self_assessment_submission'
        ),

        # Unique constraint: one self assessment per goal
        Index('idx_self_assessments_goal_unique', 'goal_id', unique=True),

        # Performance indexes
        Index('idx_self_assessments_period_status', 'period_id', 'status'),
        Index('idx_self_assessments_created_at', 'created_at'),
        Index('idx_self_assessments_rating_code', 'self_rating_code'),
    )

    # Relationships
    goal = relationship("Goal", back_populates="self_assessments")
    period = relationship("EvaluationPeriod", back_populates="self_assessments")
    supervisor_feedback = relationship("SupervisorFeedback", back_populates="self_assessment", uselist=False)

    @validates('self_rating_code')
    def validate_self_rating_code(self, key, code):
        """Validate self_rating_code is one of allowed values"""
        if code is not None:
            valid_codes = ['SS', 'S', 'A', 'B', 'C', 'D']
            if code not in valid_codes:
                raise ValueError(f"Invalid self_rating_code: {code}. Must be one of: {valid_codes}")
        return code

    @validates('self_rating')
    def validate_self_rating(self, key, self_rating):
        """Validate self_rating is within 0-7 bounds if provided"""
        if self_rating is not None:
            rating_decimal = Decimal(str(self_rating))
            if rating_decimal < 0 or rating_decimal > 7:
                raise ValueError(f"Self rating must be between 0 and 7, got: {rating_decimal}")
        return self_rating

    @validates('status')
    def validate_status(self, key, status):
        """Validate status is one of allowed values"""
        if status is not None:
            valid_statuses = ['draft', 'submitted', 'approved']
            if status not in valid_statuses:
                raise ValueError(f"Invalid status: {status}. Must be one of: {valid_statuses}")
        return status

    def __repr__(self):
        return f"<SelfAssessment(id={self.id}, goal_id={self.goal_id}, status={self.status}, rating_code={self.self_rating_code})>"
