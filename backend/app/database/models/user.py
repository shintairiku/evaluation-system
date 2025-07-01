from datetime import datetime
from enum import Enum
from uuid import UUID
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Integer, Table, Date
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import relationship

from .base import Base

# Association table for user-role many-to-many relationship
user_roles = Table(
    'user_roles',
    Base.metadata,
    Column('user_id', PostgreSQLUUID(as_uuid=True), ForeignKey('users.id'), primary_key=True),
    Column('role_id', Integer, ForeignKey('roles.id'), primary_key=True)
)


class User(Base):
    __tablename__ = "users"

    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True)
    department_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("departments.id"))
    stage_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("stages.id"))
    clerk_user_id = Column(Text, unique=True, nullable=False)
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
    roles = relationship("Role", secondary="user_roles", back_populates="users")
    
    # Supervisor relationships through UserSupervisor table
    supervisor_relations = relationship("UserSupervisor", foreign_keys="UserSupervisor.user_id", back_populates="user")
    subordinate_relations = relationship("UserSupervisor", foreign_keys="UserSupervisor.supervisor_id", back_populates="supervisor")
    
    # Convenience relationships for supervisors and subordinates
    supervisors = relationship("User", secondary="users_supervisors", 
                              primaryjoin="User.id==UserSupervisor.user_id",
                              secondaryjoin="UserSupervisor.supervisor_id==User.id",
                              viewonly=True)
    subordinates = relationship("User", secondary="users_supervisors",
                               primaryjoin="User.id==UserSupervisor.supervisor_id", 
                               secondaryjoin="UserSupervisor.user_id==User.id",
                               viewonly=True)
    
    @property
    def supervisor(self):
        """Get current active supervisor"""
        from datetime import date
        current_date = date.today()
        
        for relation in self.supervisor_relations:
            if (relation.valid_from <= current_date and 
                (relation.valid_to is None or relation.valid_to >= current_date)):
                return relation.supervisor
        return None
    
    @property
    def subordinates(self):
        """Get current active subordinates"""
        from datetime import date
        current_date = date.today()
        
        subordinates = []
        for relation in self.subordinate_relations:
            if (relation.valid_from <= current_date and 
                (relation.valid_to is None or relation.valid_to >= current_date)):
                subordinates.append(relation.user)
        return subordinates


class Department(Base):
    __tablename__ = "departments"

    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    users = relationship("User", back_populates="department")


class Stage(Base):
    __tablename__ = "stages"

    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    users = relationship("User", back_populates="stage")


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True)
    name = Column(String(50), nullable=False)
    description = Column(String(200), nullable=False)

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