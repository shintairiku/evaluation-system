"""
Role SQLAlchemy Model

This module defines the Role model with hierarchical support and permissions
as specified in Task #73.

Features:
- Hierarchical roles with parent_id self-referencing
- JSON permissions array for flexible permission management
- Code field for unique uppercase role codes
- Timestamps for audit trail
- Proper relationships with users
"""

from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship

from .base import Base


class Role(Base):
    """
    Role model with hierarchical support and permissions.
    
    Supports role hierarchy through parent_id self-referencing and
    flexible permissions through JSON array storage.
    """
    __tablename__ = "roles"

    # Primary fields
    id = Column(Integer, primary_key=True)
    name = Column(String(50), nullable=False, unique=True)
    code = Column(String(20), nullable=False, unique=True)  # Uppercase role code (e.g., 'ADMIN', 'MANAGER')
    description = Column(String(200), nullable=False)
    
    # Permissions and hierarchy
    permissions = Column(JSON, nullable=True, default=list)  # Array of permission strings
    parent_id = Column(Integer, ForeignKey('roles.id'), nullable=True)  # Self-referencing for hierarchy
    
    # Audit timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    users = relationship("User", secondary="user_roles", back_populates="roles")
    parent = relationship("Role", remote_side=[id], back_populates="children")
    children = relationship("Role", back_populates="parent")

    def __repr__(self):
        return f"<Role(id={self.id}, code={self.code}, name={self.name})>"

    def __str__(self):
        return f"{self.code}: {self.name}" 