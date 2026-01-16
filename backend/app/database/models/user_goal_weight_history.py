from datetime import datetime

from sqlalchemy import Column, String, DateTime, ForeignKey, text, DECIMAL
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID

from .base import Base


class UserGoalWeightHistory(Base):
    __tablename__ = "user_goal_weight_history"

    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    organization_id = Column(String(50), ForeignKey("organizations.id"), nullable=False)
    actor_user_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    quantitative_weight_before = Column(DECIMAL(5, 2), nullable=True)
    quantitative_weight_after = Column(DECIMAL(5, 2), nullable=True)
    qualitative_weight_before = Column(DECIMAL(5, 2), nullable=True)
    qualitative_weight_after = Column(DECIMAL(5, 2), nullable=True)
    competency_weight_before = Column(DECIMAL(5, 2), nullable=True)
    competency_weight_after = Column(DECIMAL(5, 2), nullable=True)
    changed_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
