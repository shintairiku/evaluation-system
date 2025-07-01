import logging
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
from sqlalchemy import select, update, delete, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import (
    IntegrityError, 
    NoResultFound, 
    MultipleResultsFound,
    SQLAlchemyError,
    OperationalError,
    ProgrammingError
)
from sqlalchemy.orm import selectinload, joinedload

from ..sqlalchemy_session import sqlalchemy_session_manager
from ..models.user_sqlalchemy import User, Role, Department, Stage, UserStatus
from ...schemas.user import UserCreate, UserUpdate
from ...schemas.common import PaginationParams
from ...core.exceptions import NotFoundError, ConflictError, ValidationError, DatabaseError

logger = logging.getLogger(__name__)


class UserRepository:
    """Repository for user-related database operations using SQLAlchemy"""
    
    def __init__(self):
        self.session_manager = sqlalchemy_session_manager
    
    async def _get_session(self) -> AsyncSession:
        """Get database session"""
        return self.session_manager.async_session()
    
    async def _department_exists(self, department_id: UUID) -> bool:
        """Check if department exists"""
        try:
            async with self._get_session() as session:
                result = await session.execute(
                    select(Department).where(Department.id == department_id)
                )
                return result.scalar_one_or_none() is not None
        except SQLAlchemyError as e:
            logger.error(f"Error checking department existence: {e}")
            raise
    
    async def _stage_exists(self, stage_id: UUID) -> bool:
        """Check if stage exists"""
        try:
            async with self._get_session() as session:
                result = await session.execute(
                    select(Stage).where(Stage.id == stage_id)
                )
                return result.scalar_one_or_none() is not None
        except SQLAlchemyError as e:
            logger.error(f"Error checking stage existence: {e}")
            raise
    
    async def _supervisor_exists(self, supervisor_id: UUID) -> bool:
        """Check if supervisor exists and is active"""
        try:
            async with self._get_session() as session:
                result = await session.execute(
                    select(User).where(
                        and_(
                            User.id == supervisor_id,
                            User.status == UserStatus.ACTIVE
                        )
                    )
                )
                return result.scalar_one_or_none() is not None
        except SQLAlchemyError as e:
            logger.error(f"Error checking supervisor existence: {e}")
            raise
    
    async def get_by_id(self, user_id: UUID) -> Optional[User]:
        """Get user by ID"""
        try:
            async with self._get_session() as session:
                result = await session.execute(
                    select(User)
                    .options(selectinload(User.roles), selectinload(User.supervisors))
                    .where(
                        and_(
                            User.id == user_id,
                            User.status.in_([UserStatus.ACTIVE, UserStatus.INACTIVE])
                        )
                    )
                )
                return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching user by ID {user_id}: {e}")
            raise
    
    async def get_by_email(self, email: str) -> Optional[User]:
        """Get user by email address for uniqueness validation"""
        try:
            async with self._get_session() as session:
                result = await session.execute(
                    select(User).where(
                        and_(
                            User.email == email,
                            User.status.in_([UserStatus.ACTIVE, UserStatus.INACTIVE])
                        )
                    )
                )
                return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching user by email {email}: {e}")
            raise
    
    async def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email address."""
        try:
            async with self._get_session() as session:
                result = await session.execute(
                    select(User).filter(User.email == email)
                )
                return result.scalars().first()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching user by email {email}: {e}")
            raise
    
    async def get_by_employee_code(self, employee_code: str) -> Optional[User]:
        """Get user by employee code for uniqueness validation"""
        try:
            async with self._get_session() as session:
                result = await session.execute(
                    select(User).where(
                        and_(
                            User.employee_code == employee_code,
                            User.status.in_([UserStatus.ACTIVE, UserStatus.INACTIVE])
                        )
                    )
                )
                return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching user by employee code {employee_code}: {e}")
            raise
    
    async def get_by_clerk_id(self, clerk_user_id: str) -> Optional[User]:
        """Get user by Clerk user ID"""
        try:
            async with self._get_session() as session:
                result = await session.execute(
                    select(User).where(
                        and_(
                            User.clerk_user_id == clerk_user_id,
                            User.status.in_([UserStatus.ACTIVE, UserStatus.INACTIVE])
                        )
                    )
                )
                return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching user by Clerk ID {clerk_user_id}: {e}")
            raise
    
    async def get_subordinates(self, supervisor_id: UUID) -> List[User]:
        """Get all subordinates of a supervisor"""
        try:
            async with self._get_session() as session:
                result = await session.execute(
                    select(User)
                    .options(selectinload(User.roles))
                    .join(User.supervisors)
                    .where(
                        and_(
                            User.supervisors.any(id=supervisor_id),
                            User.status == UserStatus.ACTIVE
                        )
                    )
                    .order_by(User.name)
                )
                return result.scalars().all()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching subordinates for supervisor {supervisor_id}: {e}")
            raise
    
    async def get_by_department(self, department_id: UUID, pagination: Optional[PaginationParams] = None) -> List[User]:
        """Get all users in a specific department"""
        try:
            async with self._get_session() as session:
                query = (
                    select(User)
                    .options(selectinload(User.roles))
                    .where(
                        and_(
                            User.department_id == department_id,
                            User.status == UserStatus.ACTIVE
                        )
                    )
                    .order_by(User.name)
                )
                
                if pagination:
                    query = query.limit(pagination.limit).offset(pagination.offset)
                
                result = await session.execute(query)
                return result.scalars().all()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching users by department {department_id}: {e}")
            raise
    
    async def get_by_role(self, role_name: str, pagination: Optional[PaginationParams] = None) -> List[User]:
        """Get all users with a specific role"""
        try:
            async with self._get_session() as session:
                query = (
                    select(User)
                    .options(selectinload(User.roles))
                    .join(User.roles)
                    .where(
                        and_(
                            Role.name == role_name,
                            User.status == UserStatus.ACTIVE
                        )
                    )
                    .order_by(User.name)
                )
                
                if pagination:
                    query = query.limit(pagination.limit).offset(pagination.offset)
                
                result = await session.execute(query)
                return result.scalars().all()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching users by role {role_name}: {e}")
            raise
    
    async def create_user(self, user_data: UserCreate) -> User:
        """Create new user with validation and conflict checking"""
        try:
            async with self._get_session() as session:
                # Validate references exist
                if not await self._department_exists(user_data.department_id):
                    raise ValidationError(f"Department {user_data.department_id} does not exist")
                
                if not await self._stage_exists(user_data.stage_id):
                    raise ValidationError(f"Stage {user_data.stage_id} does not exist")
                
                if user_data.supervisor_id and not await self._supervisor_exists(user_data.supervisor_id):
                    raise ValidationError(f"Supervisor {user_data.supervisor_id} does not exist or is not active")
                
                # Check for conflicts
                if await self.get_by_email(user_data.email):
                    raise ConflictError(f"User with email {user_data.email} already exists")
                
                if await self.get_by_employee_code(user_data.employee_code):
                    raise ConflictError(f"User with employee code {user_data.employee_code} already exists")
                
                if await self.get_by_clerk_id(user_data.clerk_user_id):
                    raise ConflictError(f"User with Clerk ID {user_data.clerk_user_id} already exists")
                
                # Create user
                user = User(
                    department_id=user_data.department_id,
                    stage_id=user_data.stage_id,
                    clerk_user_id=user_data.clerk_user_id,
                    name=user_data.name,
                    email=user_data.email,
                    employee_code=user_data.employee_code,
                    job_title=user_data.job_title,
                    status=UserStatus.ACTIVE
                )
                
                session.add(user)
                await session.flush()
                
                # Assign roles
                if user_data.role_ids:
                    roles = await session.execute(
                        select(Role).where(Role.id.in_(user_data.role_ids))
                    )
                    user.roles = roles.scalars().all()
                
                # Assign supervisor
                if user_data.supervisor_id:
                    supervisor = await session.execute(
                        select(User).where(User.id == user_data.supervisor_id)
                    )
                    user.supervisors = [supervisor.scalar_one()]
                
                await session.commit()
                await session.refresh(user)
                return user
        except SQLAlchemyError as e:
            logger.error(f"Error creating user: {e}")
            raise
    
    async def update_user(self, user_id: UUID, user_data: UserUpdate) -> Optional[User]:
        """Update user with field validation"""
        try:
            async with self._get_session() as session:
                # Get existing user
                result = await session.execute(
                    select(User).where(User.id == user_id)
                )
                user = result.scalar_one_or_none()
                
                if not user:
                    raise NotFoundError(f"User {user_id} not found")
                
                # Validate references if being updated
                if user_data.department_id and not await self._department_exists(user_data.department_id):
                    raise ValidationError(f"Department {user_data.department_id} does not exist")
                
                if user_data.stage_id and not await self._stage_exists(user_data.stage_id):
                    raise ValidationError(f"Stage {user_data.stage_id} does not exist")
                
                if user_data.supervisor_id and not await self._supervisor_exists(user_data.supervisor_id):
                    raise ValidationError(f"Supervisor {user_data.supervisor_id} does not exist or is not active")
                
                # Check for conflicts if updating unique fields
                if user_data.email and user_data.email != user.email:
                    existing_user = await self.get_by_email(user_data.email)
                    if existing_user and existing_user.id != user_id:
                        raise ConflictError(f"User with email {user_data.email} already exists")
                
                if user_data.employee_code and user_data.employee_code != user.employee_code:
                    existing_user = await self.get_by_employee_code(user_data.employee_code)
                    if existing_user and existing_user.id != user_id:
                        raise ConflictError(f"User with employee code {user_data.employee_code} already exists")
                
                if user_data.clerk_user_id and user_data.clerk_user_id != user.clerk_user_id:
                    existing_user = await self.get_by_clerk_id(user_data.clerk_user_id)
                    if existing_user and existing_user.id != user_id:
                        raise ConflictError(f"User with Clerk ID {user_data.clerk_user_id} already exists")
                
                # Update fields
                update_data = user_data.dict(exclude_unset=True)
                for field, value in update_data.items():
                    if hasattr(user, field):
                        setattr(user, field, value)
                
                # Update relationships if provided
                if user_data.role_ids is not None:
                    roles = await session.execute(
                        select(Role).where(Role.id.in_(user_data.role_ids))
                    )
                    user.roles = roles.scalars().all()
                
                if user_data.supervisor_id is not None:
                    if user_data.supervisor_id:
                        supervisor = await session.execute(
                            select(User).where(User.id == user_data.supervisor_id)
                        )
                        user.supervisors = [supervisor.scalar_one()]
                    else:
                        user.supervisors = []
                
                await session.commit()
                await session.refresh(user)
                return user
        except SQLAlchemyError as e:
            logger.error(f"Error updating user {user_id}: {e}")
            raise
    
    async def inactivate_user(self, user_id: UUID) -> bool:
        """Inactivate user (soft delete)"""
        try:
            async with self._get_session() as session:
                result = await session.execute(
                    select(User).where(User.id == user_id)
                )
                user = result.scalar_one_or_none()
                
                if not user:
                    raise NotFoundError(f"User {user_id} not found")
                
                if user.status == UserStatus.INACTIVE:
                    return False
                
                user.status = UserStatus.INACTIVE
                await session.commit()
                return True
        except SQLAlchemyError as e:
            logger.error(f"Error inactivating user {user_id}: {e}")
            raise
    
    async def search_users(self, search_term: str = "", filters: Dict[str, Any] = None, 
                          pagination: Optional[PaginationParams] = None) -> List[User]:
        """Search users with filters and pagination"""
        try:
            async with self._get_session() as session:
                query = (
                    select(User)
                    .options(selectinload(User.roles), selectinload(User.supervisors))
                    .where(User.status.in_([UserStatus.ACTIVE, UserStatus.INACTIVE]))
                )
                
                # Add search term
                if search_term:
                    search_filter = or_(
                        User.name.ilike(f"%{search_term}%"),
                        User.email.ilike(f"%{search_term}%"),
                        User.employee_code.ilike(f"%{search_term}%"),
                        User.job_title.ilike(f"%{search_term}%")
                    )
                    query = query.where(search_filter)
                
                # Add filters
                if filters:
                    if filters.get('department_id'):
                        query = query.where(User.department_id == filters['department_id'])
                    if filters.get('stage_id'):
                        query = query.where(User.stage_id == filters['stage_id'])
                    if filters.get('status'):
                        query = query.where(User.status == filters['status'])
                    if filters.get('role_id'):
                        query = query.join(User.roles).where(Role.id == filters['role_id'])
                
                query = query.order_by(User.name)
                
                if pagination:
                    query = query.limit(pagination.limit).offset(pagination.offset)
                
                result = await session.execute(query)
                return result.scalars().all()
        except SQLAlchemyError as e:
            logger.error(f"Error searching users: {e}")
            raise
    
    async def update_last_login(self, user_id: UUID) -> bool:
        """Update user's last login timestamp"""
        try:
            async with self._get_session() as session:
                result = await session.execute(
                    update(User)
                    .where(User.id == user_id)
                    .values(last_login_at=datetime.utcnow())
                    .returning(User.id)
                )
                updated = result.scalar_one_or_none()
                await session.commit()
                return updated is not None
        except SQLAlchemyError as e:
            logger.error(f"Error updating last login for user {user_id}: {e}")
            raise
    
    async def get_user_roles(self, user_id: UUID) -> List[Role]:
        """Get all roles for a user"""
        try:
            async with self._get_session() as session:
                result = await session.execute(
                    select(User)
                    .options(selectinload(User.roles))
                    .where(User.id == user_id)
                )
                user = result.scalar_one_or_none()
                return user.roles if user else []
        except SQLAlchemyError as e:
            logger.error(f"Error fetching roles for user {user_id}: {e}")
            raise
    
    async def get_user_supervisors(self, user_id: UUID) -> List[User]:
        """Get all supervisors for a user"""
        try:
            async with self._get_session() as session:
                result = await session.execute(
                    select(User)
                    .options(selectinload(User.supervisors))
                    .where(User.id == user_id)
                )
                user = result.scalar_one_or_none()
                return user.supervisors if user else []
        except SQLAlchemyError as e:
            logger.error(f"Error fetching supervisors for user {user_id}: {e}")
            raise
    
    async def count_users(self, filters: Dict[str, Any] = None) -> int:
        """Count users with optional filters"""
        try:
            async with self._get_session() as session:
                query = select(func.count(User.id)).where(
                    User.status.in_([UserStatus.ACTIVE, UserStatus.INACTIVE])
                )
                
                if filters:
                    if filters.get('department_id'):
                        query = query.where(User.department_id == filters['department_id'])
                    if filters.get('stage_id'):
                        query = query.where(User.stage_id == filters['stage_id'])
                    if filters.get('status'):
                        query = query.where(User.status == filters['status'])
                    if filters.get('role_id'):
                        query = query.join(User.roles).where(Role.id == filters['role_id'])
                
                result = await session.execute(query)
                return result.scalar()
        except SQLAlchemyError as e:
            logger.error(f"Error counting users: {e}")
            raise


# Global repository instance
user_repository = UserRepository()
