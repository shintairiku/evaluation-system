from __future__ import annotations
import logging
from typing import Optional, List
from uuid import UUID
from datetime import datetime
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
from ..schemas.common import PaginationParams, PaginatedResponse, SubmissionStatus
from ..security.context import AuthContext
from ..security.permissions import Permission
from ..core.exceptions import (
    NotFoundError, PermissionDeniedError, BadRequestError, ValidationError, ConflictError
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
        user_id: Optional[UUID] = None,
        status: Optional[str] = None,
        pagination: Optional[PaginationParams] = None
    ) -> PaginatedResponse[SupervisorFeedback]:
        """
        Get supervisor feedbacks based on current user's permissions and filters.
        
        Access rules:
        - Supervisors: can view their own feedbacks + feedbacks on their subordinates' assessments
        - Employees: can view feedbacks on their own assessments
        - Admins: can view all feedbacks
        """
        try:
            # Determine which feedbacks the current user can access
            accessible_filters = await self._get_accessible_filters(current_user_context, user_id)
            
            # Search feedbacks with filters
            feedbacks = await self.supervisor_feedback_repo.search_feedbacks(
                supervisor_ids=accessible_filters.get("supervisor_ids"),
                user_ids=accessible_filters.get("user_ids"),
                period_id=period_id,
                status=status,
                pagination=pagination
            )
            
            # Get total count for pagination
            total_count = await self.supervisor_feedback_repo.count_feedbacks(
                supervisor_ids=accessible_filters.get("supervisor_ids"),
                user_ids=accessible_filters.get("user_ids"),
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
            
            # Validate required rating is provided for submission (optional based on business rules)
            if existing_feedback.rating is None:
                raise ValidationError("Rating is required before submission")
            
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
        # Admin can manage all feedbacks
        if current_user_context.has_permission(Permission.GOAL_READ_ALL):
            if feedback.status == SubmissionStatus.SUBMITTED.value:
                raise BadRequestError("Cannot update submitted feedbacks")
            return
        
        # Only feedback creator can update their feedback
        if feedback.supervisor_id != current_user_context.user_id:
            raise PermissionDeniedError("You can only update your own supervisor feedbacks")
        
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

    async def _validate_feedback_update(self, feedback_data: SupervisorFeedbackUpdate, existing_feedback: SupervisorFeedbackModel):
        """Validate supervisor feedback update business rules."""
        # Additional business validations can be added here
        pass

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
        
        # Get related assessment and goal for context
        assessment = await self.self_assessment_repo.get_by_id_with_details(feedback_model.self_assessment_id)
        goal = None
        employee_name = None
        
        if assessment:
            goal = await self.goal_repo.get_goal_by_id_with_details(assessment.goal_id)
            if goal and goal.user:
                employee_name = goal.user.display_name or f"{goal.user.first_name} {goal.user.last_name}"
        
        # Add detail fields
        detail_dict.update({
            "is_editable": feedback_model.status == SubmissionStatus.DRAFT.value,
            "is_overdue": False,  # Placeholder for future deadline check
            "days_until_deadline": None,  # Placeholder for future deadline calculation
            "employee_name": employee_name,
            "goal_category": goal.goal_category if goal else None,
            "goal_title": f"{goal.goal_category} Goal" if goal else None,  # Simplified title
        })
        
        return SupervisorFeedbackDetail(**detail_dict)