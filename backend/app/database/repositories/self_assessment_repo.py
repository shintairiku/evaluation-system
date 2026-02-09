import logging
from typing import Optional, List
from uuid import UUID
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select, update, delete, and_, func
from sqlalchemy.orm import joinedload, aliased
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.self_assessment import SelfAssessment
from ..models.goal import Goal
from ...schemas.self_assessment import SelfAssessmentCreate, SelfAssessmentUpdate
from ...schemas.common import PaginationParams, SelfAssessmentStatus, RatingCode, RATING_CODE_VALUES
from ...core.exceptions import (
    NotFoundError, ConflictError, ValidationError
)
from .base import BaseRepository

logger = logging.getLogger(__name__)


class SelfAssessmentRepository(BaseRepository[SelfAssessment]):
    """Repository for SelfAssessment database operations following established patterns"""

    def __init__(self, session: AsyncSession):
        super().__init__(session, SelfAssessment)

    # ========================================
    # CREATE OPERATIONS
    # ========================================

    async def create_assessment(self, assessment_data: SelfAssessmentCreate, goal_id: UUID, org_id: str) -> SelfAssessment:
        """
        Create a new self-assessment from SelfAssessmentCreate schema with validation within organization scope.
        Adds to session (does not commit - let service layer handle transactions).
        """
        try:
            # Validate goal exists first within organization scope
            goal = await self._validate_goal_exists(goal_id, org_id)
            
            # Check if assessment already exists for this goal within organization scope
            existing = await self.get_by_goal(goal_id, org_id)
            if existing:
                raise ConflictError(f"Self-assessment already exists for goal {goal_id}")
            
            # Create assessment with validated data
            # Auto-calculate self_rating from self_rating_code
            self_rating = None
            if assessment_data.self_rating_code:
                self_rating = Decimal(str(RATING_CODE_VALUES.get(assessment_data.self_rating_code, 0.0)))

            assessment = SelfAssessment(
                goal_id=goal_id,
                period_id=goal.period_id,  # Inherit from goal
                self_rating_code=assessment_data.self_rating_code.value if assessment_data.self_rating_code else None,
                self_rating=self_rating,
                self_comment=assessment_data.self_comment,
                status=assessment_data.status.value if assessment_data.status else SelfAssessmentStatus.DRAFT.value
            )
            
            self.session.add(assessment)
            logger.info(f"Added self-assessment to session: goal_id={goal_id}")
            return assessment
            
        except IntegrityError as e:
            logger.error(f"Integrity error creating self-assessment for goal {goal_id}: {e}")
            if "chk_self_rating_bounds" in str(e):
                raise ValidationError("Self rating must be between 0 and 7")
            elif "chk_self_rating_code" in str(e):
                raise ValidationError("Invalid rating code. Must be one of: SS, S, A, B, C, D")
            elif "chk_self_assessment_status" in str(e):
                raise ValidationError("Invalid status. Must be one of: draft, submitted, approved")
            elif "idx_self_assessments_goal_unique" in str(e):
                raise ConflictError("Self-assessment already exists for this goal")
            else:
                raise ConflictError(f"Database constraint violation: {e}")
        except ValueError as e:
            logger.error(f"Validation error creating self-assessment for goal {goal_id}: {e}")
            raise ValidationError(str(e))
        except SQLAlchemyError as e:
            logger.error(f"Database error creating self-assessment for goal {goal_id}: {e}")
            raise

    # ========================================
    # READ OPERATIONS
    # ========================================

    async def get_by_id(self, assessment_id: UUID, org_id: str) -> Optional[SelfAssessment]:
        """Get self-assessment by ID within organization scope."""
        try:
            query = select(SelfAssessment).filter(SelfAssessment.id == assessment_id)
            # Apply organization filtering via goal (SelfAssessment -> Goal -> User)
            query = self.apply_org_scope_via_goal(query, SelfAssessment.goal_id, org_id)
            result = await self.session.execute(query)
            return result.scalars().first()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching self-assessment by ID {assessment_id} in org {org_id}: {e}")
            raise

    async def get_by_id_with_details(self, assessment_id: UUID, org_id: str) -> Optional[SelfAssessment]:
        """Get self-assessment by ID with all related data within organization scope."""
        try:
            query = (
                select(SelfAssessment)
                .options(
                    joinedload(SelfAssessment.goal).joinedload(Goal.user),
                    joinedload(SelfAssessment.period)
                )
                .filter(SelfAssessment.id == assessment_id)
            )
            # Apply organization filtering via goal (SelfAssessment -> Goal -> User)
            query = self.apply_org_scope_via_goal(query, SelfAssessment.goal_id, org_id)
            result = await self.session.execute(query)
            return result.scalars().unique().first()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching self-assessment details for ID {assessment_id} in org {org_id}: {e}")
            raise

    async def get_by_goal(self, goal_id: UUID, org_id: str) -> Optional[SelfAssessment]:
        """Get self-assessment by goal ID within organization scope."""
        try:
            query = select(SelfAssessment).filter(SelfAssessment.goal_id == goal_id)
            # Apply organization filtering via goal (SelfAssessment -> Goal -> User)
            query = self.apply_org_scope_via_goal(query, SelfAssessment.goal_id, org_id)
            result = await self.session.execute(query)
            return result.scalars().first()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching self-assessment for goal {goal_id} in org {org_id}: {e}")
            raise

    async def get_by_user_and_period(
        self, 
        user_id: UUID, 
        period_id: UUID,
        org_id: str
    ) -> List[SelfAssessment]:
        """Get all self-assessments for a user in a specific period within organization scope."""
        try:
            goal_alias = aliased(Goal)
            query = (
                select(SelfAssessment)
                .join(goal_alias, SelfAssessment.goal_id == goal_alias.id)
                .options(joinedload(SelfAssessment.goal))
                .filter(
                    and_(
                        goal_alias.user_id == user_id,
                        SelfAssessment.period_id == period_id
                    )
                )
            )
            # Apply organization filtering via goal
            query = self.apply_org_scope_via_goal(query, SelfAssessment.goal_id, org_id)
            query = query.order_by(SelfAssessment.created_at.desc())
            
            result = await self.session.execute(query)
            return result.scalars().unique().all()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching self-assessments for user {user_id}, period {period_id} in org {org_id}: {e}")
            raise

    async def get_by_period(
        self, 
        period_id: UUID,
        org_id: str,
        status: Optional[str] = None,
        pagination: Optional[PaginationParams] = None
    ) -> List[SelfAssessment]:
        """Get self-assessments by period within organization scope with optional status filter."""
        try:
            query = select(SelfAssessment).options(
                joinedload(SelfAssessment.goal).joinedload(Goal.user)
            ).filter(SelfAssessment.period_id == period_id)
            
            # Enforce organization scope via goal -> user
            query = self.apply_org_scope_via_goal(query, SelfAssessment.goal_id, org_id)
            
            if status:
                query = query.filter(SelfAssessment.status == status)
            
            query = query.order_by(SelfAssessment.created_at.desc())
            
            if pagination:
                query = query.offset(pagination.offset).limit(pagination.limit)
            
            result = await self.session.execute(query)
            return result.scalars().unique().all()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching self-assessments for period {period_id} in org {org_id}: {e}")
            raise

    async def get_by_status(
        self, 
        status: str,
        org_id: str,
        period_id: Optional[UUID] = None,
        pagination: Optional[PaginationParams] = None
    ) -> List[SelfAssessment]:
        """Get self-assessments by status within organization scope with optional period filter."""
        try:
            query = select(SelfAssessment).options(
                joinedload(SelfAssessment.goal).joinedload(Goal.user)
            ).filter(SelfAssessment.status == status)
            
            if period_id:
                query = query.filter(SelfAssessment.period_id == period_id)

            # Enforce organization scope via goal -> user
            query = self.apply_org_scope_via_goal(query, SelfAssessment.goal_id, org_id)
            
            query = query.order_by(SelfAssessment.created_at.desc())
            
            if pagination:
                query = query.offset(pagination.offset).limit(pagination.limit)
            
            result = await self.session.execute(query)
            return result.scalars().unique().all()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching self-assessments by status {status} in org {org_id}: {e}")
            raise

    async def search_assessments(
        self,
        org_id: str,
        user_ids: Optional[List[UUID]] = None,
        period_id: Optional[UUID] = None,
        status: Optional[str] = None,
        pagination: Optional[PaginationParams] = None
    ) -> List[SelfAssessment]:
        """Search self-assessments within organization scope with various filters."""
        try:
            query = select(SelfAssessment).options(
                joinedload(SelfAssessment.goal).joinedload(Goal.user),
                joinedload(SelfAssessment.period)
            )
            
            # Apply filters
            if user_ids:
                goal_alias = aliased(Goal)
                query = query.join(goal_alias, SelfAssessment.goal_id == goal_alias.id).filter(goal_alias.user_id.in_(user_ids))
            
            if period_id:
                query = query.filter(SelfAssessment.period_id == period_id)
            
            if status:
                query = query.filter(SelfAssessment.status == status)
            
            # Enforce organization scope via goal -> user
            query = self.apply_org_scope_via_goal(query, SelfAssessment.goal_id, org_id)

            # Apply ordering
            query = query.order_by(SelfAssessment.created_at.desc())
            
            # Apply pagination
            if pagination:
                query = query.offset(pagination.offset).limit(pagination.limit)
            
            result = await self.session.execute(query)
            return result.scalars().unique().all()
        except SQLAlchemyError as e:
            logger.error(f"Error searching self-assessments in org {org_id}: {e}")
            raise

    async def count_assessments(
        self,
        org_id: str,
        user_ids: Optional[List[UUID]] = None,
        period_id: Optional[UUID] = None,
        status: Optional[str] = None
    ) -> int:
        """Count self-assessments within organization scope matching the given filters."""
        try:
            query = select(func.count(SelfAssessment.id))
            
            # Apply same filters as search_assessments
            if user_ids:
                goal_alias = aliased(Goal)
                query = query.join(goal_alias, SelfAssessment.goal_id == goal_alias.id).filter(goal_alias.user_id.in_(user_ids))
            
            if period_id:
                query = query.filter(SelfAssessment.period_id == period_id)
            
            if status:
                query = query.filter(SelfAssessment.status == status)

            # Enforce organization scope via goal -> user
            query = self.apply_org_scope_via_goal(query, SelfAssessment.goal_id, org_id)
            
            result = await self.session.execute(query)
            return result.scalar() or 0
        except SQLAlchemyError as e:
            logger.error(f"Error counting self-assessments in org {org_id}: {e}")
            raise

    # ========================================
    # UPDATE OPERATIONS
    # ========================================

    async def update_assessment(self, assessment_id: UUID, assessment_data: SelfAssessmentUpdate, org_id: str) -> Optional[SelfAssessment]:
        """Update a self-assessment with new data, including validation."""
        try:
            # Validate assessment exists first (organization-scoped)
            existing_assessment = await self._validate_assessment_exists(assessment_id, org_id)

            # Check if assessment is editable (not approved)
            if existing_assessment.status == SelfAssessmentStatus.APPROVED.value:
                raise ValidationError("Cannot update approved self-assessment (locked)")

            # Build update dictionary
            update_data = {}

            if assessment_data.self_rating_code is not None:
                update_data["self_rating_code"] = assessment_data.self_rating_code.value
                # Auto-calculate self_rating from code
                update_data["self_rating"] = Decimal(str(RATING_CODE_VALUES.get(assessment_data.self_rating_code, 0.0)))

            if assessment_data.self_comment is not None:
                update_data["self_comment"] = assessment_data.self_comment

            if assessment_data.rating_data is not None:
                update_data["rating_data"] = assessment_data.rating_data

            # Execute update if there are changes
            if update_data:
                update_data["updated_at"] = datetime.now(timezone.utc)
                await self.session.execute(
                    update(SelfAssessment)
                    .where(SelfAssessment.id == assessment_id)
                    .values(**update_data)
                )

            # Return updated assessment
            return await self.get_by_id(assessment_id, org_id)

        except IntegrityError as e:
            logger.error(f"Integrity error updating self-assessment {assessment_id}: {e}")
            if "chk_self_rating_bounds" in str(e):
                raise ValidationError("Self rating must be between 0 and 7")
            elif "chk_self_rating_code" in str(e):
                raise ValidationError("Invalid rating code. Must be one of: SS, S, A, B, C, D")
            elif "chk_self_assessment_submission" in str(e):
                raise ValidationError("Submitted/approved assessments must have submitted_at timestamp")
            else:
                raise ConflictError(f"Database constraint violation: {e}")
        except ValueError as e:
            logger.error(f"Validation error updating self-assessment {assessment_id}: {e}")
            raise ValidationError(str(e))
        except SQLAlchemyError as e:
            logger.error(f"Database error updating self-assessment {assessment_id}: {e}")
            raise

    async def submit_assessment(self, assessment_id: UUID, org_id: str) -> Optional[SelfAssessment]:
        """Submit a self-assessment by changing status to submitted."""
        try:
            # Validate assessment exists (organization-scoped)
            existing_assessment = await self._validate_assessment_exists(assessment_id, org_id)

            # Check if already approved (locked)
            if existing_assessment.status == SelfAssessmentStatus.APPROVED.value:
                raise ValidationError("Cannot submit approved self-assessment (locked)")

            # Note: Field validation is handled at the service layer (goal-type-aware)
            # Performance goals require self_rating_code, Competency goals require rating_data

            # Update status and set submitted_at
            update_data = {
                "status": SelfAssessmentStatus.SUBMITTED.value,
                "submitted_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }

            await self.session.execute(
                update(SelfAssessment)
                .where(SelfAssessment.id == assessment_id)
                .values(**update_data)
            )

            logger.info(f"Submitted self-assessment {assessment_id}")
            return await self.get_by_id(assessment_id, org_id)

        except SQLAlchemyError as e:
            logger.error(f"Database error submitting self-assessment {assessment_id}: {e}")
            raise

    async def approve_assessment(self, assessment_id: UUID, org_id: str) -> Optional[SelfAssessment]:
        """Approve a self-assessment (called when supervisor approves feedback)."""
        try:
            # Validate assessment exists (organization-scoped)
            existing_assessment = await self._validate_assessment_exists(assessment_id, org_id)

            # Check if already approved
            if existing_assessment.status == SelfAssessmentStatus.APPROVED.value:
                logger.info(f"Self-assessment {assessment_id} is already approved")
                return existing_assessment

            # Update status to approved
            update_data = {
                "status": SelfAssessmentStatus.APPROVED.value,
                "updated_at": datetime.now(timezone.utc)
            }

            # Ensure submitted_at is set
            if not existing_assessment.submitted_at:
                update_data["submitted_at"] = datetime.now(timezone.utc)

            await self.session.execute(
                update(SelfAssessment)
                .where(SelfAssessment.id == assessment_id)
                .values(**update_data)
            )

            logger.info(f"Approved self-assessment {assessment_id} (locked)")
            return await self.get_by_id(assessment_id, org_id)

        except SQLAlchemyError as e:
            logger.error(f"Database error approving self-assessment {assessment_id}: {e}")
            raise

    async def reopen_assessment(self, assessment_id: UUID, org_id: str) -> Optional[SelfAssessment]:
        """Reopen a submitted self-assessment by changing status back to draft."""
        try:
            # Validate assessment exists (organization-scoped)
            existing_assessment = await self._validate_assessment_exists(assessment_id, org_id)

            # Check if already draft
            if existing_assessment.status == SelfAssessmentStatus.DRAFT.value:
                logger.info(f"Self-assessment {assessment_id} is already in draft status")
                return existing_assessment

            # Check if approved (cannot reopen)
            if existing_assessment.status == SelfAssessmentStatus.APPROVED.value:
                raise ValidationError("Cannot reopen approved self-assessment (locked)")

            # Update status back to draft and clear submitted_at
            update_data = {
                "status": SelfAssessmentStatus.DRAFT.value,
                "submitted_at": None,
                "updated_at": datetime.now(timezone.utc)
            }

            await self.session.execute(
                update(SelfAssessment)
                .where(SelfAssessment.id == assessment_id)
                .values(**update_data)
            )

            logger.info(f"Reopened self-assessment {assessment_id} (back to draft)")
            return await self.get_by_id(assessment_id, org_id)

        except SQLAlchemyError as e:
            logger.error(f"Database error reopening self-assessment {assessment_id}: {e}")
            raise

    # ========================================
    # DELETE OPERATIONS
    # ========================================

    async def delete_assessment(self, assessment_id: UUID, org_id: str) -> bool:
        """Delete a self-assessment by ID with organization validation."""
        try:
            # Validate assessment exists first (organization-scoped)
            existing_assessment = await self._validate_assessment_exists(assessment_id, org_id)

            # Check if assessment can be deleted (only draft assessments)
            if existing_assessment.status != SelfAssessmentStatus.DRAFT.value:
                raise ValidationError(f"Cannot delete {existing_assessment.status} assessments. Only draft assessments can be deleted.")

            result = await self.session.execute(
                delete(SelfAssessment)
                .where(SelfAssessment.id == assessment_id)
            )

            deleted = result.rowcount > 0
            if deleted:
                logger.info(f"Deleted self-assessment {assessment_id} in org {org_id}")

            return deleted

        except SQLAlchemyError as e:
            logger.error(f"Database error deleting self-assessment {assessment_id} in org {org_id}: {e}")
            raise

    # ========================================
    # HELPER METHODS
    # ========================================

    async def _validate_goal_exists(self, goal_id: UUID, org_id: str) -> Goal:
        """Validate goal exists within organization and return it, raise NotFoundError if not."""
        result = await self.session.execute(
            select(Goal).filter(Goal.id == goal_id)
        )
        goal = result.scalars().first()
        if not goal:
            raise NotFoundError(f"Goal not found: {goal_id}")

        # Verify goal belongs to organization via user relationship
        # Use the BaseRepository helper to enforce organization scope
        query = select(Goal).filter(Goal.id == goal_id)
        query = self.apply_org_scope_via_user(query, Goal.user_id, org_id)
        org_scoped = (await self.session.execute(query)).scalars().first()
        if not org_scoped:
            raise NotFoundError(f"Goal {goal_id} not found in organization {org_id}")

        return goal

    async def _validate_assessment_exists(self, assessment_id: UUID, org_id: str) -> SelfAssessment:
        """Validate assessment exists within organization and return it, raise NotFoundError if not."""
        assessment = await self.get_by_id(assessment_id, org_id)
        if not assessment:
            raise NotFoundError(f"Self-assessment not found: {assessment_id}")
        return assessment

    async def get_assessment_status_by_users(
        self,
        user_ids: List[UUID],
        period_id: UUID,
        org_id: str
    ) -> List[dict]:
        """
        Get assessment submission status for multiple users in a single query.
        Returns a list of dicts with userId, totalCount, submittedCount.
        """
        try:
            if not user_ids:
                return []

            goal_alias = aliased(Goal)

            # Query to count total and submitted assessments per user
            query = (
                select(
                    goal_alias.user_id.label('user_id'),
                    func.count(SelfAssessment.id).label('total_count'),
                    func.count(
                        func.nullif(
                            SelfAssessment.status.in_([
                                SelfAssessmentStatus.SUBMITTED.value,
                                SelfAssessmentStatus.APPROVED.value
                            ]),
                            False
                        )
                    ).label('submitted_count')
                )
                .join(goal_alias, SelfAssessment.goal_id == goal_alias.id)
                .filter(
                    and_(
                        goal_alias.user_id.in_(user_ids),
                        SelfAssessment.period_id == period_id
                    )
                )
                .group_by(goal_alias.user_id)
            )

            # Apply organization scope
            query = self.apply_org_scope_via_goal(query, SelfAssessment.goal_id, org_id)

            result = await self.session.execute(query)
            rows = result.all()

            # Build result list with all user_ids (including those with 0 assessments)
            status_map = {
                str(row.user_id): {
                    'userId': str(row.user_id),
                    'totalCount': row.total_count,
                    'submittedCount': row.submitted_count
                }
                for row in rows
            }

            # Include users with no assessments
            return [
                status_map.get(str(uid), {
                    'userId': str(uid),
                    'totalCount': 0,
                    'submittedCount': 0
                })
                for uid in user_ids
            ]

        except SQLAlchemyError as e:
            logger.error(f"Error getting assessment status by users in org {org_id}: {e}")
            raise