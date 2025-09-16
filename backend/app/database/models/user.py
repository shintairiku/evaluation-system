from datetime import datetime

from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Table, Date, text, Integer
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import relationship

from .base import Base

# Association table for user-role many-to-many relationship
user_roles = Table(
    'user_roles',
    Base.metadata,
    Column('user_id', PostgreSQLUUID(as_uuid=True), ForeignKey('users.id'), primary_key=True),
    Column('role_id', PostgreSQLUUID(as_uuid=True), ForeignKey('roles.id'), primary_key=True)
)


class User(Base):
    __tablename__ = "users"

    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    department_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("departments.id"))
    stage_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("stages.id"))
    clerk_user_id = Column(Text, unique=True, nullable=False)
    clerk_organization_id = Column(String(50), ForeignKey("organizations.id"), nullable=True)
    name = Column(Text, nullable=False)
    email = Column(Text, unique=True, nullable=False)
    employee_code = Column(Text, unique=True, nullable=False)
    status = Column(String(50), nullable=False)
    job_title = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    department = relationship("Department", back_populates="users")
    stage = relationship("Stage", back_populates="users")
    organization = relationship("Organization", back_populates="users")
    roles = relationship("Role", secondary="user_roles", back_populates="users")
    
    # Supervisor relationships through UserSupervisor table
    supervisor_relations = relationship("UserSupervisor", foreign_keys="UserSupervisor.user_id", back_populates="user")
    subordinate_relations = relationship("UserSupervisor", foreign_keys="UserSupervisor.supervisor_id", back_populates="supervisor")
    
    # Goal relationships
    goals = relationship("Goal", foreign_keys="Goal.user_id", back_populates="user")
    approved_goals = relationship("Goal", foreign_keys="Goal.approved_by", back_populates="approver")
    
    # Supervisor feedback relationships
    supervisor_feedbacks = relationship("SupervisorFeedback", foreign_keys="SupervisorFeedback.supervisor_id", back_populates="supervisor")
    
    # Note: supervisor and subordinates properties removed to avoid sync operations in async context
    # Use async service methods to get current supervisor/subordinates instead


class Department(Base):
    __tablename__ = "departments"

    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name = Column(String(100), nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    users = relationship("User", back_populates="department")


class Role(Base):
    __tablename__ = "roles"

    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name = Column(String(50), nullable=False, unique=True)
    description = Column(String(200), nullable=False)
    hierarchy_order = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    users = relationship("User", secondary="user_roles", back_populates="roles")

class UserSupervisor(Base):
    __tablename__ = "users_supervisors"

    user_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    supervisor_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    valid_from = Column(Date, nullable=False)
    valid_to = Column(Date)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="supervisor_relations")
    supervisor = relationship("User", foreign_keys=[supervisor_id], back_populates="subordinate_relations")
