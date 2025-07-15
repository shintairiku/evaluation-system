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
        
        try:
            for role_id in role_ids:
                # Check if role exists first
                role_check = await self.session.execute(select(Role).where(Role.id == role_id))
                role = role_check.scalar_one_or_none()
                if not role:
                    logger.warning(f"Role {role_id} not found, skipping")
                    continue
                
                # Check if assignment already exists
                existing_check = await self.session.execute(
                    select(user_roles).where(
                        (user_roles.c.user_id == user_id) & 
                        (user_roles.c.role_id == role_id)
                    )
                )
                existing = existing_check.first()
                
                if existing is None:
                    # Insert the role assignment directly into the association table
                    stmt = insert(user_roles).values(user_id=user_id, role_id=role_id)
                    await self.session.execute(stmt)
                    logger.info(f"Successfully assigned role {role_id} to user {user_id}")
                else:
                    logger.info(f"Role {role_id} already assigned to user {user_id}")
                    
        except IntegrityError as e:
            logger.error(f"Integrity error assigning roles to user {user_id}: {e}")
            raise
        except Exception as e:
            logger.error(f"Error assigning roles to user {user_id}: {e}")
            raise
    
    async def update_user_roles(self, user_id: UUID, role_ids: List[int]) -> None:
        """Update user roles by replacing existing assignments."""
        logger.info(f"Updating roles for user {user_id} with roles {role_ids}")
        
        try:
            # Delete existing role assignments
            delete_stmt = delete(user_roles).where(user_roles.c.user_id == user_id)
            await self.session.execute(delete_stmt)
            logger.info(f"Cleared existing roles for user {user_id}")
            
            # Add new role assignments using the assign method
            if role_ids:
                await self.assign_roles_to_user(user_id, role_ids)
                        
        except Exception as e:
            logger.error(f"Error updating roles for user {user_id}: {e}")
            raise
    
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
    
    async def get_all_subordinates(self, supervisor_id: UUID) -> List[UUID]:
        """Get all subordinate IDs for a supervisor recursively."""
        result = await self.session.execute(
            select(UserSupervisor.user_id).where(UserSupervisor.supervisor_id == supervisor_id)
        )
        return [row[0] for row in result.fetchall()]