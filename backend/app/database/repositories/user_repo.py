from typing import Optional
from uuid import UUID
import logging

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import joinedload
from sqlalchemy.exc import SQLAlchemyError

from ..models.user import User, UserSupervisor
from ...schemas.user import UserStatus

logger = logging.getLogger(__name__)


class UserRepository:

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_user_by_clerk_id(self, clerk_user_id: str) -> Optional[User]:
        """Get user by Clerk user ID."""
        try:
            result = await self.session.execute(
                select(User)
                .options(
                    joinedload(User.department),
                    joinedload(User.stage),
                    joinedload(User.roles)
                )
                .filter(User.clerk_user_id == clerk_user_id)
            )
            return result.scalars().unique().first()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching user by clerk_id {clerk_user_id}: {e}")
            raise

    async def check_user_exists_by_clerk_id(self, clerk_user_id: str) -> Optional[dict]:
        """
        Lightweight check if user exists by clerk_id.
        Returns minimal user info without expensive joins.
        """
        try:
            result = await self.session.execute(
                select(User.id, User.name, User.email, User.status)
                .filter(User.clerk_user_id == clerk_user_id)
            )
            user_row = result.first()
            
            if user_row:
                return {
                    "id": user_row.id,
                    "name": user_row.name, 
                    "email": user_row.email,
                    "status": user_row.status
                }
            return None
        except SQLAlchemyError as e:
            logger.error(f"Error checking user existence by clerk_id {clerk_user_id}: {e}")
            raise

    async def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email address."""
        try:
            result = await self.session.execute(
                select(User).filter(User.email == email)
            )
            return result.scalars().first()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching user by email {email}: {e}")
            raise

    async def get_user_by_id(self, user_id: UUID) -> Optional[User]:
        """Get user by ID."""
        try:
            result = await self.session.execute(
                select(User).filter(User.id == user_id)
            )
            return result.scalars().first()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching user by ID {user_id}: {e}")
            raise

    async def get_user_by_id_with_details(self, user_id: UUID) -> Optional[User]:
        """Get user by ID with all related data."""
        try:
            result = await self.session.execute(
                select(User)
                .options(
                    joinedload(User.department),
                    joinedload(User.stage),
                    joinedload(User.roles),
                    joinedload(User.supervisor_relations).joinedload(UserSupervisor.supervisor),
                )
                .filter(User.id == user_id)
            )
            return result.scalars().unique().first()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching user details for ID {user_id}: {e}")
            raise

    async def get_users_by_status(self, status: UserStatus) -> list[User]:
        """Get all users with specific status."""
        try:
            result = await self.session.execute(
                select(User)
                .options(
                    joinedload(User.department),
                    joinedload(User.stage),
                    joinedload(User.supervisor_relations).joinedload(UserSupervisor.supervisor)
                )
                .filter(User.status == status.value)
                .order_by(User.created_at.desc())
            )
            return result.scalars().unique().all()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching users by status {status}: {e}")
            raise

    async def get_users_by_role_names(self, role_names: list[str]) -> list[User]:
        """Get users who have any of the specified roles by name."""
        try:
            from ..models.user import Role, user_roles
            
            result = await self.session.execute(
                select(User)
                .options(
                    joinedload(User.department),
                    joinedload(User.stage),
                    joinedload(User.roles)
                )
                .join(user_roles, User.id == user_roles.c.user_id)
                .join(Role, user_roles.c.role_id == Role.id)
                .filter(Role.name.in_([name.lower() for name in role_names]))
                .filter(User.status == UserStatus.ACTIVE.value)
                .distinct()
                .order_by(User.name)
            )
            return result.scalars().unique().all()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching users by role names {role_names}: {e}")
            raise

    async def get_active_users(self) -> list[User]:
        """Get all active users with full details."""
        try:
            result = await self.session.execute(
                select(User)
                .options(
                    joinedload(User.department),
                    joinedload(User.stage),
                    joinedload(User.roles)
                )
                .filter(User.status == UserStatus.ACTIVE.value)
                .order_by(User.name)
            )
            return result.scalars().unique().all()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching active users: {e}")
            raise
