from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    DECIMAL,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PostgreSQLUUID
from sqlalchemy.schema import Index

from .base import Base


class ComprehensiveOverallRankRule(Base):
    __tablename__ = "comprehensive_overall_rank_rules"

    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True)
    organization_id = Column(String(50), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    overall_rank = Column(Text, nullable=False)
    min_score = Column(DECIMAL(10, 2), nullable=False)
    max_score = Column(DECIMAL(10, 2), nullable=True)
    level_delta = Column(Integer, nullable=False)
    display_order = Column(Integer, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("organization_id", "overall_rank", name="uq_comprehensive_overall_rank_rules_org_rank"),
        Index(
            "idx_comprehensive_overall_rank_rules_org_active_order",
            "organization_id",
            "is_active",
            "display_order",
        ),
    )


class ComprehensiveDecisionRuleGroup(Base):
    __tablename__ = "comprehensive_decision_rule_groups"

    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True)
    organization_id = Column(String(50), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    decision_type = Column(Text, nullable=False)
    group_name = Column(Text, nullable=True)
    display_order = Column(Integer, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "decision_type",
            "display_order",
            name="uq_comprehensive_decision_rule_groups_org_type_order",
        ),
        Index(
            "idx_comprehensive_decision_rule_groups_org_type_active_order",
            "organization_id",
            "decision_type",
            "is_active",
            "display_order",
        ),
    )


class ComprehensiveDecisionRule(Base):
    __tablename__ = "comprehensive_decision_rules"

    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True)
    organization_id = Column(String(50), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    group_id = Column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("comprehensive_decision_rule_groups.id", ondelete="CASCADE"),
        nullable=False,
    )
    condition_order = Column(Integer, nullable=False)
    field_name = Column(Text, nullable=False)
    operator = Column(Text, nullable=False)
    threshold_rank = Column(Text, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("group_id", "condition_order", name="uq_comprehensive_decision_rules_group_order"),
        Index("idx_comprehensive_decision_rules_org_group_order", "organization_id", "group_id", "condition_order"),
    )


class ComprehensiveManualDecision(Base):
    __tablename__ = "comprehensive_manual_decisions"

    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True)
    organization_id = Column(String(50), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    period_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("evaluation_periods.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    decision = Column(Text, nullable=False)
    stage_after = Column(Text, nullable=True)
    level_after = Column(Integer, nullable=True)
    reason = Column(Text, nullable=False)
    double_checked_by = Column(Text, nullable=True)
    applied_by_user_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    applied_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "period_id",
            "user_id",
            name="uq_comprehensive_manual_decisions_org_period_user",
        ),
        Index("idx_comprehensive_manual_decisions_org_period", "organization_id", "period_id"),
        Index("idx_comprehensive_manual_decisions_org_user", "organization_id", "user_id"),
    )


class ComprehensiveManualDecisionHistory(Base):
    __tablename__ = "comprehensive_manual_decision_history"

    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True)
    organization_id = Column(String(50), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    period_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("evaluation_periods.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    operation = Column(Text, nullable=False)
    decision = Column(Text, nullable=True)
    stage_after = Column(Text, nullable=True)
    level_after = Column(Integer, nullable=True)
    reason = Column(Text, nullable=True)
    double_checked_by = Column(Text, nullable=True)
    applied_by_user_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    applied_at = Column(DateTime(timezone=True), nullable=True)
    changed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        Index(
            "idx_comprehensive_manual_decision_history_org_period_changed",
            "organization_id",
            "period_id",
            "changed_at",
        ),
        Index(
            "idx_comprehensive_manual_decision_history_org_user_changed",
            "organization_id",
            "user_id",
            "changed_at",
        ),
    )


class ComprehensiveSettingsAuditLog(Base):
    __tablename__ = "comprehensive_settings_audit_log"

    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True)
    organization_id = Column(String(50), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    actor_user_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    before_json = Column(JSONB, nullable=True)
    after_json = Column(JSONB, nullable=True)
    changed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        Index("idx_comprehensive_settings_audit_log_org_changed", "organization_id", "changed_at"),
    )


class ComprehensiveProcessingStatus(Base):
    __tablename__ = "comprehensive_processing_statuses"

    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True)
    organization_id = Column(String(50), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    period_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("evaluation_periods.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    processed_by_user_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    processed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "period_id",
            "user_id",
            name="uq_comprehensive_processing_statuses_org_period_user",
        ),
        Index("idx_comprehensive_processing_statuses_org_period", "organization_id", "period_id"),
        Index("idx_comprehensive_processing_statuses_org_user", "organization_id", "user_id"),
    )
