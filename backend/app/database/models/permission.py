from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import text

from .base import Base


class Permission(Base):
    __tablename__ = "permissions"

    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    code = Column(String(150), unique=True, nullable=False)
    description = Column(Text, nullable=False, default="")
    permission_group = Column(String(80), nullable=False, default="その他", index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    role_permissions = relationship("RolePermission", back_populates="permission", cascade="all, delete-orphan")


class RolePermission(Base):
    __tablename__ = "role_permissions"

    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    organization_id = Column(String(50), nullable=False)
    role_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("roles.id"), nullable=False)
    permission_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("permissions.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    permission = relationship("Permission", back_populates="role_permissions")

    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "role_id",
            "permission_id",
            name="uq_role_permissions_unique",
        ),
    )
