from __future__ import annotations
import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID
from cachetools import TTLCache

from ..database.repositories.supervisor_feedback_repo import SupervisorFeedbackRepository
from ..database.repositories.self_assessment_repo import SelfAssessmentRepository
from ..database.repositories.goal_repo import GoalRepository
from ..database.repositories.user_repo import UserRepository
from ..database.repositories.evaluation_period_repo import EvaluationPeriodRepository
from ..database.repositories.department_repo import DepartmentRepository
from ..database.repositories.stage_repo import StageRepository
from ..database.repositories.role_repo import RoleRepository
from ..database.models.supervisor_feedback import SupervisorFeedback as SupervisorFeedbackModel
from ..schemas.supervisor_feedback import (
    SupervisorFeedbackCreate, SupervisorFeedbackUpdate, SupervisorFeedback, SupervisorFeedbackDetail
)
from ..schemas.self_assessment import SelfAssessment
from ..schemas.evaluation import EvaluationPeriod
from ..schemas.user import UserProfileOption, UserDetailResponse, UserInDB, User, Department, Stage, Role
from ..schemas.common import PaginationParams, PaginatedResponse, SubmissionStatus
from ..security.context import AuthContext
from ..security.permissions import Permission
from ..security.decorators import require_any_permission
from ..security.rbac_helper import RBACHelper
from ..security.rbac_types import ResourceType
from ..core.exceptions import (
    NotFoundError, PermissionDeniedError, BadRequestError, ValidationError
)
from ..schemas.self_assessment_review import SelfAssessmentReview, SelfAssessmentReviewList
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# Cache for supervisor feedback search results (50 items, 5-minute TTL aligned with other services)
supervisor_feedback_search_cache = TTLCache(maxsize=50, ttl=300)


