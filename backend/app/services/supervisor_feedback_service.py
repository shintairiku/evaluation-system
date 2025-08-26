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
    SupervisorFeedbackCreate, SupervisorFeedbackUpdate, SupervisorFeedback, SupervisorFeedbackDetail
)
from ..schemas.self_assessment import SelfAssessment
from ..schemas.evaluation import EvaluationPeriod
from ..schemas.user import UserProfileOption
from ..schemas.common import PaginationParams, PaginatedResponse, SubmissionStatus
from ..security.context import AuthContext
from ..security.permissions import Permission
from ..core.exceptions import (
    NotFoundError, PermissionDeniedError, BadRequestError, ValidationError
)
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
            # First, apply validation for non-admin users who cannot assign arbitrary supervisor_id/subordinate_id
            await self._validate_filtering_permissions(current_user_context, supervisor_id, subordinate_id)
            
            # Apply conditional defaults when both supervisor_id and subordinate_id are None
            actual_supervisor_id = supervisor_id
            actual_subordinate_id = subordinate_id

            if actual_supervisor_id is None and actual_subordinate_id is None:
                # Apply role-based defaults
                if current_user_context.is_admin():
                    # Admin: no change - can see all feedbacks
                    pass
                elif current_user_context.has_any_role(["manager", "supervisor"]) and not current_user_context.is_admin():
                    # Manager/Supervisor (but not admin): default to their own supervisor feedbacks
                    actual_supervisor_id = current_user_context.user_id
                elif current_user_context.has_any_role(["employee", "parttime"]) and not current_user_context.is_admin():
                    # Employee/Part-time (but not admin): default to their own subordinate feedbacks
                    actual_subordinate_id = current_user_context.user_id
            
            # Determine base accessible filters based on user permissions
            accessible_filters = await self._get_accessible_filters(current_user_context, actual_subordinate_id)
            
            # Apply specific supervisor_id and subordinate_id filters with permission checks
            final_supervisor_ids = accessible_filters.get("supervisor_ids")
            final_user_ids = accessible_filters.get("user_ids")
            
            # Handle supervisor_id filter
            if actual_supervisor_id:
                # Check if user has permission to view this supervisor's feedbacks
                if not current_user_context.is_admin():
                    # Non-admin users can only view their own supervisor feedbacks or those they have access to
                    if final_supervisor_ids is None or actual_supervisor_id not in final_supervisor_ids:
                        raise PermissionDeniedError(f"You do not have permission to access feedbacks from supervisor {actual_supervisor_id}")
                final_supervisor_ids = [actual_supervisor_id]
            
            # Handle subordinate_id filter
            if actual_subordinate_id:
                # Check if user has permission to view this subordinate's feedbacks
                if not current_user_context.is_admin():
                    # Non-admin users can only view feedbacks for users they have access to
                    if final_user_ids is None or actual_subordinate_id not in final_user_ids:
                        raise PermissionDeniedError(f"You do not have permission to access feedbacks for user {actual_subordinate_id}")
                final_user_ids = [actual_subordinate_id]
            
            # Search feedbacks with filters
            feedbacks = await self.supervisor_feedback_repo.search_feedbacks(
                supervisor_ids=final_supervisor_ids,
                user_ids=final_user_ids,
                period_id=period_id,
                status=status,
                pagination=pagination
            )
            
            # Get total count for pagination
            total_count = await self.supervisor_feedback_repo.count_feedbacks(
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

    async def get_feedback_by_id(
        self,
        feedback_id: UUID,
        current_user_context: AuthContext
    ) -> SupervisorFeedbackDetail:
        """Get detailed supervisor feedback information by ID with permission checks."""
        try:
            feedback = await self.supervisor_feedback_repo.get_by_id_with_details(feedback_id)
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

    async def get_feedback_for_assessment(
        self,
        self_assessment_id: UUID,
        current_user_context: AuthContext
    ) -> Optional[SupervisorFeedback]:
        """Get supervisor feedback for a specific self-assessment."""
        try:
            # Check if self-assessment exists and user has access
            assessment = await self.self_assessment_repo.get_by_id_with_details(self_assessment_id)
            if not assessment:
                raise NotFoundError(f"Self-assessment with ID {self_assessment_id} not found")
            
            # Permission check via assessment
            await self._check_assessment_access_permission(assessment, current_user_context)
            
            # Get feedback for assessment
            feedback = await self.supervisor_feedback_repo.get_by_self_assessment(self_assessment_id)
            if not feedback:
                return None
            
            # Enrich with additional information
            enriched_feedback = await self._enrich_feedback_data(feedback)
            return enriched_feedback
            
        except Exception as e:
            logger.error(f"Error getting feedback for assessment {self_assessment_id}: {str(e)}")
            raise

    async def create_feedback(
        self,
        feedback_data: SupervisorFeedbackCreate,
        current_user_context: AuthContext
    ) -> SupervisorFeedback:
        """Create a new supervisor feedback with validation and business rules."""
        try:
            # Permission check - must be supervisor or admin
            if not (current_user_context.has_permission(Permission.GOAL_APPROVE) or 
                    current_user_context.has_permission(Permission.GOAL_READ_ALL)):
                raise PermissionDeniedError("You do not have permission to create supervisor feedback")
            
            # Check if self-assessment exists and get assessment details
            assessment = await self.self_assessment_repo.get_by_id_with_details(feedback_data.self_assessment_id)
            if not assessment:
                raise NotFoundError(f"Self-assessment with ID {feedback_data.self_assessment_id} not found")
            
            # Business validation
            await self._validate_feedback_creation(assessment, feedback_data, current_user_context)
            
            # Create feedback
            created_feedback = await self.supervisor_feedback_repo.create_feedback(
                feedback_data, current_user_context.user_id
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

    async def update_feedback(
        self,
        feedback_id: UUID,
        feedback_data: SupervisorFeedbackUpdate,
        current_user_context: AuthContext
    ) -> SupervisorFeedback:
        """Update a supervisor feedback with validation and business rules."""
        try:
            # Check if feedback exists
            existing_feedback = await self.supervisor_feedback_repo.get_by_id_with_details(feedback_id)
            if not existing_feedback:
                raise NotFoundError(f"Supervisor feedback with ID {feedback_id} not found")
            
            # Permission check - only feedback creator can update
            await self._check_feedback_update_permission(existing_feedback, current_user_context)
            
            # Business validation
            await self._validate_feedback_update(feedback_data, existing_feedback)
            
            # Update feedback
            updated_feedback = await self.supervisor_feedback_repo.update_feedback(feedback_id, feedback_data)
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

    async def submit_feedback(
        self,
        feedback_id: UUID,
        current_user_context: AuthContext
    ) -> SupervisorFeedback:
        """Submit a supervisor feedback by changing status to submitted."""
        try:
            # Check if feedback exists and user can update it
            existing_feedback = await self.supervisor_feedback_repo.get_by_id_with_details(feedback_id)
            if not existing_feedback:
                raise NotFoundError(f"Supervisor feedback with ID {feedback_id} not found")
            
            # Permission check - only feedback creator can submit
            await self._check_feedback_update_permission(existing_feedback, current_user_context)
            
            # Business rule: can only submit draft feedbacks
            if existing_feedback.status != SubmissionStatus.DRAFT.value:
                raise BadRequestError("Can only submit draft feedbacks")
            
            # CRITICAL: Validate goal category rating rules before submission
            assessment = await self.self_assessment_repo.get_by_id_with_details(existing_feedback.self_assessment_id)
            if assessment:
                goal = await self.goal_repo.get_goal_by_id(assessment.goal_id)
                if goal:
                    # Create temp object for submission validation
                    temp_feedback = SupervisorFeedbackUpdate(
                        rating=float(existing_feedback.rating) if existing_feedback.rating else None,
                        comment=existing_feedback.comment,
                        status=SubmissionStatus.SUBMITTED
                    )
                    await self._validate_goal_category_rating_rules(goal, temp_feedback)
            
            # Update status using dedicated method
            updated_feedback = await self.supervisor_feedback_repo.submit_feedback(feedback_id)
            
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

    async def draft_feedback(
        self,
        feedback_id: UUID,
        current_user_context: AuthContext
    ) -> SupervisorFeedback:
        """Change a supervisor feedback status to draft."""
        try:
            # Check if feedback exists and user can update it
            existing_feedback = await self.supervisor_feedback_repo.get_by_id_with_details(feedback_id)
            if not existing_feedback:
                raise NotFoundError(f"Supervisor feedback with ID {feedback_id} not found")
            
            # Permission check - only feedback creator can change to draft
            await self._check_feedback_update_permission(existing_feedback, current_user_context)
            
            # Business rule: can only draft submitted feedbacks (to revert back to draft)
            if existing_feedback.status != SubmissionStatus.SUBMITTED.value:
                raise BadRequestError("Can only draft submitted feedbacks")
            
            # Update status using dedicated method
            updated_feedback = await self.supervisor_feedback_repo.draft_feedback(feedback_id)
            
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

    async def delete_feedback(
        self,
        feedback_id: UUID,
        current_user_context: AuthContext
    ) -> bool:
        """Delete a supervisor feedback with permission and business rule checks."""
        try:
            # Check if feedback exists
            existing_feedback = await self.supervisor_feedback_repo.get_by_id_with_details(feedback_id)
            if not existing_feedback:
                raise NotFoundError(f"Supervisor feedback with ID {feedback_id} not found")
            
            # Permission check
            await self._check_feedback_update_permission(existing_feedback, current_user_context)
            
            # Business rule: can only delete draft feedbacks
            if existing_feedback.status != SubmissionStatus.DRAFT.value:
                raise BadRequestError("Can only delete draft feedbacks")
            
            # Delete feedback
            success = await self.supervisor_feedback_repo.delete_feedback(feedback_id)
            
            if success:
                await self.session.commit()
                logger.info(f"Supervisor feedback deleted successfully: {feedback_id}")
            
            return success
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error deleting feedback {feedback_id}: {str(e)}")
            raise

    async def get_pending_feedbacks(
        self,
        current_user_context: AuthContext,
        period_id: Optional[UUID] = None,
        pagination: Optional[PaginationParams] = None
    ) -> PaginatedResponse[SupervisorFeedback]:
        """Get pending supervisor feedbacks that need attention (supervisor only)."""
        try:
            # Permission check
            if not current_user_context.has_permission(Permission.GOAL_APPROVE):
                raise PermissionDeniedError("You do not have permission to view pending feedbacks")
            
            # For supervisors, get submitted assessments from subordinates without feedback
            # This requires a more complex query that we'll implement as a business logic check
            
            # Get all submitted assessments from subordinates
            subordinates = await self.user_repo.get_subordinates(current_user_context.user_id)
            subordinate_ids = [sub.id for sub in subordinates]
            
            if not subordinate_ids:
                # No subordinates, return empty result
                return PaginatedResponse(items=[], total=0, page=1, limit=0, pages=0)
            
            # Get assessments that need feedback
            assessments = await self.self_assessment_repo.search_assessments(
                user_ids=subordinate_ids,
                period_id=period_id,
                status=SubmissionStatus.SUBMITTED.value,
                pagination=pagination
            )
            
            # Filter to those without supervisor feedback or with draft feedback only
            pending_feedbacks = []
            for assessment in assessments:
                feedback = await self.supervisor_feedback_repo.get_by_self_assessment(assessment.id)
                if not feedback or feedback.status == SubmissionStatus.DRAFT.value:
                    # Create a placeholder feedback response or actual draft if exists
                    if feedback:
                        enriched_feedback = await self._enrich_feedback_data(feedback)
                        pending_feedbacks.append(enriched_feedback)
            
            # Count for pagination
            total_count = len(pending_feedbacks)
            
            # Create response
            if pagination:
                total_pages = (total_count + pagination.limit - 1) // pagination.limit
            else:
                total_pages = 1
            
            return PaginatedResponse(
                items=pending_feedbacks,
                total=total_count,
                page=pagination.page if pagination else 1,
                limit=pagination.limit if pagination else len(pending_feedbacks),
                pages=total_pages
            )
            
        except Exception as e:
            logger.error(f"Error getting pending feedbacks: {e}")
            raise

    # ========================================
    # PRIVATE HELPER METHODS
    # ========================================

    async def _get_accessible_filters(
        self,
        current_user_context: AuthContext,
        requested_user_id: Optional[UUID] = None
    ) -> dict:
        """Determine which feedbacks the current user can access."""
        
        filters = {"supervisor_ids": None, "user_ids": None}
        
        if current_user_context.has_permission(Permission.GOAL_READ_ALL):
            # Admin: can see all feedbacks
            if requested_user_id:
                filters["user_ids"] = [requested_user_id]
            return filters  # No restrictions
        
        accessible_supervisor_ids = []
        accessible_user_ids = []
        
        # Add self as supervisor if user has feedback creation permissions
        if current_user_context.has_permission(Permission.GOAL_APPROVE):
            accessible_supervisor_ids.append(current_user_context.user_id)
        
        # Add self as user if user has goal read permissions (can see feedback on own assessments)
        if current_user_context.has_permission(Permission.GOAL_READ_SELF):
            accessible_user_ids.append(current_user_context.user_id)
        
        if current_user_context.has_permission(Permission.GOAL_READ_SUBORDINATES):
            # Supervisor: can see feedback on subordinates' assessments
            subordinates = await self.user_repo.get_subordinates(current_user_context.user_id)
            accessible_user_ids.extend([sub.id for sub in subordinates])
        
        # If specific user requested, check if accessible
        if requested_user_id:
            if requested_user_id not in accessible_user_ids:
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
        Validate that non-admin users cannot assign arbitrary supervisor_id/subordinate_id values.
        
        Business rules:
        - Admin: can assign any supervisor_id or subordinate_id
        - Manager/Supervisor: cannot assign supervisor_id other than their own, cannot assign subordinate_id to users who aren't their subordinates
        - Employee/Part-time: cannot assign supervisor_id, can only assign subordinate_id to themselves
        """
        if current_user_context.is_admin():
            return  # Admin can assign any values
        
        # Validation for supervisor_id parameter
        if supervisor_id:
            if current_user_context.has_any_role(["manager", "supervisor"]):
                # Manager/Supervisor: can only assign their own user_id to supervisor_id
                if supervisor_id != current_user_context.user_id:
                    raise PermissionDeniedError("Managers and supervisors can only filter by their own supervisor feedbacks")
            elif current_user_context.has_any_role(["employee", "parttime"]):
                # Employee/Part-time: cannot assign supervisor_id at all
                raise PermissionDeniedError("Employees and part-time users cannot filter by supervisor_id")
        
        # Validation for subordinate_id parameter
        if subordinate_id:
            if current_user_context.has_any_role(["manager", "supervisor"]):
                # Manager/Supervisor: can only assign subordinate_id to their actual subordinates
                subordinates = await self.user_repo.get_subordinates(current_user_context.user_id)
                subordinate_ids = [sub.id for sub in subordinates]
                subordinate_ids.append(current_user_context.user_id)  # Can also view their own
                
                if subordinate_id not in subordinate_ids:
                    raise PermissionDeniedError("You can only filter by feedbacks for your subordinates or yourself")
                    
            elif current_user_context.has_any_role(["employee", "parttime"]):
                # Employee/Part-time: can only assign their own user_id to subordinate_id
                if subordinate_id != current_user_context.user_id:
                    raise PermissionDeniedError("Employees and part-time users can only filter by their own received feedbacks")

    async def _check_assessment_access_permission(self, assessment, current_user_context: AuthContext):
        """Check if user has permission to access this assessment (reuse from self-assessment service)."""
        # Get the related goal to check ownership
        goal = await self.goal_repo.get_goal_by_id(assessment.goal_id)
        if not goal:
            raise NotFoundError("Related goal not found")
        
        if current_user_context.has_permission(Permission.GOAL_READ_ALL):
            return  # Admin can access all
        
        if goal.user_id == current_user_context.user_id:
            # Verify user has permission to read own goals
            if current_user_context.has_permission(Permission.GOAL_READ_SELF):
                return  # Own assessment with proper permission
        
        if current_user_context.has_permission(Permission.GOAL_READ_SUBORDINATES):
            # Check if assessment owner is subordinate
            subordinates = await self.user_repo.get_subordinates(current_user_context.user_id)
            subordinate_ids = [sub.id for sub in subordinates]
            if goal.user_id in subordinate_ids:
                return
        
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
        
        # Check if feedback is still editable
        if feedback.status == SubmissionStatus.SUBMITTED.value:
            raise BadRequestError("Cannot update submitted feedbacks")

    async def _validate_feedback_creation(self, assessment, feedback_data: SupervisorFeedbackCreate, current_user_context: AuthContext):
        """Validate supervisor feedback creation business rules."""
        # Check if assessment is submitted (can only give feedback on submitted assessments)
        if assessment.status != SubmissionStatus.SUBMITTED.value:
            raise BadRequestError("Can only create feedback for submitted self-assessments")
        
        # Check if current user is supervisor of assessment owner
        goal = await self.goal_repo.get_goal_by_id(assessment.goal_id)
        if not goal:
            raise BadRequestError("Related goal not found")
        
        # Verify supervisor relationship (unless admin)
        if not current_user_context.has_permission(Permission.GOAL_READ_ALL):
            subordinates = await self.user_repo.get_subordinates(current_user_context.user_id)
            subordinate_ids = [sub.id for sub in subordinates]
            if goal.user_id not in subordinate_ids:
                raise PermissionDeniedError("You can only provide feedback for your subordinates")
        
        # Check if evaluation period allows feedback
        period = await self.evaluation_period_repo.get_by_id(feedback_data.period_id)
        if not period:
            raise BadRequestError(f"Evaluation period {feedback_data.period_id} not found")
        
        # CRITICAL: Validate rating requirements based on goal category
        await self._validate_goal_category_rating_rules(goal, feedback_data)

    async def _validate_feedback_update(self, feedback_data: SupervisorFeedbackUpdate, existing_feedback: SupervisorFeedbackModel):
        """Validate supervisor feedback update business rules."""
        # CRITICAL: Validate rating rules for goal category during updates
        if feedback_data.rating is not None:
            # Get goal via assessment to validate category rules
            assessment = await self.self_assessment_repo.get_by_id_with_details(existing_feedback.self_assessment_id)
            if assessment:
                goal = await self.goal_repo.get_goal_by_id(assessment.goal_id)
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