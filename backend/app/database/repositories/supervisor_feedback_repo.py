import logging
from typing import Optional, List
from uuid import UUID
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select, update, delete, and_, or_, func
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
from .base import BaseRepository

logger = logging.getLogger(__name__)


class SupervisorFeedbackRepository(BaseRepository[SupervisorFeedback]):
    """Repository for SupervisorFeedback database operations following established patterns"""

    def __init__(self, session: AsyncSession):
        super().__init__(session, SupervisorFeedback)

    # ========================================
    # CREATE OPERATIONS
    # ========================================

    async def create_feedback(self, feedback_data: SupervisorFeedbackCreate, supervisor_id: UUID, org_id: str) -> SupervisorFeedback:
        """
        Create a new supervisor feedback from SupervisorFeedbackCreate schema with validation within organization scope.
        Adds to session (does not commit - let service layer handle transactions).
        """
        try:
            # Validate self-assessment exists first within organization scope
            self_assessment = await self._validate_self_assessment_exists(feedback_data.self_assessment_id, org_id)
            
            # Check if feedback already exists for this self-assessment within organization scope
            existing = await self.get_by_self_assessment(feedback_data.self_assessment_id, org_id)
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

    async def get_by_id(self, feedback_id: UUID, org_id: str) -> Optional[SupervisorFeedback]:
        """Get supervisor feedback by ID within organization scope."""
        try:
            from ..models.goal import Goal
            from ..models.user import User
            
            query = (
                select(SupervisorFeedback)
                .join(SelfAssessment, SupervisorFeedback.self_assessment_id == SelfAssessment.id)
                .join(Goal, SelfAssessment.goal_id == Goal.id)
                .join(User, Goal.user_id == User.id)
                .filter(
                    SupervisorFeedback.id == feedback_id,
                    User.clerk_organization_id == org_id
                )
            )
            result = await self.session.execute(query)
            return result.scalars().first()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching supervisor feedback by ID {feedback_id} in org {org_id}: {e}")
            raise

    async def get_by_id_with_details(self, feedback_id: UUID, org_id: str) -> Optional[SupervisorFeedback]:
        """Get supervisor feedback by ID with all related data for SupervisorFeedbackDetail response within organization scope."""
        try:
            from ..models.goal import Goal
            from ..models.user import User
            
            query = (
                select(SupervisorFeedback)
                .options(
                    # Self-assessment with complete goal and user details
                    joinedload(SupervisorFeedback.self_assessment).joinedload(SelfAssessment.goal).joinedload(Goal.user),
                    # Evaluation period for context
                    joinedload(SupervisorFeedback.period),
                    # Supervisor user data
                    joinedload(SupervisorFeedback.supervisor)
                )
                .join(SelfAssessment, SupervisorFeedback.self_assessment_id == SelfAssessment.id)
                .join(Goal, SelfAssessment.goal_id == Goal.id)
                .join(User, Goal.user_id == User.id)
                .filter(
                    SupervisorFeedback.id == feedback_id,
                    User.clerk_organization_id == org_id
                )
            )
            result = await self.session.execute(query)
            return result.scalars().unique().first()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching supervisor feedback details for ID {feedback_id} in org {org_id}: {e}")
            raise

    async def get_by_self_assessment(self, self_assessment_id: UUID, org_id: str) -> Optional[SupervisorFeedback]:
        """Get supervisor feedback by self-assessment ID within organization scope (legacy model)."""
        try:
            from ..models.goal import Goal
            from ..models.user import User

            query = (
                select(SupervisorFeedback)
                .join(SelfAssessment, SupervisorFeedback.self_assessment_id == SelfAssessment.id)
                .join(Goal, SelfAssessment.goal_id == Goal.id)
                .join(User, Goal.user_id == User.id)
                .filter(
                    SupervisorFeedback.self_assessment_id == self_assessment_id,
                    User.clerk_organization_id == org_id
                )
            )
            result = await self.session.execute(query)
            return result.scalars().first()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching supervisor feedback for self-assessment {self_assessment_id} in org {org_id}: {e}")
            raise

    async def get_by_user_and_period(
        self,
        user_id: UUID,
        period_id: UUID,
        org_id: str
    ) -> Optional[SupervisorFeedback]:
        """Get supervisor feedback by user and period (new bucket-based model) within organization scope."""
        try:
            from ..models.user import User

            query = (
                select(SupervisorFeedback)
                .join(User, SupervisorFeedback.user_id == User.id)
                .filter(
                    SupervisorFeedback.user_id == user_id,
                    SupervisorFeedback.period_id == period_id,
                    User.clerk_organization_id == org_id
                )
            )
            result = await self.session.execute(query)
            return result.scalars().first()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching supervisor feedback for user {user_id}, period {period_id} in org {org_id}: {e}")
            raise

    async def get_by_supervisor_and_period(
        self, 
        supervisor_id: UUID, 
        period_id: UUID,
        org_id: str
    ) -> List[SupervisorFeedback]:
        """Get all supervisor feedbacks for a supervisor in a specific period within organization scope."""
        try:
            from ..models.goal import Goal
            from ..models.user import User
            
            query = (
                select(SupervisorFeedback)
                .options(
                    joinedload(SupervisorFeedback.self_assessment).joinedload(SelfAssessment.goal).joinedload(Goal.user)
                )
                .join(SelfAssessment, SupervisorFeedback.self_assessment_id == SelfAssessment.id)
                .join(Goal, SelfAssessment.goal_id == Goal.id)
                .join(User, Goal.user_id == User.id)
                .filter(
                    and_(
                        SupervisorFeedback.supervisor_id == supervisor_id,
                        SupervisorFeedback.period_id == period_id,
                        User.clerk_organization_id == org_id
                    )
                )
                .order_by(SupervisorFeedback.created_at.desc())
            )
            result = await self.session.execute(query)
            return result.scalars().unique().all()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching supervisor feedbacks for supervisor {supervisor_id}, period {period_id} in org {org_id}: {e}")
            raise

    async def get_by_period(
        self, 
        period_id: UUID,
        org_id: str,
        status: Optional[str] = None,
        pagination: Optional[PaginationParams] = None
    ) -> List[SupervisorFeedback]:
        """Get supervisor feedbacks by period with optional status filter within organization scope."""
        try:
            from ..models.goal import Goal
            from ..models.user import User
            
            query = (
                select(SupervisorFeedback)
                .options(
                    joinedload(SupervisorFeedback.self_assessment).joinedload(SelfAssessment.goal).joinedload(Goal.user),
                    joinedload(SupervisorFeedback.supervisor)
                )
                .join(SelfAssessment, SupervisorFeedback.self_assessment_id == SelfAssessment.id)
                .join(Goal, SelfAssessment.goal_id == Goal.id)
                .join(User, Goal.user_id == User.id)
                .filter(
                    SupervisorFeedback.period_id == period_id,
                    User.clerk_organization_id == org_id
                )
            )
            
            if status:
                query = query.filter(SupervisorFeedback.status == status)
            
            query = query.order_by(SupervisorFeedback.created_at.desc())
            
            if pagination:
                query = query.offset(pagination.offset).limit(pagination.limit)
            
            result = await self.session.execute(query)
            return result.scalars().unique().all()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching supervisor feedbacks for period {period_id} in org {org_id}: {e}")
            raise

    async def get_by_status(
        self, 
        status: str,
        org_id: str,
        supervisor_id: Optional[UUID] = None,
        period_id: Optional[UUID] = None,
        pagination: Optional[PaginationParams] = None
    ) -> List[SupervisorFeedback]:
        """Get supervisor feedbacks by status with optional filters within organization scope."""
        try:
            from ..models.goal import Goal
            from ..models.user import User
            
            query = (
                select(SupervisorFeedback)
                .options(
                    joinedload(SupervisorFeedback.self_assessment).joinedload(SelfAssessment.goal).joinedload(Goal.user),
                    joinedload(SupervisorFeedback.supervisor)
                )
                .join(SelfAssessment, SupervisorFeedback.self_assessment_id == SelfAssessment.id)
                .join(Goal, SelfAssessment.goal_id == Goal.id)
                .join(User, Goal.user_id == User.id)
                .filter(
                    SupervisorFeedback.status == status,
                    User.clerk_organization_id == org_id
                )
            )
            
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
            logger.error(f"Error fetching supervisor feedbacks by status {status} in org {org_id}: {e}")
            raise

    async def search_feedbacks(
        self,
        org_id: str,
        supervisor_ids: Optional[List[UUID]] = None,
        period_id: Optional[UUID] = None,
        status: Optional[str] = None,
        user_ids: Optional[List[UUID]] = None,  # For filtering by assessment owner OR bucket-based user_id
        pagination: Optional[PaginationParams] = None
    ) -> List[SupervisorFeedback]:
        """
        Search supervisor feedbacks with various filters within organization scope.

        Supports both models:
        - Legacy: self_assessment_id → goal → user (goal-based feedback)
        - New: user_id (bucket-based feedback)
        """
        try:
            from ..models.goal import Goal
            from ..models.user import User

            # Use LEFT JOINs to support both legacy and bucket-based feedbacks
            # Create alias for supervisor user to check organization
            from sqlalchemy.orm import aliased
            SupervisorUser = aliased(User)

            query = (
                select(SupervisorFeedback)
                .options(
                    joinedload(SupervisorFeedback.self_assessment).joinedload(SelfAssessment.goal).joinedload(Goal.user),
                    joinedload(SupervisorFeedback.supervisor),
                    joinedload(SupervisorFeedback.period),
                    joinedload(SupervisorFeedback.user)  # For bucket-based feedbacks
                )
                .outerjoin(SelfAssessment, SupervisorFeedback.self_assessment_id == SelfAssessment.id)
                .outerjoin(Goal, SelfAssessment.goal_id == Goal.id)
                .outerjoin(User, Goal.user_id == User.id)
                # For bucket-based feedbacks, join supervisor to get org_id
                .join(SupervisorUser, SupervisorFeedback.supervisor_id == SupervisorUser.id)
                .filter(SupervisorUser.clerk_organization_id == org_id)
            )

            # Apply filters
            if supervisor_ids:
                query = query.filter(SupervisorFeedback.supervisor_id.in_(supervisor_ids))

            if period_id:
                query = query.filter(SupervisorFeedback.period_id == period_id)

            if status:
                query = query.filter(SupervisorFeedback.status == status)

            if user_ids:
                # Filter by EITHER:
                # 1. Legacy model: Goal.user_id (for goal-based feedbacks)
                # 2. New model: SupervisorFeedback.user_id (for bucket-based feedbacks)
                query = query.filter(
                    or_(
                        Goal.user_id.in_(user_ids),  # Legacy model
                        SupervisorFeedback.user_id.in_(user_ids)  # New model
                    )
                )

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
        org_id: str,
        supervisor_ids: Optional[List[UUID]] = None,
        period_id: Optional[UUID] = None,
        status: Optional[str] = None,
        user_ids: Optional[List[UUID]] = None
    ) -> int:
        """
        Count supervisor feedbacks matching the given filters within organization scope.

        Supports both models:
        - Legacy: self_assessment_id → goal → user (goal-based feedback)
        - New: user_id (bucket-based feedback)
        """
        try:
            from ..models.goal import Goal
            from ..models.user import User
            from sqlalchemy.orm import aliased

            # Create alias for supervisor user to check organization
            SupervisorUser = aliased(User)

            query = (
                select(func.count(SupervisorFeedback.id))
                .outerjoin(SelfAssessment, SupervisorFeedback.self_assessment_id == SelfAssessment.id)
                .outerjoin(Goal, SelfAssessment.goal_id == Goal.id)
                .outerjoin(User, Goal.user_id == User.id)
                # For bucket-based feedbacks, join supervisor to get org_id
                .join(SupervisorUser, SupervisorFeedback.supervisor_id == SupervisorUser.id)
                .filter(SupervisorUser.clerk_organization_id == org_id)
            )

            # Apply same filters as search_feedbacks
            if supervisor_ids:
                query = query.filter(SupervisorFeedback.supervisor_id.in_(supervisor_ids))

            if period_id:
                query = query.filter(SupervisorFeedback.period_id == period_id)

            if status:
                query = query.filter(SupervisorFeedback.status == status)

            if user_ids:
                # Filter by EITHER:
                # 1. Legacy model: Goal.user_id (for goal-based feedbacks)
                # 2. New model: SupervisorFeedback.user_id (for bucket-based feedbacks)
                query = query.filter(
                    or_(
                        Goal.user_id.in_(user_ids),  # Legacy model
                        SupervisorFeedback.user_id.in_(user_ids)  # New model
                    )
                )

            result = await self.session.execute(query)
            return result.scalar() or 0
        except SQLAlchemyError as e:
            logger.error(f"Error counting supervisor feedbacks in org {org_id}: {e}")
            raise

    # ========================================
    # UPDATE OPERATIONS
    # ========================================

    async def update_feedback(self, feedback_id: UUID, feedback_data: SupervisorFeedbackUpdate, org_id: str) -> Optional[SupervisorFeedback]:
        """Update a supervisor feedback with new data, including validation within organization scope."""
        try:
            # Validate feedback exists first within organization scope
            existing_feedback = await self._validate_feedback_exists(feedback_id, org_id)
            
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
            return await self.get_by_id(feedback_id, org_id)
            
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

    async def submit_feedback(self, feedback_id: UUID, org_id: str) -> Optional[SupervisorFeedback]:
        """Submit a supervisor feedback by changing status to submitted within organization scope."""
        try:
            # Validate feedback exists and is in draft status within organization scope
            existing_feedback = await self._validate_feedback_exists(feedback_id, org_id)
            
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
            return await self.get_by_id(feedback_id, org_id)
            
        except SQLAlchemyError as e:
            logger.error(f"Database error submitting supervisor feedback {feedback_id}: {e}")
            raise

    async def draft_feedback(self, feedback_id: UUID, org_id: str) -> Optional[SupervisorFeedback]:
        """Change a supervisor feedback status to draft within organization scope."""
        try:
            # Validate feedback exists and is in submitted status within organization scope
            existing_feedback = await self._validate_feedback_exists(feedback_id, org_id)
            
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
            return await self.get_by_id(feedback_id, org_id)
            
        except SQLAlchemyError as e:
            logger.error(f"Database error drafting supervisor feedback {feedback_id}: {e}")
            raise

    # ========================================
    # DELETE OPERATIONS
    # ========================================

    async def delete_feedback(self, feedback_id: UUID, org_id: str) -> bool:
        """Delete a supervisor feedback by ID with validation within organization scope."""
        try:
            # Validate feedback exists first within organization scope
            existing_feedback = await self._validate_feedback_exists(feedback_id, org_id)
            
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

    async def _validate_self_assessment_exists(self, self_assessment_id: UUID, org_id: str) -> SelfAssessment:
        """Validate self-assessment exists within organization scope and return it, raise NotFoundError if not."""
        from ..models.user import User
        
        result = await self.session.execute(
            select(SelfAssessment)
            .join(Goal, SelfAssessment.goal_id == Goal.id)
            .join(User, Goal.user_id == User.id)
            .filter(
                SelfAssessment.id == self_assessment_id,
                User.clerk_organization_id == org_id
            )
        )
        self_assessment = result.scalars().first()
        if not self_assessment:
            raise NotFoundError(f"Self-assessment not found in organization: {self_assessment_id}")
        return self_assessment

    async def _validate_feedback_exists(self, feedback_id: UUID, org_id: str) -> SupervisorFeedback:
        """Validate feedback exists within organization scope and return it, raise NotFoundError if not."""
        feedback = await self.get_by_id(feedback_id, org_id)
        if not feedback:
            raise NotFoundError(f"Supervisor feedback not found in organization: {feedback_id}")
        return feedback