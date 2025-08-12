from __future__ import annotations
import logging
from typing import Optional, List, Tuple
from uuid import UUID
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from ..database.repositories.supervisor_review_repository import SupervisorReviewRepository
from ..database.repositories.goal_repo import GoalRepository
from ..database.repositories.user_repo import UserRepository
from ..database.models.goal import Goal as GoalModel
from ..schemas.supervisor_review import (
    SupervisorReviewCreate,
    SupervisorReviewUpdate,
    SupervisorReview as SupervisorReviewSchema,
    SupervisorReviewDetail as SupervisorReviewDetailSchema,
)
from ..schemas.common import PaginationParams, PaginatedResponse, SubmissionStatus
from ..schemas.goal import GoalStatus
from ..security.context import AuthContext
from ..security.permissions import Permission
from ..core.exceptions import (
    NotFoundError,
    PermissionDeniedError,
    BadRequestError,
    ValidationError,
)

logger = logging.getLogger(__name__)


class SupervisorReviewService:
    """Business logic for supervisor reviews."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = SupervisorReviewRepository(session)
        self.goal_repo = GoalRepository(session)
        self.user_repo = UserRepository(session)

    # ========================================
    # CREATE
    # ========================================
    async def create_review(
        self, review_create: SupervisorReviewCreate, current_user_context: AuthContext
    ) -> SupervisorReviewSchema:
        try:
            # Permission: must be supervisor or above
            if not current_user_context.has_permission(Permission.GOAL_APPROVE):
                raise PermissionDeniedError("You do not have permission to create supervisor reviews")

            # Validate goal exists
            goal = await self.goal_repo.get_goal_by_id(review_create.goal_id)
            if not goal:
                raise NotFoundError(f"Goal with ID {review_create.goal_id} not found")

            # Must be supervisor of goal owner unless admin
            await self._require_supervisor_of_goal_owner(goal, current_user_context)

            # Enforce business rule: one review per (goal, period, supervisor)
            reviewed_at = None
            if review_create.status.value == "submitted":
                reviewed_at = datetime.now(timezone.utc)

            created = await self.repo.create(
                goal_id=review_create.goal_id,
                period_id=review_create.period_id,
                supervisor_id=current_user_context.user_id,
                action=review_create.action.value,
                comment=review_create.comment,
                status=review_create.status.value,
                reviewed_at=reviewed_at,
            )

            # If submitted and action implies status change, update goal
            if review_create.status.value == "submitted":
                await self._sync_goal_status_with_review(created, current_user_context)

            await self.session.commit()
            await self.session.refresh(created)
            return SupervisorReviewSchema.model_validate(created, from_attributes=True)
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error creating supervisor review: {e}")
            raise

    # ========================================
    # READ
    # ========================================
    async def get_review(
        self, review_id: UUID, current_user_context: AuthContext
    ) -> SupervisorReviewDetailSchema:
        review = await self.repo.get_by_id(review_id)
        if not review:
            raise NotFoundError(f"Supervisor review with ID {review_id} not found")

        await self._require_can_view_review(review, current_user_context)

        # Minimal detail enrichment for now
        is_overdue = False
        days_until_deadline = None
        return SupervisorReviewDetailSchema(
            **SupervisorReviewSchema.model_validate(review, from_attributes=True).model_dump(),
            is_overdue=is_overdue,
            days_until_deadline=days_until_deadline,
        )

    async def get_reviews(
        self,
        current_user_context: AuthContext,
        *,
        period_id: Optional[UUID] = None,
        goal_id: Optional[UUID] = None,
        status: Optional[str] = None,
        pagination: PaginationParams,
    ) -> PaginatedResponse[SupervisorReviewSchema]:
        try:
            # Admin can view all via owner path or supervisor path; others limited
            if current_user_context.has_permission(Permission.GOAL_READ_ALL):
                items = await self.repo.search(
                    period_id=period_id,
                    goal_id=goal_id,
                    status=status,
                    pagination=pagination,
                )
                total = await self.repo.count_all(
                    period_id=period_id,
                    goal_id=goal_id,
                    status=status,
                )
            else:
                # Supervisor: their own reviews; Employee: reviews on their own goals
                if current_user_context.has_permission(Permission.GOAL_APPROVE):
                    items = await self.repo.get_by_supervisor(
                        current_user_context.user_id,
                        period_id=period_id,
                        goal_id=goal_id,
                        status=status,
                        pagination=pagination,
                    )
                    total = await self.repo.count_by_supervisor(
                        current_user_context.user_id,
                        period_id=period_id,
                        goal_id=goal_id,
                        status=status,
                    )
                else:
                    items = await self.repo.get_for_goal_owner(
                        owner_user_id=current_user_context.user_id,
                        period_id=period_id,
                        goal_id=goal_id,
                        status=status,
                        pagination=pagination,
                    )
                    total = await self.repo.count_for_goal_owner(
                        owner_user_id=current_user_context.user_id,
                        period_id=period_id,
                        goal_id=goal_id,
                        status=status,
                    )

            schemas = [
                SupervisorReviewSchema.model_validate(r, from_attributes=True) for r in items
            ]
            pages = (total + pagination.limit - 1) // pagination.limit
            return PaginatedResponse(
                items=schemas, total=total, page=pagination.page, limit=pagination.limit, pages=pages
            )
        except Exception as e:
            logger.error(f"Error getting supervisor reviews: {e}")
            raise

    async def get_pending_reviews(
        self,
        current_user_context: AuthContext,
        *,
        period_id: Optional[UUID] = None,
        pagination: PaginationParams,
    ) -> PaginatedResponse[SupervisorReviewSchema]:
        if not current_user_context.has_permission(Permission.GOAL_APPROVE):
            raise PermissionDeniedError("You do not have permission to view pending supervisor reviews")
        items = await self.repo.get_pending_reviews(
            current_user_context.user_id, period_id=period_id, pagination=pagination
        )
        total = len(items)
        schemas = [SupervisorReviewSchema.model_validate(r, from_attributes=True) for r in items]
        pages = (total + pagination.limit - 1) // pagination.limit
        return PaginatedResponse(items=schemas, total=total, page=pagination.page, limit=pagination.limit, pages=pages)

    # ========================================
    # UPDATE / SUBMIT
    # ========================================
    async def update_review(
        self, review_id: UUID, review_update: SupervisorReviewUpdate, current_user_context: AuthContext
    ) -> SupervisorReviewSchema:
        try:
            review = await self.repo.get_by_id(review_id)
            if not review:
                raise NotFoundError(f"Supervisor review with ID {review_id} not found")

            # Only the creating supervisor or admin can update
            if not (current_user_context.has_permission(Permission.GOAL_READ_ALL) or review.supervisor_id == current_user_context.user_id):
                raise PermissionDeniedError("You do not have permission to update this review")

            reviewed_at = review.reviewed_at
            status_value = review_update.status.value if review_update.status is not None else None
            if status_value == "submitted" and reviewed_at is None:
                reviewed_at = datetime.now(timezone.utc)
            if status_value == "draft":
                reviewed_at = None

            updated = await self.repo.update(
                review_id,
                action=review_update.action.value if review_update.action is not None else None,
                comment=review_update.comment,
                status=status_value,
                reviewed_at=reviewed_at,
            )

            # Sync goal if moving to submitted
            if status_value == "submitted":
                await self._sync_goal_status_with_review(updated, current_user_context)

            await self.session.commit()
            return SupervisorReviewSchema.model_validate(updated, from_attributes=True)
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error updating supervisor review {review_id}: {e}")
            raise

    async def submit_review(self, review_id: UUID, current_user_context: AuthContext) -> SupervisorReviewSchema:
        return await self.update_review(
            review_id,
            SupervisorReviewUpdate(status=SubmissionStatus.SUBMITTED),
            current_user_context,
        )

    # ========================================
    # DELETE
    # ========================================
    async def delete_review(self, review_id: UUID, current_user_context: AuthContext) -> bool:
        review = await self.repo.get_by_id(review_id)
        if not review:
            raise NotFoundError(f"Supervisor review with ID {review_id} not found")
        # Only the creating supervisor or admin can delete; only if draft
        if not (current_user_context.has_permission(Permission.GOAL_READ_ALL) or review.supervisor_id == current_user_context.user_id):
            raise PermissionDeniedError("You do not have permission to delete this review")
        if review.status != "draft":
            raise BadRequestError("Only draft reviews can be deleted")
        success = await self.repo.delete(review_id)
        if success:
            await self.session.commit()
        return success

    # ========================================
    # PRIVATE HELPERS
    # ========================================
    async def _require_supervisor_of_goal_owner(self, goal: GoalModel, current_user_context: AuthContext) -> None:
        if current_user_context.has_permission(Permission.GOAL_READ_ALL):
            return
        subordinates = await self.user_repo.get_subordinates(current_user_context.user_id)
        subordinate_ids = [s.id for s in subordinates]
        if goal.user_id not in subordinate_ids:
            raise PermissionDeniedError("You can only review goals for your subordinates")

    async def _require_can_view_review(self, review, current_user_context: AuthContext) -> None:
        if current_user_context.has_permission(Permission.GOAL_READ_ALL):
            return
        if review.supervisor_id == current_user_context.user_id:
            return
        # Allow goal owner to view
        goal = await self.goal_repo.get_goal_by_id(review.goal_id)
        if goal and goal.user_id == current_user_context.user_id:
            return
        raise PermissionDeniedError("You do not have permission to view this review")

    async def _sync_goal_status_with_review(self, review, current_user_context: AuthContext) -> None:
        """Update goal status based on review action when submitted."""
        if review.action == "approved":
            await self.goal_repo.update_goal_status(review.goal_id, GoalStatus.APPROVED, approved_by=current_user_context.user_id)
        elif review.action == "rejected":
            await self.goal_repo.update_goal_status(review.goal_id, GoalStatus.REJECTED)
        elif review.action == "pending":
            # Keep goal in pending_approval
            pass


