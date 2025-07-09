"""
Role Repository - Direct data access methods for Role entities.

This repository provides simple, direct data access methods without business logic
or transaction management, as specified in Task #73.
"""

import logging
from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func
from sqlalchemy.orm import joinedload
from sqlalchemy.exc import SQLAlchemyError

from ..models.role import Role
from ..models.user import user_roles

logger = logging.getLogger(__name__)


class RoleRepository:
    """Simple repository for role operations without business logic."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    # ========================================
    # CREATE OPERATIONS
    # ========================================
    
    def add(self, role: Role) -> None:
        """Add a role to the session (does not commit)."""
        self.session.add(role)
    
    async def create_role(
        self, 
        name: str, 
        code: str, 
        description: str, 
        permissions: Optional[List[str]] = None,
        parent_id: Optional[int] = None
    ) -> Role:
        """Create a new role (does not commit)."""
        try:
            role = Role(
                name=name,
                code=code.upper(),  # Ensure uppercase
                description=description,
                permissions=permissions or [],
                parent_id=parent_id
            )
            self.session.add(role)
            await self.session.flush()  # Get the ID without committing
            return role
        except SQLAlchemyError as e:
            logger.error(f"Error creating role: {e}")
            raise
    
    # ========================================
    # READ OPERATIONS
    # ========================================
    
    async def get_all(self) -> List[Role]:
        """Get all roles."""
        try:
            result = await self.session.execute(
                select(Role)
                .options(
                    joinedload(Role.parent),
                    joinedload(Role.children)
                )
                .order_by(Role.name)
            )
            return result.scalars().unique().all()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching all roles: {e}")
            raise
    
    async def get_role_by_id(self, role_id: int) -> Optional[Role]:
        """Get role by ID with relationships loaded."""
        try:
            result = await self.session.execute(
                select(Role)
                .options(
                    joinedload(Role.parent),
                    joinedload(Role.children)
                )
                .where(Role.id == role_id)
            )
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching role by ID {role_id}: {e}")
            raise
    
    async def get_role_by_code(self, code: str) -> Optional[Role]:
        """Get role by code."""
        try:
            result = await self.session.execute(
                select(Role)
                .options(
                    joinedload(Role.parent),
                    joinedload(Role.children)
                )
                .where(Role.code == code.upper())
            )
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching role by code {code}: {e}")
            raise
    
    async def get_role_by_name(self, name: str) -> Optional[Role]:
        """Get role by name."""
        try:
            result = await self.session.execute(
                select(Role)
                .options(
                    joinedload(Role.parent),
                    joinedload(Role.children)
                )
                .where(Role.name == name)
            )
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching role by name {name}: {e}")
            raise
    
    async def get_user_roles(self, user_id: UUID) -> List[Role]:
        """Get all roles for a specific user."""
        try:
            result = await self.session.execute(
                select(Role)
                .join(user_roles, Role.id == user_roles.c.role_id)
                .where(user_roles.c.user_id == user_id)
                .order_by(Role.name)
            )
            return result.scalars().all()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching roles for user {user_id}: {e}")
            raise
    
    async def get_roles_by_parent_id(self, parent_id: Optional[int]) -> List[Role]:
        """Get all roles with specified parent_id (including None for root roles)."""
        try:
            result = await self.session.execute(
                select(Role)
                .options(joinedload(Role.children))
                .where(Role.parent_id == parent_id)
                .order_by(Role.name)
            )
            return result.scalars().unique().all()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching roles by parent_id {parent_id}: {e}")
            raise
    
    async def count_users_with_role(self, role_id: int) -> int:
        """Count how many users have this role."""
        try:
            result = await self.session.execute(
                select(func.count(user_roles.c.user_id))
                .where(user_roles.c.role_id == role_id)
            )
            return result.scalar() or 0
        except SQLAlchemyError as e:
            logger.error(f"Error counting users for role {role_id}: {e}")
            raise
    
    # ========================================
    # UPDATE OPERATIONS
    # ========================================
    
    async def update_role(
        self, 
        role_id: int, 
        name: Optional[str] = None,
        code: Optional[str] = None,
        description: Optional[str] = None,
        permissions: Optional[List[str]] = None,
        parent_id: Optional[int] = None
    ) -> Optional[Role]:
        """Update role information (does not commit)."""
        try:
            # Build update values dict
            update_values = {}
            if name is not None:
                update_values['name'] = name
            if code is not None:
                update_values['code'] = code.upper()  # Ensure uppercase
            if description is not None:
                update_values['description'] = description
            if permissions is not None:
                update_values['permissions'] = permissions
            if parent_id is not None:
                update_values['parent_id'] = parent_id
            
            if not update_values:
                # No updates to perform, return existing role
                return await self.get_role_by_id(role_id)
            
            # Perform update
            await self.session.execute(
                update(Role)
                .where(Role.id == role_id)
                .values(**update_values)
            )
            
            # Return updated role
            return await self.get_role_by_id(role_id)
        except SQLAlchemyError as e:
            logger.error(f"Error updating role {role_id}: {e}")
            raise
    
    # ========================================
    # DELETE OPERATIONS
    # ========================================
    
    async def delete_role(self, role_id: int) -> bool:
        """Delete a role (does not commit). Returns True if role was found and deleted."""
        try:
            # Check if role exists
            existing_role = await self.get_role_by_id(role_id)
            if not existing_role:
                return False
            
            # Delete the role
            result = await self.session.execute(
                delete(Role).where(Role.id == role_id)
            )
            
            return result.rowcount > 0
        except SQLAlchemyError as e:
            logger.error(f"Error deleting role {role_id}: {e}")
            raise
    
    async def check_role_exists_by_code(self, code: str, exclude_id: Optional[int] = None) -> bool:
        """Check if a role with the given code exists (excluding optional ID)."""
        try:
            query = select(Role.id).where(Role.code == code.upper())
            if exclude_id is not None:
                query = query.where(Role.id != exclude_id)
            
            result = await self.session.execute(query)
            return result.scalar_one_or_none() is not None
        except SQLAlchemyError as e:
            logger.error(f"Error checking role existence by code {code}: {e}")
            raise
    
    async def check_role_exists_by_name(self, name: str, exclude_id: Optional[int] = None) -> bool:
        """Check if a role with the given name exists (excluding optional ID)."""
        try:
            query = select(Role.id).where(Role.name == name)
            if exclude_id is not None:
                query = query.where(Role.id != exclude_id)
            
            result = await self.session.execute(query)
            return result.scalar_one_or_none() is not None
        except SQLAlchemyError as e:
            logger.error(f"Error checking role existence by name {name}: {e}")
            raise