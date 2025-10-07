from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import relationship

from .base import Base

class WebhookEvent(Base):
    """Model for tracking processed webhook events to ensure idempotency."""
    
    __tablename__ = "webhook_events"
    
    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True, server_default="gen_random_uuid()")
    organization_id = Column(String(50), ForeignKey("organizations.id"), nullable=True)  # Nullable for system-wide events
    event_id = Column(String(255), unique=True, nullable=False, index=True)
    event_type = Column(String(100), nullable=False)
    processed_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization")