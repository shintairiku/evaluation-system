from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID, JSONB
from sqlalchemy.orm import relationship

from .base import Base


class Stage(Base):
    __tablename__ = "stages"

    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    organization_id = Column(String(50), ForeignKey("organizations.id"), nullable=False)
    name = Column(Text, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization")
    users = relationship("User", back_populates="stage")
    competencies = relationship("Competency", back_populates="stage")

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
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization")
    stage = relationship("Stage", back_populates="competencies")