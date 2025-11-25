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

    @staticmethod
    def _get(entry, *keys):
        """
        Helper function to get values from dict or pydantic objects.
        Tries multiple keys (e.g., camelCase and snake_case variants) and returns the first found value.

        Args:
            entry: Dictionary or object to extract value from
            *keys: One or more key names to try (in order of preference)

        Returns:
            The value of the first matching key, or None if no keys match
        """
        if isinstance(entry, dict):
            for key in keys:
                if key in entry:
                    return entry.get(key)
            return None
        for key in keys:
            if hasattr(entry, key):
                return getattr(entry, key)
        return None

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
        latest_feedback = await self.supervisor_feedback_repo.get_by_user_and_period(
            target_user_id, period.id, org_id
        )
        supervisor_comment_map = self._build_bucket_comment_map(latest_feedback)
        supervisor_rating_map = self._build_bucket_rating_map(latest_feedback)

        draft_entries = []
        for goal in goals:
            assessment = await self.self_assessment_repo.get_by_goal(goal.id, org_id)
            bucket_key = self._map_goal_category_to_bucket(goal.goal_category)
            supervisor_comment = supervisor_comment_map.get(bucket_key) if bucket_key else None
            supervisor_rating = supervisor_rating_map.get(bucket_key) if bucket_key else None
            draft_entries.append({
                "goalId": goal.id,
                "bucket": goal.goal_category,
                "ratingCode": assessment.self_rating_text if assessment else None,
                "comment": assessment.self_comment if assessment else None,
                "previousSelfAssessmentId": assessment.previous_self_assessment_id if assessment else None,
                "supervisorComment": supervisor_comment,
                "supervisorRating": supervisor_rating
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

        # Determine review status from supervisor feedback
        review_status = None
        if latest_feedback:
            # Map supervisor_feedback status to review status
            # 'draft' or 'submitted' -> 'pending' (awaiting supervisor decision)
            # 'approved' -> 'approved'
            # 'rejected' -> 'rejected'
            # Note: When rejected, summary is deleted, so we check feedback even without summary
            if latest_feedback.status in ['draft', 'submitted']:
                review_status = 'pending'
            elif latest_feedback.status == 'approved':
                review_status = 'approved'
            elif latest_feedback.status == 'rejected':
                review_status = 'rejected'

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
            "reviewStatus": review_status,
        }

    async def save_draft(self, current_user_context: AuthContext, draft_entries: List[dict]):
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")
        now = datetime.now(timezone.utc)

        for entry in draft_entries:
            goal_id_raw = self._get(entry, "goalId", "goal_id")
            rating_code = self._get(entry, "ratingCode", "rating_code")
            comment = self._get(entry, "comment")
            if not goal_id_raw:
                raise ValidationError("goalId is required in draft entry")
            goal_id = UUID(str(goal_id_raw))
            await self.self_assessment_repo.upsert_draft(
                goal_id=goal_id,
                org_id=org_id,
                self_rating_text=rating_code,
                self_rating_numeric=None,  # keep numeric empty to avoid 1-5 constraint mismatches
                self_comment=comment,
            )
        await self.session.commit()
        return now

    async def submit(self, current_user_context: AuthContext, draft_entries: List[dict]):
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")
        user_id = current_user_context.user_id

        # Get period_id from the first goal's self-assessment instead of using active period
        if not draft_entries:
            raise ValidationError("No draft entries provided")

        first_goal_id = None
        for entry in draft_entries:
            goal_id_raw = self._get(entry, "goalId", "goal_id")
            if goal_id_raw:
                first_goal_id = UUID(str(goal_id_raw))
                break

        if not first_goal_id:
            raise ValidationError("No valid goal ID found in draft entries")

        # Get the goal to retrieve its period_id
        first_goal = await self.goal_repo.get_goal_by_id(first_goal_id, org_id)
        if not first_goal:
            raise NotFoundError(f"Goal {first_goal_id} not found")

        target_period_id = first_goal.period_id
        if not target_period_id:
            raise ValidationError("Goal does not have a period_id")

        stage_weights = await self._get_stage_weights(current_user_context)

        # Ensure all goals for the period are approved before allowing submission
        all_period_goals = await self.goal_repo.get_goals_by_user_and_period(
            user_id,
            org_id,
            target_period_id
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

        def map_bucket_keys(raw_bucket: Optional[str]) -> List[str]:
            """Normalize incoming bucket labels to scoring keys."""
            if not raw_bucket:
                return []
            bucket = raw_bucket.lower()
            keys = []
            if "業績" in raw_bucket:
                # map performance to both quantitative and qualitative buckets
                keys.extend(["quantitative", "qualitative"])
            if "コンピテンシー" in raw_bucket or "competency" in bucket:
                keys.append("competency")
            # Fallback: keep the raw key to avoid dropping data
            if not keys:
                keys.append(raw_bucket)
            return keys

        bucket_ratings: Dict[str, List[str]] = {}
        goal_ids = []
        for entry in draft_entries:
            bucket = self._get(entry, "bucket")
            rating_code = self._get(entry, "ratingCode", "rating_code")
            goal_id_raw = self._get(entry, "goalId", "goal_id")
            if not goal_id_raw:
                raise ValidationError("goalId is required in draft entry")
            goal_id = UUID(str(goal_id_raw))
            goal_ids.append(goal_id)
            for key in map_bucket_keys(bucket):
                if rating_code:
                    bucket_ratings.setdefault(key, []).append(rating_code)

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
            period_id=target_period_id,
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

        # Auto-create supervisor feedback for bucket-based review
        await self._auto_create_supervisor_feedback_for_summary(
            user_id=user_id,
            period_id=target_period_id,
            org_id=org_id,
            summary_data=per_bucket_payload,
            final_rating=final_rating
        )

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
        current_stage = getattr(current_user_context, "stage_id", None)
        if current_stage and (not target_user_id or target_user_id == current_user_context.user_id):
            return current_stage
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

    async def _auto_create_supervisor_feedback_for_summary(
        self,
        user_id: UUID,
        period_id: UUID,
        org_id: str,
        summary_data: List[Dict],
        final_rating: str
    ):
        """
        Auto-create SupervisorFeedback for self-assessment summary submission.
        Creates ONE feedback per user/period with bucket-based structure.

        Args:
            user_id: Employee user ID
            period_id: Evaluation period ID
            org_id: Organization ID
            summary_data: per_bucket data from scoring (quantitative, qualitative, competency)
            final_rating: Final rating code (S, A, etc.)
        """
        try:
            from ..database.models.supervisor_feedback import SupervisorFeedback

            # Check if feedback already exists
            existing = await self.supervisor_feedback_repo.get_by_user_and_period(
                user_id, period_id, org_id
            )

            previous_feedback_id = None
            if existing and existing.status in (SubmissionStatus.APPROVED.value, SubmissionStatus.REJECTED.value):
                # Preserve final record for history; create a new draft for the next cycle
                previous_feedback_id = existing.id
                existing = None

            if existing:
                logger.info(f"Supervisor feedback already exists for user {user_id}, period {period_id}, updating bucket_decisions with new employee ratings")

                # Update bucket_decisions with new employee ratings from summary_data
                # This ensures supervisor reviews the latest employee submission
                quant = next((b for b in summary_data if b['bucket'] == 'quantitative'), None)
                qual = next((b for b in summary_data if b['bucket'] == 'qualitative'), None)
                comp = next((b for b in summary_data if b['bucket'] == 'competency'), None)

                updated_buckets = []
                for bucket in existing.bucket_decisions or []:
                    if bucket['bucket'] == 'performance':
                        # Update performance bucket with new quant + qual data
                        perf_weight = (quant['weight'] if quant else 0) + (qual['weight'] if qual else 0)
                        perf_contrib = (quant['contribution'] if quant else 0) + (qual['contribution'] if qual else 0)
                        bucket['employeeWeight'] = round(perf_weight, 2)
                        bucket['employeeContribution'] = round(perf_contrib, 2)
                        bucket['employeeRating'] = final_rating
                        # Reset supervisor feedback for new submission
                        bucket['status'] = 'pending'
                        bucket['supervisorRating'] = None
                        bucket['comment'] = None
                    elif bucket['bucket'] == 'competency' and comp:
                        # Update competency bucket with new comp data
                        bucket['employeeWeight'] = round(comp['weight'], 2)
                        bucket['employeeContribution'] = round(comp['contribution'], 2)
                        bucket['employeeRating'] = final_rating
                        # Reset supervisor feedback for new submission
                        bucket['status'] = 'pending'
                        bucket['supervisorRating'] = None
                        bucket['comment'] = None

                    updated_buckets.append(bucket)

                existing.bucket_decisions = updated_buckets
                # Reset feedback status to draft for supervisor to review again
                existing.status = SubmissionStatus.DRAFT.value
                existing.submitted_at = None
                await self.supervisor_feedback_repo.update(existing)
                logger.info(f"Updated bucket_decisions for user {user_id}, period {period_id} with new employee ratings and reset to draft")
                return

            # Get employee's current supervisor(s)
            supervisors = await self.user_repo.get_user_supervisors(user_id, org_id)
            if not supervisors:
                logger.warning(f"Cannot auto-create feedback: No supervisors found for user {user_id}")
                return

            primary_supervisor = supervisors[0]

            # Build bucket_decisions from summary data
            # Group quantitative + qualitative → performance bucket
            quant = next((b for b in summary_data if b['bucket'] == 'quantitative'), None)
            qual = next((b for b in summary_data if b['bucket'] == 'qualitative'), None)
            comp = next((b for b in summary_data if b['bucket'] == 'competency'), None)

            bucket_decisions = []

            # Performance bucket (combines quant + qual)
            if quant or qual:
                perf_weight = (quant['weight'] if quant else 0) + (qual['weight'] if qual else 0)
                perf_contrib = (quant['contribution'] if quant else 0) + (qual['contribution'] if qual else 0)

                bucket_decisions.append({
                    "bucket": "performance",
                    "employeeWeight": round(perf_weight, 2),
                    "employeeContribution": round(perf_contrib, 2),
                    "employeeRating": final_rating,
                    "status": "pending",
                    "supervisorRating": None,
                    "comment": None
                })

            # Competency bucket
            if comp:
                bucket_decisions.append({
                    "bucket": "competency",
                    "employeeWeight": round(comp['weight'], 2),
                    "employeeContribution": round(comp['contribution'], 2),
                    "employeeRating": final_rating,
                    "status": "pending",
                    "supervisorRating": None,
                    "comment": None
                })

            # Create supervisor feedback with bucket decisions
            feedback = SupervisorFeedback(
                user_id=user_id,
                period_id=period_id,
                supervisor_id=primary_supervisor.id,
                bucket_decisions=bucket_decisions,
                status=SubmissionStatus.DRAFT.value,
                previous_feedback_id=previous_feedback_id
            )

            self.session.add(feedback)
            logger.info(f"Auto-created bucket-based supervisor feedback for user {user_id}, period {period_id}, supervisor {primary_supervisor.id}")

        except Exception as e:
            logger.error(f"Error auto-creating supervisor feedback for user {user_id}, period {period_id}: {str(e)}")
            # Don't re-raise - we don't want auto-creation failure to block submission

    def _map_goal_category_to_bucket(self, goal_category: Optional[str]) -> Optional[str]:
        """Map goal categories to supervisor feedback bucket keys."""
        if not goal_category:
            return None
        if "業績" in goal_category:
            return "performance"
        if "コンピテンシー" in goal_category:
            return "competency"
        return None

    def _build_bucket_comment_map(self, feedback) -> Dict[str, str]:
        """Extract supervisor comments from rejected feedback bucket decisions."""
        if not feedback or feedback.status != SubmissionStatus.REJECTED.value:
            return {}
        comment_map: Dict[str, str] = {}
        for bucket in feedback.bucket_decisions or []:
            bucket_key = bucket.get("bucket")
            comment = bucket.get("comment")
            if bucket_key and comment:
                comment_map[bucket_key] = comment
        return comment_map

    def _build_bucket_rating_map(self, feedback) -> Dict[str, str]:
        """Extract supervisor ratings from rejected feedback bucket decisions."""
        if not feedback or feedback.status != SubmissionStatus.REJECTED.value:
            return {}
        rating_map: Dict[str, str] = {}
        for bucket in feedback.bucket_decisions or []:
            bucket_key = bucket.get("bucket")
            rating = bucket.get("supervisorRating")
            if bucket_key and rating:
                rating_map[bucket_key] = rating
        return rating_map
