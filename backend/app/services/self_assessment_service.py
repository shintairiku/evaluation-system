from __future__ import annotations
import logging
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime, timezone
from cachetools import TTLCache

from ..database.repositories.self_assessment_repo import SelfAssessmentRepository
from ..database.repositories.goal_repo import GoalRepository
from ..database.repositories.user_repo import UserRepository
from ..database.repositories.evaluation_period_repo import EvaluationPeriodRepository
from ..database.repositories.supervisor_feedback_repo import SupervisorFeedbackRepository
from ..database.repositories.score_mapping_repo import ScoreMappingRepository
from ..database.repositories.self_assessment_summary_repo import SelfAssessmentSummaryRepository
from ..database.repositories.stage_repo import StageRepository
from ..services.scoring_service import ScoringService
from ..database.models.evaluation_score import SelfAssessmentSummary as SelfAssessmentSummaryModel
from ..database.models.self_assessment import SelfAssessment as SelfAssessmentModel
from ..schemas.self_assessment import (
    SelfAssessmentCreate, SelfAssessmentUpdate, SelfAssessment, SelfAssessmentDetail
)
from ..schemas.supervisor_feedback import SupervisorFeedbackCreate
from ..schemas.common import PaginationParams, PaginatedResponse, SubmissionStatus
from ..schemas.self_assessment_summary import StageWeights
from ..security.context import AuthContext
from ..security.permissions import Permission
from ..security.rbac_helper import RBACHelper
from ..security.rbac_types import ResourceType
from ..security.decorators import require_permission
from ..core.exceptions import (
    NotFoundError, PermissionDeniedError, BadRequestError, ValidationError
)
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# Cache for self-assessment search results (50 items, 5-minute TTL aligned with other services)
self_assessment_search_cache = TTLCache(maxsize=50, ttl=300)


