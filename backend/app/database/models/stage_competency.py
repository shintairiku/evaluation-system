from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Integer, text, UniqueConstraint, DECIMAL
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID, JSONB
from sqlalchemy.orm import relationship

from .base import Base


class Stage(Base):
    __tablename__ = "stages"

    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    organization_id = Column(String(50), ForeignKey("organizations.id"), nullable=False)
    name = Column(Text, nullable=False)
    description = Column(Text)
    quantitative_weight = Column(DECIMAL(5, 2), nullable=False, default=0)
    qualitative_weight = Column(DECIMAL(5, 2), nullable=False, default=0)
    competency_weight = Column(DECIMAL(5, 2), nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization")
    users = relationship("User", back_populates="stage")
    competencies = relationship("Competency", back_populates="stage")
    weight_history = relationship("StageWeightHistory", back_populates="stage", cascade="all, delete-orphan")

    __table_args__ = (
        # Unique constraint: stage names unique within organization
        UniqueConstraint('organization_id', 'name', name='uq_stages_org_name'),
    )


class Competency(Base):
    __tablename__ = "competencies"

    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    organization_id = Column(String(50), ForeignKey("organizations.id"), nullable=False)
    stage_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("stages.id"), nullable=False)
    name = Column(Text, nullable=False)
    description = Column(JSONB)
    display_order = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization")
    stage = relationship("Stage", back_populates="competencies")


class StageWeightHistory(Base):
    __tablename__ = "stage_weight_history"

    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    stage_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("stages.id", ondelete="CASCADE"), nullable=False)
    organization_id = Column(String(50), ForeignKey("organizations.id"), nullable=False)
    actor_user_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    quantitative_weight_before = Column(DECIMAL(5, 2), nullable=True)
    quantitative_weight_after = Column(DECIMAL(5, 2), nullable=True)
    qualitative_weight_before = Column(DECIMAL(5, 2), nullable=True)
    qualitative_weight_after = Column(DECIMAL(5, 2), nullable=True)
    competency_weight_before = Column(DECIMAL(5, 2), nullable=True)
    competency_weight_after = Column(DECIMAL(5, 2), nullable=True)
    changed_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    stage = relationship("Stage", back_populates="weight_history")
