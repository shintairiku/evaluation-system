import logging
from typing import Optional, List
from uuid import UUID

from sqlalchemy import select, delete
from sqlalchemy.orm import joinedload
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.peer_review import PeerReviewAssignment
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
        assigned_by: UUID,
        org_id: str
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
