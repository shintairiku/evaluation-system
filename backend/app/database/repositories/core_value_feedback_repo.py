import logging
from typing import Optional
from uuid import UUID
from datetime import datetime, timezone

from sqlalchemy import select, update, func
from sqlalchemy.orm import joinedload
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.core_value import CoreValueFeedback, CoreValueEvaluation
from ..models.user import User
from ...core.exceptions import NotFoundError, ConflictError, ValidationError
from .base import BaseRepository

logger = logging.getLogger(__name__)


class CoreValueFeedbackRepository(BaseRepository[CoreValueFeedback]):
    """Repository for CoreValueFeedback database operations."""

    def __init__(self, session: AsyncSession):
        super().__init__(session, CoreValueFeedback)

    # ========================================
    # READ OPERATIONS
    # ========================================

    async def get_feedback_by_evaluation(self, cv_eval_id: UUID, org_id: str) -> Optional[CoreValueFeedback]:
        """Get feedback by core value evaluation ID within organization scope."""
        try:
            query = (
                select(CoreValueFeedback)
                .join(CoreValueEvaluation, CoreValueFeedback.core_value_evaluation_id == CoreValueEvaluation.id)
                .join(User, CoreValueEvaluation.user_id == User.id)
                .filter(
                    CoreValueFeedback.core_value_evaluation_id == cv_eval_id,
                    User.clerk_organization_id == org_id
                )
            )
            result = await self.session.execute(query)
            return result.scalars().first()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching feedback for evaluation {cv_eval_id}: {e}")
            raise

    async def get_feedback(self, feedback_id: UUID, org_id: str) -> Optional[CoreValueFeedback]:
        """Get feedback by ID within organization scope."""
        try:
            query = (
                select(CoreValueFeedback)
                .join(CoreValueEvaluation, CoreValueFeedback.core_value_evaluation_id == CoreValueEvaluation.id)
                .join(User, CoreValueEvaluation.user_id == User.id)
                .filter(
                    CoreValueFeedback.id == feedback_id,
                    User.clerk_organization_id == org_id
                )
            )
            result = await self.session.execute(query)
            return result.scalars().first()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching core value feedback {feedback_id}: {e}")
            raise

    async def count_pending_feedback(self, period_id: UUID, supervisor_id: UUID, org_id: str) -> int:
        """Count PENDING feedbacks without return_comment for a supervisor in a period."""
        try:
            query = (
                select(func.count(CoreValueFeedback.id))
                .join(CoreValueEvaluation, CoreValueFeedback.core_value_evaluation_id == CoreValueEvaluation.id)
                .join(User, CoreValueEvaluation.user_id == User.id)
                .filter(
                    CoreValueFeedback.period_id == period_id,
                    CoreValueFeedback.supervisor_id == supervisor_id,
                    CoreValueFeedback.action == "PENDING",
                    CoreValueFeedback.return_comment.is_(None),
                    User.clerk_organization_id == org_id
                )
            )
            result = await self.session.execute(query)
            return result.scalar() or 0
        except SQLAlchemyError as e:
            logger.error(f"Error counting pending feedback: {e}")
            raise

    # ========================================
    # CREATE OPERATIONS
    # ========================================

    async def create_feedback(
        self,
        cv_eval_id: UUID,
        period_id: UUID,
        supervisor_id: UUID,
        subordinate_id: UUID,
        org_id: str
    ) -> CoreValueFeedback:
        """Create a new core value feedback in incomplete/PENDING status."""
        try:
            feedback = CoreValueFeedback(
                core_value_evaluation_id=cv_eval_id,
                period_id=period_id,
                supervisor_id=supervisor_id,
                subordinate_id=subordinate_id,
                action="PENDING",
                status="incomplete"
            )
            self.session.add(feedback)
            await self.session.flush()
            logger.info(f"Created core value feedback for evaluation {cv_eval_id}")
            return feedback
        except IntegrityError as e:
            if "idx_cvf_evaluation_unique" in str(e):
                raise ConflictError(f"Core value feedback already exists for evaluation {cv_eval_id}")
            raise
        except SQLAlchemyError as e:
            logger.error(f"Error creating core value feedback: {e}")
            raise

    # ========================================
    # UPDATE OPERATIONS
    # ========================================

    async def update_feedback(self, feedback_id: UUID, data: dict, org_id: str) -> Optional[CoreValueFeedback]:
        """Update core value feedback scores/comment. Transitions incomplete → draft."""
        try:
            existing = await self._validate_exists(feedback_id, org_id)

            if existing.status == "submitted":
                raise ValidationError("Cannot update submitted feedback")

            update_data = {"updated_at": datetime.now(timezone.utc)}
            if "scores" in data:
                update_data["scores"] = data["scores"]
            if "comment" in data:
                update_data["comment"] = data["comment"]

            # Transition incomplete → draft on first edit
            if existing.status == "incomplete":
                update_data["status"] = "draft"

            await self.session.execute(
                update(CoreValueFeedback)
                .where(CoreValueFeedback.id == feedback_id)
                .values(**update_data)
            )
            return await self.get_feedback(feedback_id, org_id)
        except SQLAlchemyError as e:
            logger.error(f"Error updating core value feedback {feedback_id}: {e}")
            raise

    async def submit_feedback(self, feedback_id: UUID, data: dict, org_id: str) -> Optional[CoreValueFeedback]:
        """
        Submit core value feedback: status=submitted, action=APPROVED, reviewed_at=now.
        Optionally update scores/comment at submission time.
        """
        try:
            existing = await self._validate_exists(feedback_id, org_id)

            if existing.status == "submitted":
                raise ValidationError("Feedback is already submitted")

            now = datetime.now(timezone.utc)
            update_data = {
                "action": "APPROVED",
                "status": "submitted",
                "submitted_at": now,
                "reviewed_at": now,
                "updated_at": now
            }

            if "scores" in data and data["scores"] is not None:
                update_data["scores"] = data["scores"]
            if "comment" in data and data["comment"] is not None:
                update_data["comment"] = data["comment"]

            await self.session.execute(
                update(CoreValueFeedback)
                .where(CoreValueFeedback.id == feedback_id)
                .values(**update_data)
            )

            logger.info(f"Submitted and approved core value feedback {feedback_id}")
            return await self.get_feedback(feedback_id, org_id)
        except SQLAlchemyError as e:
            logger.error(f"Error submitting core value feedback {feedback_id}: {e}")
            raise

    async def set_return_comment(self, feedback_id: UUID, comment: str, org_id: str) -> Optional[CoreValueFeedback]:
        """Set return_comment on feedback (差し戻し)."""
        try:
            existing = await self._validate_exists(feedback_id, org_id)

            if existing.action == "APPROVED":
                raise ValidationError("Cannot return approved feedback")

            await self.session.execute(
                update(CoreValueFeedback)
                .where(CoreValueFeedback.id == feedback_id)
                .values(return_comment=comment, updated_at=datetime.now(timezone.utc))
            )

            logger.info(f"Set return comment on core value feedback {feedback_id}")
            return await self.get_feedback(feedback_id, org_id)
        except SQLAlchemyError as e:
            logger.error(f"Error setting return comment on feedback {feedback_id}: {e}")
            raise

    async def clear_return_comment(self, cv_eval_id: UUID, org_id: str) -> bool:
        """Clear return_comment when employee resubmits."""
        try:
            feedback = await self.get_feedback_by_evaluation(cv_eval_id, org_id)
            if not feedback or not feedback.return_comment:
                return False

            await self.session.execute(
                update(CoreValueFeedback)
                .where(CoreValueFeedback.id == feedback.id)
                .values(return_comment=None, updated_at=datetime.now(timezone.utc))
            )

            logger.info(f"Cleared return_comment for feedback {feedback.id} (evaluation {cv_eval_id})")
            return True
        except SQLAlchemyError as e:
            logger.error(f"Error clearing return_comment for evaluation {cv_eval_id}: {e}")
            raise

    # ========================================
    # HELPER METHODS
    # ========================================

    async def _validate_exists(self, feedback_id: UUID, org_id: str) -> CoreValueFeedback:
        """Validate feedback exists within organization scope."""
        feedback = await self.get_feedback(feedback_id, org_id)
        if not feedback:
            raise NotFoundError(f"Core value feedback not found: {feedback_id}")
        return feedback
