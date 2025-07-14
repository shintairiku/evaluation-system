from sqlalchemy import Column, String, Integer
from sqlalchemy.orm import relationship

from .base import Base


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True)
    name = Column(String(50), nullable=False)
    description = Column(String(200), nullable=False)

    # Relationships
    users = relationship("User", secondary="user_roles", back_populates="roles")