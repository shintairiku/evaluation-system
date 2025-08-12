from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Text,
    DateTime,
    ForeignKey,
    CheckConstraint,
    Index,
)
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import relationship

from .base import Base


class SupervisorReview(Base):
    __tablename__ = "supervisor_reviews"

    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True)
    goal_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("goals.id", ondelete="CASCADE"), nullable=False)
    period_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("evaluation_periods.id", ondelete="CASCADE"), nullable=False)
    supervisor_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Business fields
    action = Column(String(50), nullable=False)  # approved | rejected | pending
    comment = Column(Text, nullable=True)
    status = Column(String(50), nullable=False, default="draft")  # draft | submitted

    # Timeline
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        # Validate action values
        CheckConstraint(
            "action IN ('approved', 'rejected', 'pending')",
            name="check_supervisor_review_action_values",
        ),
        # Validate status values
        CheckConstraint(
            "status IN ('draft', 'submitted')",
            name="check_supervisor_review_status_values",
        ),
        # When draft -> reviewed_at must be null; when submitted -> reviewed_at can be set (enforced in service layer)
        Index("idx_supervisor_reviews_goal_period", "goal_id", "period_id"),
        Index("idx_supervisor_reviews_supervisor", "supervisor_id"),
    )

    # Relationships
    goal = relationship("Goal", back_populates="supervisor_reviews")
    period = relationship("EvaluationPeriod")
    supervisor = relationship("User")

    def __repr__(self) -> str:
        return (
            f"<SupervisorReview(id={self.id}, goal_id={self.goal_id}, period_id={self.period_id}, "
            f"supervisor_id={self.supervisor_id}, action={self.action}, status={self.status})>"
        )


