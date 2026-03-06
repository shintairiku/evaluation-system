import logging
from typing import Optional, List, Dict
from uuid import UUID
from datetime import datetime, timezone

from sqlalchemy import select, update, and_, func
from sqlalchemy.orm import joinedload
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.core_value import CoreValueEvaluation
from ..models.user import User
from ...core.exceptions import NotFoundError, ConflictError, ValidationError
from ...schemas.common import SelfAssessmentStatus
from ...schemas.core_value import CoreValueFeedbackAction
from .base import BaseRepository

logger = logging.getLogger(__name__)


class CoreValueEvaluationRepository(BaseRepository[CoreValueEvaluation]):
    """Repository for CoreValueEvaluation database operations."""

    def __init__(self, session: AsyncSession):
        super().__init__(session, CoreValueEvaluation)

    # ========================================
    # READ OPERATIONS
    # ========================================

    async def get_evaluation(self, period_id: UUID, user_id: UUID, org_id: str) -> Optional[CoreValueEvaluation]:
        """Get a core value evaluation by period and user within organization scope."""
        try:
            query = (
                select(CoreValueEvaluation)
                .options(joinedload(CoreValueEvaluation.feedback))
                .join(User, CoreValueEvaluation.user_id == User.id)
                .filter(
                    CoreValueEvaluation.period_id == period_id,
                    CoreValueEvaluation.user_id == user_id,
                    User.clerk_organization_id == org_id
                )
            )
            result = await self.session.execute(query)
            return result.scalars().unique().first()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching core value evaluation for period {period_id}, user {user_id}: {e}")
            raise

    async def get_by_id(self, eval_id: UUID, org_id: str) -> Optional[CoreValueEvaluation]:
        """Get a core value evaluation by ID within organization scope."""
        try:
            query = (
                select(CoreValueEvaluation)
                .options(joinedload(CoreValueEvaluation.feedback))
                .join(User, CoreValueEvaluation.user_id == User.id)
                .filter(
                    CoreValueEvaluation.id == eval_id,
                    User.clerk_organization_id == org_id
                )
            )
            result = await self.session.execute(query)
            return result.scalars().unique().first()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching core value evaluation {eval_id}: {e}")
            raise

    async def get_evaluation_status_by_users(
        self,
        user_ids: List[UUID],
        period_id: UUID,
        org_id: str
    ) -> Dict[str, Dict[str, str]]:
        """
        Batch get evaluation statuses for multiple users.
        Returns dict: { user_id_str: { "status": "...", "action": "..." } }
        """
        if not user_ids:
            return {}

        try:
            from ..models.core_value import CoreValueFeedback

            query = (
                select(
                    CoreValueEvaluation.user_id,
                    CoreValueEvaluation.status,
                    CoreValueFeedback.action
                )
                .outerjoin(CoreValueFeedback, CoreValueFeedback.core_value_evaluation_id == CoreValueEvaluation.id)
                .join(User, CoreValueEvaluation.user_id == User.id)
                .filter(
                    CoreValueEvaluation.period_id == period_id,
                    CoreValueEvaluation.user_id.in_(user_ids),
                    User.clerk_organization_id == org_id
                )
            )
            result = await self.session.execute(query)
            rows = result.all()

            status_map = {}
            for row in rows:
                status_map[str(row[0])] = {
                    "status": row[1],
                    "action": row[2] or CoreValueFeedbackAction.PENDING.value
                }
            return status_map
        except SQLAlchemyError as e:
            logger.error(f"Error batch fetching core value evaluation statuses: {e}")
            raise

    # ========================================
    # CREATE OPERATIONS
    # ========================================

    async def create_evaluation(self, period_id: UUID, user_id: UUID, org_id: str) -> CoreValueEvaluation:
        """Create a new core value evaluation in draft status."""
        try:
            evaluation = CoreValueEvaluation(
                period_id=period_id,
                user_id=user_id,
                status=SelfAssessmentStatus.DRAFT.value
            )
            self.session.add(evaluation)
            await self.session.flush()
            logger.info(f"Created core value evaluation for period {period_id}, user {user_id}")
            return evaluation
        except IntegrityError as e:
            if "uq_cv_eval" in str(e):
                raise ConflictError(f"Core value evaluation already exists for period {period_id}, user {user_id}")
            raise
        except SQLAlchemyError as e:
            logger.error(f"Error creating core value evaluation: {e}")
            raise

    # ========================================
    # UPDATE OPERATIONS
    # ========================================

    async def update_evaluation(self, eval_id: UUID, data: dict, org_id: str) -> Optional[CoreValueEvaluation]:
        """Update core value evaluation scores/comment. Only if draft."""
        try:
            existing = await self._validate_exists(eval_id, org_id)

            if existing.status != SelfAssessmentStatus.DRAFT.value:
                raise ValidationError("Cannot update evaluation that is not in draft status")

            update_data = {"updated_at": datetime.now(timezone.utc)}
            if "scores" in data:
                update_data["scores"] = data["scores"]
            if "comment" in data:
                update_data["comment"] = data["comment"]

            await self.session.execute(
                update(CoreValueEvaluation)
                .where(CoreValueEvaluation.id == eval_id)
                .values(**update_data)
            )
            return await self.get_by_id(eval_id, org_id)
        except SQLAlchemyError as e:
            logger.error(f"Error updating core value evaluation {eval_id}: {e}")
            raise

    async def submit_evaluation(self, eval_id: UUID, org_id: str) -> Optional[CoreValueEvaluation]:
        """Submit core value evaluation: draft → submitted."""
        try:
            existing = await self._validate_exists(eval_id, org_id)

            if existing.status != SelfAssessmentStatus.DRAFT.value:
                raise ValidationError(f"Cannot submit evaluation in '{existing.status}' status (must be draft)")

            now = datetime.now(timezone.utc)
            await self.session.execute(
                update(CoreValueEvaluation)
                .where(CoreValueEvaluation.id == eval_id)
                .values(status=SelfAssessmentStatus.SUBMITTED.value, submitted_at=now, updated_at=now)
            )
            return await self.get_by_id(eval_id, org_id)
        except SQLAlchemyError as e:
            logger.error(f"Error submitting core value evaluation {eval_id}: {e}")
            raise

    async def reopen_evaluation(self, eval_id: UUID, org_id: str) -> Optional[CoreValueEvaluation]:
        """Reopen core value evaluation: submitted → draft. Not allowed if approved."""
        try:
            existing = await self._validate_exists(eval_id, org_id)

            if existing.status == SelfAssessmentStatus.APPROVED.value:
                raise ValidationError("Cannot reopen an approved evaluation")
            if existing.status != SelfAssessmentStatus.SUBMITTED.value:
                raise ValidationError(f"Cannot reopen evaluation in '{existing.status}' status (must be submitted)")

            await self.session.execute(
                update(CoreValueEvaluation)
                .where(CoreValueEvaluation.id == eval_id)
                .values(status=SelfAssessmentStatus.DRAFT.value, updated_at=datetime.now(timezone.utc))
            )
            return await self.get_by_id(eval_id, org_id)
        except SQLAlchemyError as e:
            logger.error(f"Error reopening core value evaluation {eval_id}: {e}")
            raise

    async def revert_to_draft(self, eval_id: UUID, org_id: str) -> Optional[CoreValueEvaluation]:
        """Revert core value evaluation to draft: submitted → draft, clear submitted_at."""
        try:
            existing = await self._validate_exists(eval_id, org_id)

            if existing.status == SelfAssessmentStatus.APPROVED.value:
                raise ValidationError("Cannot revert an approved evaluation")
            if existing.status != SelfAssessmentStatus.SUBMITTED.value:
                raise ValidationError(f"Cannot revert evaluation in '{existing.status}' status")

            await self.session.execute(
                update(CoreValueEvaluation)
                .where(CoreValueEvaluation.id == eval_id)
                .values(status=SelfAssessmentStatus.DRAFT.value, submitted_at=None, updated_at=datetime.now(timezone.utc))
            )
            return await self.get_by_id(eval_id, org_id)
        except SQLAlchemyError as e:
            logger.error(f"Error reverting core value evaluation {eval_id}: {e}")
            raise

    async def approve_evaluation(self, eval_id: UUID, org_id: str) -> Optional[CoreValueEvaluation]:
        """Approve core value evaluation: submitted → approved (locked)."""
        try:
            existing = await self._validate_exists(eval_id, org_id)

            if existing.status == SelfAssessmentStatus.APPROVED.value:
                return existing  # Already approved, idempotent
            if existing.status != SelfAssessmentStatus.SUBMITTED.value:
                raise ValidationError(f"Cannot approve evaluation in '{existing.status}' status (must be submitted)")

            await self.session.execute(
                update(CoreValueEvaluation)
                .where(CoreValueEvaluation.id == eval_id)
                .values(status=SelfAssessmentStatus.APPROVED.value, updated_at=datetime.now(timezone.utc))
            )
            return await self.get_by_id(eval_id, org_id)
        except SQLAlchemyError as e:
            logger.error(f"Error approving core value evaluation {eval_id}: {e}")
            raise

    # ========================================
    # HELPER METHODS
    # ========================================

    async def _validate_exists(self, eval_id: UUID, org_id: str) -> CoreValueEvaluation:
        """Validate evaluation exists within organization scope."""
        evaluation = await self.get_by_id(eval_id, org_id)
        if not evaluation:
            raise NotFoundError(f"Core value evaluation not found: {eval_id}")
        return evaluation
