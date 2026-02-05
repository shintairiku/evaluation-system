from __future__ import annotations
import logging
from typing import Optional, List, Dict
from uuid import UUID
from datetime import datetime, timezone
from decimal import Decimal
from cachetools import TTLCache

from ..database.repositories.goal_repo import GoalRepository
from ..database.repositories.user_repo import UserRepository
from ..database.repositories.evaluation_period_repo import EvaluationPeriodRepository
from ..database.repositories.competency_repo import CompetencyRepository
from ..database.repositories.supervisor_review_repository import SupervisorReviewRepository
from ..database.repositories.self_assessment_repo import SelfAssessmentRepository
from ..database.models.goal import Goal as GoalModel
from ..schemas.goal import (
    GoalCreate, GoalUpdate, Goal, GoalDetail, GoalStatus,
    CompetencyGoalUpdate
)
from ..schemas.goal_page import (
    EvaluationPeriodSummary,
    GoalListPageFilters,
    GoalListPageItem,
    GoalListPageMeta,
    GoalListPageResponse,
)
from ..schemas.common import PaginationParams, PaginatedResponse
from ..schemas.user import UserStatus
from ..security.context import AuthContext
from ..security.permissions import Permission
from ..security.rbac_helper import RBACHelper
from ..security.rbac_types import ResourceType
from ..security.decorators import require_permission, require_any_permission
from ..core.exceptions import (
    NotFoundError,
    PermissionDeniedError,
    BadRequestError,
    ValidationError,
    ConflictError,
)
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# Cache for goal search results (50 items, 5-minute TTL aligned with other services)
goal_search_cache = TTLCache(maxsize=50, ttl=300)


