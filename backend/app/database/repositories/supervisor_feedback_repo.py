import logging
from typing import Optional, List
from uuid import UUID
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select, update, delete, and_, func
from sqlalchemy.orm import joinedload
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.supervisor_feedback import SupervisorFeedback
from ..models.self_assessment import SelfAssessment
from ..models.goal import Goal
from ...schemas.supervisor_feedback import SupervisorFeedbackCreate, SupervisorFeedbackUpdate
from ...schemas.common import PaginationParams, SubmissionStatus
from ...core.exceptions import (
    NotFoundError, ConflictError, ValidationError
)

logger = logging.getLogger(__name__)


class SupervisorFeedbackRepository:
    """Repository for SupervisorFeedback database operations following established patterns"""

    def __init__(self, session: AsyncSession):
        self.session = session

    # ========================================
    # CREATE OPERATIONS
    # ========================================

    async def create_feedback(self, feedback_data: SupervisorFeedbackCreate, supervisor_id: UUID) -> SupervisorFeedback:
        """
        Create a new supervisor feedback from SupervisorFeedbackCreate schema with validation.
        Adds to session (does not commit - let service layer handle transactions).
        """
        try:
            # Validate self-assessment exists first
            self_assessment = await self._validate_self_assessment_exists(feedback_data.self_assessment_id)
            
            # Check if feedback already exists for this self-assessment
            existing = await self.get_by_self_assessment(feedback_data.self_assessment_id)
            if existing:
                raise ConflictError(f"Supervisor feedback already exists for self-assessment {feedback_data.self_assessment_id}")
            
            # Create feedback with validated data
            feedback = SupervisorFeedback(
                self_assessment_id=feedback_data.self_assessment_id,
                period_id=feedback_data.period_id,
                supervisor_id=supervisor_id,
                rating=Decimal(str(feedback_data.rating)) if feedback_data.rating is not None else None,
                comment=feedback_data.comment,
                status=feedback_data.status.value if feedback_data.status else SubmissionStatus.DRAFT.value
            )
            
            self.session.add(feedback)
            logger.info(f"Added supervisor feedback to session: self_assessment_id={feedback_data.self_assessment_id}")
            return feedback
            
        except IntegrityError as e:
            logger.error(f"Integrity error creating supervisor feedback for assessment {feedback_data.self_assessment_id}: {e}")
            if "check_feedback_rating_bounds" in str(e):
                raise ValidationError("Feedback rating must be between 0 and 100")
            elif "check_feedback_status_values" in str(e):
                raise ValidationError("Invalid status value")
            elif "idx_supervisor_feedback_assessment_unique" in str(e):
                raise ConflictError("Supervisor feedback already exists for this self-assessment")
            else:
                raise ConflictError(f"Database constraint violation: {e}")
        except ValueError as e:
            logger.error(f"Validation error creating supervisor feedback for assessment {feedback_data.self_assessment_id}: {e}")
            raise ValidationError(str(e))
        except SQLAlchemyError as e:
            logger.error(f"Database error creating supervisor feedback for assessment {feedback_data.self_assessment_id}: {e}")
            raise

    # ========================================
    # READ OPERATIONS
    # ========================================

    async def get_by_id(self, feedback_id: UUID) -> Optional[SupervisorFeedback]:
        """Get supervisor feedback by ID."""
        try:
            result = await self.session.execute(
                select(SupervisorFeedback).filter(SupervisorFeedback.id == feedback_id)
            )
            return result.scalars().first()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching supervisor feedback by ID {feedback_id}: {e}")
            raise

    async def get_by_id_with_details(self, feedback_id: UUID) -> Optional[SupervisorFeedback]:
        """Get supervisor feedback by ID with all related data for SupervisorFeedbackDetail response."""
        try:
            result = await self.session.execute(
                select(SupervisorFeedback)
                .options(
                    # Self-assessment with complete goal and user details
                    joinedload(SupervisorFeedback.self_assessment).joinedload(SelfAssessment.goal).joinedload(Goal.user),
                    # Evaluation period for context
                    joinedload(SupervisorFeedback.period),
                    # Supervisor user data
                    joinedload(SupervisorFeedback.supervisor)
                )
                .filter(SupervisorFeedback.id == feedback_id)
            )
            return result.scalars().unique().first()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching supervisor feedback details for ID {feedback_id}: {e}")
            raise

    async def get_by_self_assessment(self, self_assessment_id: UUID) -> Optional[SupervisorFeedback]:
        """Get supervisor feedback by self-assessment ID."""
        try:
            result = await self.session.execute(
                select(SupervisorFeedback).filter(SupervisorFeedback.self_assessment_id == self_assessment_id)
            )
            return result.scalars().first()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching supervisor feedback for self-assessment {self_assessment_id}: {e}")
            raise

    async def get_by_supervisor_and_period(
        self, 
        supervisor_id: UUID, 
        period_id: UUID
    ) -> List[SupervisorFeedback]:
        """Get all supervisor feedbacks for a supervisor in a specific period."""
        try:
            result = await self.session.execute(
                select(SupervisorFeedback)
                .options(
                    joinedload(SupervisorFeedback.self_assessment).joinedload(SelfAssessment.goal).joinedload(Goal.user)
                )
                .filter(
                    and_(
                        SupervisorFeedback.supervisor_id == supervisor_id,
                        SupervisorFeedback.period_id == period_id
                    )
                )
                .order_by(SupervisorFeedback.created_at.desc())
            )
            return result.scalars().unique().all()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching supervisor feedbacks for supervisor {supervisor_id}, period {period_id}: {e}")
            raise

    async def get_by_period(
        self, 
        period_id: UUID,
        status: Optional[str] = None,
        pagination: Optional[PaginationParams] = None
    ) -> List[SupervisorFeedback]:
        """Get supervisor feedbacks by period with optional status filter."""
        try:
            query = select(SupervisorFeedback).options(
                joinedload(SupervisorFeedback.self_assessment).joinedload(SelfAssessment.goal).joinedload(Goal.user),
                joinedload(SupervisorFeedback.supervisor)
            ).filter(SupervisorFeedback.period_id == period_id)
            
            if status:
                query = query.filter(SupervisorFeedback.status == status)
            
            query = query.order_by(SupervisorFeedback.created_at.desc())
            
            if pagination:
                query = query.offset(pagination.offset).limit(pagination.limit)
            
            result = await self.session.execute(query)
            return result.scalars().unique().all()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching supervisor feedbacks for period {period_id}: {e}")
            raise

    async def get_by_status(
        self, 
        status: str,
        supervisor_id: Optional[UUID] = None,
        period_id: Optional[UUID] = None,
        pagination: Optional[PaginationParams] = None
    ) -> List[SupervisorFeedback]:
        """Get supervisor feedbacks by status with optional filters."""
        try:
            query = select(SupervisorFeedback).options(
                joinedload(SupervisorFeedback.self_assessment).joinedload(SelfAssessment.goal).joinedload(Goal.user),
                joinedload(SupervisorFeedback.supervisor)
            ).filter(SupervisorFeedback.status == status)
            
            if supervisor_id:
                query = query.filter(SupervisorFeedback.supervisor_id == supervisor_id)
            
            if period_id:
                query = query.filter(SupervisorFeedback.period_id == period_id)
            
            query = query.order_by(SupervisorFeedback.created_at.desc())
            
            if pagination:
                query = query.offset(pagination.offset).limit(pagination.limit)
            
            result = await self.session.execute(query)
            return result.scalars().unique().all()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching supervisor feedbacks by status {status}: {e}")
            raise

    async def search_feedbacks(
        self,
        supervisor_ids: Optional[List[UUID]] = None,
        period_id: Optional[UUID] = None,
        status: Optional[str] = None,
        user_ids: Optional[List[UUID]] = None,  # For filtering by assessment owner
        pagination: Optional[PaginationParams] = None
    ) -> List[SupervisorFeedback]:
        """Search supervisor feedbacks with various filters."""
        try:
            query = select(SupervisorFeedback).options(
                joinedload(SupervisorFeedback.self_assessment).joinedload(SelfAssessment.goal).joinedload(Goal.user),
                joinedload(SupervisorFeedback.supervisor),
                joinedload(SupervisorFeedback.period)
            )
            
            # Apply filters
            if supervisor_ids:
                query = query.filter(SupervisorFeedback.supervisor_id.in_(supervisor_ids))
            
            if period_id:
                query = query.filter(SupervisorFeedback.period_id == period_id)
            
            if status:
                query = query.filter(SupervisorFeedback.status == status)
            
            if user_ids:
                # Filter by assessment owners (employees)
                query = query.join(SelfAssessment, SupervisorFeedback.self_assessment_id == SelfAssessment.id)
                query = query.join(Goal, SelfAssessment.goal_id == Goal.id)
                query = query.filter(Goal.user_id.in_(user_ids))
            
            # Apply ordering
            query = query.order_by(SupervisorFeedback.created_at.desc())
            
            # Apply pagination
            if pagination:
                query = query.offset(pagination.offset).limit(pagination.limit)
            
            result = await self.session.execute(query)
            return result.scalars().unique().all()
        except SQLAlchemyError as e:
            logger.error(f"Error searching supervisor feedbacks: {e}")
            raise

    async def count_feedbacks(
        self,
        supervisor_ids: Optional[List[UUID]] = None,
        period_id: Optional[UUID] = None,
        status: Optional[str] = None,
        user_ids: Optional[List[UUID]] = None
    ) -> int:
        """Count supervisor feedbacks matching the given filters."""
        try:
            query = select(func.count(SupervisorFeedback.id))
            
            # Apply same filters as search_feedbacks
            if supervisor_ids:
                query = query.filter(SupervisorFeedback.supervisor_id.in_(supervisor_ids))
            
            if period_id:
                query = query.filter(SupervisorFeedback.period_id == period_id)
            
            if status:
                query = query.filter(SupervisorFeedback.status == status)
            
            if user_ids:
                query = query.join(SelfAssessment, SupervisorFeedback.self_assessment_id == SelfAssessment.id)
                query = query.join(Goal, SelfAssessment.goal_id == Goal.id)
                query = query.filter(Goal.user_id.in_(user_ids))
            
            result = await self.session.execute(query)
            return result.scalar() or 0
        except SQLAlchemyError as e:
            logger.error(f"Error counting supervisor feedbacks: {e}")
            raise

    # ========================================
    # UPDATE OPERATIONS
    # ========================================

    async def update_feedback(self, feedback_id: UUID, feedback_data: SupervisorFeedbackUpdate) -> Optional[SupervisorFeedback]:
        """Update a supervisor feedback with new data, including validation."""
        try:
            # Validate feedback exists first
            existing_feedback = await self._validate_feedback_exists(feedback_id)
            
            # Build update dictionary
            update_data = {}
            
            if feedback_data.rating is not None:
                update_data["rating"] = Decimal(str(feedback_data.rating))
            
            if feedback_data.comment is not None:
                update_data["comment"] = feedback_data.comment
            
            # Execute update if there are changes
            if update_data:
                update_data["updated_at"] = datetime.now(timezone.utc)
                await self.session.execute(
                    update(SupervisorFeedback)
                    .where(SupervisorFeedback.id == feedback_id)
                    .values(**update_data)
                )
            
            # Return updated feedback
            return await self.get_by_id(feedback_id)
            
        except IntegrityError as e:
            logger.error(f"Integrity error updating supervisor feedback {feedback_id}: {e}")
            if "check_feedback_rating_bounds" in str(e):
                raise ValidationError("Feedback rating must be between 0 and 100")
            elif "check_feedback_status_values" in str(e):
                raise ValidationError("Invalid status value")
            elif "check_feedback_submission_required" in str(e):
                raise ValidationError("Submitted feedback must have submitted_at timestamp")
            else:
                raise ConflictError(f"Database constraint violation: {e}")
        except ValueError as e:
            logger.error(f"Validation error updating supervisor feedback {feedback_id}: {e}")
            raise ValidationError(str(e))
        except SQLAlchemyError as e:
            logger.error(f"Database error updating supervisor feedback {feedback_id}: {e}")
            raise

    async def submit_feedback(self, feedback_id: UUID) -> Optional[SupervisorFeedback]:
        """Submit a supervisor feedback by changing status to submitted."""
        try:
            # Validate feedback exists and is in draft status
            existing_feedback = await self._validate_feedback_exists(feedback_id)
            
            if existing_feedback.status != SubmissionStatus.DRAFT.value:
                raise ValidationError("Can only submit draft feedbacks")
            
            # Update status and set submitted_at
            update_data = {
                "status": SubmissionStatus.SUBMITTED.value,
                "submitted_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
            
            await self.session.execute(
                update(SupervisorFeedback)
                .where(SupervisorFeedback.id == feedback_id)
                .values(**update_data)
            )
            
            logger.info(f"Submitted supervisor feedback {feedback_id}")
            return await self.get_by_id(feedback_id)
            
        except SQLAlchemyError as e:
            logger.error(f"Database error submitting supervisor feedback {feedback_id}: {e}")
            raise

    async def draft_feedback(self, feedback_id: UUID) -> Optional[SupervisorFeedback]:
        """Change a supervisor feedback status to draft."""
        try:
            # Validate feedback exists and is in submitted status
            existing_feedback = await self._validate_feedback_exists(feedback_id)
            
            if existing_feedback.status != SubmissionStatus.SUBMITTED.value:
                raise ValidationError("Can only draft submitted feedbacks")
            
            # Update status and clear submitted_at
            update_data = {
                "status": SubmissionStatus.DRAFT.value,
                "submitted_at": None,
                "updated_at": datetime.now(timezone.utc)
            }
            
            await self.session.execute(
                update(SupervisorFeedback)
                .where(SupervisorFeedback.id == feedback_id)
                .values(**update_data)
            )
            
            logger.info(f"Changed supervisor feedback {feedback_id} to draft")
            return await self.get_by_id(feedback_id)
            
        except SQLAlchemyError as e:
            logger.error(f"Database error drafting supervisor feedback {feedback_id}: {e}")
            raise

    # ========================================
    # DELETE OPERATIONS
    # ========================================

    async def delete_feedback(self, feedback_id: UUID) -> bool:
        """Delete a supervisor feedback by ID with validation."""
        try:
            # Validate feedback exists first
            existing_feedback = await self._validate_feedback_exists(feedback_id)
            
            # Check if feedback can be deleted (only draft feedbacks)
            if existing_feedback.status == SubmissionStatus.SUBMITTED.value:
                raise ValidationError("Cannot delete submitted feedbacks")
            
            result = await self.session.execute(
                delete(SupervisorFeedback).where(SupervisorFeedback.id == feedback_id)
            )
            
            deleted = result.rowcount > 0
            if deleted:
                logger.info(f"Deleted supervisor feedback {feedback_id}")
            
            return deleted
            
        except SQLAlchemyError as e:
            logger.error(f"Database error deleting supervisor feedback {feedback_id}: {e}")
            raise

    # ========================================
    # HELPER METHODS
    # ========================================

    async def _validate_self_assessment_exists(self, self_assessment_id: UUID) -> SelfAssessment:
        """Validate self-assessment exists and return it, raise NotFoundError if not."""
        result = await self.session.execute(
            select(SelfAssessment).filter(SelfAssessment.id == self_assessment_id)
        )
        self_assessment = result.scalars().first()
        if not self_assessment:
            raise NotFoundError(f"Self-assessment not found: {self_assessment_id}")
        return self_assessment

    async def _validate_feedback_exists(self, feedback_id: UUID) -> SupervisorFeedback:
        """Validate feedback exists and return it, raise NotFoundError if not."""
        feedback = await self.get_by_id(feedback_id)
        if not feedback:
            raise NotFoundError(f"Supervisor feedback not found: {feedback_id}")
        return feedback