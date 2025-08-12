import logging
from typing import List, Optional
from uuid import UUID, uuid4

from sqlalchemy import select, update as sa_update, delete as sa_delete, and_, or_, func
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.supervisor_review import SupervisorReview
from ..models.goal import Goal
from ..models.user import UserSupervisor
from ...schemas.common import PaginationParams

logger = logging.getLogger(__name__)


class SupervisorReviewRepository:
    """Repository for SupervisorReview database operations following established patterns."""

    def __init__(self, session: AsyncSession):
        self.session = session

    # ========================================
    # CREATE
    # ========================================
    async def create(
        self,
        *,
        goal_id: UUID,
        period_id: UUID,
        supervisor_id: UUID,
        action: str,
        comment: Optional[str],
        status: str,
        reviewed_at: Optional[str] = None,
    ) -> SupervisorReview:
        """Create a supervisor review (does not commit). Enforces app-level uniqueness."""
        # App-level uniqueness check: one per (goal_id, period_id, supervisor_id)
        existing = await self.get_by_unique_keys(goal_id, period_id, supervisor_id)
        if existing:
            return existing

        review = SupervisorReview(
            id=uuid4(),
            goal_id=goal_id,
            period_id=period_id,
            supervisor_id=supervisor_id,
            action=action,
            comment=comment or "",
            status=status,
            reviewed_at=reviewed_at,
        )
        self.session.add(review)
        logger.info(
            f"Created SupervisorReview (pending commit): goal={goal_id}, period={period_id}, supervisor={supervisor_id}, status={status}, action={action}"
        )
        return review

    # ========================================
    # READ
    # ========================================
    async def get_by_id(self, review_id: UUID) -> Optional[SupervisorReview]:
        result = await self.session.execute(
            select(SupervisorReview).filter(SupervisorReview.id == review_id)
        )
        return result.scalars().first()

    async def get_by_unique_keys(
        self, goal_id: UUID, period_id: UUID, supervisor_id: UUID
    ) -> Optional[SupervisorReview]:
        result = await self.session.execute(
            select(SupervisorReview).filter(
                and_(
                    SupervisorReview.goal_id == goal_id,
                    SupervisorReview.period_id == period_id,
                    SupervisorReview.supervisor_id == supervisor_id,
                )
            )
        )
        return result.scalars().first()

    async def get_by_goal(self, goal_id: UUID) -> List[SupervisorReview]:
        result = await self.session.execute(
            select(SupervisorReview)
            .options(joinedload(SupervisorReview.supervisor))
            .filter(SupervisorReview.goal_id == goal_id)
            .order_by(SupervisorReview.created_at.desc())
        )
        return result.scalars().all()

    async def get_by_supervisor(
        self,
        supervisor_id: UUID,
        *,
        period_id: Optional[UUID] = None,
        goal_id: Optional[UUID] = None,
        status: Optional[str] = None,
        pagination: Optional[PaginationParams] = None,
    ) -> List[SupervisorReview]:
        query = select(SupervisorReview).filter(
            SupervisorReview.supervisor_id == supervisor_id
        )
        if period_id:
            query = query.filter(SupervisorReview.period_id == period_id)
        if goal_id:
            query = query.filter(SupervisorReview.goal_id == goal_id)
        if status:
            query = query.filter(SupervisorReview.status == status)
        query = query.order_by(SupervisorReview.updated_at.desc())
        if pagination:
            query = query.offset(pagination.offset).limit(pagination.limit)
        result = await self.session.execute(query)
        return result.scalars().all()

    async def count_by_supervisor(
        self,
        supervisor_id: UUID,
        *,
        period_id: Optional[UUID] = None,
        goal_id: Optional[UUID] = None,
        status: Optional[str] = None,
    ) -> int:
        query = select(func.count(SupervisorReview.id)).filter(
            SupervisorReview.supervisor_id == supervisor_id
        )
        if period_id:
            query = query.filter(SupervisorReview.period_id == period_id)
        if goal_id:
            query = query.filter(SupervisorReview.goal_id == goal_id)
        if status:
            query = query.filter(SupervisorReview.status == status)
        result = await self.session.execute(query)
        return result.scalar() or 0

    async def get_for_goal_owner(
        self,
        owner_user_id: UUID,
        *,
        period_id: Optional[UUID] = None,
        goal_id: Optional[UUID] = None,
        status: Optional[str] = None,
        pagination: Optional[PaginationParams] = None,
    ) -> List[SupervisorReview]:
        # Join with goals to filter by owner
        query = (
            select(SupervisorReview)
            .join(Goal, Goal.id == SupervisorReview.goal_id)
            .filter(Goal.user_id == owner_user_id)
        )
        if period_id:
            query = query.filter(SupervisorReview.period_id == period_id)
        if goal_id:
            query = query.filter(SupervisorReview.goal_id == goal_id)
        if status:
            query = query.filter(SupervisorReview.status == status)
        query = query.order_by(SupervisorReview.updated_at.desc())
        if pagination:
            query = query.offset(pagination.offset).limit(pagination.limit)
        result = await self.session.execute(query)
        return result.scalars().all()

    async def count_for_goal_owner(
        self,
        owner_user_id: UUID,
        *,
        period_id: Optional[UUID] = None,
        goal_id: Optional[UUID] = None,
        status: Optional[str] = None,
    ) -> int:
        query = (
            select(func.count(SupervisorReview.id))
            .join(Goal, Goal.id == SupervisorReview.goal_id)
            .filter(Goal.user_id == owner_user_id)
        )
        if period_id:
            query = query.filter(SupervisorReview.period_id == period_id)
        if goal_id:
            query = query.filter(SupervisorReview.goal_id == goal_id)
        if status:
            query = query.filter(SupervisorReview.status == status)
        result = await self.session.execute(query)
        return result.scalar() or 0

    async def get_pending_reviews(
        self,
        supervisor_id: UUID,
        *,
        period_id: Optional[UUID] = None,
        pagination: Optional[PaginationParams] = None,
    ) -> List[SupervisorReview]:
        # Pending = draft reviews for goals currently pending approval
        query = (
            select(SupervisorReview)
            .join(Goal, Goal.id == SupervisorReview.goal_id)
            .filter(
                and_(
                    SupervisorReview.supervisor_id == supervisor_id,
                    SupervisorReview.status == "draft",
                    Goal.status == "pending_approval",
                )
            )
            .order_by(SupervisorReview.updated_at.asc())
        )
        if period_id:
            query = query.filter(SupervisorReview.period_id == period_id)
        if pagination:
            query = query.offset(pagination.offset).limit(pagination.limit)
        result = await self.session.execute(query)
        return result.scalars().all()

    async def search(
        self,
        *,
        period_id: Optional[UUID] = None,
        goal_id: Optional[UUID] = None,
        status: Optional[str] = None,
        pagination: Optional[PaginationParams] = None,
    ) -> List[SupervisorReview]:
        """Search reviews for admin across all supervisors/goals."""
        query = select(SupervisorReview)
        if period_id:
            query = query.filter(SupervisorReview.period_id == period_id)
        if goal_id:
            query = query.filter(SupervisorReview.goal_id == goal_id)
        if status:
            query = query.filter(SupervisorReview.status == status)
        query = query.order_by(SupervisorReview.updated_at.desc())
        if pagination:
            query = query.offset(pagination.offset).limit(pagination.limit)
        result = await self.session.execute(query)
        return result.scalars().all()

    async def count_all(
        self,
        *,
        period_id: Optional[UUID] = None,
        goal_id: Optional[UUID] = None,
        status: Optional[str] = None,
    ) -> int:
        query = select(func.count(SupervisorReview.id))
        if period_id:
            query = query.filter(SupervisorReview.period_id == period_id)
        if goal_id:
            query = query.filter(SupervisorReview.goal_id == goal_id)
        if status:
            query = query.filter(SupervisorReview.status == status)
        result = await self.session.execute(query)
        return result.scalar() or 0

    # ========================================
    # UPDATE
    # ========================================
    async def update(
        self,
        review_id: UUID,
        *,
        action: Optional[str] = None,
        comment: Optional[str] = None,
        status: Optional[str] = None,
        reviewed_at: Optional[str] = None,
    ) -> Optional[SupervisorReview]:
        update_values = {}
        if action is not None:
            update_values["action"] = action
        if comment is not None:
            update_values["comment"] = comment
        if status is not None:
            update_values["status"] = status
        if reviewed_at is not None:
            update_values["reviewed_at"] = reviewed_at
        if update_values:
            update_values["updated_at"] = func.now()
            await self.session.execute(
                sa_update(SupervisorReview)
                .where(SupervisorReview.id == review_id)
                .values(**update_values)
            )
        return await self.get_by_id(review_id)

    # ========================================
    # DELETE
    # ========================================
    async def delete(self, review_id: UUID) -> bool:
        result = await self.session.execute(
            sa_delete(SupervisorReview).where(SupervisorReview.id == review_id)
        )
        return result.rowcount > 0


