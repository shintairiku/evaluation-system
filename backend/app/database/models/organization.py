from datetime import datetime

from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import relationship

from .base import Base


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(String(50), primary_key=True)  # Clerk organization ID
    name = Column(String(100), nullable=False)
    slug = Column(String(100), unique=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    users = relationship("User", back_populates="organization")
    domain_settings = relationship("DomainSettings", back_populates="organization", cascade="all, delete-orphan")


class DomainSettings(Base):
    __tablename__ = "domain_settings"

    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True, server_default="gen_random_uuid()")
    organization_id = Column(String(50), ForeignKey("organizations.id"), nullable=False)
    domain = Column(String(100), nullable=False)
    auto_join_enabled = Column(Boolean, default=False, nullable=False)
    verification_status = Column(String(20), default="pending", nullable=False)  # pending, verified, failed
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="domain_settings")

    __table_args__ = (
        # Unique constraint to prevent duplicate domains per organization
        UniqueConstraint('organization_id', 'domain', name='uq_domain_settings_org_domain'),
    )