from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import relationship

from .base import Base


class ViewerVisibilityUser(Base):
    __tablename__ = "viewer_visibility_user"

    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    organization_id = Column(String(50), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    viewer_user_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    target_user_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    resource_type = Column(String(30), nullable=False)
    created_by = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    viewer = relationship("User", foreign_keys=[viewer_user_id])
    target_user = relationship("User", foreign_keys=[target_user_id])
    creator = relationship("User", foreign_keys=[created_by])

    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "viewer_user_id",
            "target_user_id",
            "resource_type",
            name="uq_viewer_visibility_user",
        ),
    )


class ViewerVisibilityDepartment(Base):
    __tablename__ = "viewer_visibility_department"

    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    organization_id = Column(String(50), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    viewer_user_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    target_department_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("departments.id", ondelete="CASCADE"), nullable=False)
    resource_type = Column(String(30), nullable=False)
    created_by = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    viewer = relationship("User", foreign_keys=[viewer_user_id])
    department = relationship("Department", foreign_keys=[target_department_id])
    creator = relationship("User", foreign_keys=[created_by])

    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "viewer_user_id",
            "target_department_id",
            "resource_type",
            name="uq_viewer_visibility_department",
        ),
    )


class ViewerVisibilitySupervisorTeam(Base):
    __tablename__ = "viewer_visibility_supervisor_team"

    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    organization_id = Column(String(50), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    viewer_user_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    supervisor_user_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    resource_type = Column(String(30), nullable=False)
    created_by = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    viewer = relationship("User", foreign_keys=[viewer_user_id])
    supervisor = relationship("User", foreign_keys=[supervisor_user_id])
    creator = relationship("User", foreign_keys=[created_by])

    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "viewer_user_id",
            "supervisor_user_id",
            "resource_type",
            name="uq_viewer_visibility_supervisor_team",
        ),
    )
