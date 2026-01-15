import logging
from typing import Dict, Optional, Sequence, Set
from uuid import UUID

from sqlalchemy import case, select, update, func, or_, delete, insert
from sqlalchemy.orm import joinedload
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.user import User, UserSupervisor, Role, user_roles
from ..models.user_goal_weight_history import UserGoalWeightHistory
from ..models.stage_competency import Stage
from ...schemas.user import UserStatus, UserCreate, UserUpdate, UserClerkIdUpdate
from ...schemas.common import PaginationParams
from .base import BaseRepository

logger = logging.getLogger(__name__)


class UserRepository(BaseRepository[User]):

    def __init__(self, session: AsyncSession):
        super().__init__(session, User)

    # ========================================
    # CREATE OPERATIONS
    # ========================================
    
    def add(self, user: User) -> None:
        """Add a user to the session (does not commit)."""
        self.session.add(user)

    def add_user_supervisor_relation(self, user_supervisor: UserSupervisor) -> None:
        """Add a user-supervisor relationship to the session (does not commit)."""
        self.session.add(user_supervisor)

    async def create_user(self, user_data: UserCreate, org_id: str) -> User:
        """
        Create a new user from UserCreate schema within organization scope.
        Adds to session (does not commit - let service layer handle transactions).
        """
        try:
            # Validate department belongs to organization if provided
            if user_data.department_id:
                from ..models.user import Department
                dept_result = await self.session.execute(
                    select(Department.organization_id).where(Department.id == user_data.department_id)
                )
                dept_org_id = dept_result.scalar()
                if not dept_org_id:
                    raise ValueError(f"Department {user_data.department_id} not found")
                if dept_org_id != org_id:
                    raise ValueError(f"Department belongs to org {dept_org_id}, expected {org_id}")
            
            # Validate stage belongs to organization if provided  
            if user_data.stage_id:
                from ..models.stage_competency import Stage
                stage_result = await self.session.execute(
                    select(Stage.organization_id).where(Stage.id == user_data.stage_id)
                )
                stage_org_id = stage_result.scalar()
                if not stage_org_id:
                    raise ValueError(f"Stage {user_data.stage_id} not found")
                if stage_org_id != org_id:
                    raise ValueError(f"Stage belongs to org {stage_org_id}, expected {org_id}")
            
            # Create User model from UserCreate schema
            user = User(
                name=user_data.name,
                email=user_data.email,
                employee_code=user_data.employee_code,
                job_title=user_data.job_title,
                clerk_user_id=user_data.clerk_user_id,
                clerk_organization_id=org_id,  # Set organization from context
                department_id=user_data.department_id,
                stage_id=user_data.stage_id,
                status=user_data.status or UserStatus.PENDING_APPROVAL
            )
            
            self.session.add(user)
            logger.info(f"Added user to session for org {org_id}: {user.email}")
            return user
        except SQLAlchemyError as e:
            logger.error(f"Error creating user with email {user_data.email} for org {org_id}: {e}")
            raise

    # ========================================
    # READ OPERATIONS
    # ========================================

    async def get_user_by_id(self, user_id: UUID, org_id: Optional[str] = None) -> Optional[User]:
        """Get user by ID, optionally within organization scope."""
        try:
            query = select(User).filter(User.id == user_id)
            if org_id:
                query = self.apply_org_scope_direct(query, User.clerk_organization_id, org_id)
            self.ensure_org_filter_applied("get_user_by_id", org_id)
            
            result = await self.session.execute(query)
            return result.scalars().first()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching user by ID {user_id} in org {org_id}: {e}")
            raise

    async def get_user_by_id_with_details(self, user_id: UUID, org_id: str) -> Optional[User]:
        """Get user by ID with all related data, including supervisors and subordinates."""
        try:
            query = select(User).options(
                joinedload(User.department),
                joinedload(User.stage),
                joinedload(User.roles),
                joinedload(User.supervisor_relations).joinedload(UserSupervisor.supervisor),
                joinedload(User.subordinate_relations).joinedload(UserSupervisor.user),
            ).filter(User.id == user_id)
            
            query = self.apply_org_scope_direct(query, User.clerk_organization_id, org_id)
            
            result = await self.session.execute(query)
            return result.scalars().unique().first()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching user details for ID {user_id} in org {org_id}: {e}")
            raise

    async def get_user_statuses(self, org_id: str, user_ids: Sequence[UUID]) -> Dict[UUID, str]:
        """Fetch statuses for a set of users within organization scope."""
        if not user_ids:
            return {}

        try:
            # `in_` accepts any general sequence; no need to coerce to list
            stmt = select(User.id, User.status).where(User.id.in_(user_ids))
            stmt = self.apply_org_scope_direct(stmt, User.clerk_organization_id, org_id)

            result = await self.session.execute(stmt)
            return {row.id: row.status for row in result}
        except SQLAlchemyError as e:
            logger.error(f"Error fetching user statuses for org {org_id}: {e}")
            raise

    async def get_user_by_clerk_id(self, clerk_user_id: str, org_id: Optional[str] = None) -> Optional[User]:
        """Get user by Clerk user ID. org_id is optional for authentication purposes."""
        try:
            query = select(User).options(
                joinedload(User.department),
                joinedload(User.stage),
                joinedload(User.roles)
            ).filter(User.clerk_user_id == clerk_user_id)
            
            # Apply org filter if provided (optional for auth context)
            if org_id:
                query = self.apply_org_scope_direct(query, User.clerk_organization_id, org_id)
                self.ensure_org_filter_applied("get_user_by_clerk_id", org_id)
            
            result = await self.session.execute(query)
            return result.scalars().unique().first()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching user by clerk_id {clerk_user_id}: {e}")
            raise

    async def get_user_stage_id(self, user_id: UUID, org_id: Optional[str] = None) -> Optional[UUID]:
        """Get user's stage_id efficiently with minimal query. org_id is optional for backwards compatibility."""
        try:
            query = select(User.stage_id).filter(User.id == user_id)
            
            # Apply org filter if provided (for org-aware contexts)
            if org_id:
                query = self.apply_org_scope_direct(query, User.clerk_organization_id, org_id)
            
            result = await self.session.execute(query)
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching stage_id for user {user_id}: {e}")
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

    async def get_user_by_email(self, email: str, org_id: str) -> Optional[User]:
        """Get user by email address within organization scope."""
        try:
            query = select(User).filter(User.email == email)
            query = self.apply_org_scope_direct(query, User.clerk_organization_id, org_id)
            
            result = await self.session.execute(query)
            return result.scalars().first()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching user by email {email} in org {org_id}: {e}")
            raise

    async def get_user_stage_with_weights(self, user_id: UUID, org_id: str) -> Optional[dict]:
        """Fetch user's stage information along with effective weights (override-aware)."""
        try:
            stmt = (
                select(
                    User.id,
                    User.stage_id,
                    Stage.quantitative_weight,
                    Stage.qualitative_weight,
                    Stage.competency_weight,
                    User.quantitative_weight_override,
                    User.qualitative_weight_override,
                    User.competency_weight_override
                )
                .join(Stage, Stage.id == User.stage_id, isouter=True)
                .where(User.id == user_id)
            )
            stmt = self.apply_org_scope_direct(stmt, User.clerk_organization_id, org_id)

            result = await self.session.execute(stmt)
            row = result.first()
            if not row:
                return None

            has_override = (
                row.quantitative_weight_override is not None
                and row.qualitative_weight_override is not None
                and row.competency_weight_override is not None
            )

            def to_float(value):
                return float(value) if value is not None else None

            quantitative = to_float(row.quantitative_weight_override if has_override else row.quantitative_weight)
            qualitative = to_float(row.qualitative_weight_override if has_override else row.qualitative_weight)
            competency = to_float(row.competency_weight_override if has_override else row.competency_weight)

            return {
                "user_id": row.id,
                "stage_id": row.stage_id,
                "quantitative_weight": quantitative,
                "qualitative_weight": qualitative,
                "competency_weight": competency,
                "has_override": has_override,
                "source": "user" if has_override else "stage"
            }
        except SQLAlchemyError as e:
            logger.error(f"Error fetching stage weights for user {user_id} in org {org_id}: {e}")
            raise

    async def set_user_goal_weight_override(
        self,
        user_id: UUID,
        org_id: str,
        *,
        quantitative: float,
        qualitative: float,
        competency: float
    ) -> Optional[User]:
        """Set user-level goal weight overrides (all-or-none)."""
        try:
            existing_user = await self.get_user_by_id(user_id, org_id)
            if not existing_user:
                return None

            existing_user.quantitative_weight_override = quantitative
            existing_user.qualitative_weight_override = qualitative
            existing_user.competency_weight_override = competency

            self.session.add(existing_user)
            logger.info(f"Updated user goal weight overrides in session: {existing_user.email}")
            return existing_user
        except SQLAlchemyError as e:
            logger.error(f"Error setting goal weight overrides for user {user_id}: {e}")
            raise

    async def clear_user_goal_weight_override(self, user_id: UUID, org_id: str) -> Optional[User]:
        """Clear user-level goal weight overrides (revert to stage defaults)."""
        try:
            existing_user = await self.get_user_by_id(user_id, org_id)
            if not existing_user:
                return None

            existing_user.quantitative_weight_override = None
            existing_user.qualitative_weight_override = None
            existing_user.competency_weight_override = None

            self.session.add(existing_user)
            logger.info(f"Cleared user goal weight overrides in session: {existing_user.email}")
            return existing_user
        except SQLAlchemyError as e:
            logger.error(f"Error clearing goal weight overrides for user {user_id}: {e}")
            raise

    async def add_user_goal_weight_history_entry(
        self,
        user_id: UUID,
        org_id: str,
        actor_user_id: UUID,
        before_weights: dict,
        after_weights: dict
    ) -> UserGoalWeightHistory:
        """Persist a user goal weight history entry for auditing."""
        history_entry = UserGoalWeightHistory(
            user_id=user_id,
            organization_id=org_id,
            actor_user_id=actor_user_id,
            quantitative_weight_before=before_weights.get("quantitative_weight"),
            quantitative_weight_after=after_weights.get("quantitative_weight"),
            qualitative_weight_before=before_weights.get("qualitative_weight"),
            qualitative_weight_after=after_weights.get("qualitative_weight"),
            competency_weight_before=before_weights.get("competency_weight"),
            competency_weight_after=after_weights.get("competency_weight"),
        )
        self.session.add(history_entry)
        return history_entry

    async def get_user_goal_weight_history(
        self,
        user_id: UUID,
        org_id: str,
        limit: int = 20
    ):
        """Retrieve recent goal weight history entries for a user within organization scope."""
        query = (
            select(
                UserGoalWeightHistory,
                User.name,
                User.employee_code
            )
            .outerjoin(User, UserGoalWeightHistory.actor_user_id == User.id)
            .where(UserGoalWeightHistory.user_id == user_id)
            .order_by(UserGoalWeightHistory.changed_at.desc())
            .limit(limit)
        )
        query = self.apply_org_scope_direct(query, UserGoalWeightHistory.organization_id, org_id)
        result = await self.session.execute(query)
        return result.all()

    async def get_user_by_employee_code(self, employee_code: str, org_id: str) -> Optional[User]:
        """Get user by employee code within organization scope."""
        try:
            query = select(User).filter(User.employee_code == employee_code)
            query = self.apply_org_scope_direct(query, User.clerk_organization_id, org_id)
            
            result = await self.session.execute(query)
            return result.scalars().first()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching user by employee code {employee_code} in org {org_id}: {e}")
            raise

    async def get_users_by_status(self, status: UserStatus, org_id: str) -> list[User]:
        """Get all users with specific status within organization scope."""
        try:
            query = select(User).options(
                joinedload(User.department),
                joinedload(User.stage),
                joinedload(User.supervisor_relations).joinedload(UserSupervisor.supervisor)
            ).filter(User.status == status.value)
            
            query = self.apply_org_scope_direct(query, User.clerk_organization_id, org_id)
            query = query.order_by(User.created_at.desc())
            
            result = await self.session.execute(query)
            return result.scalars().unique().all()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching users by status {status} in org {org_id}: {e}")
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
    
    async def get_users_by_department(self, department_id: UUID, org_id: str) -> list[User]:
        """Get all users in a specific department within organization scope."""
        try:
            query = select(User).options(
                joinedload(User.department),
                joinedload(User.stage),
                joinedload(User.roles)
            ).filter(User.department_id == department_id)
            
            query = self.apply_org_scope_direct(query, User.clerk_organization_id, org_id)
            query = query.filter(User.status == UserStatus.ACTIVE.value).order_by(User.name)
            
            result = await self.session.execute(query)
            return result.scalars().unique().all()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching users by department {department_id} in org {org_id}: {e}")
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

    async def count_users_with_role(self, role_id: UUID, org_id: str) -> int:
        """Count users who have a specific role within organization scope."""
        try:
            from ..models.user import user_roles
            
            query = (
                select(func.count(User.id.distinct()))
                .join(user_roles, User.id == user_roles.c.user_id)
                .where(user_roles.c.role_id == role_id)
            )
            query = self.apply_org_scope_direct(query, User.clerk_organization_id, org_id)
            result = await self.session.execute(query)
            return result.scalar() or 0
        except SQLAlchemyError as e:
            logger.error(f"Error counting users with role {role_id}: {e}")
            raise

    async def get_user_supervisors(self, user_id: UUID, org_id: str) -> list[User]:
        """Get all supervisors for a specific user within organization scope."""
        try:
            query = (
                select(User)
                .join(UserSupervisor, User.id == UserSupervisor.supervisor_id)
                .filter(
                    UserSupervisor.user_id == user_id,
                    UserSupervisor.valid_to.is_(None),
                )
                .order_by(UserSupervisor.valid_from.desc(), User.name)
            )
            
            query = self.apply_org_scope_direct(query, User.clerk_organization_id, org_id)
            query = query.filter(User.status == UserStatus.ACTIVE.value)
            
            result = await self.session.execute(query)
            return result.scalars().all()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching supervisors for user {user_id} in org {org_id}: {e}")
            raise

    async def get_subordinates(self, supervisor_id: UUID, org_id: str) -> list[User]:
        """Get all subordinates for a specific supervisor within organization scope."""
        try:
            result = await self.session.execute(
                select(User)
                .join(UserSupervisor, User.id == UserSupervisor.user_id)
                .filter(
                    UserSupervisor.supervisor_id == supervisor_id,
                    UserSupervisor.valid_to.is_(None),
                    User.status == UserStatus.ACTIVE.value,
                    User.clerk_organization_id == org_id,
                )
                .order_by(User.name)
            )
            return result.scalars().all()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching subordinates for supervisor {supervisor_id} in org {org_id}: {e}")
            raise

    async def get_active_users(self, org_id: str) -> list[User]:
        """Get all active users with full details within organization scope."""
        try:
            query = select(User).options(
                joinedload(User.department),
                joinedload(User.stage),
                joinedload(User.roles)
            ).filter(User.status == UserStatus.ACTIVE.value)
            
            # Apply organization filter (required)
            query = self.apply_org_scope_direct(query, User.clerk_organization_id, org_id)
            self.ensure_org_filter_applied("get_active_users", org_id)
            
            query = query.order_by(User.name)
            result = await self.session.execute(query)
            return result.scalars().unique().all()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching active users for org {org_id}: {e}")
            raise

    async def get_users_by_organization(self, org_id: str) -> list[User]:
        """Get all users within a specific organization."""
        try:
            self.ensure_org_filter_applied("get_users_by_organization", org_id)
            
            query = select(User).options(
                joinedload(User.department),
                joinedload(User.stage),
                joinedload(User.roles)
            ).filter(User.status == UserStatus.ACTIVE.value)
            
            query = self.apply_org_scope_direct(query, User.clerk_organization_id, org_id)
            query = query.order_by(User.name)
            
            result = await self.session.execute(query)
            return result.scalars().unique().all()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching users by organization {org_id}: {e}")
            raise

    async def get_all_users(self, org_id: str) -> list[User]:
        """Get all users within a specific organization (regardless of status)."""
        try:
            self.ensure_org_filter_applied("get_all_users", org_id)

            query = select(User).options(
                joinedload(User.department),
                joinedload(User.stage),
                joinedload(User.roles)
            )

            query = self.apply_org_scope_direct(query, User.clerk_organization_id, org_id)
            query = query.order_by(User.name)

            result = await self.session.execute(query)
            return result.scalars().unique().all()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching all users for org {org_id}: {e}")
            raise

    async def search_users(
        self,
        org_id: str,
        search_term: str = "",
        statuses: Optional[list[UserStatus]] = None,
        department_ids: Optional[list[UUID]] = None,
        stage_ids: Optional[list[UUID]] = None,
        role_ids: Optional[list[UUID]] = None,
        user_ids: Optional[list[UUID]] = None,
        pagination: Optional[PaginationParams] = None,
    ) -> list[User]:
        """
        Search and filter users with pagination within organization scope.
        Handles complex filtering logic.
        """
        try:
            query = select(User).options(
                joinedload(User.department),
                joinedload(User.stage),
                joinedload(User.roles)
            )

            # Apply organization filter (required)
            query = self.apply_org_scope_direct(query, User.clerk_organization_id, org_id)
            self.ensure_org_filter_applied("search_users", org_id)

            if search_term:
                search_ilike = f"%{search_term.lower()}%"
                query = query.filter(
                    or_(
                        func.lower(User.name).ilike(search_ilike),
                        func.lower(User.employee_code).ilike(search_ilike),
                        func.lower(User.job_title).ilike(search_ilike),
                    )
                )

            if statuses:
                query = query.filter(User.status.in_([s.value for s in statuses]))
            if department_ids:
                query = query.filter(User.department_id.in_(department_ids))
            if stage_ids:
                query = query.filter(User.stage_id.in_(stage_ids))
            if role_ids:
                query = query.join(user_roles).filter(user_roles.c.role_id.in_(role_ids))
            if user_ids:
                query = query.filter(User.id.in_(user_ids))

            if pagination:
                query = query.limit(pagination.limit).offset(pagination.offset)
            
            query = query.order_by(User.name)

            result = await self.session.execute(query)
            return result.scalars().unique().all()
        except SQLAlchemyError as e:
            logger.error(f"Error searching for users: {e}")
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

    async def batch_update_user_statuses(self, org_id: str, updates: Dict[UUID, UserStatus]) -> Set[UUID]:
        """Batch update user statuses using a single CASE statement."""
        if not updates:
            return set()

        try:
            update_ids = list(updates.keys())

            status_case = case(
                *[(User.id == user_id, status.value) for user_id, status in updates.items()],
                else_=User.status,
            )

            stmt = (
                update(User)
                .where(User.clerk_organization_id == org_id)
                .where(User.id.in_(update_ids))
                .values(status=status_case, updated_at=func.now())
                .returning(User.id)
            )

            result = await self.session.execute(stmt)
            updated = set(result.scalars().all())
            return updated
        except SQLAlchemyError as e:
            logger.error(f"Error batch updating user statuses in org {org_id}: {e}")
            raise

    


    async def update_user(self, user_id: UUID, user_data: UserUpdate, org_id: str) -> Optional[User]:
        """Update a user with UserUpdate schema (does not commit)."""
        try:
            # Get the existing user
            existing_user = await self.get_user_by_id(user_id, org_id)
            if not existing_user:
                return None
            
            # Update fields from UserUpdate schema
            if user_data.name is not None:
                existing_user.name = user_data.name
            if user_data.email is not None:
                existing_user.email = user_data.email
            if user_data.employee_code is not None:
                existing_user.employee_code = user_data.employee_code
            if user_data.job_title is not None:
                existing_user.job_title = user_data.job_title
            if user_data.department_id is not None:
                existing_user.department_id = user_data.department_id
            # stage_id removed - use dedicated admin-only update_user_stage method
            if user_data.status is not None:
                existing_user.status = user_data.status
            
            # Mark as modified in session
            self.session.add(existing_user)
            logger.info(f"Updated user in session: {existing_user.email}")
            return existing_user
            
        except SQLAlchemyError as e:
            logger.error(f"Error updating user {user_id}: {e}")
            raise

    async def update_user_clerk_id(self, user_id: UUID, clerk_data: UserClerkIdUpdate, org_id: str) -> Optional[User]:
        """
        INTERNAL METHOD: Update only clerk_user_id (used by fallback system only).
        This is separated from regular user updates for security.
        """
        try:
            # Get the existing user
            existing_user = await self.get_user_by_id(user_id, org_id)
            if not existing_user:
                return None
            
            # Update only clerk_user_id
            existing_user.clerk_user_id = clerk_data.clerk_user_id
            
            # Mark as modified in session
            self.session.add(existing_user)
            logger.info(f"Updated clerk_user_id for user: {existing_user.email}")
            return existing_user
            
        except SQLAlchemyError as e:
            logger.error(f"Error updating clerk_user_id for user {user_id}: {e}")
            raise

    async def update_user_stage(self, user_id: UUID, stage_id: UUID, org_id: str) -> Optional[User]:
        """Update user's stage (admin only - does not commit)."""
        try:
            # Get the existing user
            existing_user = await self.get_user_by_id(user_id, org_id)
            if not existing_user:
                return None
            
            # Update stage_id
            existing_user.stage_id = stage_id
            
            # Mark as modified in session
            self.session.add(existing_user)
            logger.info(f"Updated user stage in session: {existing_user.email} -> stage {stage_id}")
            return existing_user
            
        except SQLAlchemyError as e:
            logger.error(f"Error updating user stage {user_id}: {e}")
            raise

    async def assign_roles_to_user(self, user_id: UUID, role_ids: list[UUID]) -> None:
        """Assign roles to user by inserting into user_roles table (does not commit)."""
        if not role_ids:
            logger.info(f"No role_ids provided for user {user_id}")
            return
        
        logger.info(f"Starting role assignment - User ID: {user_id}, Role IDs: {role_ids}")
        
        try:
            # First verify the user exists
            user_check = await self.session.execute(select(User).where(User.id == user_id))
            user = user_check.scalar_one_or_none()
            if not user:
                logger.error(f"User {user_id} not found - cannot assign roles")
                raise ValueError(f"User {user_id} not found")
            
            for role_id in role_ids:
                logger.info(f"Processing role {role_id} for user {user_id}")
                
                # Check if role exists first
                role_check = await self.session.execute(select(Role).where(Role.id == role_id))
                role = role_check.scalar_one_or_none()
                if not role:
                    logger.warning(f"Role {role_id} not found, skipping")
                    continue
                
                logger.info(f"Role {role_id} found: {role.name}")
                
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
                    logger.info(f"Inserting role assignment: user_id={user_id}, role_id={role_id}")
                    stmt = insert(user_roles).values(user_id=user_id, role_id=role_id)
                    result = await self.session.execute(stmt)
                    logger.info(f"Insert result: {result}")
                    logger.info(f"Successfully assigned role {role_id} to user {user_id}")
                else:
                    logger.info(f"Role {role_id} already assigned to user {user_id}")
            
            # Verify the assignments were made by checking the table
            verification_check = await self.session.execute(
                select(user_roles).where(user_roles.c.user_id == user_id)
            )
            assignments = verification_check.fetchall()
            logger.info(f"Verification: User {user_id} now has {len(assignments)} role assignments: {[a.role_id for a in assignments]}")
                    
        except SQLAlchemyError as e:
            logger.error(f"SQLAlchemy error assigning roles to user {user_id}: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error assigning roles to user {user_id}: {e}")
            raise

    async def update_user_roles(self, user_id: UUID, role_ids: list[UUID]) -> None:
        """Update user roles by replacing existing assignments (does not commit)."""
        logger.info(f"Updating roles for user {user_id} with roles {role_ids}")
        
        try:
            # Delete existing role assignments
            delete_stmt = delete(user_roles).where(user_roles.c.user_id == user_id)
            await self.session.execute(delete_stmt)
            logger.info(f"Cleared existing roles for user {user_id}")
            
            # Add new role assignments
            if role_ids:
                await self.assign_roles_to_user(user_id, role_ids)
                        
        except SQLAlchemyError as e:
            logger.error(f"Error updating roles for user {user_id}: {e}")
            raise

    async def remove_user_roles(self, user_id: UUID, role_ids: list[UUID]) -> None:
        """Remove specific roles from user (does not commit)."""
        if not role_ids:
            return
            
        logger.info(f"Removing roles {role_ids} from user {user_id}")
        
        try:
            delete_stmt = delete(user_roles).where(
                (user_roles.c.user_id == user_id) & 
                (user_roles.c.role_id.in_(role_ids))
            )
            await self.session.execute(delete_stmt)
            logger.info(f"Removed roles {role_ids} from user {user_id}")
            
        except SQLAlchemyError as e:
            logger.error(f"Error removing roles from user {user_id}: {e}")
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
    # OTHER OPERATIONS
    # ========================================

    async def count_users(
        self, 
        org_id: str,
        search_term: str = "", 
        statuses: Optional[list[UserStatus]] = None,
        department_ids: Optional[list[UUID]] = None,
        stage_ids: Optional[list[UUID]] = None,
        role_ids: Optional[list[UUID]] = None,
        user_ids: Optional[list[UUID]] = None,
    ) -> int:
        """
        Count users based on search and filter criteria within organization scope.
        """
        try:
            query = select(func.count(User.id.distinct()))

            # Apply organization filter (required)
            query = self.apply_org_scope_direct(query, User.clerk_organization_id, org_id)
            self.ensure_org_filter_applied("count_users", org_id)

            if search_term:
                search_ilike = f"%{search_term.lower()}%"
                query = query.filter(
                    or_(
                        func.lower(User.name).ilike(search_ilike),
                        func.lower(User.employee_code).ilike(search_ilike),
                        func.lower(User.job_title).ilike(search_ilike),
                    )
                )

            if statuses:
                query = query.filter(User.status.in_([s.value for s in statuses]))
            if department_ids:
                query = query.filter(User.department_id.in_(department_ids))
            if stage_ids:
                query = query.filter(User.stage_id.in_(stage_ids))
            if role_ids:
                query = query.join(user_roles).filter(user_roles.c.role_id.in_(role_ids))
            if user_ids:
                query = query.filter(User.id.in_(user_ids))

            result = await self.session.execute(query)
            return result.scalar_one()
        except SQLAlchemyError as e:
            logger.error(f"Error counting users: {e}")
            raise

    async def get_users_for_org_chart(
        self,
        org_id: str,
        department_ids: Optional[list[UUID]] = None,
        role_ids: Optional[list[UUID]] = None,
        user_ids: Optional[list[UUID]] = None,
    ) -> list[User]:
        """
        Efficient query for organization chart - single query with necessary joins.
        Always returns only ACTIVE users within organization scope.
        """
        try:
            query = select(User).options(
                joinedload(User.department),
                joinedload(User.roles)
            ).filter(User.status == "active")
            
            # Apply organization filter (required)
            query = self.apply_org_scope_direct(query, User.clerk_organization_id, org_id)
            self.ensure_org_filter_applied("get_users_for_org_chart", org_id)
            
            if department_ids:
                query = query.filter(User.department_id.in_(department_ids))
            if role_ids:
                query = query.join(user_roles).filter(user_roles.c.role_id.in_(role_ids))
            if user_ids:
                query = query.filter(User.id.in_(user_ids))
            
            result = await self.session.execute(query)
            return result.scalars().unique().all()
        except SQLAlchemyError as e:
            logger.error(f"Error getting users for org chart in org {org_id}: {e}")
            raise
