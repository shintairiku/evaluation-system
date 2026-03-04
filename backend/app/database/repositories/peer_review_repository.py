import logging
from typing import Optional, List
from uuid import UUID
from datetime import datetime, timezone

from sqlalchemy import select, update, delete
from sqlalchemy.orm import joinedload
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.peer_review import PeerReviewAssignment, PeerReviewEvaluation
from ..models.user import User
from ...core.exceptions import NotFoundError, ConflictError, ValidationError
from .base import BaseRepository

logger = logging.getLogger(__name__)


class PeerReviewAssignmentRepository(BaseRepository[PeerReviewAssignment]):
    """Repository for PeerReviewAssignment database operations."""

    def __init__(self, session: AsyncSession):
        super().__init__(session, PeerReviewAssignment)

    # ========================================
    # READ OPERATIONS
    # ========================================

    async def get_assignments_for_period(self, period_id: UUID, org_id: str) -> List[PeerReviewAssignment]:
        """Get all assignments for a period within organization scope."""
        try:
            query = (
                select(PeerReviewAssignment)
                .options(
                    joinedload(PeerReviewAssignment.reviewee),
                    joinedload(PeerReviewAssignment.reviewer),
                    joinedload(PeerReviewAssignment.evaluation),
                )
                .join(User, PeerReviewAssignment.reviewee_id == User.id)
                .filter(
                    PeerReviewAssignment.period_id == period_id,
                    User.clerk_organization_id == org_id
                )
                .order_by(PeerReviewAssignment.created_at)
            )
            result = await self.session.execute(query)
            return list(result.scalars().unique().all())
        except SQLAlchemyError as e:
            logger.error(f"Error fetching assignments for period {period_id}: {e}")
            raise

    async def get_assignments_for_reviewee(self, period_id: UUID, reviewee_id: UUID, org_id: str) -> List[PeerReviewAssignment]:
        """Get assignments for a specific reviewee in a period."""
        try:
            query = (
                select(PeerReviewAssignment)
                .options(
                    joinedload(PeerReviewAssignment.reviewer),
                    joinedload(PeerReviewAssignment.evaluation),
                )
                .join(User, PeerReviewAssignment.reviewee_id == User.id)
                .filter(
                    PeerReviewAssignment.period_id == period_id,
                    PeerReviewAssignment.reviewee_id == reviewee_id,
                    User.clerk_organization_id == org_id
                )
            )
            result = await self.session.execute(query)
            return list(result.scalars().unique().all())
        except SQLAlchemyError as e:
            logger.error(f"Error fetching assignments for reviewee {reviewee_id}: {e}")
            raise

    async def get_assignments_for_reviewer(self, period_id: UUID, reviewer_id: UUID, org_id: str) -> List[PeerReviewAssignment]:
        """Get assignments where user is the reviewer."""
        try:
            query = (
                select(PeerReviewAssignment)
                .options(
                    joinedload(PeerReviewAssignment.reviewee),
                    joinedload(PeerReviewAssignment.evaluation),
                )
                .join(User, PeerReviewAssignment.reviewee_id == User.id)
                .filter(
                    PeerReviewAssignment.period_id == period_id,
                    PeerReviewAssignment.reviewer_id == reviewer_id,
                    User.clerk_organization_id == org_id
                )
            )
            result = await self.session.execute(query)
            return list(result.scalars().unique().all())
        except SQLAlchemyError as e:
            logger.error(f"Error fetching assignments for reviewer {reviewer_id}: {e}")
            raise

    async def get_assignment_by_id(self, assignment_id: UUID, org_id: str) -> Optional[PeerReviewAssignment]:
        """Get assignment by ID within organization scope."""
        try:
            query = (
                select(PeerReviewAssignment)
                .options(joinedload(PeerReviewAssignment.evaluation))
                .join(User, PeerReviewAssignment.reviewee_id == User.id)
                .filter(
                    PeerReviewAssignment.id == assignment_id,
                    User.clerk_organization_id == org_id
                )
            )
            result = await self.session.execute(query)
            return result.scalars().unique().first()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching assignment {assignment_id}: {e}")
            raise

    # ========================================
    # CREATE OPERATIONS
    # ========================================

    async def create_assignment(
        self,
        period_id: UUID,
        reviewee_id: UUID,
        reviewer_id: UUID,
        assigned_by: UUID
    ) -> PeerReviewAssignment:
        """Create a new peer review assignment."""
        try:
            assignment = PeerReviewAssignment(
                period_id=period_id,
                reviewee_id=reviewee_id,
                reviewer_id=reviewer_id,
                assigned_by=assigned_by
            )
            self.session.add(assignment)
            await self.session.flush()
            logger.info(f"Created peer review assignment: reviewer {reviewer_id} -> reviewee {reviewee_id}")
            return assignment
        except IntegrityError as e:
            if "uq_peer_assignment" in str(e):
                raise ConflictError(f"Assignment already exists for this reviewer-reviewee pair in this period")
            if "chk_peer_no_self" in str(e):
                raise ValidationError("A user cannot review themselves")
            raise
        except SQLAlchemyError as e:
            logger.error(f"Error creating peer review assignment: {e}")
            raise

    # ========================================
    # DELETE OPERATIONS
    # ========================================

    async def delete_assignment(self, assignment_id: UUID, org_id: str) -> bool:
        """Delete an assignment by ID."""
        try:
            existing = await self.get_assignment_by_id(assignment_id, org_id)
            if not existing:
                raise NotFoundError(f"Peer review assignment not found: {assignment_id}")

            await self.session.execute(
                delete(PeerReviewAssignment)
                .where(PeerReviewAssignment.id == assignment_id)
            )
            logger.info(f"Deleted peer review assignment {assignment_id}")
            return True
        except SQLAlchemyError as e:
            logger.error(f"Error deleting assignment {assignment_id}: {e}")
            raise

    async def delete_assignments_for_reviewee(self, period_id: UUID, reviewee_id: UUID, org_id: str) -> int:
        """Delete all assignments for a reviewee in a period. Returns count deleted."""
        try:
            # First verify org scope
            assignments = await self.get_assignments_for_reviewee(period_id, reviewee_id, org_id)
            if not assignments:
                return 0

            ids = [a.id for a in assignments]
            await self.session.execute(
                delete(PeerReviewAssignment)
                .where(PeerReviewAssignment.id.in_(ids))
            )
            logger.info(f"Deleted {len(ids)} assignments for reviewee {reviewee_id} in period {period_id}")
            return len(ids)
        except SQLAlchemyError as e:
            logger.error(f"Error deleting assignments for reviewee {reviewee_id}: {e}")
            raise


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
                    PeerReviewEvaluation.status == "submitted",
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
        reviewer_id: UUID
    ) -> PeerReviewEvaluation:
        """Create a new peer review evaluation in draft status."""
        try:
            evaluation = PeerReviewEvaluation(
                assignment_id=assignment_id,
                period_id=period_id,
                reviewee_id=reviewee_id,
                reviewer_id=reviewer_id,
                status="draft"
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

            if existing.status != "draft":
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

            if existing.status != "draft":
                raise ValidationError(f"Cannot submit evaluation in '{existing.status}' status (must be draft)")

            now = datetime.now(timezone.utc)
            await self.session.execute(
                update(PeerReviewEvaluation)
                .where(PeerReviewEvaluation.id == eval_id)
                .values(status="submitted", submitted_at=now, updated_at=now)
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
