from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Boolean, Integer, DateTime, ForeignKey, text, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID, JSONB
from sqlalchemy.orm import relationship, validates
from sqlalchemy.schema import Index

from .base import Base


class CoreValueDefinition(Base):
    """
    Core value definition model representing the 9 fixed organizational values.
    Seeded per organization via migration 020.
    """
    __tablename__ = "core_value_definitions"

    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    organization_id = Column(String(50), nullable=False)
    display_order = Column(Integer, nullable=False)
    name = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        Index('uq_cv_def_org_order', 'organization_id', 'display_order', unique=True),
        Index('uq_cv_def_org_name', 'organization_id', 'name', unique=True),
    )

    def __repr__(self):
        return f"<CoreValueDefinition(id={self.id}, org={self.organization_id}, order={self.display_order}, name={self.name})>"


class CoreValueEvaluation(Base):
    """
    Core value evaluation model representing employee self-evaluation.

    3-state system: draft → submitted → approved
    Scores stored as JSONB: { "coreValueDefId": "A+", ... }
    """
    __tablename__ = "core_value_evaluations"

    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    period_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("evaluation_periods.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    scores = Column(JSONB, nullable=True)
    comment = Column(String, nullable=True)
    status = Column(String(20), nullable=False, default="draft")

    submitted_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'submitted', 'approved')",
            name='chk_cv_status'
        ),
        CheckConstraint(
            "(status = 'draft') OR (submitted_at IS NOT NULL)",
            name='chk_cv_submission'
        ),
        Index('uq_cv_eval', 'period_id', 'user_id', unique=True),
        Index('idx_cv_eval_status', 'status'),
    )

    # Relationships
    period = relationship("EvaluationPeriod")
    user = relationship("User", foreign_keys=[user_id])
    feedback = relationship("CoreValueFeedback", back_populates="core_value_evaluation", uselist=False)

    @validates('status')
    def validate_status(self, key, status):
        if status is not None:
            valid_statuses = ['draft', 'submitted', 'approved']
            if status not in valid_statuses:
                raise ValueError(f"Invalid status: {status}. Must be one of: {valid_statuses}")
        return status

    def __repr__(self):
        return f"<CoreValueEvaluation(id={self.id}, period_id={self.period_id}, user_id={self.user_id}, status={self.status})>"


class CoreValueFeedback(Base):
    """
    Core value feedback model representing supervisor evaluation of employee core value self-evaluations.

    Two-axis tracking:
    - status: incomplete → draft → submitted (workflow progress)
    - action: PENDING → APPROVED (decision)

    When action=APPROVED, the linked CoreValueEvaluation.status is set to 'approved' (locked).
    """
    __tablename__ = "core_value_feedback"

    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    core_value_evaluation_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("core_value_evaluations.id", ondelete="CASCADE"), nullable=False)
    period_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("evaluation_periods.id", ondelete="CASCADE"), nullable=False)
    supervisor_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    subordinate_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    scores = Column(JSONB, nullable=True)
    comment = Column(String, nullable=True)
    return_comment = Column(Text, nullable=True)

    action = Column(String(10), nullable=False, default="PENDING")
    status = Column(String(50), nullable=False, default="incomplete")

    submitted_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        CheckConstraint(
            "action IN ('PENDING', 'APPROVED')",
            name='chk_cvf_action'
        ),
        CheckConstraint(
            "status IN ('incomplete', 'draft', 'submitted')",
            name='chk_cvf_status'
        ),
        CheckConstraint(
            "(status != 'submitted') OR (submitted_at IS NOT NULL)",
            name='chk_cvf_submission'
        ),
        CheckConstraint(
            "(action != 'APPROVED') OR (reviewed_at IS NOT NULL)",
            name='chk_cvf_approval'
        ),
        Index('idx_cvf_evaluation_unique', 'core_value_evaluation_id', unique=True),
        Index('idx_cvf_period_status', 'period_id', 'status'),
        Index('idx_cvf_supervisor', 'supervisor_id'),
        Index('idx_cvf_subordinate', 'subordinate_id'),
        Index('idx_cvf_action', 'action'),
    )

    # Relationships
    core_value_evaluation = relationship("CoreValueEvaluation", back_populates="feedback")
    period = relationship("EvaluationPeriod")
    supervisor = relationship("User", foreign_keys=[supervisor_id])
    subordinate = relationship("User", foreign_keys=[subordinate_id])

    @validates('status')
    def validate_status(self, key, status):
        if status is not None:
            valid_statuses = ['incomplete', 'draft', 'submitted']
            if status not in valid_statuses:
                raise ValueError(f"Invalid status: {status}. Must be one of: {valid_statuses}")
        return status

    @validates('action')
    def validate_action(self, key, action):
        if action is not None:
            valid_actions = ['PENDING', 'APPROVED']
            if action not in valid_actions:
                raise ValueError(f"Invalid action: {action}. Must be one of: {valid_actions}")
        return action

    def __repr__(self):
        return f"<CoreValueFeedback(id={self.id}, cv_eval_id={self.core_value_evaluation_id}, action={self.action}, status={self.status})>"
