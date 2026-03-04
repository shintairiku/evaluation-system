from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, text, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID, JSONB
from sqlalchemy.orm import relationship, validates
from sqlalchemy.schema import Index

from .base import Base


class PeerReviewAssignment(Base):
    """
    Peer review assignment model.
    Admin assigns exactly 2 reviewers per employee per period.
    """
    __tablename__ = "peer_review_assignments"

    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    period_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("evaluation_periods.id", ondelete="CASCADE"), nullable=False)
    reviewee_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reviewer_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    assigned_by = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        CheckConstraint(
            "reviewee_id != reviewer_id",
            name='chk_peer_no_self'
        ),
        Index('uq_peer_assignment', 'period_id', 'reviewee_id', 'reviewer_id', unique=True),
        Index('idx_pra_period_reviewee', 'period_id', 'reviewee_id'),
        Index('idx_pra_period_reviewer', 'period_id', 'reviewer_id'),
    )

    # Relationships
    period = relationship("EvaluationPeriod")
    reviewee = relationship("User", foreign_keys=[reviewee_id])
    reviewer = relationship("User", foreign_keys=[reviewer_id])
    assigner = relationship("User", foreign_keys=[assigned_by])
    evaluation = relationship("PeerReviewEvaluation", back_populates="assignment", uselist=False)

    def __repr__(self):
        return f"<PeerReviewAssignment(id={self.id}, period={self.period_id}, reviewee={self.reviewee_id}, reviewer={self.reviewer_id})>"


class PeerReviewEvaluation(Base):
    """
    Peer review evaluation model.
    Reviewer scores 9 core values + 1 general comment for a colleague.

    2-state system: draft → submitted (no reopen)
    Scores stored as JSONB: { "coreValueDefId": "A+", ... }
    """
    __tablename__ = "peer_review_evaluations"

    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    assignment_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("peer_review_assignments.id", ondelete="CASCADE"), nullable=False)
    period_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("evaluation_periods.id", ondelete="CASCADE"), nullable=False)
    reviewee_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reviewer_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    scores = Column(JSONB, nullable=True)
    comment = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="draft")

    submitted_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'submitted')",
            name='chk_pre_status'
        ),
        CheckConstraint(
            "(status = 'draft') OR (submitted_at IS NOT NULL)",
            name='chk_pre_submission'
        ),
        Index('uq_peer_eval_assignment', 'assignment_id', unique=True),
        Index('idx_pre_period_reviewee', 'period_id', 'reviewee_id'),
        Index('idx_pre_period_reviewer', 'period_id', 'reviewer_id'),
        Index('idx_pre_status', 'status'),
    )

    # Relationships
    assignment = relationship("PeerReviewAssignment", back_populates="evaluation")
    period = relationship("EvaluationPeriod")
    reviewee = relationship("User", foreign_keys=[reviewee_id])
    reviewer = relationship("User", foreign_keys=[reviewer_id])

    @validates('status')
    def validate_status(self, key, status):
        if status is not None:
            valid_statuses = ['draft', 'submitted']
            if status not in valid_statuses:
                raise ValueError(f"Invalid status: {status}. Must be one of: {valid_statuses}")
        return status

    def __repr__(self):
        return f"<PeerReviewEvaluation(id={self.id}, assignment={self.assignment_id}, reviewer={self.reviewer_id}, reviewee={self.reviewee_id}, status={self.status})>"
