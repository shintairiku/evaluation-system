from __future__ import annotations
import logging
from typing import Optional
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
from ..security.decorators import require_permission, require_any_permission
from ..security.rbac_helper import RBACHelper
from ..security.rbac_types import ResourceType
from ..core.exceptions import (
    NotFoundError,
    PermissionDeniedError,
    BadRequestError,
)

logger = logging.getLogger(__name__)


class SupervisorReviewService:
    """Business logic for supervisor reviews."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = SupervisorReviewRepository(session)
        self.goal_repo = GoalRepository(session)
        self.user_repo = UserRepository(session)
        
        # Initialize RBAC Helper with user repository for subordinate queries
        RBACHelper.initialize_with_repository(self.user_repo)

    # ========================================
    # CREATE
    # ========================================
    @require_permission(Permission.GOAL_APPROVE)
    async def create_review(
        self, review_create: SupervisorReviewCreate, current_user_context: AuthContext
    ) -> SupervisorReviewSchema:
        try:
            # Permission check handled by @require_permission decorator

            # Validate goal exists within organization
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")

            goal = await self.goal_repo.get_goal_by_id(review_create.goal_id, org_id)
            if not goal:
                raise NotFoundError(f"Goal with ID {review_create.goal_id} not found")

            # Must be supervisor of goal owner unless admin
            await self._require_supervisor_of_goal_owner(goal, current_user_context)

            # Enforce business rule: one review per (goal, period, supervisor)
            # Default to incomplete status if not specified
            status_value = review_create.status.value if review_create.status else SubmissionStatus.INCOMPLETE.value
            reviewed_at = None
            if status_value == "submitted":
                reviewed_at = datetime.now(timezone.utc)

            created = await self.repo.create(
                goal_id=review_create.goal_id,
                period_id=review_create.period_id,
                supervisor_id=current_user_context.user_id,
                org_id=org_id,
                action=review_create.action.value,
                comment=review_create.comment,
                status=status_value,
                reviewed_at=reviewed_at,
            )

            # If submitted and action implies status change, update goal
            if status_value == "submitted":
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
    @require_any_permission([Permission.GOAL_READ_ALL, Permission.GOAL_READ_SUBORDINATES, Permission.GOAL_READ_SELF])
    async def get_review(
        self, review_id: UUID, current_user_context: AuthContext
    ) -> SupervisorReviewDetailSchema:
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")

        review = await self.repo.get_by_id(review_id, org_id)
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

    @require_any_permission([Permission.GOAL_READ_ALL, Permission.GOAL_READ_SUBORDINATES, Permission.GOAL_READ_SELF])
    async def get_reviews(
        self,
        current_user_context: AuthContext,
        *,
        period_id: Optional[UUID] = None,
        goal_id: Optional[UUID] = None,
        subordinate_id: Optional[UUID] = None,
        status: Optional[str] = None,
        pagination: PaginationParams,
    ) -> PaginatedResponse[SupervisorReviewSchema]:
        try:
            # Permission check handled by @require_any_permission decorator
            # Use RBACHelper to determine accessible user IDs for data filtering (centralized)
            accessible_user_ids = await RBACHelper.get_accessible_user_ids(current_user_context)

            # Organization required for all repository calls
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")

            # Branch by RBACHelper result
            if accessible_user_ids is None:
                # Admin: access to all users
                items = await self.repo.search(
                    org_id,
                    period_id=period_id,
                    goal_id=goal_id,
                    subordinate_id=subordinate_id,
                    status=status,
                    pagination=pagination,
                )
                total = await self.repo.count_all(
                    org_id,
                    period_id=period_id,
                    goal_id=goal_id,
                    subordinate_id=subordinate_id,
                    status=status,
                )
            elif len(accessible_user_ids) == 1 and accessible_user_ids[0] == current_user_context.user_id:
                # Employee: only their own goals -> use goal-owner path
                items = await self.repo.get_for_goal_owner(
                    owner_user_id=current_user_context.user_id,
                    org_id=org_id,
                    period_id=period_id,
                    goal_id=goal_id,
                    status=status,
                    pagination=pagination,
                )
                total = await self.repo.count_for_goal_owner(
                    owner_user_id=current_user_context.user_id,
                    org_id=org_id,
                    period_id=period_id,
                    goal_id=goal_id,
                    status=status,
                )
            else:
                # Supervisor/manager: has subordinates (list includes subordinates + self)
                items = await self.repo.get_by_supervisor(
                    current_user_context.user_id,
                    org_id,
                    period_id=period_id,
                    goal_id=goal_id,
                    subordinate_id=subordinate_id,
                    status=status,
                    pagination=pagination,
                )
                total = await self.repo.count_by_supervisor(
                    current_user_context.user_id,
                    org_id,
                    period_id=period_id,
                    goal_id=goal_id,
                    subordinate_id=subordinate_id,
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

    @require_permission(Permission.GOAL_APPROVE)
    async def get_pending_reviews(
        self,
        current_user_context: AuthContext,
        *,
        period_id: Optional[UUID] = None,
        subordinate_id: Optional[UUID] = None,
        pagination: PaginationParams,
    ) -> PaginatedResponse[SupervisorReviewSchema]:
        # Permission check handled by @require_permission decorator
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")

        items = await self.repo.get_pending_reviews(
            current_user_context.user_id, org_id, period_id=period_id, subordinate_id=subordinate_id, pagination=pagination
        )
        total = len(items)
        schemas = [SupervisorReviewSchema.model_validate(r, from_attributes=True) for r in items]
        pages = (total + pagination.limit - 1) // pagination.limit
        return PaginatedResponse(items=schemas, total=total, page=pagination.page, limit=pagination.limit, pages=pages)

    # ========================================
    # UPDATE / SUBMIT
    # ========================================
    @require_any_permission([Permission.GOAL_READ_ALL, Permission.GOAL_APPROVE])
    async def update_review(
        self, review_id: UUID, review_update: SupervisorReviewUpdate, current_user_context: AuthContext
    ) -> SupervisorReviewSchema:
        try:
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")

            review = await self.repo.get_by_id(review_id, org_id)
            if not review:
                raise NotFoundError(f"Supervisor review with ID {review_id} not found")

            # Only the creating supervisor or admin can update
            if not (current_user_context.has_permission(Permission.GOAL_READ_ALL) or review.supervisor_id == current_user_context.user_id):
                raise PermissionDeniedError("You do not have permission to update this review")
            
            # Additional check: if not admin, verify supervisor still has authority over the goal owner
            if not current_user_context.has_permission(Permission.GOAL_READ_ALL):
                goal = await self.goal_repo.get_goal_by_id(review.goal_id, org_id)
                if goal:
                    await self._require_supervisor_of_goal_owner(goal, current_user_context)

            reviewed_at = review.reviewed_at
            status_value = review_update.status.value if review_update.status is not None else None
            if status_value == "submitted" and reviewed_at is None:
                reviewed_at = datetime.now(timezone.utc)
            if status_value in ["incomplete", "draft"]:
                reviewed_at = None

            updated = await self.repo.update(
                review_id,
                org_id,
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

    @require_any_permission([Permission.GOAL_READ_ALL, Permission.GOAL_APPROVE])
    async def submit_review(self, review_id: UUID, current_user_context: AuthContext) -> SupervisorReviewSchema:
        return await self.update_review(
            review_id,
            SupervisorReviewUpdate(status=SubmissionStatus.SUBMITTED),
            current_user_context,
        )

    # ========================================
    # DELETE
    # ========================================
    @require_any_permission([Permission.GOAL_READ_ALL, Permission.GOAL_APPROVE])
    async def delete_review(self, review_id: UUID, current_user_context: AuthContext) -> bool:
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")

        review = await self.repo.get_by_id(review_id, org_id)
        if not review:
            raise NotFoundError(f"Supervisor review with ID {review_id} not found")
        # Only the creating supervisor or admin can delete; only if incomplete or draft
        if not (current_user_context.has_permission(Permission.GOAL_READ_ALL) or review.supervisor_id == current_user_context.user_id):
            raise PermissionDeniedError("You do not have permission to delete this review")
        
        # Additional check: if not admin, verify supervisor still has authority over the goal owner
        if not current_user_context.has_permission(Permission.GOAL_READ_ALL):
            goal = await self.goal_repo.get_goal_by_id(review.goal_id, org_id)
            if goal:
                await self._require_supervisor_of_goal_owner(goal, current_user_context)
        
        if review.status not in ["incomplete", "draft"]:
            raise BadRequestError("Only incomplete or draft reviews can be deleted")
        success = await self.repo.delete(review_id, org_id)
        if success:
            await self.session.commit()
        return success

    # ========================================
    # PRIVATE HELPERS
    # ========================================
    async def _require_supervisor_of_goal_owner(self, goal: GoalModel, current_user_context: AuthContext) -> None:
        """Validate user can access this goal using RBAC framework"""
        # Use RBACHelper for resource access validation
        can_access = await RBACHelper.can_access_resource(
            auth_context=current_user_context,
            resource_id=goal.id,
            resource_type=ResourceType.GOAL,
            owner_user_id=goal.user_id
        )
        if not can_access:
            raise PermissionDeniedError("You can only review goals for your subordinates")

    async def _require_can_view_review(self, review, current_user_context: AuthContext) -> None:
        """Validate user can view this review using RBAC framework"""
        if current_user_context.has_permission(Permission.GOAL_READ_ALL):
            return
        if review.supervisor_id == current_user_context.user_id:
            return
        
        # Use RBACHelper to check if user can access the related goal
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")

        goal = await self.goal_repo.get_goal_by_id(review.goal_id, org_id)
        if goal:
            can_access = await RBACHelper.can_access_resource(
                auth_context=current_user_context,
                resource_id=goal.id,
                resource_type=ResourceType.GOAL,
                owner_user_id=goal.user_id
            )
            if can_access:
                return
                
        raise PermissionDeniedError("You do not have permission to view this review")

    async def _sync_goal_status_with_review(self, review, current_user_context: AuthContext) -> None:
        """Update goal status based on review action when submitted."""
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")

        if review.action == "APPROVED":
            await self.goal_repo.update_goal_status(review.goal_id, GoalStatus.APPROVED, org_id, approved_by=current_user_context.user_id)
        elif review.action == "REJECTED":
            await self.goal_repo.update_goal_status(review.goal_id, GoalStatus.REJECTED, org_id)
        elif review.action == "PENDING":
            # Keep goal in submitted
            pass