class GoalService:
    """Service layer for goal-related business logic and operations"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.goal_repo = GoalRepository(session)
        self.user_repo = UserRepository(session)
        self.evaluation_period_repo = EvaluationPeriodRepository(session)
        self.competency_repo = CompetencyRepository(session)
        self.supervisor_review_repo = SupervisorReviewRepository(session)
        self.self_assessment_repo = SelfAssessmentRepository(session)
        
        # Initialize RBAC Helper with user repository for subordinate queries
        RBACHelper.initialize_with_repository(self.user_repo)
    
    async def get_goals(
        self,
        current_user_context: AuthContext,
        user_id: Optional[UUID] = None,
        period_id: Optional[UUID] = None,
        goal_category: Optional[str] = None,
        status: Optional[List[str]] = None,
        has_previous_goal_id: Optional[bool] = None,
        pagination: Optional[PaginationParams] = None,
        include_reviews: bool = False,
        include_rejection_history: bool = False
    ) -> PaginatedResponse[Goal]:
        """
        Get goals based on current user's permissions and filters.

        Access rules:
        - Employees: can only view their own goals
        - Supervisors: can view their subordinates' goals + their own
        - Admins: can view all goals

        Performance optimization:
        - include_reviews: Batch fetch supervisor reviews (eliminates N+1 queries)
        - include_rejection_history: Fetch rejection history chain (requires include_reviews=True)
        """
        try:
            # Determine which users' goals the current user can access
            accessible_user_ids = await self._get_accessible_goal_user_ids(
                current_user_context, user_id
            )
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")

            # If the caller has no accessible users, return an empty page rather than
            # risk widening scope due to downstream truthiness checks.
            if accessible_user_ids is not None and len(accessible_user_ids) == 0:
                page_number = pagination.page if pagination else 1
                page_limit = pagination.limit if pagination else 0
                return PaginatedResponse(
                    items=[],
                    total=0,
                    page=page_number,
                    limit=page_limit,
                    pages=1,
                )
            
            # Search goals with filters
            goals = await self.goal_repo.search_goals(
                org_id=org_id,
                user_ids=accessible_user_ids,
                period_id=period_id,
                goal_category=goal_category,
                status=status,
                has_previous_goal_id=has_previous_goal_id,
                pagination=pagination
            )
            
            # Get total count for pagination
            total_count = await self.goal_repo.count_goals(
                org_id=org_id,
                user_ids=accessible_user_ids,
                period_id=period_id,
                goal_category=goal_category,
                status=status,
                has_previous_goal_id=has_previous_goal_id,
            )

            # Batch fetch supervisor reviews if requested (performance optimization)
            reviews_map = {}
            if include_reviews and goals:
                goal_ids = [goal.id for goal in goals]
                reviews_map = await self.supervisor_review_repo.get_by_goals_batch(
                    goal_ids=goal_ids,
                    org_id=org_id
                )
                logger.info(f"Batch fetched {len(reviews_map)} reviews for {len(goal_ids)} goals")

            # Batch fetch rejection histories if requested (performance optimization)
            rejection_histories_map = {}
            if include_rejection_history and goals:
                rejection_histories_map = await self._get_rejection_histories_batch(
                    goals=goals,
                    org_id=org_id
                )

            # Batch load competency names for all goals (N+1 fix)
            competency_name_map: dict[str, str] = {}
            competency_description_map: dict[str, dict[str, str]] = {}
            try:
                from uuid import UUID as _UUID
                competency_ids: set[UUID] = set()
                for goal_model in goals:
                    if (
                        goal_model.goal_category == "コンピテンシー"
                        and goal_model.target_data
                        and isinstance(goal_model.target_data, dict)
                        and goal_model.target_data.get("competency_ids")
                    ):
                        for cid in goal_model.target_data.get("competency_ids", []) or []:
                            try:
                                competency_ids.add(_UUID(str(cid)))
                            except (ValueError, TypeError):
                                pass

                if competency_ids:
                    comp_map = await self.competency_repo.get_by_ids_batch(list(competency_ids), org_id)
                    competency_name_map = {str(cid): comp.name for cid, comp in comp_map.items() if comp}
                    competency_description_map = {
                        str(cid): (comp.description or {}) for cid, comp in comp_map.items() if comp
                    }
            except Exception as e:
                logger.warning(f"Failed to batch load competency names: {e}")

            # Convert to response format
            enriched_goals = []
            for goal_model in goals:
                enriched_goal = await self._enrich_goal_data(
                    goal_model,
                    include_reviews=include_reviews,
                    include_rejection_history=include_rejection_history,
                    reviews_map=reviews_map,
                    rejection_histories_map=rejection_histories_map,
                    org_id=org_id,
                    competency_name_map=competency_name_map,
                    competency_description_map=competency_description_map,
                )
                enriched_goals.append(enriched_goal)
            
            # Create paginated response
            if pagination:
                total_pages = (total_count + pagination.limit - 1) // pagination.limit
            else:
                total_pages = 1
            
            return PaginatedResponse(
                items=enriched_goals,
                total=total_count,
                page=pagination.page if pagination else 1,
                limit=pagination.limit if pagination else len(enriched_goals),
                pages=total_pages
            )
            
        except Exception as e:
            logger.error(f"Error in get_goals: {e}")
            raise

    async def get_goals_by_ids(
        self,
        current_user_context: AuthContext,
        goal_ids: List[UUID],
        *,
        include_reviews: bool = False,
        include_rejection_history: bool = False,
    ) -> List[Goal]:
        """Return goals by explicit IDs with permission enforcement and batch enrichment."""
        if not goal_ids:
            return []

        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")

        # Determine which users' goals the current user can access.
        accessible_user_ids = await self._get_accessible_goal_user_ids(current_user_context)

        # Approvers must be able to fetch goals they have pending reviews for, even if
        # the current subordinate relationship has changed or the user is inactive.
        review_assigned_goal_ids: set[UUID] = set()
        if (
            current_user_context.user_id
            and current_user_context.has_permission(Permission.GOAL_APPROVE)
        ):
            review_assigned_goal_ids = await self.supervisor_review_repo.get_goal_ids_for_supervisor(
                current_user_context.user_id,
                org_id,
                goal_ids=goal_ids,
                status="draft",
            )

        if (
            accessible_user_ids is not None
            and len(accessible_user_ids) == 0
            and len(review_assigned_goal_ids) == 0
        ):
            return []

        goals_map = await self.goal_repo.get_goals_by_ids_batch(goal_ids, org_id)

        accessible_set = set(accessible_user_ids) if accessible_user_ids is not None else None
        seen: set[UUID] = set()
        ordered_goals: list[GoalModel] = []
        for goal_id in goal_ids:
            if goal_id in seen:
                continue
            seen.add(goal_id)
            goal_model = goals_map.get(goal_id)
            if not goal_model:
                continue
            if (
                accessible_set is not None
                and goal_model.user_id not in accessible_set
                and goal_id not in review_assigned_goal_ids
            ):
                continue
            ordered_goals.append(goal_model)

        if not ordered_goals:
            return []

        # Batch fetch supervisor reviews if requested (performance optimization)
        reviews_map = {}
        if include_reviews:
            reviews_map = await self.supervisor_review_repo.get_by_goals_batch(
                goal_ids=[g.id for g in ordered_goals],
                org_id=org_id,
            )

        rejection_histories_map = {}
        if include_rejection_history:
            rejection_histories_map = await self._get_rejection_histories_batch(
                goals=ordered_goals,
                org_id=org_id,
            )

        competency_name_map: dict[str, str] = {}
        competency_description_map: dict[str, dict[str, str]] = {}
        try:
            from uuid import UUID as _UUID

            competency_ids: set[UUID] = set()
            for goal_model in ordered_goals:
                if (
                    goal_model.goal_category == "コンピテンシー"
                    and goal_model.target_data
                    and isinstance(goal_model.target_data, dict)
                    and goal_model.target_data.get("competency_ids")
                ):
                    for cid in goal_model.target_data.get("competency_ids", []) or []:
                        try:
                            competency_ids.add(_UUID(str(cid)))
                        except (ValueError, TypeError):
                            pass

            if competency_ids:
                comp_map = await self.competency_repo.get_by_ids_batch(list(competency_ids), org_id)
                competency_name_map = {str(cid): comp.name for cid, comp in comp_map.items() if comp}
                competency_description_map = {
                    str(cid): (comp.description or {}) for cid, comp in comp_map.items() if comp
                }
        except Exception as e:
            logger.warning(f"Failed to batch load competency names: {e}")

        enriched_goals: list[Goal] = []
        for goal_model in ordered_goals:
            enriched_goal = await self._enrich_goal_data(
                goal_model,
                include_reviews=include_reviews,
                include_rejection_history=include_rejection_history,
                reviews_map=reviews_map,
                rejection_histories_map=rejection_histories_map,
                org_id=org_id,
                competency_name_map=competency_name_map,
                competency_description_map=competency_description_map,
            )
            enriched_goals.append(enriched_goal)

        return enriched_goals

    async def get_goal_list_page(
        self,
        current_user_context: AuthContext,
        period_id: Optional[UUID] = None,
        status: Optional[List[str]] = None,
        user_id: Optional[UUID] = None,
        page: int = 1,
        limit: int = 50,
    ) -> GoalListPageResponse:
        """Return a page-shaped response for the goal list UI in a single call."""
        try:
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")

            # Clamp pagination to safe bounds
            page = max(1, page)
            limit = max(1, min(limit, 200))
            pagination = PaginationParams(page=page, limit=limit)

            accessible_user_ids = await self._get_accessible_goal_user_ids(
                current_user_context=current_user_context,
                requested_user_id=user_id,
            )

            # If the caller has no accessible users, short-circuit with an empty page
            if accessible_user_ids is not None and len(accessible_user_ids) == 0:
                empty_meta = GoalListPageMeta(total=0, page=pagination.page, limit=pagination.limit, pages=1)
                empty_filters = GoalListPageFilters(
                    period_id=period_id,
                    statuses=status or None,
                    periods=[],
                )
                return GoalListPageResponse(goals=[], meta=empty_meta, filters=empty_filters)

            rows, total = await self.goal_repo.get_goal_list_page(
                org_id=org_id,
                user_ids=accessible_user_ids,
                period_id=period_id,
                status=status,
                pagination=pagination,
            )

            items: List[GoalListPageItem] = []
            for row in rows:
                target_data = row.get("target_data") or {}
                weight_value = row.get("weight")
                items.append(
                    GoalListPageItem(
                        goal_id=row["goal_id"],
                        user_id=row["user_id"],
                        user_name=row.get("user_name"),
                        employee_code=row.get("employee_code"),
                        department_name=row.get("department_name"),
                        period_id=row["period_id"],
                        period_name=row.get("period_name"),
                        goal_category=row.get("goal_category"),
                        status=row.get("status"),
                        weight=float(weight_value) if weight_value is not None else 0.0,
                        title=target_data.get("title"),
                        performance_goal_type=target_data.get("performance_goal_type"),
                        action_plan=target_data.get("action_plan"),
                        updated_at=row.get("updated_at"),
                    )
                )

            periods = await self.evaluation_period_repo.get_all(org_id)
            period_summaries = [
                EvaluationPeriodSummary(
                    id=period.id,
                    name=period.name,
                    start_date=period.start_date,
                    end_date=period.end_date,
                    status=period.status.value if hasattr(period, "status") and hasattr(period.status, "value") else str(period.status),
                )
                for period in periods
            ]

            pages = (total + pagination.limit - 1) // pagination.limit if total else 1
            meta = GoalListPageMeta(
                total=total,
                page=pagination.page,
                limit=pagination.limit,
                pages=pages,
            )

            filters = GoalListPageFilters(
                period_id=period_id,
                statuses=status or None,
                periods=period_summaries,
            )

            return GoalListPageResponse(
                goals=items,
                meta=meta,
                filters=filters,
            )

        except Exception as e:
            logger.error(f"Error in get_goal_list_page: {e}")
            raise

    async def get_goal_by_id(
        self,
        goal_id: UUID,
        current_user_context: AuthContext
    ) -> GoalDetail:
        """Get detailed goal information by ID with permission checks."""
        try:
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")
            goal = await self.goal_repo.get_goal_by_id_with_details(goal_id, org_id)
            if not goal:
                raise NotFoundError(f"Goal with ID {goal_id} not found")
            
            # Permission check using RBACHelper
            can_access = await RBACHelper.can_access_resource(
                auth_context=current_user_context,
                resource_id=goal_id,
                resource_type=ResourceType.GOAL,
                owner_user_id=goal.user_id
            )
            if not can_access:
                raise PermissionDeniedError("You do not have permission to access this goal")
            
            # Enrich with detailed information
            enriched_goal = await self._enrich_goal_detail_data(goal)
            return enriched_goal
            
        except Exception as e:
            logger.error(f"Error getting goal {goal_id}: {str(e)}")
            raise

    @require_any_permission([Permission.GOAL_MANAGE, Permission.GOAL_MANAGE_SELF])
    async def create_goal(
        self,
        goal_data: GoalCreate,
        current_user_context: AuthContext
    ) -> Goal:
        """Create a new goal with validation and business rules."""
        try:
            # Users create goals for themselves (admin can create for anyone, but we'll keep it simple for now)
            target_user_id = current_user_context.user_id
            
            # Business validation
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")
            await self._validate_goal_creation(goal_data, target_user_id, org_id)

            stage_budget = await self._get_stage_budget_for_user(target_user_id, org_id)
            await self._validate_stage_weight_budget(
                user_id=target_user_id,
                period_id=goal_data.period_id,
                org_id=org_id,
                stage_budget=stage_budget,
                goal_category=goal_data.goal_category,
                goal_weight=goal_data.weight,
                performance_goal_type=goal_data.performance_goal_type.value if goal_data.performance_goal_type else None,
            )
            
            # Validate weight limits only for submitted goals, not drafts
            if goal_data.status == GoalStatus.SUBMITTED:
                await self._validate_weight_limits(
                    target_user_id,
                    goal_data.period_id,
                    goal_data.goal_category,
                    goal_data.weight,
                    org_id
                )
            
            # Create goal
            created_goal = await self.goal_repo.create_goal(goal_data, target_user_id, org_id)
            
            # Commit transaction
            await self.session.commit()
            await self.session.refresh(created_goal)
            
            # Only create related assessment records when goal is submitted
            # Goals start as draft and supervisor_review is created when submitted
            if goal_data.status == GoalStatus.SUBMITTED:
                await self._create_related_assessment_records(created_goal, org_id)
                await self.session.commit()

            # Enrich response data with competency names (N+1 fix)
            competency_name_map = await self._build_competency_name_map_for_goal(created_goal, org_id)
            enriched_goal = await self._enrich_goal_data(
                created_goal,
                org_id=org_id,
                competency_name_map=competency_name_map
            )

            logger.info(f"Goal created successfully: {created_goal.id}")
            return enriched_goal
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error creating goal: {str(e)}")
            raise

    @require_any_permission([Permission.GOAL_MANAGE, Permission.GOAL_MANAGE_SELF])
    async def update_goal(
        self,
        goal_id: UUID,
        goal_data: GoalUpdate,
        current_user_context: AuthContext
    ) -> Goal:
        """Update a goal with validation and business rules."""
        try:
            # Check if goal exists
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")
            existing_goal = await self.goal_repo.get_goal_by_id(goal_id, org_id)
            if not existing_goal:
                raise NotFoundError(f"Goal with ID {goal_id} not found")

            is_admin_manage = current_user_context.has_permission(Permission.GOAL_MANAGE)
            if not is_admin_manage and current_user_context.user_id != existing_goal.user_id:
                raise PermissionDeniedError("You can only update your own goals")

            if existing_goal.status != GoalStatus.DRAFT.value:
                raise BadRequestError("Can only update draft goals")
            
            # Business validation
            await self._validate_goal_update(goal_data, existing_goal, org_id)

            stage_budget = await self._get_stage_budget_for_user(existing_goal.user_id, org_id)
            updated_weight = goal_data.weight if goal_data.weight is not None else float(existing_goal.weight or 0)
            updated_performance_type = getattr(goal_data, "performance_goal_type", None)
            if updated_performance_type is not None:
                updated_performance_type_value = updated_performance_type.value
            else:
                target_data = existing_goal.target_data or {}
                updated_performance_type_value = target_data.get("performance_goal_type")

            await self._validate_stage_weight_budget(
                user_id=existing_goal.user_id,
                period_id=existing_goal.period_id,
                org_id=org_id,
                stage_budget=stage_budget,
                goal_category=existing_goal.goal_category,
                goal_weight=updated_weight,
                performance_goal_type=updated_performance_type_value,
                exclude_goal_id=goal_id
            )
            
            # Update goal
            updated_goal = await self.goal_repo.update_goal(goal_id, goal_data, org_id)
            if not updated_goal:
                raise NotFoundError(f"Goal with ID {goal_id} not found after update")
            
            # Commit transaction
            await self.session.commit()

            # Enrich response data with competency names (N+1 fix)
            competency_name_map = await self._build_competency_name_map_for_goal(updated_goal, org_id)
            enriched_goal = await self._enrich_goal_data(
                updated_goal,
                org_id=org_id,
                competency_name_map=competency_name_map
            )

            logger.info(f"Goal updated successfully: {goal_id}")
            return enriched_goal
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error updating goal {goal_id}: {str(e)}")
            raise

    @require_any_permission([Permission.GOAL_MANAGE, Permission.GOAL_MANAGE_SELF])
    async def delete_goal(
        self,
        goal_id: UUID,
        current_user_context: AuthContext
    ) -> bool:
        """Delete a goal with permission and business rule checks."""
        try:
            # Check if goal exists
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")
            existing_goal = await self.goal_repo.get_goal_by_id(goal_id, org_id)
            if not existing_goal:
                raise NotFoundError(f"Goal with ID {goal_id} not found")

            is_admin_manage = current_user_context.has_permission(Permission.GOAL_MANAGE)
            if not is_admin_manage and current_user_context.user_id != existing_goal.user_id:
                raise PermissionDeniedError("You can only delete your own goals")

            if existing_goal.status != GoalStatus.DRAFT.value:
                raise BadRequestError("Can only delete draft goals")

            # Defensive cleanup: ensure supervisor review record is removed (should be none for drafts).
            try:
                reviews = await self.supervisor_review_repo.get_by_goal(goal_id, org_id)
                for review in reviews:
                    await self.supervisor_review_repo.delete(review.id, org_id)
            except Exception as cleanup_error:
                logger.warning(
                    "Failed to cleanup supervisor_review records for goal %s before delete: %s",
                    goal_id,
                    cleanup_error,
                )
            
            # Delete goal
            success = await self.goal_repo.delete_goal(goal_id, org_id)
            
            if success:
                await self.session.commit()
                logger.info(f"Goal deleted successfully: {goal_id}")
            
            return success
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error deleting goal {goal_id}: {str(e)}")
            raise

    @require_permission(Permission.GOAL_MANAGE_SELF)
    async def submit_goal(
        self,
        goal_id: UUID,
        status: str,
        current_user_context: AuthContext
    ) -> Goal:
        """Submit a goal with specified status (draft or submitted)."""
        try:
            # Validate status parameter
            if status not in ["draft", "submitted"]:
                raise ValidationError("Status must be either 'draft' or 'submitted'")
            
            # Check if goal exists and user can update it
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")
            existing_goal = await self.goal_repo.get_goal_by_id(goal_id, org_id)
            if not existing_goal:
                raise NotFoundError(f"Goal with ID {goal_id} not found")
            
            # Permission check - only goal owner can submit (strict ownership, even admins cannot submit others' goals)
            if current_user_context.user_id != existing_goal.user_id:
                raise PermissionDeniedError("You can only submit your own goals")

            if status == "submitted":
                current_user = await self.user_repo.get_user_by_id(current_user_context.user_id, org_id)
                if not current_user:
                    raise PermissionDeniedError("User context required")

                if current_user.status != UserStatus.ACTIVE.value:
                    raise BadRequestError("Only active users can submit goals")

                # Business rule: can only submit draft or rejected goals
                if existing_goal.status not in [GoalStatus.DRAFT.value, GoalStatus.REJECTED.value]:
                    raise BadRequestError("Can only submit draft or rejected goals")

                # Note: Weight validation is now handled on frontend before submission starts
                # Individual goal submission should not validate total weights

                # Update status using dedicated method with validation
                updated_goal = await self.goal_repo.update_goal_status(goal_id, GoalStatus.SUBMITTED, org_id)

                # Commit transaction
                await self.session.commit()

                # Auto-create draft supervisor review only when submitting for approval
                try:
                    await self._create_related_assessment_records(updated_goal, org_id)
                    await self.session.commit()
                except Exception as auto_create_error:
                    logger.error(f"Auto-create SupervisorReview failed for goal {goal_id}: {auto_create_error}")
                    # Do not rollback goal submission due to review auto-creation failure

            else:
                # Withdrawal: submitted -> draft (only if supervisor review is untouched).
                if existing_goal.status != GoalStatus.SUBMITTED.value:
                    raise BadRequestError("Can only withdraw submitted goals back to draft")

                reviews = await self.supervisor_review_repo.get_by_goal(goal_id, org_id)
                if not reviews:
                    # Some users can submit goals without any supervisors assigned.
                    # In that case we intentionally don't create supervisor review records,
                    # and the goal should still be withdrawable back to draft.
                    updated_goal = await self.goal_repo.update_goal_status(goal_id, GoalStatus.DRAFT, org_id)
                    await self.session.commit()
                else:
                    untouched = all(
                        review.status == "draft" and (review.comment or "").strip() == ""
                        for review in reviews
                    )
                    if not untouched:
                        raise BadRequestError(
                            "Cannot withdraw: supervisor has already started reviewing this goal"
                        )

                    # Delete the corresponding supervisor review row(s) immediately.
                    # Product expects a 1:1 relationship; if multiple exist, delete them all.
                    for review in reviews:
                        await self.supervisor_review_repo.delete(review.id, org_id)

                    updated_goal = await self.goal_repo.update_goal_status(goal_id, GoalStatus.DRAFT, org_id)
                    await self.session.commit()

            # Enrich response data with competency names (N+1 fix)
            competency_name_map = await self._build_competency_name_map_for_goal(updated_goal, org_id)
            enriched_goal = await self._enrich_goal_data(
                updated_goal,
                org_id=org_id,
                competency_name_map=competency_name_map
            )

            logger.info(f"Goal status changed to '{status}': {goal_id} by {current_user_context.user_id}")
            return enriched_goal
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error submitting goal {goal_id}: {str(e)}")
            raise

    @require_permission(Permission.GOAL_APPROVE)
    async def approve_goal(
        self,
        goal_id: UUID,
        current_user_context: AuthContext
    ) -> Goal:
        """Approve a goal (supervisor/admin only)."""
        try:
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")
            goal = await self.goal_repo.get_goal_by_id_with_details(goal_id, org_id)
            if not goal:
                raise NotFoundError(f"Goal with ID {goal_id} not found")
            
            # Additional permission check - must be supervisor of goal owner or admin
            can_approve = await RBACHelper.can_access_resource(
                auth_context=current_user_context,
                resource_id=goal_id,
                resource_type=ResourceType.GOAL,
                owner_user_id=goal.user_id
            )
            if not can_approve:
                raise PermissionDeniedError("You can only approve goals for your subordinates")
            
            # Business validation
            if goal.status != GoalStatus.SUBMITTED.value:
                raise BadRequestError("Goal must be in pending approval status")
            
            # Update status
            updated_goal = await self.goal_repo.update_goal_status(
                goal_id,
                GoalStatus.APPROVED,
                org_id,
                approved_by=current_user_context.user_id
            )
            
            # Commit transaction
            await self.session.commit()

            # Enrich response data with competency names (N+1 fix)
            competency_name_map = await self._build_competency_name_map_for_goal(updated_goal, org_id)
            enriched_goal = await self._enrich_goal_data(
                updated_goal,
                org_id=org_id,
                competency_name_map=competency_name_map
            )

            logger.info(f"Goal approved successfully: {goal_id} by {current_user_context.user_id}")
            return enriched_goal
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error approving goal {goal_id}: {str(e)}")
            raise

    @require_permission(Permission.GOAL_APPROVE)
    async def reject_goal(
        self,
        goal_id: UUID,
        rejection_reason: str,
        current_user_context: AuthContext
    ) -> Goal:
        """Reject a goal (supervisor/admin only)."""
        try:
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")
            if not rejection_reason or not rejection_reason.strip():
                raise ValidationError("Rejection reason is required")
            goal = await self.goal_repo.get_goal_by_id_with_details(goal_id, org_id)
            if not goal:
                raise NotFoundError(f"Goal with ID {goal_id} not found")
            
            # Additional permission check - must be supervisor of goal owner or admin
            can_reject = await RBACHelper.can_access_resource(
                auth_context=current_user_context,
                resource_id=goal_id,
                resource_type=ResourceType.GOAL,
                owner_user_id=goal.user_id
            )
            if not can_reject:
                raise PermissionDeniedError("You can only reject goals for your subordinates")
            
            # Business validation
            if goal.status not in (GoalStatus.SUBMITTED.value, GoalStatus.APPROVED.value):
                raise BadRequestError("Goal must be in submitted or approved status")

            # Guard rails: prevent remand/rejection once evaluation has progressed.
            period = await self.evaluation_period_repo.get_by_id(goal.period_id, org_id)
            if not period:
                raise NotFoundError(f"Evaluation period with ID {goal.period_id} not found")

            period_status = getattr(period.status, "value", period.status)
            if period_status in ("completed", "cancelled"):
                raise BadRequestError("Cannot reject goals in completed or cancelled evaluation periods")

            existing_assessment = await self.self_assessment_repo.get_by_goal(goal_id, org_id)
            if existing_assessment:
                raise BadRequestError("Cannot reject goal after self-assessment has been created")
            
            # Update status
            updated_goal = await self.goal_repo.update_goal_status(goal_id, GoalStatus.REJECTED, org_id)

            # Persist rejection reason via supervisor_review (source of truth for feedback).
            reviewed_at = datetime.now(timezone.utc)
            existing_review = await self.supervisor_review_repo.get_by_unique_keys(
                goal_id=goal_id,
                period_id=goal.period_id,
                supervisor_id=current_user_context.user_id,
                org_id=org_id,
            )
            if existing_review:
                await self.supervisor_review_repo.update(
                    existing_review.id,
                    org_id,
                    action="REJECTED",
                    comment=rejection_reason.strip(),
                    status="submitted",
                    reviewed_at=reviewed_at,
                )
            else:
                await self.supervisor_review_repo.create(
                    goal_id=goal_id,
                    period_id=goal.period_id,
                    supervisor_id=current_user_context.user_id,
                    subordinate_id=goal.user_id,
                    org_id=org_id,
                    action="REJECTED",
                    comment=rejection_reason.strip(),
                    status="submitted",
                    reviewed_at=reviewed_at,
                )

            # Ensure a replacement draft exists for resubmission (avoid duplicates).
            replacement = await self.goal_repo.get_replacement_draft_by_previous_goal_id(goal_id, org_id)
            if not replacement:
                await self.goal_repo.create_goal_from_model(
                    user_id=goal.user_id,
                    period_id=goal.period_id,
                    goal_category=goal.goal_category,
                    target_data=goal.target_data,
                    weight=float(goal.weight),
                    org_id=org_id,
                    status=GoalStatus.DRAFT,
                    previous_goal_id=goal_id,
                )

            # Commit transaction
            await self.session.commit()

            # Enrich response data with competency names (N+1 fix)
            competency_name_map = await self._build_competency_name_map_for_goal(updated_goal, org_id)
            enriched_goal = await self._enrich_goal_data(
                updated_goal,
                org_id=org_id,
                competency_name_map=competency_name_map
            )

            logger.info(f"Goal rejected successfully: {goal_id} by {current_user_context.user_id}")
            return enriched_goal
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error rejecting goal {goal_id}: {str(e)}")
            raise

    @require_permission(Permission.GOAL_APPROVE)
    async def get_pending_approvals(
        self,
        current_user_context: AuthContext,
        period_id: Optional[UUID] = None,
        pagination: Optional[PaginationParams] = None
    ) -> PaginatedResponse[Goal]:
        """Get goals pending approval for current supervisor."""
        try:
            # Get pending goals for supervisor's subordinates
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")
            goals = await self.goal_repo.get_pending_approvals_for_supervisor(
                current_user_context.user_id,
                org_id,
                period_id=period_id,
                pagination=pagination
            )
            
            # Count for pagination
            total_count = len(goals)  # Simple count for now

            # Batch load competency names for all goals (N+1 fix)
            competency_name_map: dict[str, str] = {}
            try:
                from uuid import UUID as _UUID
                competency_ids: set[UUID] = set()
                for goal_model in goals:
                    if (
                        goal_model.goal_category == "コンピテンシー"
                        and goal_model.target_data
                        and isinstance(goal_model.target_data, dict)
                        and goal_model.target_data.get("competency_ids")
                    ):
                        for cid in goal_model.target_data.get("competency_ids", []) or []:
                            try:
                                competency_ids.add(_UUID(str(cid)))
                            except (ValueError, TypeError):
                                pass

                if competency_ids:
                    comp_map = await self.competency_repo.get_by_ids_batch(list(competency_ids), org_id)
                    competency_name_map = {str(cid): comp.name for cid, comp in comp_map.items() if comp}
            except Exception as e:
                logger.warning(f"Failed to batch load competency names: {e}")

            # Enrich data
            enriched_goals = []
            for goal_model in goals:
                enriched_goal = await self._enrich_goal_data(
                    goal_model,
                    org_id=org_id,
                    competency_name_map=competency_name_map
                )
                enriched_goals.append(enriched_goal)
            
            # Create response
            if pagination:
                total_pages = (total_count + pagination.limit - 1) // pagination.limit
            else:
                total_pages = 1
            
            return PaginatedResponse(
                items=enriched_goals,
                total=total_count,
                page=pagination.page if pagination else 1,
                limit=pagination.limit if pagination else len(enriched_goals),
                pages=total_pages
            )
            
        except Exception as e:
            logger.error(f"Error getting pending approvals: {e}")
            raise

    async def get_all_goals_for_admin(
        self,
        org_id: str,
        period_id: Optional[UUID] = None,
        user_id: Optional[UUID] = None,
        department_id: Optional[UUID] = None,
        goal_category: Optional[str] = None,
        status: Optional[List[str]] = None,
        pagination: Optional[PaginationParams] = None,
        include_reviews: bool = True,
        include_rejection_history: bool = False
    ) -> PaginatedResponse[Goal]:
        """
        Get all goals for admin visualization (system-wide, no user filtering).

        SECURITY: This method should ONLY be called from admin-protected endpoints.
        It bypasses the normal user-level filtering and returns ALL users' goals.

        Performance optimization:
        - include_reviews: Batch fetch supervisor reviews (default: True)
        - include_rejection_history: Fetch rejection history chain

        Args:
            org_id: Organization ID (required for scoping)
            period_id: Optional filter by evaluation period
            user_id: Optional filter by specific user
            department_id: Optional filter by department
            goal_category: Optional filter by goal category
            status: Optional filter by status list
            pagination: Pagination parameters
            include_reviews: Include supervisor reviews (default True for performance)
            include_rejection_history: Include rejection history chain

        Returns:
            PaginatedResponse[Goal]: Paginated list of goals with enriched data
        """
        try:
            # Search goals with user_ids=None (ALL users in organization)
            goals = await self.goal_repo.search_goals(
                org_id=org_id,
                user_ids=[user_id] if user_id else None,  # None = all users, [user_id] = specific user
                period_id=period_id,
                department_id=department_id,
                goal_category=goal_category,
                status=status,
                pagination=pagination
            )

            # Get total count for pagination
            total_count = await self.goal_repo.count_goals(
                org_id=org_id,
                user_ids=[user_id] if user_id else None,
                period_id=period_id,
                department_id=department_id,
                goal_category=goal_category,
                status=status
            )

            # Batch fetch supervisor reviews if requested (performance optimization)
            reviews_map = {}
            if include_reviews and goals:
                goal_ids = [goal.id for goal in goals]
                reviews_map = await self.supervisor_review_repo.get_by_goals_batch(
                    goal_ids=goal_ids,
                    org_id=org_id
                )
                logger.info(f"[Admin] Batch fetched {len(reviews_map)} reviews for {len(goal_ids)} goals")

            # Batch fetch rejection histories if requested (performance optimization)
            rejection_histories_map = {}
            if include_rejection_history and goals:
                rejection_histories_map = await self._get_rejection_histories_batch(
                    goals=goals,
                    org_id=org_id
                )

            # Batch fetch competency names for competency goals to avoid N+1 lookups
            # Collect all competency IDs appearing in the current page of goals
            competency_name_map: dict[str, str] = {}
            try:
                from uuid import UUID as _UUID
                competency_ids: set[UUID] = set()
                for g in goals:
                    if (
                        g.goal_category == "コンピテンシー"
                        and g.target_data
                        and isinstance(g.target_data, dict)
                        and g.target_data.get("competency_ids")
                    ):
                        for cid in g.target_data.get("competency_ids", []) or []:
                            # Ensure UUID type where possible; tolerate strings
                            try:
                                competency_ids.add(_UUID(str(cid)))
                            except Exception:
                                continue

                if competency_ids:
                    comp_map = await self.competency_repo.get_by_ids_batch(list(competency_ids), org_id)
                    # Build string-keyed map for serialization in _enrich_goal_data
                    competency_name_map = {str(cid): comp.name for cid, comp in comp_map.items() if comp}
            except Exception as e:
                logger.warning(f"Failed to batch load competency names: {e}")

            # Convert to response format
            enriched_goals = []
            for goal_model in goals:
                enriched_goal = await self._enrich_goal_data(
                    goal_model,
                    include_reviews=include_reviews,
                    include_rejection_history=include_rejection_history,
                    reviews_map=reviews_map,
                    rejection_histories_map=rejection_histories_map,
                    org_id=org_id,
                    competency_name_map=competency_name_map
                )
                enriched_goals.append(enriched_goal)

            # Create paginated response
            if pagination:
                total_pages = (total_count + pagination.limit - 1) // pagination.limit
            else:
                total_pages = 1

            logger.info(f"[Admin] Returning {len(enriched_goals)} goals (total: {total_count})")

            return PaginatedResponse(
                items=enriched_goals,
                total=total_count,
                page=pagination.page if pagination else 1,
                limit=pagination.limit if pagination else len(enriched_goals),
                pages=total_pages
            )

        except Exception as e:
            logger.error(f"Error in get_all_goals_for_admin: {e}")
            raise

    # ========================================
    # PRIVATE HELPER METHODS
    # ========================================

    async def _get_accessible_goal_user_ids(
        self,
        current_user_context: AuthContext,
        requested_user_id: Optional[UUID] = None
    ) -> Optional[List[UUID]]:
        """Determine which users' goals the current user can access."""

        if current_user_context.has_permission(Permission.GOAL_READ_ALL) or current_user_context.has_permission(Permission.GOAL_MANAGE):
            # Admin: can read any user's goals when explicitly requested
            if requested_user_id:
                return [requested_user_id]
            # Safe default: admin sees only their own goals unless explicitly requesting others
            # For org-wide view, use get_all_goals_for_admin() endpoint instead
            return [current_user_context.user_id] if current_user_context.user_id else []
        
        accessible_ids = []
        
        # Add self when the user can either read or manage their own goals.
        can_access_self = (
            current_user_context.has_permission(Permission.GOAL_READ_SELF)
            or current_user_context.has_permission(Permission.GOAL_MANAGE_SELF)
        )
        if can_access_self and current_user_context.user_id:
            accessible_ids.append(current_user_context.user_id)
        
        # Supervisors: can see subordinates' goals.
        # Approvers must also be able to view the goals they act on.
        can_access_subordinates = (
            current_user_context.has_permission(Permission.GOAL_READ_SUBORDINATES)
            or current_user_context.has_permission(Permission.GOAL_APPROVE)
        )
        if can_access_subordinates:
            # Supervisor: can see subordinates' goals
            subordinate_ids = await RBACHelper._get_subordinate_user_ids(
                current_user_context.user_id, self.user_repo, current_user_context.organization_id
            )
            accessible_ids.extend(subordinate_ids)

        # Deduplicate while preserving order
        seen = set()
        deduped: list[UUID] = []
        for uid in accessible_ids:
            if uid and uid not in seen:
                seen.add(uid)
                deduped.append(uid)
        accessible_ids = deduped
        
        # If specific user requested, check if accessible
        if requested_user_id:
            if requested_user_id not in accessible_ids:
                raise PermissionDeniedError(f"You do not have permission to access goals for user {requested_user_id}")
            return [requested_user_id]
        
        return accessible_ids

    async def _validate_goal_creation(self, goal_data: GoalCreate, user_id: UUID, org_id: UUID):
        """Validate goal creation business rules."""
        # Check if evaluation period exists and is active
        period = await self.evaluation_period_repo.get_by_id(goal_data.period_id, org_id)
        if not period:
            raise BadRequestError(f"Evaluation period {goal_data.period_id} not found")

        # Check if competencies exist (for competency goals) - OPTIMIZED: batch validation
        if goal_data.goal_category == "コンピテンシー" and goal_data.competency_ids:
            # Batch validate all competencies in one query
            comp_map = await self.competency_repo.get_by_ids_batch(
                goal_data.competency_ids,
                org_id
            )

            # Check if any competency is missing
            missing = [cid for cid in goal_data.competency_ids if cid not in comp_map]
            if missing:
                raise BadRequestError(f"Competencies not found: {missing}")

    async def _validate_goal_update(self, goal_data: GoalUpdate, existing_goal: GoalModel, org_id: UUID):
        """Validate goal update business rules."""
        # Check if competencies exist (for competency goals) - OPTIMIZED: batch validation
        if isinstance(goal_data, CompetencyGoalUpdate) and goal_data.competency_ids:
            # Batch validate all competencies in one query
            comp_map = await self.competency_repo.get_by_ids_batch(
                goal_data.competency_ids,
                org_id
            )

            # Check if any competency is missing
            missing = [cid for cid in goal_data.competency_ids if cid not in comp_map]
            if missing:
                raise BadRequestError(f"Competencies not found: {missing}")

    async def _validate_weight_limits(
        self,
        user_id: UUID,
        period_id: UUID,
        goal_category: str,
        new_weight: float,
        org_id: UUID,
        exclude_goal_id: Optional[UUID] = None
    ):
        """Validate that total weight doesn't exceed 100% per category."""
        # Get current weight totals by category
        weight_totals = await self.goal_repo.get_weight_totals_by_category(
            user_id, period_id, org_id, exclude_goal_id
        )
        
        current_total = weight_totals.get(goal_category, Decimal('0'))
        new_total = current_total + Decimal(str(new_weight))
        
        if new_total > Decimal('100'):
            raise ValidationError(
                f"Total weight for {goal_category} would exceed 100%. "
                f"Current: {current_total}%, Adding: {new_weight}%, Total: {new_total}%"
            )

    async def _validate_total_weight_before_submission(
        self,
        user_id: UUID,
        period_id: UUID,
        org_id: UUID
    ):
        """Validate that performance goals total exactly 100% before submission."""
        # Get current weight totals by category for all goals
        weight_totals = await self.goal_repo.get_weight_totals_by_category(
            user_id, period_id, org_id
        )

        # Check performance goals total 100%
        performance_total = weight_totals.get('業績目標', Decimal('0'))
        if performance_total != Decimal('100'):
            raise ValidationError(
                f"業績目標の合計ウェイトは100%である必要があります。現在の合計: {performance_total}%"
            )

    async def _get_stage_budget_for_user(self, user_id: UUID, org_id: str) -> Dict[str, Decimal]:
        """Fetch stage configuration for the user and convert to Decimal budgets."""
        user_stage = await self.user_repo.get_user_stage_with_weights(user_id, org_id)
        if not user_stage:
            raise BadRequestError("ユーザー情報を取得できませんでした。")
        if not user_stage.get("stage_id"):
            raise BadRequestError("ステージ未設定のため重みを登録できません。管理者にお問い合わせください。")

        def to_decimal(value: Optional[float]) -> Decimal:
            return Decimal(str(value if value is not None else 0))

        return {
            "stage_id": user_stage["stage_id"],
            "quantitative": to_decimal(user_stage.get("quantitative_weight")),
            "qualitative": to_decimal(user_stage.get("qualitative_weight")),
            "competency": to_decimal(user_stage.get("competency_weight")),
        }

    async def _validate_stage_weight_budget(
        self,
        user_id: UUID,
        period_id: UUID,
        org_id: str,
        stage_budget: Dict[str, Decimal],
        goal_category: str,
        goal_weight: float,
        performance_goal_type: Optional[str] = None,
        exclude_goal_id: Optional[UUID] = None
    ):
        """Ensure new/updated goal keeps totals within stage budget."""
        bucket = self._determine_weight_bucket(goal_category, performance_goal_type)
        if not bucket:
            return

        goal_weight_decimal = Decimal(str(goal_weight or 0))
        current_totals = await self.goal_repo.get_weight_totals_by_budget_bucket(
            user_id=user_id,
            period_id=period_id,
            org_id=org_id,
            exclude_goal_id=exclude_goal_id
        )

        new_total = current_totals.get(bucket, Decimal('0')) + goal_weight_decimal
        budget_limit = stage_budget.get(bucket)
        if budget_limit is None:
            return

        if new_total > budget_limit:
            label = self._bucket_label(bucket)
            raise ValidationError(
                f"{label}の合計ウェイトは{float(budget_limit)}%以内で設定してください。現在: {float(new_total)}%"
            )

    def _determine_weight_bucket(
        self,
        goal_category: str,
        performance_goal_type: Optional[str]
    ) -> Optional[str]:
        """Map goal category/type to stage budget bucket."""
        if goal_category == "業績目標":
            normalized_type = (performance_goal_type or "").lower()
            if normalized_type in ("quantitative", "定量目標"):
                return "quantitative"
            return "qualitative"
        if goal_category in ("コンピテンシー", "コアバリュー"):
            return "competency"
        return None

    def _bucket_label(self, bucket: str) -> str:
        return {
            "quantitative": "定量目標",
            "qualitative": "定性目標",
            "competency": "コンピテンシー/コアバリュー",
        }.get(bucket, bucket)

    async def _get_rejection_history(
        self,
        goal_id: UUID,
        org_id: str,
        max_depth: int = 10
    ) -> List:
        """
        Fetch complete rejection history by following previousGoalId chain.

        DEPRECATED: This method is kept for backward compatibility only.
        New code should use _get_rejection_histories_batch() for better performance.
        This method performs N+1 queries (2 queries per rejection level).

        Performance comparison:
        - This method: N goals × M depth × 2 queries = O(N*M) queries
        - Batch method: 2-3 queries total regardless of N or M

        This uses a Python loop which is simpler than SQL recursive CTE
        and sufficient for typical rejection depths (1-3 levels).

        Args:
            goal_id: Starting goal ID (the previousGoalId to start from)
            org_id: Organization ID for scoping
            max_depth: Maximum depth to prevent infinite loops

        Returns:
            List of SupervisorReview in chronological order (oldest first)
        """
        history = []
        current_id = goal_id
        visited = set()

        while current_id and len(visited) < max_depth:
            # Prevent infinite loops
            if current_id in visited:
                logger.warning(f"Circular reference detected in rejection history at goal {current_id}")
                break
            visited.add(current_id)

            # Fetch the rejection review for the current goal (the rejected goal)
            review = await self.supervisor_review_repo.get_rejection_review_by_goal(
                current_id,
                org_id
            )

            if review:
                # Add review to history (prepend for chronological order)
                history.insert(0, review)

            # Fetch the goal to get its previousGoalId to continue the chain
            goal = await self.goal_repo.get_goal_by_id(current_id, org_id)
            if not goal or not goal.previous_goal_id:
                break

            # Move to the previous goal in the chain
            current_id = goal.previous_goal_id

        logger.info(f"Fetched {len(history)} rejection reviews for goal chain starting at {goal_id}")
        return history

    async def _get_rejection_histories_batch(
        self,
        goals: List[GoalModel],
        org_id: str,
        max_depth: int = 10
    ) -> dict[UUID, List]:
        """
        Batch fetch rejection histories for multiple goals efficiently.
        This eliminates N+1 queries by processing all goals at once.

        Args:
            goals: List of GoalModel objects to fetch rejection histories for
            org_id: Organization ID for scoping
            max_depth: Maximum depth to prevent infinite loops

        Returns:
            Dictionary mapping goal.previous_goal_id to rejection history list
        """
        # Collect all previousGoalIds that need rejection history
        previous_goal_ids = {goal.previous_goal_id for goal in goals if goal.previous_goal_id}

        if not previous_goal_ids:
            return {}

        # First, collect ALL goal IDs in all chains by following previous_goal_id links
        all_goal_ids = set(previous_goal_ids)
        current_level = set(previous_goal_ids)
        all_goals_map = {}

        for depth in range(max_depth):
            if not current_level:
                break

            # Batch fetch goals for this level
            goals_batch = await self.goal_repo.get_goals_by_ids_batch(
                list(current_level), org_id
            )
            all_goals_map.update(goals_batch)

            # Find next level (all previous_goal_ids from current level)
            next_level = set()
            for goal_id in current_level:
                goal = goals_batch.get(goal_id)
                if goal and goal.previous_goal_id and goal.previous_goal_id not in all_goal_ids:
                    next_level.add(goal.previous_goal_id)
                    all_goal_ids.add(goal.previous_goal_id)

            current_level = next_level

        # Now batch fetch ALL rejection reviews at once
        reviews_batch = await self.supervisor_review_repo.get_rejection_reviews_batch(
            list(all_goal_ids), org_id
        )

        # Build the history for each original previous_goal_id by following the chain
        histories_map: dict[UUID, List] = {}

        for start_goal_id in previous_goal_ids:
            history = []
            current_id = start_goal_id
            visited = set()

            # Follow the chain and collect reviews
            while current_id and len(visited) < max_depth:
                if current_id in visited:
                    logger.warning(f"Circular reference detected in rejection history at goal {current_id}")
                    break
                visited.add(current_id)

                # Get the rejection review for this goal (already fetched in batch)
                review = reviews_batch.get(current_id)
                if review:
                    # Prepend to maintain chronological order (oldest first)
                    history.insert(0, review)

                # Get the goal to continue the chain (already fetched in batch)
                goal = all_goals_map.get(current_id)
                if not goal or not goal.previous_goal_id:
                    break

                # Move to the previous goal in the chain
                current_id = goal.previous_goal_id

            if history:
                histories_map[start_goal_id] = history

        logger.info(f"Batch fetched rejection histories for {len(previous_goal_ids)} goal chains")
        return histories_map

    async def _build_competency_name_map_for_goal(
        self,
        goal_model: GoalModel,
        org_id: str
    ) -> dict[str, str]:
        """
        Extract competency IDs from a single goal and batch fetch their names.
        This prevents N+1 queries in the fallback path of _enrich_goal_data.

        Args:
            goal_model: Goal model to extract competency_ids from
            org_id: Organization ID for scoping

        Returns:
            dict[str, str]: Map of competency_id (as string) to competency name
        """
        try:
            from uuid import UUID as _UUID

            competency_ids: set[UUID] = set()

            # Extract competency_ids from target_data for competency goals
            if (
                goal_model.goal_category == "コンピテンシー"
                and goal_model.target_data
                and isinstance(goal_model.target_data, dict)
                and goal_model.target_data.get("competency_ids")
            ):
                ids = goal_model.target_data.get("competency_ids", []) or []
                for cid in ids:
                    try:
                        competency_ids.add(_UUID(str(cid)))
                    except (ValueError, TypeError):
                        logger.warning(f"Invalid competency_id format in goal {goal_model.id}: {cid}")

            # Batch fetch competencies if any IDs found
            if competency_ids:
                comp_map = await self.competency_repo.get_by_ids_batch(list(competency_ids), org_id)
                return {str(cid): comp.name for cid, comp in comp_map.items() if comp}

            return {}

        except Exception as e:
            logger.warning(f"Failed to build competency name map for goal {goal_model.id}: {e}")
            return {}

    async def _enrich_goal_data(
        self,
        goal_model: GoalModel,
        include_reviews: bool = False,
        include_rejection_history: bool = False,
        reviews_map: dict = None,
        rejection_histories_map: dict = None,
        org_id: str = None,
        *,
        competency_name_map: dict[str, str] | None = None,
        competency_description_map: dict[str, dict[str, str]] | None = None,
    ) -> Goal:
        """
        Convert GoalModel to Goal response schema with enriched data.

        Performance optimization:
        - When include_reviews=True, embeds supervisor_review from reviews_map
        - When include_rejection_history=True, fetches rejection history chain
        """
        # Base goal data
        goal_dict = {
            "id": goal_model.id,
            "user_id": goal_model.user_id,
            "period_id": goal_model.period_id,
            "goal_category": goal_model.goal_category,
            "weight": float(goal_model.weight) if goal_model.weight else 0.0,
            "status": goal_model.status,
            "approved_by": goal_model.approved_by,
            "approved_at": goal_model.approved_at,
            "previous_goal_id": goal_model.previous_goal_id,
            "created_at": goal_model.created_at,
            "updated_at": goal_model.updated_at
        }
        
        # Add target_data fields directly (simplified)
        if goal_model.target_data:
            goal_dict.update(goal_model.target_data)

        # Add competency name lookup for competency goals
        if (
            goal_model.goal_category == "コンピテンシー"
            and goal_model.target_data
            and goal_model.target_data.get("competency_ids")
        ):
            try:
                competency_names: dict[str, str] = {}
                ids = goal_model.target_data.get("competency_ids", []) or []

                if competency_name_map is not None:
                    # Prefer batched map if provided for performance
                    for cid in ids:
                        name = competency_name_map.get(str(cid))
                        if name:
                            competency_names[str(cid)] = name
                elif org_id:
                    # Fallback: individual lookups (should be rare)
                    for cid in ids:
                        comp = await self.competency_repo.get_by_id(cid, org_id)
                        if comp:
                            competency_names[str(cid)] = comp.name

                if competency_names:
                    goal_dict["competency_names"] = competency_names
            except Exception as e:
                logger.warning(f"Failed to resolve competency names for goal {goal_model.id}: {str(e)}")
                # Continue without competency names if lookup fails

        # Add resolved ideal action texts for competency goals (avoids client-side N+1 fetches)
        if (
            goal_model.goal_category == "コンピテンシー"
            and goal_model.target_data
            and isinstance(goal_model.target_data, dict)
            and goal_model.target_data.get("selected_ideal_actions")
        ):
            try:
                selected = goal_model.target_data.get("selected_ideal_actions") or {}
                if isinstance(selected, dict) and selected:
                    ideal_action_texts: dict[str, list[str]] = {}

                    for competency_key, action_ids in selected.items():
                        if not isinstance(action_ids, list):
                            continue

                        comp_id_str = str(competency_key)
                        desc_map = None
                        if competency_description_map is not None:
                            desc_map = competency_description_map.get(comp_id_str)

                        resolved: list[str] = []
                        if isinstance(desc_map, dict):
                            for action_id in action_ids:
                                text = desc_map.get(str(action_id))
                                if text:
                                    resolved.append(text)

                        if not resolved:
                            resolved = [f"行動 {str(action_id)}" for action_id in action_ids]

                        ideal_action_texts[comp_id_str] = resolved

                    if ideal_action_texts:
                        goal_dict["ideal_action_texts"] = ideal_action_texts
            except Exception as e:
                logger.warning(f"Failed to resolve ideal action texts for goal {goal_model.id}: {str(e)}")

        # Performance optimization: Embed supervisor review if requested
        if include_reviews and reviews_map is not None:
            review = reviews_map.get(goal_model.id)
            if review:
                # Convert SupervisorReview to dict using model_dump for proper serialization
                from ..schemas.supervisor_review import SupervisorReviewInDB
                goal_dict["supervisor_review"] = SupervisorReviewInDB.model_validate(review).model_dump(by_alias=True)

        # Performance optimization: Embed rejection history if requested
        if include_rejection_history and goal_model.previous_goal_id:
            # Use pre-fetched map if available (batch optimization)
            if rejection_histories_map is not None:
                rejection_history = rejection_histories_map.get(goal_model.previous_goal_id, [])
            # Fallback to individual query if map not provided (backward compatibility)
            elif org_id:
                rejection_history = await self._get_rejection_history(
                    goal_id=goal_model.previous_goal_id,
                    org_id=org_id
                )
            else:
                rejection_history = []

            if rejection_history:
                # Convert each review to dict using model_dump
                from ..schemas.supervisor_review import SupervisorReviewInDB
                goal_dict["rejection_history"] = [
                    SupervisorReviewInDB.model_validate(review).model_dump(by_alias=True)
                    for review in rejection_history
                ]

        return Goal(**goal_dict)

    async def _enrich_goal_detail_data(self, goal_model: GoalModel) -> GoalDetail:
        """Convert GoalModel to GoalDetail response schema with essential enriched data."""
        # Start with basic goal data
        base_goal = await self._enrich_goal_data(goal_model)
        detail_dict = base_goal.model_dump()
        
        # Add essential detail fields only
        detail_dict.update({
            "has_self_assessment": False,  # Placeholder for future assessment integration
            "has_supervisor_feedback": False,  # Placeholder for future feedback integration
            "is_editable": goal_model.status == GoalStatus.DRAFT.value,
            "is_assessment_open": False,  # Placeholder for future period status check
            "is_overdue": False,  # Placeholder for future deadline check
        })
        
        # Days since submission for pending goals
        if goal_model.created_at and goal_model.status == GoalStatus.SUBMITTED.value:
            days_since = (datetime.utcnow() - goal_model.created_at).days
            detail_dict["days_since_submission"] = days_since
        
        return GoalDetail(**detail_dict)

    async def _create_related_assessment_records(self, goal: GoalModel, org_id: str) -> None:
        """
        Create related supervisor review records when goal is submitted.

        This method creates a single draft supervisor review for the (current) supervisor of the goal owner.
        If no supervisors are found, logs a warning but continues (not an error condition).
        If creation fails, logs the error but does not raise to avoid breaking goal submission.

        Args:
            goal: The goal model for which to create supervisor reviews
            org_id: Organization ID for scoping
        """
        try:
            supervisors = await self.user_repo.get_user_supervisors(goal.user_id, org_id)

            if not supervisors:
                logger.warning(
                    f"No supervisors found for goal {goal.id} (user {goal.user_id}). "
                    "Supervisor review records will not be created."
                )
                return

            if len(supervisors) > 1:
                logger.warning(
                    "Multiple current supervisors found for user %s in org %s when submitting goal %s; "
                    "creating a single supervisor review using the first supervisor: %s",
                    goal.user_id,
                    org_id,
                    goal.id,
                    supervisors[0].id,
                )

            supervisor = supervisors[0]
            logger.info("Creating supervisor_review record for goal %s (supervisor %s)", goal.id, supervisor.id)

            await self.supervisor_review_repo.create(
                goal_id=goal.id,
                period_id=goal.period_id,
                supervisor_id=supervisor.id,
                subordinate_id=goal.user_id,
                org_id=org_id,
                action="PENDING",
                comment=None,
                status="draft",
            )

        except Exception as e:
            logger.error(
                f"Failed to create supervisor review records for goal {goal.id}: {e}. "
                "Goal submission will continue, but manual review creation may be needed."
            )
            # Don't raise exception to avoid breaking goal submission flow
