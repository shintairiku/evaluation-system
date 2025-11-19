from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, DECIMAL, JSON, UniqueConstraint, Integer, ForeignKeyConstraint, text
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import relationship

from .base import Base


class EvaluationScoreMapping(Base):
    __tablename__ = "evaluation_score_mapping"

    id = Column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    organization_id = Column(String(50), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    rating_code = Column(String, nullable=False)
    rating_label = Column(String, nullable=True)
    score_value = Column(DECIMAL(3, 1), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        UniqueConstraint('organization_id', 'rating_code', name='uq_evaluation_score_mapping_org_code'),
    )

    def __repr__(self):
        return f"<EvaluationScoreMapping(org={self.organization_id}, code={self.rating_code}, score={self.score_value})>"


class RatingThreshold(Base):
    __tablename__ = "rating_thresholds"

    id = Column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    organization_id = Column(String(50), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    rating_code = Column(String, nullable=False)
    min_score = Column(DECIMAL(3, 2), nullable=False)
    note = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        UniqueConstraint('organization_id', 'rating_code', name='uq_rating_thresholds_org_code'),
        ForeignKeyConstraint(
            ['organization_id', 'rating_code'],
            ['evaluation_score_mapping.organization_id', 'evaluation_score_mapping.rating_code'],
            ondelete="CASCADE",
            name="fk_rating_thresholds_mapping",
        ),
    )

    def __repr__(self):
        return f"<RatingThreshold(org={self.organization_id}, code={self.rating_code}, min={self.min_score})>"


class EvaluationPolicyFlag(Base):
    __tablename__ = "evaluation_policy_flags"

    organization_id = Column(String(50), ForeignKey("organizations.id", ondelete="CASCADE"), primary_key=True)
    key = Column(String, primary_key=True)
    value = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    def __repr__(self):
        return f"<EvaluationPolicyFlag(org={self.organization_id}, key={self.key})>"


class LevelAdjustmentMaster(Base):
    __tablename__ = "level_adjustment_master"

    organization_id = Column(String(50), ForeignKey("organizations.id", ondelete="CASCADE"), primary_key=True)
    rating_code = Column(String, primary_key=True)
    level_delta = Column(Integer, nullable=False)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        ForeignKeyConstraint(
            ['organization_id', 'rating_code'],
            ['evaluation_score_mapping.organization_id', 'evaluation_score_mapping.rating_code'],
            ondelete="CASCADE",
            name="fk_level_adjustment_mapping",
        ),
    )

    def __repr__(self):
        return f"<LevelAdjustmentMaster(org={self.organization_id}, code={self.rating_code}, delta={self.level_delta})>"


class SelfAssessmentSummary(Base):
    __tablename__ = "self_assessment_summaries"

    id = Column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    organization_id = Column(String(50), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    period_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("evaluation_periods.id", ondelete="CASCADE"), nullable=False)
    stage_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("stages.id", ondelete="SET NULL"))
    stage_weights = Column(JSON, nullable=False)
    per_bucket = Column(JSON, nullable=False)
    weighted_total = Column(DECIMAL(4, 2), nullable=False)
    final_rating_code = Column(String, nullable=False)
    flags = Column(JSON, nullable=False, default=dict)
    level_adjustment_preview = Column(JSON, nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        UniqueConstraint('organization_id', 'user_id', 'period_id', name='uq_self_assessment_summaries_org_user_period'),
    )

    user = relationship("User")
    stage = relationship("Stage")

    def __repr__(self):
        return f"<SelfAssessmentSummary(org={self.organization_id}, user={self.user_id}, period={self.period_id}, rating={self.final_rating_code})>"
