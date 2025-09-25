import logging
from typing import Optional, List
from uuid import UUID
from datetime import date, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from ..database.repositories.evaluation_period_repo import EvaluationPeriodRepository
from ..database.models.evaluation import EvaluationPeriod as EvaluationPeriodModel, EvaluationPeriodStatus
from ..schemas.evaluation import (
    EvaluationPeriodCreate, EvaluationPeriodUpdate, EvaluationPeriod, 
    EvaluationPeriodDetail, EvaluationPeriodList
)
from ..schemas.common import PaginationParams
from ..security.context import AuthContext
from ..security.permissions import Permission
from ..core.exceptions import (
    NotFoundError, ConflictError, PermissionDeniedError, BadRequestError
)

logger = logging.getLogger(__name__)


class EvaluationPeriodService:
    """Service layer for evaluation period business logic and operations"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.evaluation_period_repo = EvaluationPeriodRepository(session)
    
    async def create_evaluation_period(
        self, 
        current_user_context: AuthContext, 
        period_data: EvaluationPeriodCreate
    ) -> EvaluationPeriod:
        """Create a new evaluation period."""
        
        # Check permissions - only admins can create evaluation periods
        if not current_user_context.has_permission(Permission.EVALUATION_MANAGE):
            raise PermissionDeniedError("Only administrators can create evaluation periods")
        
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required for evaluation period creation")
        
        try:
            # Validate business rules
            await self._validate_period_creation(period_data, org_id)
            
            period_model = await self.evaluation_period_repo.create_evaluation_period(period_data, org_id)
            await self.session.commit()
            
            logger.info(f"Created evaluation period: {period_model.id} by user: {current_user_context.user_id}")
            
            return EvaluationPeriod.model_validate(period_model)
            
        except Exception as e:
            await self.session.rollback()
            raise

    async def get_evaluation_period(
        self, 
        current_user_context: AuthContext, 
        period_id: UUID
    ) -> EvaluationPeriod:
        """Get an evaluation period by ID.
        
        Currently accessible to all authenticated users.
        TODO: Consider adding user-specific restrictions in the future (may limit non-admin access).
        """
        
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")
        
        period_model = await self.evaluation_period_repo.get_by_id(period_id, org_id)
        if not period_model:
            raise NotFoundError(f"Evaluation period with ID {period_id} not found")
        
        return EvaluationPeriod.model_validate(period_model)

    async def get_evaluation_period_detail(
        self, 
        current_user_context: AuthContext, 
        period_id: UUID
    ) -> EvaluationPeriodDetail:
        """Get detailed evaluation period information with statistics.
        
        Currently accessible to all authenticated users.
        TODO: Consider adding user-specific restrictions in the future (may limit non-admin access).
        """
        
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")
        
        period_model = await self.evaluation_period_repo.get_by_id(period_id, org_id)
        if not period_model:
            raise NotFoundError(f"Evaluation period with ID {period_id} not found")
        
        # Convert to base evaluation period
        period_dict = EvaluationPeriod.model_validate(period_model).model_dump()
        
        # TODO: Calculate statistics when other models are implemented
        # For now, we'll set placeholder values that indicate no data is available yet
        statistics = {
            # Goal statistics - will be calculated when Goal model is implemented
            "total_goals_count": None,
            "active_goals_count": None, 
            "pending_goals_count": None,
            
            # Assessment statistics - will be calculated when SelfAssessment model is implemented
            "total_assessments_count": None,
            "completed_assessments_count": None,
            "pending_assessments_count": None,
            
            # Review statistics - will be calculated when SupervisorReview model is implemented
            "total_reviews_count": None,
            "completed_reviews_count": None,
            "pending_reviews_count": None,
            
            # Feedback statistics - will be calculated when SupervisorFeedback model is implemented
            "total_feedback_count": None,
            "completed_feedback_count": None,
            
            # User participation statistics - will be calculated when user-goal relationships exist
            "total_participants_count": None,
            "active_participants_count": None,
            
            # Timeline information - can be calculated now
            "is_goals_submission_open": self._is_goals_submission_open(period_model),
            "is_evaluation_open": self._is_evaluation_open(period_model),
            "days_remaining": self._calculate_days_remaining(period_model),
            "completion_percentage": None  # Will be calculated when assessment data is available
        }
        
        # Merge period data with statistics
        detail_dict = {**period_dict, **statistics}
        
        return EvaluationPeriodDetail.model_validate(detail_dict)

    async def get_evaluation_periods(
        self, 
        current_user_context: AuthContext,
        status: Optional[EvaluationPeriodStatus] = None,
        pagination: Optional[PaginationParams] = None
    ) -> EvaluationPeriodList:
        """Get evaluation periods with optional filtering.
        
        Currently accessible to all authenticated users.
        TODO: Consider adding user-specific restrictions in the future (may limit non-admin access).
        """
        
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")
        
        try:
            if status:
                periods_models = await self.evaluation_period_repo.get_by_status(status, org_id)
                total = len(periods_models)
            else:
                periods_models = await self.evaluation_period_repo.get_all(org_id, pagination)
                total = await self.evaluation_period_repo.count_all(org_id)
            
            periods = [EvaluationPeriod.model_validate(period) for period in periods_models]
            
            # Calculate pagination info
            page = 1
            size = len(periods)
            has_next = False
            has_prev = False
            
            if pagination:
                page = pagination.page
                size = pagination.limit
                has_next = (pagination.offset + len(periods)) < total
                has_prev = pagination.page > 1
            
            return EvaluationPeriodList(
                evaluation_periods=periods,
                total=total,
                page=page,
                size=size,
                has_next=has_next,
                has_prev=has_prev
            )
            
        except Exception as e:
            logger.error(f"Error getting evaluation periods: {e}")
            raise

    async def get_active_evaluation_period(
        self, 
        current_user_context: AuthContext
    ) -> Optional[EvaluationPeriod]:
        """Get the currently active evaluation period.
        
        Currently accessible to all authenticated users.
        TODO: Consider adding user-specific restrictions in the future (may limit non-admin access).
        """
        
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")
        
        period_model = await self.evaluation_period_repo.get_active_period(org_id)
        if not period_model:
            return None
        
        return EvaluationPeriod.model_validate(period_model)

    async def update_evaluation_period(
        self, 
        current_user_context: AuthContext, 
        period_id: UUID, 
        period_data: EvaluationPeriodUpdate
    ) -> EvaluationPeriod:
        """Update an evaluation period."""
        
        # Check permissions - only admins can update evaluation periods
        if not current_user_context.has_permission(Permission.EVALUATION_MANAGE):
            raise PermissionDeniedError("Only administrators can update evaluation periods")
        
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required for evaluation period update")
        
        try:
            # Check if period exists
            existing_period = await self.evaluation_period_repo.get_by_id(period_id, org_id)
            if not existing_period:
                raise NotFoundError(f"Evaluation period with ID {period_id} not found")
            
            # Validate business rules for update
            await self._validate_period_update(period_id, period_data, existing_period, org_id)
            
            # Update the evaluation period
            updated_period = await self.evaluation_period_repo.update_evaluation_period(period_id, period_data, org_id)
            await self.session.commit()
            
            logger.info(f"Updated evaluation period: {period_id} by user: {current_user_context.user_id}")
            
            return EvaluationPeriod.model_validate(updated_period)
            
        except Exception as e:
            await self.session.rollback()
            raise

    async def update_evaluation_period_status(
        self, 
        current_user_context: AuthContext, 
        period_id: UUID, 
        status: EvaluationPeriodStatus
    ) -> EvaluationPeriod:
        """Update the status of an evaluation period."""
        
        # Check permissions - only admins can update status
        if not current_user_context.has_permission(Permission.EVALUATION_MANAGE):
            raise PermissionDeniedError("Only administrators can update evaluation period status")
        
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required for status update")
        
        try:
            # Check if period exists
            existing_period = await self.evaluation_period_repo.get_by_id(period_id, org_id)
            if not existing_period:
                raise NotFoundError(f"Evaluation period with ID {period_id} not found")
            
            # Validate status transition
            await self._validate_status_transition(existing_period, status, org_id)
            
            # Update status
            updated_period = await self.evaluation_period_repo.update_status(period_id, status, org_id)
            await self.session.commit()
            
            logger.info(f"Updated evaluation period status: {period_id} to {status} by user: {current_user_context.user_id}")
            
            return EvaluationPeriod.model_validate(updated_period)
            
        except Exception as e:
            await self.session.rollback()
            raise

    async def delete_evaluation_period(
        self, 
        current_user_context: AuthContext, 
        period_id: UUID
    ) -> bool:
        """Delete an evaluation period."""
        
        # Check permissions - only admins can delete evaluation periods
        if not current_user_context.has_permission(Permission.EVALUATION_MANAGE):
            raise PermissionDeniedError("Only administrators can delete evaluation periods")
        
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required for deletion")
        
        try:
            # Check if period exists
            existing_period = await self.evaluation_period_repo.get_by_id(period_id, org_id)
            if not existing_period:
                raise NotFoundError(f"Evaluation period with ID {period_id} not found")
            
            # Validate deletion is allowed
            await self._validate_period_deletion(existing_period)
            
            # Delete the evaluation period
            deleted = await self.evaluation_period_repo.delete_evaluation_period(period_id, org_id)
            await self.session.commit()
            
            logger.info(f"Deleted evaluation period: {period_id} by user: {current_user_context.user_id}")
            
            return deleted
            
        except Exception as e:
            await self.session.rollback()
            raise

    # ========================================
    # PRIVATE VALIDATION METHODS
    # ========================================

    async def _validate_period_creation(self, period_data: EvaluationPeriodCreate, org_id: str):
        """Validate business rules for evaluation period creation."""
        
        # Check for name uniqueness
        name_exists = await self.evaluation_period_repo.check_name_exists(period_data.name, org_id)
        if name_exists:
            raise ConflictError(f"Evaluation period with name '{period_data.name}' already exists")
        
        # Check for date overlap with existing periods
        date_overlap = await self.evaluation_period_repo.check_date_overlap(
            period_data.start_date, 
            period_data.end_date,
            org_id
        )
        if date_overlap:
            raise ConflictError("Evaluation period dates overlap with an existing period")
        
        # Additional business rule validations (relaxed for flexibility)
        
        # Goal submission deadline should be reasonable (allow some flexibility)
        if period_data.goal_submission_deadline > period_data.end_date:
            raise BadRequestError("Goal submission deadline should not be after the period end date")
        
        # Evaluation deadline should be reasonable (allow same day or after)
        if period_data.evaluation_deadline < period_data.end_date:
            raise BadRequestError("Evaluation deadline should not be before the period end date")

    async def _validate_period_update(self, period_id: UUID, period_data: EvaluationPeriodUpdate, existing_period: EvaluationPeriodModel, org_id: str):
        """Validate business rules for evaluation period update."""
        
        update_dict = period_data.model_dump(exclude_unset=True)
        
        # Check name uniqueness if name is being updated
        if 'name' in update_dict and update_dict['name'] != existing_period.name:
            name_exists = await self.evaluation_period_repo.check_name_exists(update_dict['name'], org_id, exclude_id=period_id)
            if name_exists:
                raise ConflictError(f"Evaluation period with name '{update_dict['name']}' already exists")
        
        # Check date overlap if dates are being updated
        start_date = update_dict.get('start_date', existing_period.start_date)
        end_date = update_dict.get('end_date', existing_period.end_date)
        
        if 'start_date' in update_dict or 'end_date' in update_dict:
            date_overlap = await self.evaluation_period_repo.check_date_overlap(
                start_date, 
                end_date, 
                org_id,
                exclude_id=period_id
            )
            if date_overlap:
                raise ConflictError("Updated evaluation period dates overlap with an existing period")
        
        # Cannot modify dates if period is active or completed
        if existing_period.status in [EvaluationPeriodStatus.ACTIVE, EvaluationPeriodStatus.COMPLETED]:
            if any(field in update_dict for field in ['start_date', 'end_date', 'goal_submission_deadline']):
                raise BadRequestError(f"Cannot modify dates for {existing_period.status} evaluation period")

    async def _validate_status_transition(self, existing_period: EvaluationPeriodModel, new_status: EvaluationPeriodStatus, org_id: str):
        """Validate that the status transition is allowed."""
        
        current_status = existing_period.status
        
        # Define allowed transitions
        allowed_transitions = {
            EvaluationPeriodStatus.DRAFT: [EvaluationPeriodStatus.ACTIVE],
            EvaluationPeriodStatus.ACTIVE: [EvaluationPeriodStatus.COMPLETED, EvaluationPeriodStatus.CANCELLED],
            EvaluationPeriodStatus.COMPLETED: [],  # No transitions allowed from completed
            EvaluationPeriodStatus.CANCELLED: []  # No transitions allowed from cancelled
        }
        
        if new_status not in allowed_transitions.get(current_status, []):
            raise BadRequestError(f"Cannot transition from {current_status} to {new_status}")
        
        # Additional business rule: Only one active period at a time
        if new_status == EvaluationPeriodStatus.ACTIVE:
            active_period = await self.evaluation_period_repo.get_active_period(org_id)
            if active_period and active_period.id != existing_period.id:
                raise ConflictError("Cannot activate period: another period is already active")

    async def _validate_period_deletion(self, existing_period: EvaluationPeriodModel):
        """Validate that the evaluation period can be deleted."""
        
        # Cannot delete active, completed, or cancelled periods
        if existing_period.status in [EvaluationPeriodStatus.ACTIVE, EvaluationPeriodStatus.COMPLETED, EvaluationPeriodStatus.CANCELLED]:
            raise BadRequestError(f"Cannot delete {existing_period.status} evaluation period")
        
        # TODO: Add validation for existing goals/assessments when those models are implemented
        # if existing_period.goals:
        #     raise BadRequestError("Cannot delete evaluation period that has associated goals")

    # ========================================
    # HELPER METHODS FOR STATISTICS CALCULATION
    # ========================================

    def _is_goals_submission_open(self, period: EvaluationPeriodModel) -> bool:
        """Check if goal submission is still open for this period."""
        today = date.today()
        return (
            period.status == EvaluationPeriodStatus.ACTIVE and
            today <= period.goal_submission_deadline
        )

    def _is_evaluation_open(self, period: EvaluationPeriodModel) -> bool:
        """Check if evaluation is still open for this period."""
        today = date.today()
        return (
            period.status == EvaluationPeriodStatus.ACTIVE and
            period.end_date <= today <= period.evaluation_deadline
        )

    def _calculate_days_remaining(self, period: EvaluationPeriodModel) -> Optional[int]:
        """Calculate days remaining until period end (only for active periods)."""
        if period.status != EvaluationPeriodStatus.ACTIVE:
            return None
        
        today = date.today()
        if today > period.end_date:
            return 0
        
        return (period.end_date - today).days