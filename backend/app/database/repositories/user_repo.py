import logging
from typing import Optional, Dict, Any
from uuid import UUID
from datetime import datetime, timezone

from sqlalchemy import select, update, func, or_, delete
from sqlalchemy.orm import joinedload
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.user import User, UserSupervisor, Role, user_roles
from ...schemas.user import UserStatus

logger = logging.getLogger(__name__)


class UserRepository:

    def __init__(self, session: AsyncSession):
        self.session = session

    # ========================================
    # CREATE OPERATIONS
    # ========================================
    
    def add(self, user: User) -> None:
        """Add a user to the session (does not commit)."""
        self.session.add(user)

    def add_user_supervisor_relation(self, user_supervisor: UserSupervisor) -> None:
        """Add a user-supervisor relationship to the session (does not commit)."""
        self.session.add(user_supervisor)

    async def create_user(self, user: User) -> User:
        """
        Create a new user in the database.
        Adds, commits, and refreshes the user instance.
        """
        try:
            self.session.add(user)
            await self.session.commit()
            await self.session.refresh(user)
            logger.info(f"Successfully created user {user.id} with email {user.email}")
            return user
        except SQLAlchemyError as e:
            await self.session.rollback()
            logger.error(f"Error creating user with email {user.email}: {e}")
            raise

    # ========================================
    # READ OPERATIONS
    # ========================================

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
        """Get user by ID with all related data, including supervisors and subordinates."""
        try:
            result = await self.session.execute(
                select(User)
                .options(
                    joinedload(User.department),
                    joinedload(User.stage),
                    joinedload(User.roles),
                    joinedload(User.supervisor_relations).joinedload(UserSupervisor.supervisor),
                    joinedload(User.subordinate_relations).joinedload(UserSupervisor.user),
                )
                .filter(User.id == user_id)
            )
            return result.scalars().unique().first()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching user details for ID {user_id}: {e}")
            raise

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

  
    async def get_user_by_employee_code(self, employee_code: str) -> Optional[User]:
        """Get user by employee code."""
        try:
            result = await self.session.execute(
                select(User).filter(User.employee_code == employee_code)
            )
            return result.scalars().first()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching user by employee code {employee_code}: {e}")
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
    
    async def get_users_by_department(self, department_id: UUID) -> list[User]:
        """Get all users in a specific department."""
        try:
            result = await self.session.execute(
                select(User)
                .options(
                    joinedload(User.department),
                    joinedload(User.stage),
                    joinedload(User.roles)
                )
                .filter(User.department_id == department_id)
                .filter(User.status == UserStatus.ACTIVE.value)
                .order_by(User.name)
            )
            return result.scalars().unique().all()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching users by department {department_id}: {e}")
            raise

    async def get_user_roles(self, user_id: UUID) -> list[Role]:
        """Get all roles for a specific user."""
        try:
            from ..models.user import user_roles
            
            result = await self.session.execute(
                select(Role)
                .join(user_roles, Role.id == user_roles.c.role_id)
                .filter(user_roles.c.user_id == user_id)
                .order_by(Role.name)
            )
            return result.scalars().all()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching roles for user {user_id}: {e}")
            raise

    async def get_user_supervisors(self, user_id: UUID) -> list[User]:
        """Get all supervisors for a specific user."""
        try:
            result = await self.session.execute(
                select(User)
                .join(UserSupervisor, User.id == UserSupervisor.supervisor_id)
                .filter(UserSupervisor.user_id == user_id)
                .filter(User.status == UserStatus.ACTIVE.value)
                .order_by(User.name)
            )
            return result.scalars().all()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching supervisors for user {user_id}: {e}")
            raise

    async def get_subordinates(self, supervisor_id: UUID) -> list[User]:
        """Get all subordinates for a specific supervisor."""
        try:
            result = await self.session.execute(
                select(User)
                .join(UserSupervisor, User.id == UserSupervisor.user_id)
                .filter(UserSupervisor.supervisor_id == supervisor_id)
                .filter(User.status == UserStatus.ACTIVE.value)
                .order_by(User.name)
            )
            return result.scalars().all()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching subordinates for supervisor {supervisor_id}: {e}")
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

    async def search_users(self, search_term: str = "", filters: Dict[str, Any] = None) -> list[User]:
        """Search users with optional filters."""
        try:
            query = (
                select(User)
                .options(
                    joinedload(User.department),
                    joinedload(User.stage),
                    joinedload(User.roles)
                )
                .filter(User.status == UserStatus.ACTIVE.value)
            )
            
            if search_term:
                search_filter = or_(
                    User.name.ilike(f"%{search_term}%"),
                    User.email.ilike(f"%{search_term}%"),
                    User.employee_code.ilike(f"%{search_term}%")
                )
                query = query.where(search_filter)
            
            if filters:
                if filters.get('department_id'):
                    query = query.where(User.department_id == filters['department_id'])
                if filters.get('status'):
                    query = query.where(User.status == filters['status'])
            
            query = query.order_by(User.name)
            
            result = await self.session.execute(query)
            return result.scalars().unique().all()
        except SQLAlchemyError as e:
            logger.error(f"Error searching users: {e}")
            raise

    # ========================================
    # UPDATE OPERATIONS
    # ========================================

    async def update_user_status(self, user_id: UUID, status: UserStatus) -> bool:
        """Update user status."""
        try:
            result = await self.session.execute(
                update(User)
                .where(User.id == user_id)
                .values(status=status.value)
                .returning(User.id)
            )
            return result.scalar_one_or_none() is not None
        except SQLAlchemyError as e:
            logger.error(f"Error updating user status for {user_id}: {e}")
            raise

    async def update_last_login(self, user_id: UUID) -> bool:
        """Update user's last login timestamp."""
        try:
            result = await self.session.execute(
                update(User)
                .where(User.id == user_id)
                .values(last_login_at=datetime.now(timezone.utc))
                .returning(User.id)
            )
            return result.scalar_one_or_none() is not None
        except SQLAlchemyError as e:
            logger.error(f"Error updating last login for user {user_id}: {e}")
            raise

    # ========================================
    # DELETE OPERATIONS
    # ========================================

    async def hard_delete_user_by_id(self, user_id: UUID) -> bool:
        """
        Permanently delete a user and their relationships from the database.
        This includes roles and supervisor/subordinate links.
        """
        try:
            # Delete from association tables first
            await self.session.execute(
                delete(user_roles).where(user_roles.c.user_id == user_id)
            )
            await self.session.execute(
                delete(UserSupervisor).where(
                    or_(
                        UserSupervisor.user_id == user_id,
                        UserSupervisor.supervisor_id == user_id
                    )
                )
            )

            # Then, delete the user
            stmt = delete(User).where(User.id == user_id).returning(User.id)
            result = await self.session.execute(stmt)
            
            deleted_id = result.scalar_one_or_none()
            if deleted_id:
                logger.info(f"Successfully hard deleted user {user_id}")
                return True
            
            logger.warning(f"Attempted to hard delete non-existent user {user_id}")
            return False

        except SQLAlchemyError as e:
            logger.error(f"Error during hard delete for user {user_id}: {e}")
            raise

    # ========================================
    # HELPER METHODS
    # ========================================

    async def count_users_by_filters(self, filters: Dict[str, Any] = None) -> int:
        """Count users with optional filters."""
        try:
            query = select(func.count(User.id))
            
            if filters:
                if filters.get('department_id'):
                    query = query.where(User.department_id == filters['department_id'])
                if filters.get('status'):
                    query = query.where(User.status == filters['status'])
            
            result = await self.session.execute(query)
            return result.scalar()
        except SQLAlchemyError as e:
            logger.error(f"Error counting users: {e}")
            raise
