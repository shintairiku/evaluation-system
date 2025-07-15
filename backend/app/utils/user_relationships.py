import logging
from typing import List
from uuid import UUID
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert, delete
from sqlalchemy.exc import IntegrityError

from ..database.models.user import UserSupervisor, User, Role, user_roles

logger = logging.getLogger(__name__)


class UserRelationshipManager:
    """Utility class for managing user relationships and role assignments."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def assign_roles_to_user(self, user_id: UUID, role_ids: List[int]) -> None:
        """Assign roles to user by inserting into user_roles table."""
        if not role_ids:
            return
        
        logger.info(f"Starting role assignment for user {user_id} with roles {role_ids}")
        
    
    async def update_user_roles(self, user_id: UUID, role_ids: List[int]) -> None:
        """Update user roles by replacing existing assignments."""
        # Delete existing role assignments
        delete_stmt = delete(user_roles).where(user_roles.c.user_id == user_id)
        await self.session.execute(delete_stmt)
        
        # Add new role assignments
        if role_ids:
            await self.assign_roles_to_user(user_id, role_ids)
    
    async def add_supervisor_relationship(self, user_id: UUID, supervisor_id: UUID) -> None:
        """Add supervisor relationship for a user."""
        relationship = UserSupervisor(
            user_id=user_id,
            supervisor_id=supervisor_id,
            valid_from=date.today(),
            valid_to=None
        )
        self.session.add(relationship)
    
    async def add_subordinate_relationships(self, supervisor_id: UUID, subordinate_ids: List[UUID]) -> None:
        """Add subordinate relationships during signup or user management."""
        for subordinate_id in subordinate_ids:
            relationship = UserSupervisor(
                user_id=subordinate_id,
                supervisor_id=supervisor_id,
                valid_from=date.today(),
                valid_to=None
            )
            self.session.add(relationship)