class SupervisorFeedbackService:
    """Service layer for supervisor feedback-related business logic and operations"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.supervisor_feedback_repo = SupervisorFeedbackRepository(session)
        self.self_assessment_repo = SelfAssessmentRepository(session)
        self.goal_repo = GoalRepository(session)
        self.user_repo = UserRepository(session)
        self.evaluation_period_repo = EvaluationPeriodRepository(session)
        self.department_repo = DepartmentRepository(session)
        self.stage_repo = StageRepository(session)
        self.role_repo = RoleRepository(session)

        # Initialize RBAC Helper with user repository for subordinate queries
        RBACHelper.initialize_with_repository(self.user_repo)
    
    @require_any_permission([Permission.GOAL_READ_ALL, Permission.GOAL_READ_SUBORDINATES, Permission.GOAL_READ_SELF])
    async def get_feedbacks(
        self,
        current_user_context: AuthContext,
        period_id: Optional[UUID] = None,
        supervisor_id: Optional[UUID] = None,
        subordinate_id: Optional[UUID] = None,
        status: Optional[str] = None,
        pagination: Optional[PaginationParams] = None
    ) -> PaginatedResponse[SupervisorFeedback]:
        """
        Get supervisor feedbacks based on current user's permissions and filters.
        
        Args:
            current_user_context: Authentication context for permission checks
            period_id: Filter by specific evaluation period
            user_id: Legacy parameter - filter by assessment owner (subordinate)
            supervisor_id: Filter by specific supervisor who created feedbacks
            subordinate_id: Filter by specific subordinate who received feedbacks
            status: Filter by feedback status (draft/submitted)
            pagination: Pagination parameters
        
        Access rules:
        - Supervisors: can view their own feedbacks + feedbacks on their subordinates' assessments
        - Employees: can view feedbacks on their own assessments
        - Admins: can view all feedbacks
        
        Notes:
        - supervisor_id: Returns feedbacks created by the specified supervisor
        - subordinate_id: Returns feedbacks received by the specified subordinate
        - user_id is deprecated, use subordinate_id instead
        
        Role-based default behavior when both supervisor_id and subordinate_id are None:
        - Admin: Can see all feedbacks (no defaults applied)
        - Manager/Supervisor: Defaults to supervisor_id=current_user (their own created feedbacks)
        - Employee/Part-time: Defaults to subordinate_id=current_user (feedbacks they received)
        
        Role-based filtering restrictions:
        - Admin: Can filter by any supervisor_id or subordinate_id
        - Manager/Supervisor: Can only filter by their own supervisor_id, and subordinate_id of their actual subordinates
        - Employee/Part-time: Cannot filter by supervisor_id, can only filter by their own subordinate_id
        """
        try:
            # Permission check handled by @require_any_permission decorator
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")

            # Use RBACHelper to determine accessible user IDs (centralized)
            accessible_user_ids = await RBACHelper.get_accessible_user_ids(current_user_context)

            # Defaults for missing filters
            actual_supervisor_id = supervisor_id
            actual_subordinate_id = subordinate_id

            if actual_supervisor_id is None and actual_subordinate_id is None:
                if accessible_user_ids is None:
                    # Admin: no defaults
                    pass
                elif len(accessible_user_ids) == 1 and accessible_user_ids[0] == current_user_context.user_id:
                    # Employee: default to their own received feedbacks
                    actual_subordinate_id = current_user_context.user_id
                else:
                    # Supervisor: default to their own created feedbacks
                    actual_supervisor_id = current_user_context.user_id

            # Validate filters vs accessible users for non-admins
            final_supervisor_ids = None
            final_user_ids = None

            if actual_supervisor_id is not None:
                if accessible_user_ids is not None and actual_supervisor_id != current_user_context.user_id:
                    raise PermissionDeniedError("You can only access your own supervisor feedbacks")
                final_supervisor_ids = [actual_supervisor_id]

            if actual_subordinate_id is not None:
                if accessible_user_ids is not None and actual_subordinate_id not in accessible_user_ids:
                    raise PermissionDeniedError(f"You do not have permission to access feedbacks for user {actual_subordinate_id}")
                final_user_ids = [actual_subordinate_id]
            else:
                # Non-admins: restrict to accessible users
                if accessible_user_ids is not None:
                    final_user_ids = accessible_user_ids

            # Search feedbacks with filters (org-scoped)
            feedbacks = await self.supervisor_feedback_repo.search_feedbacks(
                org_id=org_id,
                supervisor_ids=final_supervisor_ids,
                user_ids=final_user_ids,
                period_id=period_id,
                status=status,
                pagination=pagination
            )

            # Get total count for pagination (org-scoped)
            total_count = await self.supervisor_feedback_repo.count_feedbacks(
                org_id=org_id,
                supervisor_ids=final_supervisor_ids,
                user_ids=final_user_ids,
                period_id=period_id,
                status=status
            )
            
            # Convert to response format
            enriched_feedbacks = []
            for feedback_model in feedbacks:
                enriched_feedback = await self._enrich_feedback_data(feedback_model)
                enriched_feedbacks.append(enriched_feedback)
            
            # Create paginated response
            if pagination:
                total_pages = (total_count + pagination.limit - 1) // pagination.limit
            else:
                total_pages = 1
            
            return PaginatedResponse(
                items=enriched_feedbacks,
                total=total_count,
                page=pagination.page if pagination else 1,
                limit=pagination.limit if pagination else len(enriched_feedbacks),
                pages=total_pages
            )
            
        except Exception as e:
            logger.error(f"Error in get_feedbacks: {e}")
            raise

    @require_any_permission([Permission.GOAL_READ_ALL, Permission.GOAL_READ_SUBORDINATES])
    async def get_pending_self_assessment_reviews(
        self,
        current_user_context: AuthContext,
        period_id: Optional[UUID] = None,
        subordinate_id: Optional[UUID] = None,
        pagination: Optional[PaginationParams] = None,
    ) -> SelfAssessmentReviewList:
        """
        List pending (draft) bucket-based self-assessment feedbacks for supervisors.

        Returns supervisor_feedback records with user_id (new model) that are in draft status,
        ready for supervisor review.
        """
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")

        # Determine accessible subordinates
        accessible_user_ids = await RBACHelper.get_accessible_user_ids(current_user_context)
        if subordinate_id and accessible_user_ids is not None and subordinate_id not in accessible_user_ids:
            raise PermissionDeniedError("You do not have permission to access this user")

        user_filters = [subordinate_id] if subordinate_id else accessible_user_ids

        # Get bucket-based feedbacks (user_id IS NOT NULL)
        feedbacks = await self.supervisor_feedback_repo.search_feedbacks(
            org_id=org_id,
            supervisor_ids=[current_user_context.user_id],
            user_ids=user_filters,
            period_id=period_id,
            status=SubmissionStatus.DRAFT.value,
            pagination=pagination,
        )

        total_count = await self.supervisor_feedback_repo.count_feedbacks(
            org_id=org_id,
            supervisor_ids=[current_user_context.user_id],
            user_ids=user_filters,
            period_id=period_id,
            status=SubmissionStatus.DRAFT.value,
        )

        items: list[SelfAssessmentReview] = []
        for fb in feedbacks:
            # Skip legacy feedbacks (those with self_assessment_id but no user_id)
            if not fb.user_id:
                continue

            # Get employee details (full user info) with all relationships loaded
            subordinate = None
            if fb.user:
                subordinate = await self._enrich_user_for_detail_response(fb.user)

            # Parse bucket_decisions from JSONB
            from ..schemas.self_assessment_review import BucketDecision
            bucket_decisions = []
            if fb.bucket_decisions:
                for bucket_data in fb.bucket_decisions:
                    bucket_decisions.append(
                        BucketDecision(
                            bucket=bucket_data.get("bucket"),
                            employeeWeight=bucket_data.get("employeeWeight", 0),
                            employeeContribution=bucket_data.get("employeeContribution", 0),
                            employeeRating=bucket_data.get("employeeRating", ""),
                            status=bucket_data.get("status", "pending"),
                            supervisorRating=bucket_data.get("supervisorRating"),
                            comment=bucket_data.get("comment")
                        )
                    )

            items.append(
                SelfAssessmentReview(
                    id=fb.id,
                    userId=fb.user_id,
                    periodId=fb.period_id,
                    supervisorId=fb.supervisor_id,
                    previousFeedbackId=fb.previous_feedback_id,
                    status=fb.status,
                    bucketDecisions=bucket_decisions,
                    subordinate=subordinate,
                    createdAt=fb.created_at,
                    updatedAt=fb.updated_at,
                )
            )

        effective_limit = pagination.limit if pagination else len(items) or 1
        current_page = pagination.page if pagination else 1
        pages = (total_count + effective_limit - 1) // effective_limit
        return SelfAssessmentReviewList(
            items=items,
            total=total_count,
            page=current_page,
            limit=effective_limit,
            pages=pages
        )

    @require_any_permission([Permission.GOAL_READ_ALL, Permission.GOAL_READ_SUBORDINATES, Permission.GOAL_READ_SELF])
    async def get_feedback_by_id(
        self,
        feedback_id: UUID,
        current_user_context: AuthContext
    ) -> SupervisorFeedbackDetail:
        """Get detailed supervisor feedback information by ID with permission checks."""
        try:
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")
            feedback = await self.supervisor_feedback_repo.get_by_id_with_details(feedback_id, org_id)
            if not feedback:
                raise NotFoundError(f"Supervisor feedback with ID {feedback_id} not found")
            
            # Permission check
            await self._check_feedback_access_permission(feedback, current_user_context)
            
            # Enrich with detailed information
            enriched_feedback = await self._enrich_feedback_detail_data(feedback)
            return enriched_feedback
            
        except Exception as e:
            logger.error(f"Error getting feedback {feedback_id}: {str(e)}")
            raise

    @require_any_permission([Permission.GOAL_READ_ALL, Permission.GOAL_READ_SUBORDINATES, Permission.GOAL_READ_SELF])
    async def get_feedback_for_assessment(
        self,
        self_assessment_id: UUID,
        current_user_context: AuthContext
    ) -> Optional[SupervisorFeedback]:
        """Get supervisor feedback for a specific self-assessment."""
        try:
            # Check if self-assessment exists and user has access
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")
            assessment = await self.self_assessment_repo.get_by_id_with_details(self_assessment_id, org_id)
            if not assessment:
                raise NotFoundError(f"Self-assessment with ID {self_assessment_id} not found")
            
            # Permission check via assessment
            await self._check_assessment_access_permission(assessment, current_user_context)
            
            # Get feedback for assessment
            feedback = await self.supervisor_feedback_repo.get_by_self_assessment(self_assessment_id, org_id)
            if not feedback:
                return None
            
            # Enrich with additional information
            enriched_feedback = await self._enrich_feedback_data(feedback)
            return enriched_feedback
            
        except Exception as e:
            logger.error(f"Error getting feedback for assessment {self_assessment_id}: {str(e)}")
            raise

    @require_any_permission([Permission.GOAL_APPROVE, Permission.GOAL_READ_ALL])
    async def create_feedback(
        self,
        feedback_data: SupervisorFeedbackCreate,
        current_user_context: AuthContext
    ) -> SupervisorFeedback:
        """Create a new supervisor feedback with validation and business rules."""
        try:
            # Permission check handled by @require_any_permission decorator
            
            # Check if self-assessment exists and get assessment details
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")
            assessment = await self.self_assessment_repo.get_by_id_with_details(feedback_data.self_assessment_id, org_id)
            if not assessment:
                raise NotFoundError(f"Self-assessment with ID {feedback_data.self_assessment_id} not found")
            
            # Business validation
            await self._validate_feedback_creation(assessment, feedback_data, current_user_context)
            
            # Create feedback
            created_feedback = await self.supervisor_feedback_repo.create_feedback(
                feedback_data, current_user_context.user_id, org_id
            )
            
            # Commit transaction
            await self.session.commit()
            await self.session.refresh(created_feedback)
            
            # Enrich response data
            enriched_feedback = await self._enrich_feedback_data(created_feedback)
            
            logger.info(f"Supervisor feedback created successfully: {created_feedback.id}")
            return enriched_feedback
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error creating supervisor feedback: {str(e)}")
            raise

    @require_any_permission([Permission.GOAL_APPROVE, Permission.GOAL_READ_ALL])
    async def update_feedback(
        self,
        feedback_id: UUID,
        feedback_data: SupervisorFeedbackUpdate,
        current_user_context: AuthContext
    ) -> SupervisorFeedback:
        """Update a supervisor feedback with validation and business rules."""
        try:
            # Check if feedback exists
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")
            existing_feedback = await self.supervisor_feedback_repo.get_by_id_with_details(feedback_id, org_id)
            if not existing_feedback:
                raise NotFoundError(f"Supervisor feedback with ID {feedback_id} not found")
            
            # Permission check - only feedback creator can update
            await self._check_feedback_update_permission(existing_feedback, current_user_context)
            
            # Business validation
            await self._validate_feedback_update(feedback_data, existing_feedback)
            
            # Update feedback
            updated_feedback = await self.supervisor_feedback_repo.update_feedback(feedback_id, feedback_data, org_id)
            if not updated_feedback:
                raise NotFoundError(f"Supervisor feedback with ID {feedback_id} not found after update")
            
            # Commit transaction
            await self.session.commit()
            
            # Enrich response data
            enriched_feedback = await self._enrich_feedback_data(updated_feedback)
            
            logger.info(f"Supervisor feedback updated successfully: {feedback_id}")
            return enriched_feedback
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error updating feedback {feedback_id}: {str(e)}")
            raise

    @require_any_permission([Permission.GOAL_APPROVE, Permission.GOAL_READ_ALL])
    async def submit_feedback(
        self,
        feedback_id: UUID,
        current_user_context: AuthContext
    ) -> SupervisorFeedback:
        """Submit a supervisor feedback by changing status to submitted."""
        try:
            # Check if feedback exists and user can update it
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")
            existing_feedback = await self.supervisor_feedback_repo.get_by_id_with_details(feedback_id, org_id)
            if not existing_feedback:
                raise NotFoundError(f"Supervisor feedback with ID {feedback_id} not found")
            
            # Permission check - only feedback creator can submit
            await self._check_feedback_update_permission(existing_feedback, current_user_context)
            
            # Business rule: can only submit draft feedbacks
            if existing_feedback.status != SubmissionStatus.DRAFT.value:
                raise BadRequestError("Can only submit draft feedbacks")
            
            # CRITICAL: Validate goal category rating rules before submission
            assessment = await self.self_assessment_repo.get_by_id_with_details(existing_feedback.self_assessment_id, org_id)
            if assessment:
                goal = await self.goal_repo.get_goal_by_id(assessment.goal_id, org_id)
                if goal:
                    # Create temp object for submission validation
                    temp_feedback = SupervisorFeedbackUpdate(
                        rating=float(existing_feedback.rating) if existing_feedback.rating else None,
                        comment=existing_feedback.comment,
                        status=SubmissionStatus.SUBMITTED
                    )
                    await self._validate_goal_category_rating_rules(goal, temp_feedback)
            
            # Update status using dedicated method
            updated_feedback = await self.supervisor_feedback_repo.submit_feedback(feedback_id, org_id)
            
            # Commit transaction
            await self.session.commit()
            
            # Enrich response data
            enriched_feedback = await self._enrich_feedback_data(updated_feedback)
            
            logger.info(f"Supervisor feedback submitted: {feedback_id} by {current_user_context.user_id}")
            return enriched_feedback
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error submitting feedback {feedback_id}: {str(e)}")
            raise

    @require_any_permission([Permission.GOAL_APPROVE, Permission.GOAL_READ_ALL])
    async def draft_feedback(
        self,
        feedback_id: UUID,
        current_user_context: AuthContext
    ) -> SupervisorFeedback:
        """Change a supervisor feedback status to draft."""
        try:
            # Check if feedback exists and user can update it
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")
            existing_feedback = await self.supervisor_feedback_repo.get_by_id_with_details(feedback_id, org_id)
            if not existing_feedback:
                raise NotFoundError(f"Supervisor feedback with ID {feedback_id} not found")
            
            # Permission check - only feedback creator can change to draft
            await self._check_feedback_update_permission(existing_feedback, current_user_context)
            
            # Business rule: can only draft submitted feedbacks (to revert back to draft)
            if existing_feedback.status != SubmissionStatus.SUBMITTED.value:
                raise BadRequestError("Can only draft submitted feedbacks")
            
            # Update status using dedicated method
            updated_feedback = await self.supervisor_feedback_repo.draft_feedback(feedback_id, org_id)
            
            # Commit transaction
            await self.session.commit()
            
            # Enrich response data
            enriched_feedback = await self._enrich_feedback_data(updated_feedback)
            
            logger.info(f"Supervisor feedback changed to draft: {feedback_id} by {current_user_context.user_id}")
            return enriched_feedback
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error drafting feedback {feedback_id}: {str(e)}")
            raise

    @require_any_permission([Permission.GOAL_APPROVE, Permission.GOAL_READ_ALL])
    async def delete_feedback(
        self,
        feedback_id: UUID,
        current_user_context: AuthContext
    ) -> bool:
        """Delete a supervisor feedback with permission and business rule checks."""
        try:
            # Check if feedback exists
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")
            existing_feedback = await self.supervisor_feedback_repo.get_by_id_with_details(feedback_id, org_id)
            if not existing_feedback:
                raise NotFoundError(f"Supervisor feedback with ID {feedback_id} not found")
            
            # Permission check
            await self._check_feedback_update_permission(existing_feedback, current_user_context)
                        
            # Delete feedback
            success = await self.supervisor_feedback_repo.delete_feedback(feedback_id, org_id)
            
            if success:
                await self.session.commit()
                logger.info(f"Supervisor feedback deleted successfully: {feedback_id}")
            
            return success
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error deleting feedback {feedback_id}: {str(e)}")
            raise

    @require_any_permission([Permission.GOAL_APPROVE, Permission.GOAL_READ_ALL])
    async def update_bucket_decisions(
        self,
        feedback_id: UUID,
        bucket_decisions_data: list,
        status: Optional[SubmissionStatus],
        current_user_context: AuthContext
    ) -> SupervisorFeedback:
        """
        Update bucket decisions for a supervisor feedback (new bucket-based model).

        This allows supervisors to update their ratings, comments, and approval status
        for each bucket (performance, competency) in the employee's self-assessment.
        """
        try:
            # Check if feedback exists
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")

            existing_feedback = await self.supervisor_feedback_repo.get_by_id_with_details(feedback_id, org_id)
            if not existing_feedback:
                raise NotFoundError(f"Supervisor feedback with ID {feedback_id} not found")

            # Permission check - only feedback creator can update
            await self._check_feedback_update_permission(existing_feedback, current_user_context)

            # Business rule: can only update bucket-based feedbacks (those with user_id)
            if not existing_feedback.user_id:
                raise BadRequestError("Can only update bucket-based supervisor feedbacks")

            # Convert bucket decisions when provided
            if bucket_decisions_data:
                bucket_decisions_json = []
                for bd in bucket_decisions_data:
                    bucket_decisions_json.append({
                        "bucket": bd.bucket,
                        "employeeWeight": bd.employee_weight,
                        "employeeContribution": bd.employee_contribution,
                        "employeeRating": bd.employee_rating,
                        "status": bd.status,
                        "supervisorRating": bd.supervisor_rating,
                        "comment": bd.comment
                    })
                existing_feedback.bucket_decisions = bucket_decisions_json
            else:
                bucket_decisions_json = self._clone_bucket_decisions(existing_feedback.bucket_decisions)

            normalized_status = status.value if isinstance(status, SubmissionStatus) else status
            if normalized_status:
                self._validate_feedback_status_transition(existing_feedback.status, normalized_status)
                existing_feedback.status = normalized_status
                if normalized_status == SubmissionStatus.SUBMITTED.value:
                    existing_feedback.submitted_at = datetime.now(timezone.utc)
                elif normalized_status == SubmissionStatus.APPROVED.value:
                    if not existing_feedback.submitted_at:
                        existing_feedback.submitted_at = datetime.now(timezone.utc)
                    self._set_bucket_statuses(existing_feedback.bucket_decisions, SubmissionStatus.APPROVED.value)
                elif normalized_status == SubmissionStatus.REJECTED.value:
                    self._set_bucket_statuses(existing_feedback.bucket_decisions, SubmissionStatus.REJECTED.value)

            # Commit transaction
            await self.session.commit()
            await self.session.refresh(existing_feedback)

            # Enrich response data
            enriched_feedback = await self._enrich_feedback_data(existing_feedback)

            logger.info(f"Bucket decisions updated for feedback {feedback_id} by {current_user_context.user_id}")
            return enriched_feedback

        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error updating bucket decisions for feedback {feedback_id}: {str(e)}")
            raise


    # ========================================
    # PRIVATE HELPER METHODS
    # ========================================

    async def _get_accessible_filters(
        self,
        current_user_context: AuthContext,
        requested_user_id: Optional[UUID] = None
    ) -> dict:
        """Determine which feedbacks the current user can access using RBACHelper."""
        
        filters = {"supervisor_ids": None, "user_ids": None}
        
        if current_user_context.has_permission(Permission.GOAL_READ_ALL):
            # Admin: can see all feedbacks
            if requested_user_id:
                filters["user_ids"] = [requested_user_id]
            return filters  # No restrictions
        
        # Use RBACHelper to get accessible user IDs
        accessible_user_ids = await RBACHelper.get_accessible_user_ids(
            auth_context=current_user_context,
            resource_type=ResourceType.ASSESSMENT,
            permission_context="feedback_access"
        )
        
        accessible_supervisor_ids = []
        
        # Add self as supervisor if user has feedback creation permissions
        if current_user_context.has_permission(Permission.GOAL_APPROVE):
            accessible_supervisor_ids.append(current_user_context.user_id)
        
        # If specific user requested, validate access
        if requested_user_id:
            if accessible_user_ids and requested_user_id not in accessible_user_ids:
                raise PermissionDeniedError(f"You do not have permission to access feedbacks for user {requested_user_id}")
            filters["user_ids"] = [requested_user_id]
        else:
            filters["supervisor_ids"] = accessible_supervisor_ids if accessible_supervisor_ids else None
            filters["user_ids"] = accessible_user_ids if accessible_user_ids else None
        
        return filters

    async def _validate_filtering_permissions(
        self,
        current_user_context: AuthContext,
        supervisor_id: Optional[UUID] = None,
        subordinate_id: Optional[UUID] = None
    ):
        """
        Validate that non-admin users cannot assign arbitrary supervisor_id/subordinate_id values using RBAC framework.
        
        Business rules:
        - Admin: can assign any supervisor_id or subordinate_id
        - Manager/Supervisor: cannot assign supervisor_id other than their own, can only assign subordinate_id to accessible users
        - Employee/Part-time: cannot assign supervisor_id, can only assign subordinate_id to themselves
        """
        if current_user_context.has_permission(Permission.GOAL_READ_ALL):
            return  # Admin can assign any values
        
        # Validation for supervisor_id parameter
        if supervisor_id:
            if current_user_context.has_permission(Permission.GOAL_APPROVE):
                # Manager/Supervisor: can only assign their own user_id to supervisor_id
                if supervisor_id != current_user_context.user_id:
                    raise PermissionDeniedError("Managers and supervisors can only filter by their own supervisor feedbacks")
            elif current_user_context.has_permission(Permission.GOAL_READ_SELF):
                # Employee/Part-time: cannot assign supervisor_id at all
                raise PermissionDeniedError("Employees and part-time users cannot filter by supervisor_id")
        
        # Validation for subordinate_id parameter using RBACHelper
        if subordinate_id:
            accessible_user_ids = await RBACHelper.get_accessible_user_ids(
                auth_context=current_user_context,
                resource_type=ResourceType.ASSESSMENT,
                permission_context="feedback_filter_validation"
            )
            
            if accessible_user_ids and subordinate_id not in accessible_user_ids:
                raise PermissionDeniedError("You can only filter by feedbacks for users you have access to")

    async def _check_assessment_access_permission(self, assessment, current_user_context: AuthContext):
        """Check if user has permission to access this assessment using RBAC framework."""
        # Get the related goal to check ownership
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")
        goal = await self.goal_repo.get_goal_by_id(assessment.goal_id, org_id)
        if not goal:
            raise NotFoundError("Related goal not found")
        
        # Use RBACHelper for resource access validation
        can_access = await RBACHelper.can_access_resource(
            auth_context=current_user_context,
            resource_id=goal.id,
            resource_type=ResourceType.GOAL,
            owner_user_id=goal.user_id
        )
        
        if not can_access:
            raise PermissionDeniedError("You do not have permission to access this assessment")

    async def _check_feedback_access_permission(self, feedback: SupervisorFeedbackModel, current_user_context: AuthContext):
        """Check if user has permission to access this feedback."""
        if current_user_context.has_permission(Permission.GOAL_READ_ALL):
            return  # Admin can access all
        
        # Feedback creator can access their own feedback
        if feedback.supervisor_id == current_user_context.user_id:
            return
        
        # Assessment owner can view feedback on their assessments
        assessment = await self.self_assessment_repo.get_by_id_with_details(feedback.self_assessment_id)
        if assessment:
            await self._check_assessment_access_permission(assessment, current_user_context)
            return
        
        raise PermissionDeniedError("You do not have permission to access this feedback")

    async def _check_feedback_update_permission(self, feedback: SupervisorFeedbackModel, current_user_context: AuthContext):
        """Check if user has permission to update this feedback."""
        # Business Rule: Only manager and supervisor roles can update/delete feedback
        if not current_user_context.has_any_role(["manager", "supervisor"]):
            raise PermissionDeniedError("Only managers and supervisors can update supervisor feedback")
        
        # Business Rule: supervisor_id MUST be same as current_user_context.user_id
        if feedback.supervisor_id != current_user_context.user_id:
            raise PermissionDeniedError("You can only update/delete your own supervisor feedbacks")
        
    async def _validate_feedback_creation(self, assessment, feedback_data: SupervisorFeedbackCreate, current_user_context: AuthContext):
        """Validate supervisor feedback creation business rules using RBAC framework."""
        # Check if assessment is submitted (can only give feedback on submitted assessments)
        if assessment.status != SubmissionStatus.SUBMITTED.value:
            raise BadRequestError("Can only create feedback for submitted self-assessments")
        
        # Check if current user has access to the assessment's goal
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")
        goal = await self.goal_repo.get_goal_by_id(assessment.goal_id, org_id)
        if not goal:
            raise BadRequestError("Related goal not found")
        
        # Use RBACHelper to verify supervisor relationship
        can_access = await RBACHelper.can_access_resource(
            auth_context=current_user_context,
            resource_id=goal.id,
            resource_type=ResourceType.GOAL,
            owner_user_id=goal.user_id
        )
        
        if not can_access:
            raise PermissionDeniedError("You can only provide feedback for goals you have access to")
        
        # Check if evaluation period allows feedback
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")
        period = await self.evaluation_period_repo.get_by_id(feedback_data.period_id, org_id)
        if not period:
            raise BadRequestError(f"Evaluation period {feedback_data.period_id} not found")
        
        # CRITICAL: Validate rating requirements based on goal category
        await self._validate_goal_category_rating_rules(goal, feedback_data)

    async def _validate_feedback_update(self, feedback_data: SupervisorFeedbackUpdate, existing_feedback: SupervisorFeedbackModel):
        """Validate supervisor feedback update business rules."""
        # CRITICAL: Validate rating rules for goal category during updates
        if feedback_data.rating is not None:
            # Get goal via assessment to validate category rules
            org_id = existing_feedback.org_id # Assuming org_id is stored in the model
            if not org_id:
                raise PermissionDeniedError("Organization context required")
            assessment = await self.self_assessment_repo.get_by_id_with_details(existing_feedback.self_assessment_id, org_id)
            if assessment:
                goal = await self.goal_repo.get_goal_by_id(assessment.goal_id, org_id)
                if goal:
                    # Create temp object for validation (without status field)
                    temp_feedback = SupervisorFeedbackUpdate(
                        rating=feedback_data.rating if feedback_data.rating is not None else existing_feedback.rating,
                        comment=feedback_data.comment
                    )
                    await self._validate_goal_category_rating_rules(goal, temp_feedback)

    async def _validate_goal_category_rating_rules(self, goal, feedback_data):
        """
        Validate rating requirements based on goal category.
        
        Business Rules from strategy document:
        - コアバリュー (Core Values): rating MUST be null, only comment allowed
        - 業績目標 (Performance): rating 0-100 REQUIRED when submitting
        - コンピテンシー (Competency): rating 0-100 REQUIRED when submitting
        """
        goal_category = goal.goal_category
        
        if goal_category == "コアバリュー":  # Core Values
            if feedback_data.rating is not None:
                raise ValidationError(
                    f"Core Value goals (コアバリュー) cannot have numeric ratings. "
                    f"Please remove the rating and provide only comments for goal category: {goal_category}"
                )
        
        elif goal_category in ["業績目標", "コンピテンシー"]:  # Performance or Competency
            # For submission validation, check if this is a submission context
            is_submission_context = hasattr(feedback_data, 'status') and feedback_data.status == SubmissionStatus.SUBMITTED
            
            if is_submission_context and feedback_data.rating is None:
                goal_type_name = "Performance" if goal_category == "業績目標" else "Competency"
                raise ValidationError(
                    f"{goal_type_name} goals ({goal_category}) require a numeric rating (0-100) when submitting feedback. "
                    f"Please provide a rating for goal category: {goal_category}"
                )
                
            # Additional validation: rating must be within 0-100 (handled by schema, but double-check)
            if feedback_data.rating is not None and not (0 <= feedback_data.rating <= 100):
                raise ValidationError(
                    f"Rating for {goal_category} goals must be between 0 and 100, got: {feedback_data.rating}"
                )
        
        else:
            # Unknown goal category
            raise ValidationError(
                f"Unknown goal category: {goal_category}. "
                f"Valid categories are: 業績目標, コンピテンシー, コアバリュー"
            )

    async def _enrich_feedback_data(self, feedback_model: SupervisorFeedbackModel) -> SupervisorFeedback:
        """Convert SupervisorFeedbackModel to SupervisorFeedback response schema with enriched data."""
        # Base feedback data
        feedback_dict = {
            "id": feedback_model.id,
            "self_assessment_id": feedback_model.self_assessment_id,
            "period_id": feedback_model.period_id,
            "supervisor_id": feedback_model.supervisor_id,
            "rating": float(feedback_model.rating) if feedback_model.rating else None,
            "comment": feedback_model.comment,
            "status": SubmissionStatus(feedback_model.status),
            "submitted_at": feedback_model.submitted_at,
            "created_at": feedback_model.created_at,
            "updated_at": feedback_model.updated_at
        }
        
        return SupervisorFeedback(**feedback_dict)

    async def _enrich_feedback_detail_data(self, feedback_model: SupervisorFeedbackModel) -> SupervisorFeedbackDetail:
        """Convert SupervisorFeedbackModel to SupervisorFeedbackDetail response schema with enriched data."""
        # Start with basic feedback data
        base_feedback = await self._enrich_feedback_data(feedback_model)
        detail_dict = base_feedback.model_dump()
        
        # Get related data using the loaded relationships (from get_by_id_with_details)
        assessment_data = None
        evaluation_period_data = None
        subordinate_data = None
        supervisor_data = None
        goal = None
        
        # Extract self-assessment data if available
        if feedback_model.self_assessment:
            assessment_data = await self._convert_assessment_to_schema(feedback_model.self_assessment)
            
            # Extract goal and subordinate data from assessment
            if feedback_model.self_assessment.goal:
                goal = feedback_model.self_assessment.goal
                if goal.user:
                    subordinate_data = await self._convert_user_to_profile_option(goal.user)
        
        # Extract evaluation period data if available
        if feedback_model.period:
            evaluation_period_data = await self._convert_period_to_schema(feedback_model.period)
        
        # Extract supervisor data if available
        if feedback_model.supervisor:
            supervisor_data = await self._convert_user_to_profile_option(feedback_model.supervisor)
        
        # Add all enhanced detail fields
        detail_dict.update({
            # Related object data
            "self_assessment": assessment_data,
            "evaluation_period": evaluation_period_data,
            "subordinate": subordinate_data,
            "supervisor": supervisor_data,
            
            # Status and editability
            "is_editable": feedback_model.status == SubmissionStatus.DRAFT.value,
            "is_overdue": False,  # Placeholder for future deadline check
            "days_until_deadline": None,  # Placeholder for future deadline calculation
            
            # Context fields
            "goal_category": goal.goal_category if goal else None,
            "goal_title": goal.title if goal else None,
            "goal_description": goal.description if goal else None,
            "evaluation_period_name": feedback_model.period.name if feedback_model.period else None,
        })
        
        return SupervisorFeedbackDetail(**detail_dict)

    def _clone_bucket_decisions(self, bucket_decisions: Optional[list]) -> list:
        """Create a mutable copy of stored bucket decisions."""
        if not bucket_decisions:
            return []
        return [dict(bucket) for bucket in bucket_decisions]

    def _set_bucket_statuses(self, bucket_decisions: list, status: str) -> None:
        """Set status field for each bucket decision."""
        for bucket in bucket_decisions or []:
            bucket["status"] = status

    def _validate_feedback_status_transition(self, current_status: str, new_status: str) -> None:
        """Ensure feedback status transitions follow goal-like workflow rules."""
        valid_transitions = {
            SubmissionStatus.DRAFT.value: [
                SubmissionStatus.DRAFT.value,
                SubmissionStatus.SUBMITTED.value,
                SubmissionStatus.APPROVED.value,
                SubmissionStatus.REJECTED.value,
            ],
            SubmissionStatus.SUBMITTED.value: [
                SubmissionStatus.SUBMITTED.value,
                SubmissionStatus.APPROVED.value,
                SubmissionStatus.REJECTED.value
            ],
            SubmissionStatus.APPROVED.value: [],
            SubmissionStatus.REJECTED.value: []
        }

        allowed = valid_transitions.get(current_status, [])
        if new_status not in allowed:
            raise BadRequestError(
                f"Invalid status transition from '{current_status}' to '{new_status}'. "
                f"Allowed next statuses: {allowed}"
            )

    async def _convert_assessment_to_schema(self, assessment_model) -> SelfAssessment:
        """Convert SelfAssessment database model to SelfAssessment schema."""
        return SelfAssessment(
            id=assessment_model.id,
            goalId=assessment_model.goal_id,
            periodId=assessment_model.period_id,
            selfRating=float(assessment_model.self_rating) if assessment_model.self_rating else None,
            selfComment=assessment_model.self_comment,
            status=SubmissionStatus(assessment_model.status),
            submittedAt=assessment_model.submitted_at,
            createdAt=assessment_model.created_at,
            updatedAt=assessment_model.updated_at
        )
    
    async def _convert_period_to_schema(self, period_model) -> EvaluationPeriod:
        """Convert EvaluationPeriod database model to EvaluationPeriod schema."""
        return EvaluationPeriod(
            id=period_model.id,
            name=period_model.name,
            description=period_model.description,
            start_date=period_model.start_date,
            end_date=period_model.end_date,
            status=period_model.status,
            created_at=period_model.created_at,
            updated_at=period_model.updated_at
        )
    
    async def _convert_user_to_profile_option(self, user_model) -> UserProfileOption:
        """Convert User database model to UserProfileOption schema."""
        return UserProfileOption(
            id=user_model.id,
            first_name=user_model.first_name,
            last_name=user_model.last_name,
            display_name=user_model.display_name,
            email=user_model.email,
            employee_code=user_model.employee_code,
            job_title=user_model.job_title,
            roles=[]  # Roles would need to be loaded separately if needed
        )

    async def _enrich_user_data(self, user_model) -> User:
        """Enrich user data with relationships (department, stage, roles) using repository pattern"""
        from ..database.models.user import User as UserModel

        # Get department using repository
        department_model = await self.department_repo.get_by_id(user_model.department_id, user_model.clerk_organization_id)
        if not department_model:
            # Create a fallback department if not found
            department = Department(
                id=user_model.department_id,
                name="Unknown Department",
                description="Department not found"
            )
        else:
            department = Department.model_validate(department_model, from_attributes=True)

        # Get stage using repository
        stage_model = await self.stage_repo.get_by_id(user_model.stage_id, user_model.clerk_organization_id)
        if not stage_model:
            # Create a fallback stage if not found
            stage = Stage(
                id=user_model.stage_id,
                name="Unknown Stage",
                description="Stage not found"
            )
        else:
            stage = Stage.model_validate(stage_model, from_attributes=True)

        # Get roles using repository
        role_models = await self.role_repo.get_user_roles(user_model.id, user_model.clerk_organization_id)
        roles = [Role.model_validate(role, from_attributes=True) for role in role_models]

        # Use UserInDB to validate basic user data first
        user_in_db = UserInDB.model_validate(user_model, from_attributes=True)

        return User(
            **user_in_db.model_dump(),
            department=department,
            stage=stage,
            roles=roles,
        )

    async def _enrich_user_for_detail_response(self, user_model) -> UserDetailResponse:
        """
        Enrich user model to UserDetailResponse with all relationships loaded.
        Similar to UserService._enrich_detailed_user_data but without supervisor/subordinates.
        """
        # Get basic enriched user data with department, stage, and roles
        base_user = await self._enrich_user_data(user_model)

        # For self-assessment review, we don't need supervisor/subordinates
        # Just convert to UserDetailResponse
        user_detail_data = base_user.model_dump()
        user_detail_data.update({
            'supervisor': None,
            'subordinates': None
        })

        return UserDetailResponse(**user_detail_data)
