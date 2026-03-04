import logging
from typing import Optional, List
from uuid import UUID
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.orm import joinedload
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.peer_review import PeerReviewEvaluation
from ..models.user import User
from ...core.exceptions import NotFoundError, ConflictError, ValidationError
from ...schemas.peer_review import PeerReviewStatus
from .base import BaseRepository

logger = logging.getLogger(__name__)


class PeerReviewEvaluationRepository(BaseRepository[PeerReviewEvaluation]):
    """Repository for PeerReviewEvaluation database operations."""

    def __init__(self, session: AsyncSession):
        super().__init__(session, PeerReviewEvaluation)

    # ========================================
    # READ OPERATIONS
    # ========================================

    async def get_evaluation_by_id(self, eval_id: UUID, org_id: str) -> Optional[PeerReviewEvaluation]:
        """Get evaluation by ID within organization scope."""
        try:
            query = (
                select(PeerReviewEvaluation)
                .options(joinedload(PeerReviewEvaluation.reviewee))
                .join(User, PeerReviewEvaluation.reviewee_id == User.id)
                .filter(
                    PeerReviewEvaluation.id == eval_id,
                    User.clerk_organization_id == org_id
                )
            )
            result = await self.session.execute(query)
            return result.scalars().unique().first()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching peer review evaluation {eval_id}: {e}")
            raise

    async def get_evaluations_for_reviewer(self, period_id: UUID, reviewer_id: UUID, org_id: str) -> List[PeerReviewEvaluation]:
        """Get all evaluations assigned to a reviewer for a period."""
        try:
            query = (
                select(PeerReviewEvaluation)
                .options(joinedload(PeerReviewEvaluation.reviewee))
                .join(User, PeerReviewEvaluation.reviewee_id == User.id)
                .filter(
                    PeerReviewEvaluation.period_id == period_id,
                    PeerReviewEvaluation.reviewer_id == reviewer_id,
                    User.clerk_organization_id == org_id
                )
            )
            result = await self.session.execute(query)
            return list(result.scalars().unique().all())
        except SQLAlchemyError as e:
            logger.error(f"Error fetching evaluations for reviewer {reviewer_id}: {e}")
            raise

    async def get_submitted_evaluations_for_reviewee(self, period_id: UUID, reviewee_id: UUID, org_id: str) -> List[PeerReviewEvaluation]:
        """Get all submitted evaluations for a reviewee (for calculating averages)."""
        try:
            query = (
                select(PeerReviewEvaluation)
                .join(User, PeerReviewEvaluation.reviewee_id == User.id)
                .filter(
                    PeerReviewEvaluation.period_id == period_id,
                    PeerReviewEvaluation.reviewee_id == reviewee_id,
                    PeerReviewEvaluation.status == PeerReviewStatus.SUBMITTED.value,
                    User.clerk_organization_id == org_id
                )
            )
            result = await self.session.execute(query)
            return list(result.scalars().all())
        except SQLAlchemyError as e:
            logger.error(f"Error fetching submitted evaluations for reviewee {reviewee_id}: {e}")
            raise

    # ========================================
    # CREATE OPERATIONS
    # ========================================

    async def create_evaluation(
        self,
        assignment_id: UUID,
        period_id: UUID,
        reviewee_id: UUID,
        reviewer_id: UUID,
        org_id: str
    ) -> PeerReviewEvaluation:
        """Create a new peer review evaluation in draft status."""
        try:
            evaluation = PeerReviewEvaluation(
                assignment_id=assignment_id,
                period_id=period_id,
                reviewee_id=reviewee_id,
                reviewer_id=reviewer_id,
                status=PeerReviewStatus.DRAFT.value
            )
            self.session.add(evaluation)
            await self.session.flush()
            logger.info(f"Created peer review evaluation for assignment {assignment_id}")
            return evaluation
        except IntegrityError as e:
            if "uq_peer_eval_assignment" in str(e):
                raise ConflictError(f"Evaluation already exists for assignment {assignment_id}")
            raise
        except SQLAlchemyError as e:
            logger.error(f"Error creating peer review evaluation: {e}")
            raise

    # ========================================
    # UPDATE OPERATIONS
    # ========================================

    async def update_evaluation(self, eval_id: UUID, data: dict, org_id: str) -> Optional[PeerReviewEvaluation]:
        """Update peer review evaluation scores/comment. Only if draft."""
        try:
            existing = await self._validate_exists(eval_id, org_id)

            if existing.status != PeerReviewStatus.DRAFT.value:
                raise ValidationError("Cannot update evaluation that is not in draft status")

            update_data = {"updated_at": datetime.now(timezone.utc)}
            if "scores" in data:
                update_data["scores"] = data["scores"]
            if "comment" in data:
                update_data["comment"] = data["comment"]

            await self.session.execute(
                update(PeerReviewEvaluation)
                .where(PeerReviewEvaluation.id == eval_id)
                .values(**update_data)
            )
            return await self.get_evaluation_by_id(eval_id, org_id)
        except SQLAlchemyError as e:
            logger.error(f"Error updating peer review evaluation {eval_id}: {e}")
            raise

    async def submit_evaluation(self, eval_id: UUID, org_id: str) -> Optional[PeerReviewEvaluation]:
        """Submit peer review evaluation: draft → submitted (definitive)."""
        try:
            existing = await self._validate_exists(eval_id, org_id)

            if existing.status != PeerReviewStatus.DRAFT.value:
                raise ValidationError(f"Cannot submit evaluation in '{existing.status}' status (must be draft)")

            now = datetime.now(timezone.utc)
            await self.session.execute(
                update(PeerReviewEvaluation)
                .where(PeerReviewEvaluation.id == eval_id)
                .values(status=PeerReviewStatus.SUBMITTED.value, submitted_at=now, updated_at=now)
            )
            return await self.get_evaluation_by_id(eval_id, org_id)
        except SQLAlchemyError as e:
            logger.error(f"Error submitting peer review evaluation {eval_id}: {e}")
            raise

    # ========================================
    # HELPER METHODS
    # ========================================

    async def _validate_exists(self, eval_id: UUID, org_id: str) -> PeerReviewEvaluation:
        """Validate evaluation exists within organization scope."""
        evaluation = await self.get_evaluation_by_id(eval_id, org_id)
        if not evaluation:
            raise NotFoundError(f"Peer review evaluation not found: {eval_id}")
        return evaluation
