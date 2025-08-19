from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import Column, String, Text, DateTime, Date, text
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import relationship

from .base import Base


class EvaluationPeriodStatus(str, Enum):
    UPCOMING = "準備中"
    ACTIVE = "実施中"
    COMPLETED = "完了"


class EvaluationPeriodType(str, Enum):
    HALF_TERM = "半期"
    MONTHLY = "月次"
    QUARTERLY = "四半期"
    YEARLY = "年次"
    OTHER = "その他"


class EvaluationPeriod(Base):
    __tablename__ = "evaluation_periods"

    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name = Column(Text, nullable=False)
    period_type = Column(String(50), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    goal_submission_deadline = Column(Date, nullable=False)
    evaluation_deadline = Column(Date, nullable=False)
    status = Column(String(50), nullable=False, default=EvaluationPeriodStatus.UPCOMING)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    goals = relationship("Goal", back_populates="period")
    self_assessments = relationship("SelfAssessment", back_populates="period")

    def __repr__(self):
        return f"<EvaluationPeriod(id={self.id}, name='{self.name}', status='{self.status}')>"