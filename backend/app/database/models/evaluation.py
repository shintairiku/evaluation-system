from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import Column, String, Text, DateTime, Date, text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import relationship

from .base import Base


class EvaluationPeriodStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class EvaluationPeriodType(str, Enum):
    HALF_TERM = "半期"
    MONTHLY = "月次"
    QUARTERLY = "四半期"
    YEARLY = "年次"
    OTHER = "その他"


class EvaluationPeriod(Base):
    __tablename__ = "evaluation_periods"

    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    organization_id = Column(String(50), ForeignKey("organizations.id"), nullable=False)
    name = Column(Text, nullable=False)
    period_type = Column(String(50), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    goal_submission_deadline = Column(Date, nullable=False)
    evaluation_deadline = Column(Date, nullable=False)
    status = Column(String(50), nullable=False, default=EvaluationPeriodStatus.DRAFT)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization")
    goals = relationship("Goal", back_populates="period")
    self_assessments = relationship("SelfAssessment", back_populates="period")
    supervisor_feedbacks = relationship("SupervisorFeedback", back_populates="period")

    def __repr__(self):
        return f"<EvaluationPeriod(id={self.id}, name='{self.name}', status='{self.status}')>"