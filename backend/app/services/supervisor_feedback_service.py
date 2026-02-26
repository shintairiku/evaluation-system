from __future__ import annotations
import logging
from typing import Optional
from uuid import UUID
from cachetools import TTLCache

from ..database.repositories.supervisor_feedback_repo import SupervisorFeedbackRepository
from ..database.repositories.self_assessment_repo import SelfAssessmentRepository
from ..database.repositories.goal_repo import GoalRepository
from ..database.repositories.user_repo import UserRepository
from ..database.repositories.evaluation_period_repo import EvaluationPeriodRepository
from ..database.models.supervisor_feedback import SupervisorFeedback as SupervisorFeedbackModel
from ..schemas.supervisor_feedback import (
    SupervisorFeedbackCreate, SupervisorFeedbackUpdate, SupervisorFeedbackSubmit,
    SupervisorFeedback, SupervisorFeedbackDetail
)
from ..schemas.supervisor_review import SupervisorAction
from ..schemas.self_assessment import SelfAssessment
from ..schemas.evaluation import EvaluationPeriod
from ..schemas.user import UserProfileOption
from ..schemas.common import PaginationParams, PaginatedResponse, SubmissionStatus, SelfAssessmentStatus
from ..security.context import AuthContext
from ..security.permissions import Permission
from ..security.decorators import require_any_permission
from ..security.rbac_helper import RBACHelper
from ..security.rbac_types import ResourceType
from ..core.exceptions import (
    NotFoundError, PermissionDeniedError, BadRequestError, ValidationError, ConflictError
)
from .rating_rules import validate_rating_code_for_goal
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
        action: Optional[str] = None,
        has_return_comment: Optional[bool] = None,
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
                action=action,
                has_return_comment=has_return_comment,
                pagination=pagination
            )

            # Get total count for pagination (org-scoped)
            total_count = await self.supervisor_feedback_repo.count_feedbacks(
                org_id=org_id,
                supervisor_ids=final_supervisor_ids,
                user_ids=final_user_ids,
                period_id=period_id,
                status=status,
                action=action,
                has_return_comment=has_return_comment
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

            # Check if feedback already exists (idempotent create)
            existing_feedback = await self.supervisor_feedback_repo.get_by_self_assessment(
                feedback_data.self_assessment_id, org_id
            )
            if existing_feedback:
                if existing_feedback.supervisor_id != current_user_context.user_id:
                    raise PermissionDeniedError(
                        "Supervisor feedback already exists and can only be edited by its creator"
                    )
                logger.info(
                    "Supervisor feedback already exists for self-assessment %s. Returning existing feedback %s.",
                    feedback_data.self_assessment_id,
                    existing_feedback.id
                )
                return await self._enrich_feedback_data(existing_feedback)

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

        except ConflictError as e:
            await self.session.rollback()
            # Race condition: feedback was created between our check and insert
            org_id = current_user_context.organization_id
            if org_id:
                existing_feedback = await self.supervisor_feedback_repo.get_by_self_assessment(
                    feedback_data.self_assessment_id, org_id
                )
                if existing_feedback and existing_feedback.supervisor_id == current_user_context.user_id:
                    logger.info(
                        "Create feedback conflict resolved by returning existing feedback %s for self-assessment %s.",
                        existing_feedback.id,
                        feedback_data.self_assessment_id
                    )
                    return await self._enrich_feedback_data(existing_feedback)
            logger.error(f"Error creating supervisor feedback: {str(e)}")
            raise

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

            await self._ensure_period_allows_score_changes(existing_feedback.period_id, org_id)
            
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
        submit_data: SupervisorFeedbackSubmit,
        current_user_context: AuthContext
    ) -> SupervisorFeedback:
        """
        Submit a supervisor feedback with approval decision.

        When action=APPROVED, the linked SelfAssessment is also approved (locked).
        """
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

            await self._ensure_period_allows_score_changes(existing_feedback.period_id, org_id)

            # Business rule: cannot submit already approved feedback
            if existing_feedback.action == SupervisorAction.APPROVED.value:
                raise BadRequestError("Feedback has already been approved")

            # Business rule: can only submit draft or incomplete feedbacks
            if existing_feedback.status == SubmissionStatus.SUBMITTED.value:
                raise BadRequestError("Feedback is already submitted")

            # Validate rating code if provided
            if submit_data.supervisor_rating_code is not None:
                goal = existing_feedback.self_assessment.goal if existing_feedback.self_assessment else None
                if goal is None:
                    raise BadRequestError("Related goal not found")
                await self._validate_goal_category_rating_rules(
                    goal,
                    submit_data.supervisor_rating_code.value
                )

            # Update feedback using dedicated method with submit data
            updated_feedback = await self.supervisor_feedback_repo.submit_feedback(
                feedback_id, submit_data, org_id
            )

            # CRITICAL: If action is APPROVED, also approve the self-assessment
            if submit_data.action == SupervisorAction.APPROVED:
                from .self_assessment_service import SelfAssessmentService
                self_assessment_service = SelfAssessmentService(self.session)
                await self_assessment_service.approve_assessment(
                    existing_feedback.self_assessment_id, org_id
                )
                logger.info(f"Self-assessment {existing_feedback.self_assessment_id} approved via feedback {feedback_id}")

            # Commit transaction
            await self.session.commit()

            # Enrich response data
            enriched_feedback = await self._enrich_feedback_data(updated_feedback)

            logger.info(f"Supervisor feedback submitted: {feedback_id} by {current_user_context.user_id}, action={submit_data.action}")
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

            await self._ensure_period_allows_score_changes(existing_feedback.period_id, org_id)
            
            # Business rule: cannot revert approved feedbacks
            if existing_feedback.action == SupervisorAction.APPROVED.value:
                raise BadRequestError("Cannot revert approved feedback to draft")

            # Business rule: can only draft submitted feedbacks (to revert back to draft)
            if existing_feedback.status != SubmissionStatus.SUBMITTED.value:
                raise BadRequestError("Can only revert submitted feedbacks to draft")
            
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
    async def return_feedback(
        self,
        feedback_id: UUID,
        return_comment: str,
        current_user_context: AuthContext
    ) -> SupervisorFeedback:
        """
        Return feedback for correction (差し戻し).
        Sets return_comment visible to subordinate and reverts SelfAssessment to draft.
        """
        try:
            org_id = current_user_context.organization_id
            if not org_id:
                raise PermissionDeniedError("Organization context required")

            existing_feedback = await self.supervisor_feedback_repo.get_by_id_with_details(feedback_id, org_id)
            if not existing_feedback:
                raise NotFoundError(f"Supervisor feedback with ID {feedback_id} not found")

            await self._check_feedback_update_permission(existing_feedback, current_user_context)

            await self._ensure_period_allows_score_changes(existing_feedback.period_id, org_id)

            if existing_feedback.action == SupervisorAction.APPROVED.value:
                raise BadRequestError("Cannot return approved feedback")

            # Set return_comment on feedback
            updated_feedback = await self.supervisor_feedback_repo.return_feedback(
                feedback_id, return_comment, org_id
            )

            # Revert linked SelfAssessment to draft so subordinate can edit
            from .self_assessment_service import SelfAssessmentService
            self_assessment_service = SelfAssessmentService(self.session)
            await self_assessment_service.revert_to_draft(
                existing_feedback.self_assessment_id, org_id
            )
            logger.info(f"Self-assessment {existing_feedback.self_assessment_id} reverted to draft via feedback return {feedback_id}")

            await self.session.commit()

            enriched_feedback = await self._enrich_feedback_data(updated_feedback)

            logger.info(f"Supervisor feedback returned: {feedback_id} by {current_user_context.user_id}")
            return enriched_feedback

        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error returning feedback {feedback_id}: {str(e)}")
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
            await self._ensure_period_allows_score_changes(existing_feedback.period_id, org_id)
                        
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
        org_id = current_user_context.organization_id
        if org_id:
            assessment = await self.self_assessment_repo.get_by_id_with_details(feedback.self_assessment_id, org_id)
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
        if assessment.status != SelfAssessmentStatus.SUBMITTED.value:
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
        await self._ensure_period_allows_score_changes(feedback_data.period_id, org_id)
        
        # Validate rating code rules based on goal category
        if feedback_data.supervisor_rating_code:
            await self._validate_goal_category_rating_rules(
                goal, feedback_data.supervisor_rating_code.value if hasattr(feedback_data.supervisor_rating_code, 'value') else feedback_data.supervisor_rating_code
            )

    async def _ensure_period_allows_score_changes(self, period_id: UUID, org_id: str) -> None:
        period = await self.evaluation_period_repo.get_by_id(period_id, org_id)
        if not period:
            raise NotFoundError(f"Evaluation period with ID {period_id} not found")

        period_status = str(getattr(period.status, "value", period.status)).lower()
        if period_status in ("completed", "cancelled"):
            raise BadRequestError("Cannot modify scores in completed or cancelled evaluation periods")

    async def _validate_feedback_update(self, feedback_data: SupervisorFeedbackUpdate, existing_feedback: SupervisorFeedbackModel):
        """Validate supervisor feedback update business rules."""
        # Cannot update approved feedback
        if existing_feedback.action == SupervisorAction.APPROVED.value:
            raise BadRequestError("Cannot update an approved feedback")

        # Cannot update submitted feedback (must be reverted to draft first)
        if existing_feedback.status == SubmissionStatus.SUBMITTED.value:
            raise BadRequestError("Cannot update submitted feedback. Revert to draft first.")

        # Validate rating code if provided
        model_fields = getattr(feedback_data, "model_fields_set", set())
        is_rating_code_provided = "supervisor_rating_code" in model_fields if model_fields else feedback_data.supervisor_rating_code is not None

        if is_rating_code_provided and feedback_data.supervisor_rating_code is not None:
            goal = existing_feedback.self_assessment.goal if existing_feedback.self_assessment else None
            if goal is None:
                raise BadRequestError("Related goal not found")
            await self._validate_goal_category_rating_rules(
                goal,
                feedback_data.supervisor_rating_code.value
            )

    async def _validate_goal_category_rating_rules(self, goal, supervisor_rating_code: str = None):
        """
        Validate rating code based on goal category using centralized rating_rules.

        Business Rules:
        - コアバリュー (Core Values): rating code MUST be null, only comment allowed
        - 業績目標 (定量目標): D rating is allowed (for failed targets)
        - コンピテンシー: D rating is NOT allowed (behavioral competencies)

        Note: supervisor_rating_code is always optional per user requirement.
        """
        validate_rating_code_for_goal(
            goal_category=goal.goal_category if goal else None,
            target_data=goal.target_data if goal else None,
            rating_code=supervisor_rating_code,
            actor_name="supervisor"
        )

    async def _enrich_feedback_data(self, feedback_model: SupervisorFeedbackModel) -> SupervisorFeedback:
        """Convert SupervisorFeedbackModel to SupervisorFeedback response schema with enriched data."""
        # Base feedback data with new fields
        feedback_dict = {
            "id": feedback_model.id,
            "self_assessment_id": feedback_model.self_assessment_id,
            "period_id": feedback_model.period_id,
            "supervisor_id": feedback_model.supervisor_id,
            "subordinate_id": feedback_model.subordinate_id,
            "supervisor_rating_code": feedback_model.supervisor_rating_code,
            "supervisor_rating": float(feedback_model.supervisor_rating) if feedback_model.supervisor_rating else None,
            "supervisor_comment": feedback_model.supervisor_comment,
            "return_comment": feedback_model.return_comment,
            "rating_data": feedback_model.rating_data,
            "action": SupervisorAction(feedback_model.action) if feedback_model.action else SupervisorAction.PENDING,
            "status": SubmissionStatus(feedback_model.status),
            "submitted_at": feedback_model.submitted_at,
            "reviewed_at": feedback_model.reviewed_at,
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
        
        # Editable only if not submitted and not approved
        is_editable = (
            feedback_model.status != SubmissionStatus.SUBMITTED.value and
            feedback_model.action != SupervisorAction.APPROVED.value
        )

        # Add all enhanced detail fields
        detail_dict.update({
            # Related object data
            "self_assessment": assessment_data,
            "evaluation_period": evaluation_period_data,
            "subordinate_info": subordinate_data,
            "supervisor_info": supervisor_data,

            # Status and editability
            "is_editable": is_editable,
            "is_overdue": False,  # Placeholder for future deadline check
            "days_until_deadline": None,  # Placeholder for future deadline calculation

            # Context fields
            "goal_category": goal.goal_category if goal else None,
            "goal_title": goal.title if goal else None,
            "goal_description": goal.description if goal else None,
            "evaluation_period_name": feedback_model.period.name if feedback_model.period else None,
        })
        
        return SupervisorFeedbackDetail(**detail_dict)

    async def _convert_assessment_to_schema(self, assessment_model) -> SelfAssessment:
        """Convert SelfAssessment database model to SelfAssessment schema."""
        return SelfAssessment(
            id=assessment_model.id,
            goalId=assessment_model.goal_id,
            periodId=assessment_model.period_id,
            selfRatingCode=assessment_model.self_rating_code,
            selfRating=float(assessment_model.self_rating) if assessment_model.self_rating else None,
            selfComment=assessment_model.self_comment,
            ratingData=assessment_model.rating_data,
            status=SelfAssessmentStatus(assessment_model.status),
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
