import logging
from typing import List, Optional
from uuid import UUID, uuid4

from sqlalchemy import select, update as sa_update, delete as sa_delete, and_, func
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.supervisor_review import SupervisorReview
from ..models.goal import Goal
from ...schemas.common import PaginationParams
from .base import BaseRepository

logger = logging.getLogger(__name__)


class SupervisorReviewRepository(BaseRepository[SupervisorReview]):
    """Repository for SupervisorReview database operations following established patterns."""

    def __init__(self, session: AsyncSession):
        super().__init__(session, SupervisorReview)

    # ========================================
    # CREATE
    # ========================================
    async def create(
        self,
        *,
        goal_id: UUID,
        period_id: UUID,
        supervisor_id: UUID,
        subordinate_id: UUID,
        org_id: str,
        action: str,
        comment: Optional[str],
        status: str,
        reviewed_at: Optional[str] = None,
    ) -> SupervisorReview:
        """Create a supervisor review (does not commit). Enforces app-level uniqueness within organization."""
        # App-level uniqueness check: one per (goal_id, period_id, supervisor_id) within org
        existing = await self.get_by_unique_keys(goal_id, period_id, supervisor_id, org_id)
        if existing:
            return existing

        review = SupervisorReview(
            id=uuid4(),
            goal_id=goal_id,
            period_id=period_id,
            supervisor_id=supervisor_id,
            subordinate_id=subordinate_id,
            action=action,
            comment=comment or "",
            status=status,
            reviewed_at=reviewed_at,
        )
        self.session.add(review)
        logger.info(
            f"Created SupervisorReview (pending commit) in org {org_id}: goal={goal_id}, period={period_id}, supervisor={supervisor_id}, subordinate={subordinate_id}, status={status}, action={action}"
        )
        return review

    # ========================================
    # READ
    # ========================================
    async def get_by_id(self, review_id: UUID, org_id: str) -> Optional[SupervisorReview]:
        """Get a supervisor review by ID within organization scope."""
        query = select(SupervisorReview).filter(SupervisorReview.id == review_id)
        # Apply organization scope via goal -> user
        query = self.apply_org_scope_via_goal(query, SupervisorReview.goal_id, org_id)
        result = await self.session.execute(query)
        return result.scalars().first()

    async def get_by_unique_keys(
        self, goal_id: UUID, period_id: UUID, supervisor_id: UUID, org_id: str
    ) -> Optional[SupervisorReview]:
        query = select(SupervisorReview).filter(
            and_(
                SupervisorReview.goal_id == goal_id,
                SupervisorReview.period_id == period_id,
                SupervisorReview.supervisor_id == supervisor_id,
            )
        )
        # Enforce organization scope via goal -> user
        query = self.apply_org_scope_via_goal(query, SupervisorReview.goal_id, org_id)
        result = await self.session.execute(query)
        return result.scalars().first()

    async def get_by_goal(self, goal_id: UUID, org_id: str) -> List[SupervisorReview]:
        query = select(SupervisorReview)
        query = query.options(joinedload(SupervisorReview.supervisor)).filter(SupervisorReview.goal_id == goal_id)
        # Enforce organization scope via goal -> user
        query = self.apply_org_scope_via_goal(query, SupervisorReview.goal_id, org_id)
        query = query.order_by(SupervisorReview.created_at.desc())
        result = await self.session.execute(query)
        return result.scalars().all()

    async def get_rejection_review_by_goal(self, goal_id: UUID, org_id: str) -> Optional[SupervisorReview]:
        """
        Get the rejection review for a specific goal (action='rejected').
        Used for building rejection history chains.
        """
        query = select(SupervisorReview)
        query = query.options(joinedload(SupervisorReview.supervisor)).filter(
            and_(
                SupervisorReview.goal_id == goal_id,
                SupervisorReview.action == 'REJECTED'
            )
        )
        # Enforce organization scope via goal -> user
        query = self.apply_org_scope_via_goal(query, SupervisorReview.goal_id, org_id)
        query = query.order_by(
            SupervisorReview.reviewed_at.desc().nulls_last(),
            SupervisorReview.updated_at.desc()
        )
        result = await self.session.execute(query)
        return result.scalars().first()

    async def get_rejection_reviews_batch(self, goal_ids: List[UUID], org_id: str) -> dict[UUID, SupervisorReview]:
        """
        Batch fetch rejection reviews for multiple goals in a single SQL query.
        Used for building rejection history chains efficiently.

        Args:
            goal_ids: List of goal UUIDs to fetch rejection reviews for
            org_id: Organization ID for scoping

        Returns:
            Dictionary mapping goal_id to most recent rejection SupervisorReview
        """
        if not goal_ids:
            return {}

        query = select(SupervisorReview)
        query = query.options(joinedload(SupervisorReview.supervisor)).filter(
            and_(
                SupervisorReview.goal_id.in_(goal_ids),
                SupervisorReview.action == 'REJECTED'
            )
        )
        # Enforce organization scope via goal -> user
        query = self.apply_org_scope_via_goal(query, SupervisorReview.goal_id, org_id)
        query = query.order_by(
            SupervisorReview.goal_id,
            SupervisorReview.reviewed_at.desc().nulls_last(),
            SupervisorReview.updated_at.desc()
        )

        result = await self.session.execute(query)
        reviews = result.scalars().all()

        # Create map: goal_id -> most recent rejection review
        reviews_map: dict[UUID, SupervisorReview] = {}
        for review in reviews:
            if review.goal_id not in reviews_map:
                reviews_map[review.goal_id] = review

        logger.info(f"Batch fetched {len(reviews_map)} rejection reviews for {len(goal_ids)} goals in org {org_id}")
        return reviews_map

    async def get_by_goals_batch(
        self,
        goal_ids: List[UUID],
        org_id: str,
        limit_per_goal: int = 10
    ) -> dict[UUID, SupervisorReview]:
        """
        Batch fetch most recent supervisor review for multiple goals in a single SQL query.
        This eliminates N+1 query problems when fetching reviews for goal lists.

        Args:
            goal_ids: List of goal UUIDs to fetch reviews for
            org_id: Organization ID for scoping
            limit_per_goal: Maximum reviews per goal (default: 10, but we only return the most recent)

        Returns:
            Dictionary mapping goal_id -> most recent SupervisorReview

        Performance:
            - 1 SQL query for any number of goals (vs N queries)
            - Uses IN clause for efficient batch fetching
            - Sorted by (goal_id, reviewed_at DESC) for deterministic ordering
        """
        if not goal_ids:
            return {}

        # Fetch all reviews for all goal_ids in a single query
        query = select(SupervisorReview).filter(
            SupervisorReview.goal_id.in_(goal_ids)
        )

        # Enforce organization scope via goal -> user
        query = self.apply_org_scope_via_goal(query, SupervisorReview.goal_id, org_id)

        # Order by goal_id and reviewed_at to get most recent first for each goal
        # Use NULLS LAST to ensure NULL reviewed_at values don't come first
        query = query.order_by(
            SupervisorReview.goal_id,
            SupervisorReview.reviewed_at.desc().nulls_last(),
            SupervisorReview.updated_at.desc(),
            SupervisorReview.created_at.desc()
        )

        result = await self.session.execute(query)
        reviews = result.scalars().all()

        # Map goal_id -> most recent review
        reviews_map: dict[UUID, SupervisorReview] = {}
        for review in reviews:
            # Only keep the first (most recent) review for each goal
            if review.goal_id not in reviews_map:
                reviews_map[review.goal_id] = review

        logger.info(f"Batch fetched {len(reviews_map)} reviews for {len(goal_ids)} goals in org {org_id}")
        return reviews_map

    async def get_goal_ids_for_supervisor(
        self,
        supervisor_id: UUID,
        org_id: str,
        *,
        goal_ids: List[UUID],
        status: Optional[str] = None,
    ) -> set[UUID]:
        """Return goal IDs that have a supervisor review assigned to the supervisor (org-scoped)."""
        if not goal_ids:
            return set()

        query = select(SupervisorReview.goal_id).filter(
            and_(
                SupervisorReview.supervisor_id == supervisor_id,
                SupervisorReview.goal_id.in_(goal_ids),
            )
        )
        if status:
            query = query.filter(SupervisorReview.status == status)

        query = self.apply_org_scope_via_goal(query, SupervisorReview.goal_id, org_id)
        result = await self.session.execute(query)
        return set(result.scalars().all())

    async def get_subordinate_ids_for_supervisor(
        self,
        supervisor_id: UUID,
        org_id: str,
        *,
        subordinate_ids: List[UUID],
        status: Optional[str] = None,
    ) -> set[UUID]:
        """Return subordinate IDs that have supervisor reviews assigned to the supervisor (org-scoped)."""
        if not subordinate_ids:
            return set()

        query = select(SupervisorReview.subordinate_id).filter(
            and_(
                SupervisorReview.supervisor_id == supervisor_id,
                SupervisorReview.subordinate_id.in_(subordinate_ids),
            )
        )
        if status:
            query = query.filter(SupervisorReview.status == status)

        query = self.apply_org_scope_via_goal(query, SupervisorReview.goal_id, org_id)
        result = await self.session.execute(query)
        return set(result.scalars().all())

    async def get_by_supervisor(
        self,
        supervisor_id: UUID,
        org_id: str,
        *,
        period_id: Optional[UUID] = None,
        goal_id: Optional[UUID] = None,
        subordinate_id: Optional[UUID] = None,
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
        if subordinate_id:
            query = query.filter(SupervisorReview.subordinate_id == subordinate_id)
        if status:
            query = query.filter(SupervisorReview.status == status)

        # Enforce organization scope via goal -> user
        query = self.apply_org_scope_via_goal(query, SupervisorReview.goal_id, org_id)

        query = query.order_by(SupervisorReview.updated_at.desc())
        if pagination:
            query = query.offset(pagination.offset).limit(pagination.limit)
        result = await self.session.execute(query)
        return result.scalars().all()

    async def count_by_supervisor(
        self,
        supervisor_id: UUID,
        org_id: str,
        *,
        period_id: Optional[UUID] = None,
        goal_id: Optional[UUID] = None,
        subordinate_id: Optional[UUID] = None,
        status: Optional[str] = None,
    ) -> int:
        query = select(func.count(SupervisorReview.id)).filter(
            SupervisorReview.supervisor_id == supervisor_id
        )
        if period_id:
            query = query.filter(SupervisorReview.period_id == period_id)
        if goal_id:
            query = query.filter(SupervisorReview.goal_id == goal_id)
        if subordinate_id:
            query = query.filter(SupervisorReview.subordinate_id == subordinate_id)
        if status:
            query = query.filter(SupervisorReview.status == status)

        # Enforce organization scope via goal -> user
        query = self.apply_org_scope_via_goal(query, SupervisorReview.goal_id, org_id)

        result = await self.session.execute(query)
        return result.scalar() or 0

    async def get_for_goal_owner(
        self,
        owner_user_id: UUID,
        org_id: str,
        *,
        period_id: Optional[UUID] = None,
        goal_id: Optional[UUID] = None,
        status: Optional[str] = None,
        pagination: Optional[PaginationParams] = None,
    ) -> List[SupervisorReview]:
        # Base query without manual JOIN - apply_org_scope_via_goal_with_owner handles the JOIN
        query = select(SupervisorReview)

        if period_id:
            query = query.filter(SupervisorReview.period_id == period_id)
        if goal_id:
            query = query.filter(SupervisorReview.goal_id == goal_id)
        if status:
            query = query.filter(SupervisorReview.status == status)

        # Apply organization scope and owner filter via single JOIN to avoid duplication
        query = self.apply_org_scope_via_goal_with_owner(query, SupervisorReview.goal_id, org_id, owner_user_id)

        query = query.order_by(SupervisorReview.updated_at.desc())
        if pagination:
            query = query.offset(pagination.offset).limit(pagination.limit)
        result = await self.session.execute(query)
        return result.scalars().all()

    async def count_for_goal_owner(
        self,
        owner_user_id: UUID,
        org_id: str,
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

        # Apply organization scope and owner filter via single JOIN to avoid duplication
        query = self.apply_org_scope_via_goal_with_owner(query, SupervisorReview.goal_id, org_id, owner_user_id)

        result = await self.session.execute(query)
        return result.scalar() or 0

    async def get_pending_reviews(
        self,
        supervisor_id: UUID,
        org_id: str,
        *,
        period_id: Optional[UUID] = None,
        subordinate_id: Optional[UUID] = None,
        pagination: Optional[PaginationParams] = None,
    ) -> List[SupervisorReview]:
        # Pending = draft reviews for goals currently pending approval
        query = (
            select(SupervisorReview)
            .filter(
                and_(
                    SupervisorReview.supervisor_id == supervisor_id,
                    SupervisorReview.status == "draft",
                )
            )
        )
        if period_id:
            query = query.filter(SupervisorReview.period_id == period_id)
        if subordinate_id:
            query = query.filter(SupervisorReview.subordinate_id == subordinate_id)
        if pagination:
            query = query.offset(pagination.offset).limit(pagination.limit)

        # Apply organization scope and goal status filter via single JOIN
        # This replaces the manual JOIN to avoid duplication
        query = self.apply_org_scope_via_goal_with_status(query, SupervisorReview.goal_id, org_id, "submitted")
        query = query.order_by(SupervisorReview.updated_at.asc())
        result = await self.session.execute(query)
        return result.scalars().all()

    async def count_pending_reviews(
        self,
        supervisor_id: UUID,
        org_id: str,
        *,
        period_id: Optional[UUID] = None,
        subordinate_id: Optional[UUID] = None,
    ) -> int:
        """Count pending reviews that need attention (supervisor only)."""
        query = (
            select(func.count(SupervisorReview.id))
            .filter(
                and_(
                    SupervisorReview.supervisor_id == supervisor_id,
                    SupervisorReview.status == "draft",
                )
            )
        )
        if period_id:
            query = query.filter(SupervisorReview.period_id == period_id)
        if subordinate_id:
            query = query.filter(SupervisorReview.subordinate_id == subordinate_id)

        query = self.apply_org_scope_via_goal_with_status(query, SupervisorReview.goal_id, org_id, "submitted")
        result = await self.session.execute(query)
        return int(result.scalar() or 0)

    async def search(
        self,
        org_id: str,
        *,
        period_id: Optional[UUID] = None,
        goal_id: Optional[UUID] = None,
        subordinate_id: Optional[UUID] = None,
        status: Optional[str] = None,
        pagination: Optional[PaginationParams] = None,
    ) -> List[SupervisorReview]:
        """Search reviews for admin across organization-scoped supervisors/goals."""
        query = select(SupervisorReview)
        if period_id:
            query = query.filter(SupervisorReview.period_id == period_id)
        if goal_id:
            query = query.filter(SupervisorReview.goal_id == goal_id)
        if subordinate_id:
            query = query.filter(SupervisorReview.subordinate_id == subordinate_id)
        if status:
            query = query.filter(SupervisorReview.status == status)

        # Enforce organization scope via goal -> user
        query = self.apply_org_scope_via_goal(query, SupervisorReview.goal_id, org_id)

        query = query.order_by(SupervisorReview.updated_at.desc())
        if pagination:
            query = query.offset(pagination.offset).limit(pagination.limit)
        result = await self.session.execute(query)
        return result.scalars().all()

    async def count_all(
        self,
        org_id: str,
        *,
        period_id: Optional[UUID] = None,
        goal_id: Optional[UUID] = None,
        subordinate_id: Optional[UUID] = None,
        status: Optional[str] = None,
    ) -> int:
        query = select(func.count(SupervisorReview.id))
        if period_id:
            query = query.filter(SupervisorReview.period_id == period_id)
        if goal_id:
            query = query.filter(SupervisorReview.goal_id == goal_id)
        if subordinate_id:
            query = query.filter(SupervisorReview.subordinate_id == subordinate_id)
        if status:
            query = query.filter(SupervisorReview.status == status)

        # Enforce organization scope via goal -> user
        query = self.apply_org_scope_via_goal(query, SupervisorReview.goal_id, org_id)

        result = await self.session.execute(query)
        return result.scalar() or 0

    # ========================================
    # UPDATE
    # ========================================
    async def update(
        self,
        review_id: UUID,
        org_id: str,
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
        # Return organization-scoped review
        return await self.get_by_id(review_id, org_id)

    # ========================================
    # DELETE
    # ========================================
    async def delete(self, review_id: UUID, org_id: str) -> bool:
        # Ensure review exists in org scope before delete
        existing = await self.get_by_id(review_id, org_id)
        if not existing:
            return False

        result = await self.session.execute(
            sa_delete(SupervisorReview).where(SupervisorReview.id == review_id)
        )
        return result.rowcount > 0