class SelfAssessmentService:
    """Service layer for self-assessment-related business logic and operations"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.self_assessment_repo = SelfAssessmentRepository(session)
        self.goal_repo = GoalRepository(session)
        self.user_repo = UserRepository(session)
        self.evaluation_period_repo = EvaluationPeriodRepository(session)
        self.supervisor_feedback_repo = SupervisorFeedbackRepository(session)
        self.summary_repo = SelfAssessmentSummaryRepository(session)
        self.stage_repo = StageRepository(session)
        self.score_repo = ScoreMappingRepository(session)
        self.scoring_service = ScoringService(session)
        
        # Initialize RBAC Helper with user repository for subordinate queries
        RBACHelper.initialize_with_repository(self.user_repo)
    
    async def get_assessments(
        self,
        current_user_context: AuthContext,
        user_id: Optional[UUID] = None,
        period_id: Optional[UUID] = None,
        status: Optional[str] = None,
        pagination: Optional[PaginationParams] = None
    ) -> PaginatedResponse[SelfAssessment]:
        """
        Get self-assessments based on current user's permissions and filters.
        
        Access rules:
        - Employees: can only view their own assessments
        - Supervisors: can view their subordinates' assessments + their own
        - Admins: can view all assessments
        """
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")
        
        try:
            # Determine which users' assessments the current user can access
            accessible_user_ids = await self._get_accessible_assessment_user_ids(
                current_user_context, user_id
            )
            
            # Search assessments with filters
            assessments = await self.self_assessment_repo.search_assessments(
                org_id=org_id,
                user_ids=accessible_user_ids,
                period_id=period_id,
                status=status,
                pagination=pagination
            )
            
            # Get total count for pagination
            total_count = await self.self_assessment_repo.count_assessments(
                org_id=org_id,
                user_ids=accessible_user_ids,
                period_id=period_id,
                status=status
            )
            
            # Convert to response format
            enriched_assessments = []
            for assessment_model in assessments:
                enriched_assessment = await self._enrich_assessment_data(assessment_model)
                enriched_assessments.append(enriched_assessment)
            
            # Create paginated response
            if pagination:
                total_pages = (total_count + pagination.limit - 1) // pagination.limit
            else:
                total_pages = 1
            
            return PaginatedResponse(
                items=enriched_assessments,
                total=total_count,
                page=pagination.page if pagination else 1,
                limit=pagination.limit if pagination else len(enriched_assessments),
                pages=total_pages
            )
            
        except Exception as e:
            logger.error(f"Error in get_assessments: {e}")
            raise

    async def get_current_context(self, current_user_context: AuthContext):
        return await self.get_self_assessment_context(current_user_context)

    async def get_self_assessment_context(
        self,
        current_user_context: AuthContext,
        user_id: Optional[UUID] = None,
        period_id: Optional[UUID] = None,
    ):
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")
        target_user_id = user_id or current_user_context.user_id
        await self._assert_user_access(current_user_context, target_user_id)

        if period_id:
            period = await self.evaluation_period_repo.get_by_id(period_id, org_id)
            if not period:
                raise NotFoundError("Evaluation period not found")
        else:
            period = await self.evaluation_period_repo.get_active_period(org_id)
            if not period:
                raise NotFoundError("No active evaluation period found")

        goals = await self.goal_repo.get_latest_approved_goals_for_user_period(target_user_id, org_id, period.id)
        stage_weights = await self._get_stage_weights(current_user_context, target_user_id)
        stage_weights_model = StageWeights(**stage_weights)
        thresholds = await self._get_thresholds(org_id)

        draft_entries = []
        for goal in goals:
            assessment = await self.self_assessment_repo.get_by_goal(goal.id, org_id)
            draft_entries.append({
                "goalId": goal.id,
                "bucket": goal.goal_category,
                "ratingCode": assessment.self_rating_text if assessment else None,
                "comment": assessment.self_comment if assessment else None,
            })

        summary = None
        existing_summary = await self.summary_repo.get_summary(org_id, target_user_id, period.id)
        if existing_summary:
            summary = {
                "stageWeights": stage_weights,
                "perBucket": existing_summary.per_bucket,
                "weightedTotal": float(existing_summary.weighted_total),
                "finalRating": existing_summary.final_rating_code,
                "flags": existing_summary.flags,
                "levelAdjustmentPreview": existing_summary.level_adjustment_preview,
                "submittedAt": existing_summary.submitted_at,
            }

        return {
            "goals": [
                {
                    "id": g.id,
                    "goalCategory": g.goal_category,
                    "periodId": g.period_id,
                    "status": g.status,
                    "weight": float(g.weight) if hasattr(g, "weight") and g.weight is not None else None,
                    "targetData": g.target_data if hasattr(g, "target_data") else None,
                }
                for g in goals
            ],
            "draft": draft_entries,
            "stageWeights": stage_weights_model,
            "thresholds": thresholds,
            "summary": summary,
        }

    async def save_draft(self, current_user_context: AuthContext, draft_entries: List[dict]):
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")
        now = datetime.now(timezone.utc)

        for entry in draft_entries:
            goal_id = UUID(str(entry.get("goalId")))
            rating_code = entry.get("ratingCode")
            comment = entry.get("comment")
            rating_numeric = None
            if rating_code:
                rating_numeric = await self.scoring_service.get_score_for_rating(org_id, rating_code)
            await self.self_assessment_repo.upsert_draft(
                goal_id=goal_id,
                org_id=org_id,
                self_rating_text=rating_code,
                self_rating_numeric=rating_numeric,
                self_comment=comment,
            )
        await self.session.commit()
        return now

    async def submit(self, current_user_context: AuthContext, draft_entries: List[dict]):
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")
        user_id = current_user_context.user_id
        active_period = await self.evaluation_period_repo.get_active_period(org_id)
        if not active_period:
            raise NotFoundError("No active evaluation period found")

        stage_weights = await self._get_stage_weights(current_user_context)

        # Ensure all goals for the period are approved before allowing submission
        all_period_goals = await self.goal_repo.get_goals_by_user_and_period(
            user_id,
            org_id,
            active_period.id
        )
        not_approved = [
            goal for goal in all_period_goals
            if (goal.status or "").lower() != "approved"
        ]
        if not_approved:
            raise ValidationError(
                "All goals must be approved before submitting a self-assessment. "
                f"Pending: {len(not_approved)} goal(s)."
            )

        # Persist draft first
        await self.save_draft(current_user_context, draft_entries)

        bucket_ratings: Dict[str, List[str]] = {}
        goal_ids = []
        for entry in draft_entries:
            bucket = entry.get("bucket")
            rating_code = entry.get("ratingCode")
            goal_id = UUID(str(entry.get("goalId")))
            goal_ids.append(goal_id)
            if bucket and rating_code:
                bucket_ratings.setdefault(bucket, []).append(rating_code)

        # Validate required buckets (weight > 0) have ratings
        for bucket, weight in stage_weights.items():
            if float(weight or 0) > 0 and not bucket_ratings.get(bucket):
                raise ValidationError(f"Missing ratings for bucket {bucket} with weight {weight}")

        summary = await self.scoring_service.compute_summary(org_id, bucket_ratings, stage_weights)
        per_bucket = summary["per_bucket"]
        weighted_total = summary["weighted_total"]
        final_rating = summary["final_rating"]
        flags = summary["flags"]
        level_preview = summary["level_adjustment_preview"]

        per_bucket_payload = [
            {
                "bucket": b["bucket"],
                "weight": b["weight"],
                "avg_score": float(b["avg_score"]),
                "contribution": float(b["contribution"]),
            }
            for b in per_bucket
        ]

        summary_model = SelfAssessmentSummaryModel(
            organization_id=org_id,
            user_id=user_id,
            period_id=active_period.id,
            stage_id=await self._get_stage_id(current_user_context, user_id),
            stage_weights=stage_weights,
            per_bucket=per_bucket_payload,
            weighted_total=weighted_total,
            final_rating_code=final_rating,
            flags=flags,
            level_adjustment_preview=level_preview,
            submitted_at=datetime.now(timezone.utc),
        )
        await self.summary_repo.upsert_summary(summary_model)
        await self.self_assessment_repo.submit_assessments_for_goals(goal_ids, org_id)
        await self.session.commit()

        return {
            "stageWeights": stage_weights,
            "perBucket": per_bucket_payload,
            "weightedTotal": float(weighted_total),
            "finalRating": final_rating,
            "flags": flags,
            "levelAdjustmentPreview": level_preview,
            "submittedAt": summary_model.submitted_at,
        }

    async def get_summary(self, current_user_context: AuthContext, period_id: UUID, user_id: Optional[UUID] = None):
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")
        target_user = user_id or current_user_context.user_id
        await self._assert_user_access(current_user_context, target_user)
        summary = await self.summary_repo.get_summary(org_id, target_user, period_id)
        if not summary:
            return None
        return {
            "stageWeights": summary.stage_weights,
            "perBucket": summary.per_bucket,
            "weightedTotal": float(summary.weighted_total),
            "finalRating": summary.final_rating_code,
            "flags": summary.flags,
            "levelAdjustmentPreview": summary.level_adjustment_preview,
            "submittedAt": summary.submitted_at,
        }

    async def _get_stage_weights(self, current_user_context: AuthContext, target_user_id: Optional[UUID] = None) -> Dict[str, float]:
        org_id = current_user_context.organization_id
        user = await self.user_repo.get_user_by_id(target_user_id or current_user_context.user_id, org_id)
        if not user or not user.stage_id:
            return {"quantitative": 0.0, "qualitative": 0.0, "competency": 0.0}
        stage = await self.stage_repo.get_by_id(user.stage_id, org_id)
        if not stage:
            return {"quantitative": 0.0, "qualitative": 0.0, "competency": 0.0}
        return {
            "quantitative": float(stage.quantitative_weight or 0),
            "qualitative": float(stage.qualitative_weight or 0),
            "competency": float(stage.competency_weight or 0),
        }

    async def _get_thresholds(self, org_id: str) -> List[Dict[str, Any]]:
        rows = await self.score_repo.list_thresholds(org_id)
        return [
            {
                "ratingCode": row.rating_code,
                "minScore": float(row.min_score),
                "note": row.note,
            }
            for row in rows
        ]

    async def _get_stage_id(self, current_user_context: AuthContext, target_user_id: Optional[UUID] = None) -> Optional[UUID]:
        if current_user_context.stage_id and (not target_user_id or target_user_id == current_user_context.user_id):
            return current_user_context.stage_id
        org_id = current_user_context.organization_id
        user = await self.user_repo.get_user_by_id(target_user_id or current_user_context.user_id, org_id)
        return user.stage_id if user else None

    async def _assert_user_access(self, current_user_context: AuthContext, target_user_id: UUID) -> None:
        if target_user_id == current_user_context.user_id:
            return
        if current_user_context.has_permission(Permission.ASSESSMENT_READ_ALL):
            return
        if current_user_context.has_permission(Permission.ASSESSMENT_READ_SUBORDINATES):
            subordinates = await RBACHelper._get_subordinate_user_ids(
                current_user_context.user_id,
                RBACHelper.get_user_repository(),
                current_user_context.organization_id,
            )
            if target_user_id in subordinates:
                return
        raise PermissionDeniedError("You do not have permission to access this assessment")

    async def get_assessments_by_period(
        self,
        period_id: UUID,
        current_user_context: AuthContext,
        user_id: Optional[UUID] = None,
        status: Optional[str] = None,
        pagination: Optional[PaginationParams] = None
    ) -> PaginatedResponse[SelfAssessment]:
        """Get self-assessments by evaluation period with optional filters."""
        return await self.get_assessments(
            current_user_context=current_user_context,
            user_id=user_id,
            period_id=period_id,
            status=status,
            pagination=pagination
        )

    async def get_assessment_for_goal(
        self,
        goal_id: UUID,
        current_user_context: AuthContext
    ) -> Optional[SelfAssessment]:
        """Get self-assessment for a specific goal."""
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")
        
        try:
            # Check if goal exists and user has access
            goal = await self.goal_repo.get_goal_by_id(goal_id, org_id)
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
                raise PermissionDeniedError("You do not have permission to access this goal's assessment")
            
            # Get assessment for goal
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")
            
            assessment = await self.self_assessment_repo.get_by_goal(goal_id, org_id)
            if not assessment:
                return None
            
            # Enrich with additional information
            enriched_assessment = await self._enrich_assessment_data(assessment)
            return enriched_assessment
            
        except Exception as e:
            logger.error(f"Error getting assessment for goal {goal_id}: {str(e)}")
            raise

    async def get_assessment_by_id(
        self,
        assessment_id: UUID,
        current_user_context: AuthContext
    ) -> SelfAssessmentDetail:
        """Get detailed self-assessment information by ID with permission checks."""
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")
        
        try:
            assessment = await self.self_assessment_repo.get_by_id_with_details(assessment_id, org_id)
            if not assessment:
                raise NotFoundError(f"Self-assessment with ID {assessment_id} not found")
            
            # Permission check using RBACHelper
            can_access = await RBACHelper.can_access_resource(
                auth_context=current_user_context,
                resource_id=assessment_id,
                resource_type=ResourceType.ASSESSMENT,
                owner_user_id=assessment.goal.user_id
            )
            if not can_access:
                raise PermissionDeniedError("You do not have permission to access this assessment")
            
            # Enrich with detailed information
            enriched_assessment = await self._enrich_assessment_detail_data(assessment, org_id)
            return enriched_assessment
            
        except Exception as e:
            logger.error(f"Error getting assessment {assessment_id}: {str(e)}")
            raise

    @require_permission(Permission.ASSESSMENT_MANAGE_SELF)
    async def create_assessment(
        self,
        goal_id: UUID,
        assessment_data: SelfAssessmentCreate,
        current_user_context: AuthContext
    ) -> SelfAssessment:
        """Create a new self-assessment with validation and business rules."""
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")
        
        try:
            # Check if goal exists and get goal details
            goal = await self.goal_repo.get_goal_by_id(goal_id, org_id)
            if not goal:
                raise NotFoundError(f"Goal with ID {goal_id} not found")
            
            # Permission check - only goal owner can create self-assessment (using RBACHelper)
            can_create = await RBACHelper.can_access_resource(
                auth_context=current_user_context,
                resource_id=goal_id,
                resource_type=ResourceType.GOAL,
                owner_user_id=goal.user_id
            )
            if not can_create:
                raise PermissionDeniedError("You can only create self-assessments for your own goals")
            
            # Business validation
            await self._validate_assessment_creation(goal, assessment_data, org_id)
            
            # Create assessment
            created_assessment = await self.self_assessment_repo.create_assessment(assessment_data, goal_id, org_id)
            
            # Commit transaction
            await self.session.commit()
            await self.session.refresh(created_assessment)
            
            # Enrich response data
            enriched_assessment = await self._enrich_assessment_data(created_assessment)
            
            logger.info(f"Self-assessment created successfully: {created_assessment.id}")
            return enriched_assessment
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error creating self-assessment for goal {goal_id}: {str(e)}")
            raise

    @require_permission(Permission.ASSESSMENT_MANAGE_SELF)
    async def update_assessment(
        self,
        assessment_id: UUID,
        assessment_data: SelfAssessmentUpdate,
        current_user_context: AuthContext
    ) -> SelfAssessment:
        """Update a self-assessment with validation and business rules."""
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")
        
        try:
            # Check if assessment exists
            existing_assessment = await self.self_assessment_repo.get_by_id_with_details(assessment_id, org_id)
            if not existing_assessment:
                raise NotFoundError(f"Self-assessment with ID {assessment_id} not found")
            
            # Permission check - only assessment owner can update
            can_update = await RBACHelper.can_access_resource(
                auth_context=current_user_context,
                resource_id=assessment_id,
                resource_type=ResourceType.ASSESSMENT,
                owner_user_id=existing_assessment.goal.user_id
            )
            if not can_update:
                raise PermissionDeniedError("You can only update your own assessments")
            
            # Business validation
            await self._validate_assessment_update(assessment_data, existing_assessment)
            
            # Update assessment
            updated_assessment = await self.self_assessment_repo.update_assessment(assessment_id, assessment_data, org_id)
            if not updated_assessment:
                raise NotFoundError(f"Self-assessment with ID {assessment_id} not found after update")
            
            # Commit transaction
            await self.session.commit()
            
            # Enrich response data
            enriched_assessment = await self._enrich_assessment_data(updated_assessment)
            
            logger.info(f"Self-assessment updated successfully: {assessment_id}")
            return enriched_assessment
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error updating assessment {assessment_id}: {str(e)}")
            raise

    @require_permission(Permission.ASSESSMENT_MANAGE_SELF)
    async def submit_assessment(
        self,
        assessment_id: UUID,
        current_user_context: AuthContext
    ) -> SelfAssessment:
        """Submit a self-assessment by changing status to submitted."""
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")
        
        try:
            # Check if assessment exists and user can update it
            existing_assessment = await self.self_assessment_repo.get_by_id_with_details(assessment_id, org_id)
            if not existing_assessment:
                raise NotFoundError(f"Self-assessment with ID {assessment_id} not found")
            
            # Permission check - only assessment owner can submit
            can_submit = await RBACHelper.can_access_resource(
                auth_context=current_user_context,
                resource_id=assessment_id,
                resource_type=ResourceType.ASSESSMENT,
                owner_user_id=existing_assessment.goal.user_id
            )
            if not can_submit:
                raise PermissionDeniedError("You can only submit your own assessments")
            
            # Business rule: can only submit draft assessments
            if existing_assessment.status != SubmissionStatus.DRAFT.value:
                raise BadRequestError("Can only submit draft assessments")
            
            # Validate required rating is provided for submission
            if existing_assessment.self_rating is None:
                raise ValidationError("Self-rating is required before submission")
            
            # Update status using dedicated method
            updated_assessment = await self.self_assessment_repo.submit_assessment(assessment_id, org_id)
            
            # CRITICAL: Auto-create SupervisorFeedback when self-assessment is submitted
            # This implements the trigger: SelfAssessments (submitted) → SupervisorFeedback auto-creation
            await self._auto_create_supervisor_feedback(updated_assessment, org_id)
            
            # Commit transaction
            await self.session.commit()
            
            # Enrich response data
            enriched_assessment = await self._enrich_assessment_data(updated_assessment)
            
            logger.info(f"Self-assessment submitted: {assessment_id} by {current_user_context.user_id}")
            return enriched_assessment
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error submitting assessment {assessment_id}: {str(e)}")
            raise

    @require_permission(Permission.ASSESSMENT_MANAGE_SELF)
    async def delete_assessment(
        self,
        assessment_id: UUID,
        current_user_context: AuthContext
    ) -> bool:
        """Delete a self-assessment with permission and business rule checks."""
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")
        
        try:
            # Check if assessment exists
            existing_assessment = await self.self_assessment_repo.get_by_id_with_details(assessment_id, org_id)
            if not existing_assessment:
                raise NotFoundError(f"Self-assessment with ID {assessment_id} not found")
            
            # Permission check - only assessment owner can delete
            can_delete = await RBACHelper.can_access_resource(
                auth_context=current_user_context,
                resource_id=assessment_id,
                resource_type=ResourceType.ASSESSMENT,
                owner_user_id=existing_assessment.goal.user_id
            )
            if not can_delete:
                raise PermissionDeniedError("You can only delete your own assessments")
            
            # Business rule: can only delete draft assessments
            if existing_assessment.status != SubmissionStatus.DRAFT.value:
                raise BadRequestError("Can only delete draft assessments")
            
            # Delete assessment
            success = await self.self_assessment_repo.delete_assessment(assessment_id, org_id)
            
            if success:
                await self.session.commit()
                logger.info(f"Self-assessment deleted successfully: {assessment_id}")
            
            return success
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error deleting assessment {assessment_id}: {str(e)}")
            raise

    # ========================================
    # PRIVATE HELPER METHODS
    # ========================================

    async def _get_accessible_assessment_user_ids(
        self,
        current_user_context: AuthContext,
        requested_user_id: Optional[UUID] = None
    ) -> Optional[List[UUID]]:
        """Determine which users' assessments the current user can access."""
        
        if current_user_context.has_permission(Permission.ASSESSMENT_READ_ALL):
            # Admin: can see all assessments
            if requested_user_id:
                return [requested_user_id]
            return None  # All users
        
        accessible_ids = []
        
        # Add self if user has ASSESSMENT_READ_SELF permission
        if current_user_context.has_permission(Permission.ASSESSMENT_READ_SELF):
            accessible_ids.append(current_user_context.user_id)
        
        if current_user_context.has_permission(Permission.ASSESSMENT_READ_SUBORDINATES):
            # Supervisor: can see subordinates' assessments
            subordinate_ids = await RBACHelper._get_subordinate_user_ids(
                current_user_context.user_id, self.user_repo, current_user_context.organization_id
            )
            accessible_ids.extend(subordinate_ids)
        
        # If specific user requested, check if accessible
        if requested_user_id:
            if requested_user_id not in accessible_ids:
                raise PermissionDeniedError(f"You do not have permission to access assessments for user {requested_user_id}")
            return [requested_user_id]
        
        return accessible_ids


    async def _validate_assessment_creation(self, goal, assessment_data: SelfAssessmentCreate, org_id: str):
        """Validate self-assessment creation business rules."""
        # Check if goal is approved (can only assess approved goals)
        if goal.status != "approved":
            raise BadRequestError("Can only create self-assessments for approved goals")
        
        # Check if evaluation period allows self-assessment
        period = await self.evaluation_period_repo.get_by_id(goal.period_id, org_id)
        if not period:
            raise BadRequestError(f"Evaluation period {goal.period_id} not found")
        
        # Additional period validation could go here (e.g., check if assessment period is open)

    async def _validate_assessment_update(self, assessment_data: SelfAssessmentUpdate, existing_assessment: SelfAssessmentModel):
        """Validate self-assessment update business rules."""
        # Validate rating requirements for submission
        if (assessment_data.status == SubmissionStatus.SUBMITTED and 
            assessment_data.self_rating is None and 
            existing_assessment.self_rating is None):
            raise ValidationError("Self-rating is required before submission")

    async def _enrich_assessment_data(self, assessment_model: SelfAssessmentModel) -> SelfAssessment:
        """Convert SelfAssessmentModel to SelfAssessment response schema with enriched data."""
        # Base assessment data
        assessment_dict = {
            "id": assessment_model.id,
            "goal_id": assessment_model.goal_id,
            "period_id": assessment_model.period_id,
            "self_rating": assessment_model.self_rating if assessment_model.self_rating is not None else None,
            "self_comment": assessment_model.self_comment,
            "status": SubmissionStatus(assessment_model.status),
            "submitted_at": assessment_model.submitted_at,
            "created_at": assessment_model.created_at,
            "updated_at": assessment_model.updated_at
        }
        
        return SelfAssessment(**assessment_dict)

    async def _enrich_assessment_detail_data(self, assessment_model: SelfAssessmentModel, org_id: str) -> SelfAssessmentDetail:
        """Convert SelfAssessmentModel to SelfAssessmentDetail response schema with enriched data."""
        # Start with basic assessment data
        base_assessment = await self._enrich_assessment_data(assessment_model)
        detail_dict = base_assessment.model_dump()
        
        # Get related goal for context
        goal = await self.goal_repo.get_goal_by_id(assessment_model.goal_id, org_id)
        
        # Add detail fields
        detail_dict.update({
            "is_editable": assessment_model.status == SubmissionStatus.DRAFT.value,
            "is_overdue": False,  # Placeholder for future deadline check
            "days_until_deadline": None,  # Placeholder for future deadline calculation
            "goal_category": goal.goal_category if goal else None,
            "goal_status": goal.status if goal else None,
        })
        
        return SelfAssessmentDetail(**detail_dict)
    
    async def _auto_create_supervisor_feedback(self, assessment: SelfAssessmentModel, org_id: str):
        """
        Auto-create SupervisorFeedback when self-assessment is submitted.
        
        Implements strategy document requirement:
        'SelfAssessments (submitted) → SupervisorFeedback auto-creation'
        """
        try:
            # Check if feedback already exists (avoid duplicates)
            existing_feedback = await self.supervisor_feedback_repo.get_by_self_assessment(assessment.id, org_id)
            if existing_feedback:
                logger.info(f"SupervisorFeedback already exists for assessment {assessment.id}, skipping auto-creation")
                return
            
            # Get the goal to find the employee's supervisor
            goal = await self.goal_repo.get_goal_by_id(assessment.goal_id, org_id)
            if not goal:
                logger.error(f"Cannot auto-create feedback: Goal {assessment.goal_id} not found")
                return
            
            # Get employee's current supervisor(s)
            supervisors = await self.user_repo.get_supervisors(goal.user_id)
            if not supervisors:
                logger.warning(f"Cannot auto-create feedback: No supervisors found for user {goal.user_id}")
                return
            
            # Use the primary supervisor (first in list)
            primary_supervisor = supervisors[0]
            
            # Create draft supervisor feedback
            feedback_create = SupervisorFeedbackCreate(
                self_assessment_id=assessment.id,
                period_id=assessment.period_id,
                rating=None,  # Will be set based on goal category rules
                comment=None,  # Empty initially
                status=SubmissionStatus.DRAFT  # Start as draft
            )
            
            # Create the feedback
            created_feedback = await self.supervisor_feedback_repo.create_feedback(
                feedback_create, 
                primary_supervisor.id
            )
            
            logger.info(f"Auto-created SupervisorFeedback {created_feedback.id} for assessment {assessment.id} assigned to supervisor {primary_supervisor.id}")
            
        except Exception as e:
            logger.error(f"Error auto-creating supervisor feedback for assessment {assessment.id}: {str(e)}")
            # Don't re-raise - we don't want auto-creation failure to block assessment submission
            # This follows the pattern from goal_service.py: "Do not rollback goal submission due to review auto-creation failure"
