from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text, DECIMAL, text
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.schema import Index, UniqueConstraint

from .base import Base


class EvaluationScoreMapping(Base):
    """
    Organization-scoped rating-code to numeric-score mapping.
    Used to convert codes like SS/S/A/B/C/D into numeric values.
    """

    __tablename__ = "evaluation_score_mapping"

    id = Column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    organization_id = Column(String(50), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    rating_code = Column(Text, nullable=False)
    rating_label = Column(Text, nullable=True)
    score_value = Column(DECIMAL(10, 2), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("organization_id", "rating_code", name="uq_evaluation_score_mapping_org_code"),
        Index("idx_evaluation_score_mapping_org", "organization_id"),
        Index("idx_evaluation_score_mapping_org_active", "organization_id", "is_active"),
    )

    def __repr__(self):
        return f"<EvaluationScoreMapping(org={self.organization_id}, code={self.rating_code}, score={self.score_value})>"
