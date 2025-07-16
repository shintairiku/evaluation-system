from datetime import datetime
from sqlalchemy import Column, String, DateTime, text
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import relationship

from .base import Base


class Role(Base):
    __tablename__ = "roles"

    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name = Column(String(50), nullable=False)
    description = Column(String(200), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    users = relationship("User", secondary="user_roles", back_populates="roles")