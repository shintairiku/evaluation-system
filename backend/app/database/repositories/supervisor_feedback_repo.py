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
from ...schemas.supervisor_feedback import SupervisorFeedbackCreate, SupervisorFeedbackUpdate, SupervisorFeedbackSubmit
from ...schemas.common import PaginationParams, SubmissionStatus, RatingCode, RATING_CODE_VALUES
from ...schemas.supervisor_review import SupervisorAction
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
            
            # Auto-calculate supervisor_rating from rating_code
            supervisor_rating = None
            if feedback_data.supervisor_rating_code:
                supervisor_rating = Decimal(str(RATING_CODE_VALUES.get(feedback_data.supervisor_rating_code, 0.0)))

            # Get subordinate_id from the self-assessment's goal owner
            subordinate_id = None
            if self_assessment.goal:
                subordinate_id = self_assessment.goal.user_id

            # Create feedback with validated data
            feedback = SupervisorFeedback(
                self_assessment_id=feedback_data.self_assessment_id,
                period_id=feedback_data.period_id,
                supervisor_id=supervisor_id,
                subordinate_id=subordinate_id,
                supervisor_rating_code=feedback_data.supervisor_rating_code.value if feedback_data.supervisor_rating_code else None,
                supervisor_rating=supervisor_rating,
                supervisor_comment=feedback_data.supervisor_comment,
                rating_data=feedback_data.rating_data,
                action=feedback_data.action.value if feedback_data.action else SupervisorAction.PENDING.value,
                status=feedback_data.status.value if feedback_data.status else SubmissionStatus.INCOMPLETE.value
            )
            
            self.session.add(feedback)
            logger.info(f"Added supervisor feedback to session: self_assessment_id={feedback_data.self_assessment_id}")
            return feedback
            
        except IntegrityError as e:
            logger.error(f"Integrity error creating supervisor feedback for assessment {feedback_data.self_assessment_id}: {e}")
            if "chk_supervisor_feedback_rating_bounds" in str(e):
                raise ValidationError("Supervisor rating must be between 0 and 7")
            elif "chk_supervisor_rating_code" in str(e):
                raise ValidationError("Invalid rating code. Must be one of: SS, S, A, B, C, D")
            elif "chk_supervisor_feedback_status" in str(e):
                raise ValidationError("Invalid status. Must be one of: incomplete, draft, submitted")
            elif "chk_supervisor_feedback_action" in str(e):
                raise ValidationError("Invalid action. Must be PENDING or APPROVED")
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
        """Get supervisor feedback by self-assessment ID within organization scope."""
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
        subordinate_ids: Optional[List[UUID]] = None,
        period_id: Optional[UUID] = None,
        status: Optional[str] = None,
        action: Optional[str] = None,
        user_ids: Optional[List[UUID]] = None,  # For filtering by assessment owner (alias for subordinate_ids)
        pagination: Optional[PaginationParams] = None
    ) -> List[SupervisorFeedback]:
        """Search supervisor feedbacks with various filters within organization scope."""
        try:
            if supervisor_ids is not None and len(supervisor_ids) == 0:
                return []
            if subordinate_ids is not None and len(subordinate_ids) == 0:
                return []
            if user_ids is not None and len(user_ids) == 0:
                return []

            from ..models.goal import Goal
            from ..models.user import User

            query = (
                select(SupervisorFeedback)
                .options(
                    joinedload(SupervisorFeedback.self_assessment).joinedload(SelfAssessment.goal).joinedload(Goal.user),
                    joinedload(SupervisorFeedback.supervisor),
                    joinedload(SupervisorFeedback.subordinate),
                    joinedload(SupervisorFeedback.period)
                )
                .join(SelfAssessment, SupervisorFeedback.self_assessment_id == SelfAssessment.id)
                .join(Goal, SelfAssessment.goal_id == Goal.id)
                .join(User, Goal.user_id == User.id)
                .filter(User.clerk_organization_id == org_id)
            )

            # Apply filters
            if supervisor_ids is not None:
                query = query.filter(SupervisorFeedback.supervisor_id.in_(supervisor_ids))

            if subordinate_ids is not None:
                query = query.filter(SupervisorFeedback.subordinate_id.in_(subordinate_ids))

            if period_id:
                query = query.filter(SupervisorFeedback.period_id == period_id)

            if status:
                query = query.filter(SupervisorFeedback.status == status)

            if action:
                query = query.filter(SupervisorFeedback.action == action)

            if user_ids is not None:
                # Filter by assessment owners (employees) - already joined with Goal
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
        org_id: str,
        supervisor_ids: Optional[List[UUID]] = None,
        subordinate_ids: Optional[List[UUID]] = None,
        period_id: Optional[UUID] = None,
        status: Optional[str] = None,
        action: Optional[str] = None,
        user_ids: Optional[List[UUID]] = None
    ) -> int:
        """Count supervisor feedbacks matching the given filters within organization scope."""
        try:
            if supervisor_ids is not None and len(supervisor_ids) == 0:
                return 0
            if subordinate_ids is not None and len(subordinate_ids) == 0:
                return 0
            if user_ids is not None and len(user_ids) == 0:
                return 0

            from ..models.goal import Goal
            from ..models.user import User

            query = (
                select(func.count(SupervisorFeedback.id))
                .join(SelfAssessment, SupervisorFeedback.self_assessment_id == SelfAssessment.id)
                .join(Goal, SelfAssessment.goal_id == Goal.id)
                .join(User, Goal.user_id == User.id)
                .filter(User.clerk_organization_id == org_id)
            )

            # Apply same filters as search_feedbacks
            if supervisor_ids is not None:
                query = query.filter(SupervisorFeedback.supervisor_id.in_(supervisor_ids))

            if subordinate_ids is not None:
                query = query.filter(SupervisorFeedback.subordinate_id.in_(subordinate_ids))

            if period_id:
                query = query.filter(SupervisorFeedback.period_id == period_id)

            if status:
                query = query.filter(SupervisorFeedback.status == status)

            if action:
                query = query.filter(SupervisorFeedback.action == action)

            if user_ids is not None:
                # Filter by assessment owners (employees) - already joined with Goal
                query = query.filter(Goal.user_id.in_(user_ids))

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

            # Check if feedback can be updated (not submitted)
            if existing_feedback.status == SubmissionStatus.SUBMITTED.value:
                raise ValidationError("Cannot update submitted feedback")

            # Build update dictionary
            update_data = {}

            # Handle supervisor_rating_code - use model_fields_set to detect explicit null
            if hasattr(feedback_data, 'model_fields_set') and 'supervisor_rating_code' in feedback_data.model_fields_set:
                if feedback_data.supervisor_rating_code is not None:
                    update_data["supervisor_rating_code"] = feedback_data.supervisor_rating_code.value
                    # Auto-calculate supervisor_rating from code
                    update_data["supervisor_rating"] = Decimal(str(RATING_CODE_VALUES.get(feedback_data.supervisor_rating_code, 0.0)))
                else:
                    # Explicitly clear the rating
                    update_data["supervisor_rating_code"] = None
                    update_data["supervisor_rating"] = None
            elif feedback_data.supervisor_rating_code is not None:
                # Fallback for when model_fields_set is not available
                update_data["supervisor_rating_code"] = feedback_data.supervisor_rating_code.value
                update_data["supervisor_rating"] = Decimal(str(RATING_CODE_VALUES.get(feedback_data.supervisor_rating_code, 0.0)))

            if feedback_data.supervisor_comment is not None:
                update_data["supervisor_comment"] = feedback_data.supervisor_comment

            if feedback_data.rating_data is not None:
                update_data["rating_data"] = feedback_data.rating_data

            # If any data was provided, change status to draft if still incomplete
            if update_data and existing_feedback.status == SubmissionStatus.INCOMPLETE.value:
                update_data["status"] = SubmissionStatus.DRAFT.value

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
            if "chk_supervisor_feedback_rating_bounds" in str(e):
                raise ValidationError("Supervisor rating must be between 0 and 7")
            elif "chk_supervisor_rating_code" in str(e):
                raise ValidationError("Invalid rating code. Must be one of: SS, S, A, B, C, D")
            elif "chk_supervisor_feedback_submission" in str(e):
                raise ValidationError("Submitted feedback must have submitted_at timestamp")
            else:
                raise ConflictError(f"Database constraint violation: {e}")
        except ValueError as e:
            logger.error(f"Validation error updating supervisor feedback {feedback_id}: {e}")
            raise ValidationError(str(e))
        except SQLAlchemyError as e:
            logger.error(f"Database error updating supervisor feedback {feedback_id}: {e}")
            raise

    async def submit_feedback(
        self,
        feedback_id: UUID,
        submit_data: SupervisorFeedbackSubmit,
        org_id: str
    ) -> Optional[SupervisorFeedback]:
        """
        Submit supervisor feedback with approval.
        Persists requested action, sets status=submitted.
        Rating and comment are optional.
        """
        try:
            # Validate feedback exists within organization scope
            existing_feedback = await self._validate_feedback_exists(feedback_id, org_id)

            # Check if already submitted
            if existing_feedback.status == SubmissionStatus.SUBMITTED.value:
                raise ValidationError("Feedback is already submitted")

            now = datetime.now(timezone.utc)

            # Build update dictionary
            action_value = submit_data.action.value
            update_data = {
                "action": action_value,
                "status": SubmissionStatus.SUBMITTED.value,
                "submitted_at": now,
                "updated_at": now
            }

            if action_value == SupervisorAction.APPROVED.value:
                update_data["reviewed_at"] = now
            else:
                update_data["reviewed_at"] = None

            # Optional: update rating if provided
            if submit_data.supervisor_rating_code is not None:
                update_data["supervisor_rating_code"] = submit_data.supervisor_rating_code.value
                update_data["supervisor_rating"] = Decimal(str(RATING_CODE_VALUES.get(submit_data.supervisor_rating_code, 0.0)))

            # Optional: update comment if provided
            if submit_data.supervisor_comment is not None:
                update_data["supervisor_comment"] = submit_data.supervisor_comment

            # Optional: update rating_data if provided
            if submit_data.rating_data is not None:
                update_data["rating_data"] = submit_data.rating_data

            await self.session.execute(
                update(SupervisorFeedback)
                .where(SupervisorFeedback.id == feedback_id)
                .values(**update_data)
            )

            logger.info(f"Submitted supervisor feedback {feedback_id} with action={action_value}")
            return await self.get_by_id(feedback_id, org_id)

        except SQLAlchemyError as e:
            logger.error(f"Database error submitting supervisor feedback {feedback_id}: {e}")
            raise

    async def draft_feedback(self, feedback_id: UUID, org_id: str) -> Optional[SupervisorFeedback]:
        """Change a supervisor feedback status to draft within organization scope."""
        try:
            # Validate feedback exists within organization scope
            existing_feedback = await self._validate_feedback_exists(feedback_id, org_id)

            # Can only change to draft if not yet submitted/approved
            if existing_feedback.action == SupervisorAction.APPROVED.value:
                raise ValidationError("Cannot change approved feedback to draft (self-assessment is already locked)")

            # Update status to draft, reset approval fields
            update_data = {
                "status": SubmissionStatus.DRAFT.value,
                "action": SupervisorAction.PENDING.value,
                "submitted_at": None,
                "reviewed_at": None,
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

            # Check if feedback can be deleted (not submitted/approved)
            if existing_feedback.status == SubmissionStatus.SUBMITTED.value:
                raise ValidationError("Cannot delete submitted feedback")
            if existing_feedback.action == SupervisorAction.APPROVED.value:
                raise ValidationError("Cannot delete approved feedback")

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
        """Validate self-assessment exists within organization scope and return it with goal loaded."""
        from ..models.user import User

        result = await self.session.execute(
            select(SelfAssessment)
            .options(joinedload(SelfAssessment.goal))
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
