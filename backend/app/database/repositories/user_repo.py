import logging
from typing import Optional, List, Dict, Any, AsyncGenerator
from uuid import UUID
from datetime import datetime
from enum import Enum
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

from ..session import get_db_session
from ..models.user import User, Role, Department, Stage, UserSupervisor
from ...schemas.user import UserCreate, UserUpdate
from ...schemas.common import PaginationParams
from ...core.exceptions import NotFoundError, ConflictError, ValidationError

logger = logging.getLogger(__name__)


class UserStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class UserRepository:
    """Repository for user-related database operations using SQLAlchemy"""
    
    def __init__(self):
        pass
    
    async def _validate_references(self, session: AsyncSession, department_id: UUID, 
                                  stage_id: UUID, supervisor_id: Optional[UUID] = None) -> None:
        """Validate that all referenced entities exist"""
        # Check department exists
        dept_result = await session.execute(
            select(Department.id).where(Department.id == department_id)
        )
        if not dept_result.scalar_one_or_none():
            raise ValidationError(f"Department {department_id} does not exist")
        
        # Check stage exists
        stage_result = await session.execute(
            select(Stage.id).where(Stage.id == stage_id)
        )
        if not stage_result.scalar_one_or_none():
            raise ValidationError(f"Stage {stage_id} does not exist")
        
        # Check supervisor if provided
        if supervisor_id:
            supervisor_result = await session.execute(
                select(User.id).where(
                    and_(
                        User.id == supervisor_id,
                        User.status == UserStatus.ACTIVE
                    )
                )
            )
            if not supervisor_result.scalar_one_or_none():
                raise ValidationError(f"Supervisor {supervisor_id} does not exist or is not active")
    
    async def get_by_id(self, user_id: UUID) -> Optional[User]:
        """Get user by ID"""
        async for session in get_db_session():
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
    
    async def get_by_email(self, email: str) -> Optional[User]:
        """Get user by email address for uniqueness validation"""
        async for session in get_db_session():
            result = await session.execute(
                select(User).where(
                    and_(
                        User.email == email,
                        User.status.in_([UserStatus.ACTIVE, UserStatus.INACTIVE])
                    )
                )
            )
            return result.scalar_one_or_none()
    
    
    async def get_by_employee_code(self, employee_code: str) -> Optional[User]:
        """Get user by employee code for uniqueness validation"""
        async for session in get_db_session():
            result = await session.execute(
                select(User).where(
                    and_(
                        User.employee_code == employee_code,
                        User.status.in_([UserStatus.ACTIVE, UserStatus.INACTIVE])
                    )
                )
            )
            return result.scalar_one_or_none()
    
    async def get_by_clerk_id(self, clerk_user_id: str) -> Optional[User]:
        """Get user by Clerk user ID"""
        async for session in get_db_session():
            result = await session.execute(
                select(User).where(
                    and_(
                        User.clerk_user_id == clerk_user_id,
                        User.status.in_([UserStatus.ACTIVE, UserStatus.INACTIVE])
                    )
                )
            )
            return result.scalar_one_or_none()
    
    async def get_subordinates(self, supervisor_id: UUID) -> List[User]:
        """Get all subordinates of a supervisor"""
        try:
            async for session in get_db_session():
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
            async for session in get_db_session():
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
            async for session in get_db_session():
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
        async for session in get_db_session():
                # Validate references exist
                await self._validate_references(
                    session, 
                    user_data.department_id, 
                    user_data.stage_id, 
                    user_data.supervisor_id
                )
                
                # Check for conflicts
                existing_email = await session.execute(
                    select(User.id).where(User.email == user_data.email)
                )
                if existing_email.scalar_one_or_none():
                    raise ConflictError(f"User with email {user_data.email} already exists")
                
                existing_code = await session.execute(
                    select(User.id).where(User.employee_code == user_data.employee_code)
                )
                if existing_code.scalar_one_or_none():
                    raise ConflictError(f"User with employee code {user_data.employee_code} already exists")
                
                existing_clerk = await session.execute(
                    select(User.id).where(User.clerk_user_id == user_data.clerk_user_id)
                )
                if existing_clerk.scalar_one_or_none():
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
    
    async def update_user(self, user_id: UUID, user_data: UserUpdate) -> Optional[User]:
        """Update user with field validation"""
        async for session in get_db_session():
                # Get existing user
                result = await session.execute(
                    select(User).where(User.id == user_id)
                )
                user = result.scalar_one_or_none()
                
                if not user:
                    raise NotFoundError(f"User {user_id} not found")
                
                # Validate references if being updated
                if user_data.department_id or user_data.stage_id or user_data.supervisor_id is not None:
                    await self._validate_references(
                        session,
                        user_data.department_id or user.department_id,
                        user_data.stage_id or user.stage_id,
                        user_data.supervisor_id if user_data.supervisor_id is not None else (user.supervisors[0].id if user.supervisors else None)
                    )
                
                # Check for conflicts if updating unique fields
                if user_data.email and user_data.email != user.email:
                    existing_email = await session.execute(
                        select(User.id).where(and_(User.email == user_data.email, User.id != user_id))
                    )
                    if existing_email.scalar_one_or_none():
                        raise ConflictError(f"User with email {user_data.email} already exists")
                
                if user_data.employee_code and user_data.employee_code != user.employee_code:
                    existing_code = await session.execute(
                        select(User.id).where(and_(User.employee_code == user_data.employee_code, User.id != user_id))
                    )
                    if existing_code.scalar_one_or_none():
                        raise ConflictError(f"User with employee code {user_data.employee_code} already exists")
                
                if user_data.clerk_user_id and user_data.clerk_user_id != user.clerk_user_id:
                    existing_clerk = await session.execute(
                        select(User.id).where(and_(User.clerk_user_id == user_data.clerk_user_id, User.id != user_id))
                    )
                    if existing_clerk.scalar_one_or_none():
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
    
    async def inactivate_user(self, user_id: UUID) -> bool:
        """Inactivate user (soft delete)"""
        async for session in get_db_session():
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
    
    async def search_users(self, search_term: str = "", filters: Dict[str, Any] = None, 
                          pagination: Optional[PaginationParams] = None) -> List[User]:
        """Search users with filters and pagination"""
        try:
            async for session in get_db_session():
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
                    if filters.get('role_name'):
                        query = query.join(User.roles).where(Role.name == filters['role_name'])
                
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
            async for session in get_db_session():
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
            async for session in get_db_session():
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
            async for session in get_db_session():
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
            async for session in get_db_session():
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
                    if filters.get('role_name'):
                        query = query.join(User.roles).where(Role.name == filters['role_name'])
                
                result = await session.execute(query)
                return result.scalar()
        except SQLAlchemyError as e:
            logger.error(f"Error counting users: {e}")
            raise


# Global repository instance
user_repository = UserRepository()
