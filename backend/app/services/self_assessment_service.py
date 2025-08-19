from __future__ import annotations
import logging
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from cachetools import TTLCache

from ..database.repositories.self_assessment_repo import SelfAssessmentRepository
from ..database.repositories.goal_repo import GoalRepository
from ..database.repositories.user_repo import UserRepository
from ..database.repositories.evaluation_period_repo import EvaluationPeriodRepository
from ..database.models.self_assessment import SelfAssessment as SelfAssessmentModel
from ..schemas.self_assessment import (
    SelfAssessmentCreate, SelfAssessmentUpdate, SelfAssessment, SelfAssessmentDetail
)
from ..schemas.common import PaginationParams, PaginatedResponse, SubmissionStatus
from ..security.context import AuthContext
from ..security.permissions import Permission
from ..core.exceptions import (
    NotFoundError, PermissionDeniedError, BadRequestError, ValidationError, ConflictError
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
        try:
            # Determine which users' assessments the current user can access
            accessible_user_ids = await self._get_accessible_user_ids(current_user_context, user_id)
            
            # Search assessments with filters
            assessments = await self.self_assessment_repo.search_assessments(
                user_ids=accessible_user_ids,
                period_id=period_id,
                status=status,
                pagination=pagination
            )
            
            # Get total count for pagination
            total_count = await self.self_assessment_repo.count_assessments(
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
        try:
            # Check if goal exists and user has access
            goal = await self.goal_repo.get_goal_by_id(goal_id)
            if not goal:
                raise NotFoundError(f"Goal with ID {goal_id} not found")
            
            # Permission check
            await self._check_goal_access_permission(goal, current_user_context)
            
            # Get assessment for goal
            assessment = await self.self_assessment_repo.get_by_goal(goal_id)
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
        try:
            assessment = await self.self_assessment_repo.get_by_id_with_details(assessment_id)
            if not assessment:
                raise NotFoundError(f"Self-assessment with ID {assessment_id} not found")
            
            # Permission check
            await self._check_assessment_access_permission(assessment, current_user_context)
            
            # Enrich with detailed information
            enriched_assessment = await self._enrich_assessment_detail_data(assessment)
            return enriched_assessment
            
        except Exception as e:
            logger.error(f"Error getting assessment {assessment_id}: {str(e)}")
            raise

    async def create_assessment(
        self,
        goal_id: UUID,
        assessment_data: SelfAssessmentCreate,
        current_user_context: AuthContext
    ) -> SelfAssessment:
        """Create a new self-assessment with validation and business rules."""
        try:
            # Check if user has permission to manage self assessments
            if not current_user_context.has_permission(Permission.ASSESSMENT_MANAGE_SELF):
                raise PermissionDeniedError("You do not have permission to manage self-assessments")
            
            # Check if goal exists and get goal details
            goal = await self.goal_repo.get_goal_by_id(goal_id)
            if not goal:
                raise NotFoundError(f"Goal with ID {goal_id} not found")
            
            # Permission check - only goal owner can create self-assessment
            if goal.user_id != current_user_context.user_id:
                raise PermissionDeniedError("You can only create self-assessments for your own goals")
            
            # Business validation
            await self._validate_assessment_creation(goal, assessment_data)
            
            # Create assessment
            created_assessment = await self.self_assessment_repo.create_assessment(assessment_data, goal_id)
            
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

    async def update_assessment(
        self,
        assessment_id: UUID,
        assessment_data: SelfAssessmentUpdate,
        current_user_context: AuthContext
    ) -> SelfAssessment:
        """Update a self-assessment with validation and business rules."""
        try:
            # Check if assessment exists
            existing_assessment = await self.self_assessment_repo.get_by_id_with_details(assessment_id)
            if not existing_assessment:
                raise NotFoundError(f"Self-assessment with ID {assessment_id} not found")
            
            # Permission check - only assessment owner can update
            await self._check_assessment_update_permission(existing_assessment, current_user_context)
            
            # Business validation
            await self._validate_assessment_update(assessment_data, existing_assessment)
            
            # Update assessment
            updated_assessment = await self.self_assessment_repo.update_assessment(assessment_id, assessment_data)
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

    async def submit_assessment(
        self,
        assessment_id: UUID,
        current_user_context: AuthContext
    ) -> SelfAssessment:
        """Submit a self-assessment by changing status to submitted."""
        try:
            # Check if assessment exists and user can update it
            existing_assessment = await self.self_assessment_repo.get_by_id_with_details(assessment_id)
            if not existing_assessment:
                raise NotFoundError(f"Self-assessment with ID {assessment_id} not found")
            
            # Permission check - only assessment owner can submit
            await self._check_assessment_update_permission(existing_assessment, current_user_context)
            
            # Business rule: can only submit draft assessments
            if existing_assessment.status != SubmissionStatus.DRAFT.value:
                raise BadRequestError("Can only submit draft assessments")
            
            # Validate required rating is provided for submission
            if existing_assessment.self_rating is None:
                raise ValidationError("Self-rating is required before submission")
            
            # Update status using dedicated method
            updated_assessment = await self.self_assessment_repo.submit_assessment(assessment_id)
            
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

    async def delete_assessment(
        self,
        assessment_id: UUID,
        current_user_context: AuthContext
    ) -> bool:
        """Delete a self-assessment with permission and business rule checks."""
        try:
            # Check if assessment exists
            existing_assessment = await self.self_assessment_repo.get_by_id_with_details(assessment_id)
            if not existing_assessment:
                raise NotFoundError(f"Self-assessment with ID {assessment_id} not found")
            
            # Permission check
            await self._check_assessment_update_permission(existing_assessment, current_user_context)
            
            # Business rule: can only delete draft assessments
            if existing_assessment.status != SubmissionStatus.DRAFT.value:
                raise BadRequestError("Can only delete draft assessments")
            
            # Delete assessment
            success = await self.self_assessment_repo.delete_assessment(assessment_id)
            
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

    async def _get_accessible_user_ids(
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
            subordinates = await self.user_repo.get_subordinates(current_user_context.user_id)
            accessible_ids.extend([sub.id for sub in subordinates])
        
        # If specific user requested, check if accessible
        if requested_user_id:
            if requested_user_id not in accessible_ids:
                raise PermissionDeniedError(f"You do not have permission to access assessments for user {requested_user_id}")
            return [requested_user_id]
        
        return accessible_ids

    async def _check_goal_access_permission(self, goal, current_user_context: AuthContext):
        """Check if user has permission to access this goal's assessment."""
        if current_user_context.has_permission(Permission.ASSESSMENT_READ_ALL):
            return  # Admin can access all
        
        if goal.user_id == current_user_context.user_id:
            # Verify user has permission to read own assessments
            if current_user_context.has_permission(Permission.ASSESSMENT_READ_SELF):
                return  # Own goal with proper permission
        
        if current_user_context.has_permission(Permission.ASSESSMENT_READ_SUBORDINATES):
            # Check if goal owner is subordinate
            subordinates = await self.user_repo.get_subordinates(current_user_context.user_id)
            subordinate_ids = [sub.id for sub in subordinates]
            if goal.user_id in subordinate_ids:
                return
        
        raise PermissionDeniedError("You do not have permission to access this goal's assessment")

    async def _check_assessment_access_permission(self, assessment: SelfAssessmentModel, current_user_context: AuthContext):
        """Check if user has permission to access this assessment."""
        # Get the related goal to check ownership
        goal = await self.goal_repo.get_goal_by_id(assessment.goal_id)
        if not goal:
            raise NotFoundError("Related goal not found")
        
        await self._check_goal_access_permission(goal, current_user_context)

    async def _check_assessment_update_permission(self, assessment: SelfAssessmentModel, current_user_context: AuthContext):
        """Check if user has permission to update this assessment."""
        # Check if user has permission to manage self assessments
        if not current_user_context.has_permission(Permission.ASSESSMENT_MANAGE_SELF):
            raise PermissionDeniedError("You do not have permission to manage self-assessments")
        
        # Get the related goal to check ownership
        goal = await self.goal_repo.get_goal_by_id(assessment.goal_id)
        if not goal:
            raise NotFoundError("Related goal not found")
        
        # Only goal owner can update their self-assessment
        if goal.user_id != current_user_context.user_id:
            raise PermissionDeniedError("You can only update your own self-assessments")
        
        # Check if assessment is still editable
        if assessment.status == SubmissionStatus.SUBMITTED.value:
            raise BadRequestError("Cannot update submitted assessments")

    async def _validate_assessment_creation(self, goal, assessment_data: SelfAssessmentCreate):
        """Validate self-assessment creation business rules."""
        # Check if goal is approved (can only assess approved goals)
        if goal.status != "approved":
            raise BadRequestError("Can only create self-assessments for approved goals")
        
        # Check if evaluation period allows self-assessment
        period = await self.evaluation_period_repo.get_by_id(goal.period_id)
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

    async def _enrich_assessment_detail_data(self, assessment_model: SelfAssessmentModel) -> SelfAssessmentDetail:
        """Convert SelfAssessmentModel to SelfAssessmentDetail response schema with enriched data."""
        # Start with basic assessment data
        base_assessment = await self._enrich_assessment_data(assessment_model)
        detail_dict = base_assessment.model_dump()
        
        # Get related goal for context
        goal = await self.goal_repo.get_goal_by_id(assessment_model.goal_id)
        
        # Add detail fields
        detail_dict.update({
            "is_editable": assessment_model.status == SubmissionStatus.DRAFT.value,
            "is_overdue": False,  # Placeholder for future deadline check
            "days_until_deadline": None,  # Placeholder for future deadline calculation
            "goal_category": goal.goal_category if goal else None,
            "goal_status": goal.status if goal else None,
        })
        
        return SelfAssessmentDetail(**detail_dict)