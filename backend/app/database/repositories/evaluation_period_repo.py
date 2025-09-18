import logging
from typing import Optional, List
from uuid import UUID
from datetime import datetime, date, timezone

from sqlalchemy import select, update, func, and_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.evaluation import EvaluationPeriod, EvaluationPeriodStatus
from ...schemas.evaluation import EvaluationPeriodCreate, EvaluationPeriodUpdate
from ...schemas.common import PaginationParams
from .base import BaseRepository

logger = logging.getLogger(__name__)


class EvaluationPeriodRepository(BaseRepository[EvaluationPeriod]):

    def __init__(self, session: AsyncSession):
        super().__init__(session, EvaluationPeriod)
        self.session = session

    # ========================================
    # CREATE OPERATIONS
    # ========================================
    
    def add(self, evaluation_period: EvaluationPeriod) -> None:
        """Add an evaluation period to the session (does not commit)."""
        self.session.add(evaluation_period)

    async def create_evaluation_period(self, period_data: EvaluationPeriodCreate, org_id: str) -> EvaluationPeriod:
        """
        Create a new evaluation period within organization scope.
        Adds to session (does not commit - let service layer handle transactions).
        """
        try:
            evaluation_period = EvaluationPeriod(
                organization_id=org_id,
                name=period_data.name,
                period_type=period_data.period_type,
                start_date=period_data.start_date,
                end_date=period_data.end_date,
                goal_submission_deadline=period_data.goal_submission_deadline,
                evaluation_deadline=period_data.evaluation_deadline,
                status=period_data.status
            )
            
            self.add(evaluation_period)
            await self.session.flush()  # Flush to get the ID
            await self.session.refresh(evaluation_period)
            
            logger.info(f"Created evaluation period for org {org_id}: {evaluation_period.id}")
            return evaluation_period
            
        except SQLAlchemyError as e:
            logger.error(f"Database error creating evaluation period for org {org_id}: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error creating evaluation period for org {org_id}: {e}")
            raise

    # ========================================
    # READ OPERATIONS
    # ========================================

    async def get_by_id(self, period_id: UUID, org_id: str) -> Optional[EvaluationPeriod]:
        """Get evaluation period by ID within organization scope."""
        try:
            query = select(EvaluationPeriod).where(EvaluationPeriod.id == period_id)
            query = self.apply_org_scope_direct(query, EvaluationPeriod.organization_id, org_id)
            result = await self.session.execute(query)
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            logger.error(f"Database error getting evaluation period {period_id} in org {org_id}: {e}")
            raise

    async def get_all(self, org_id: str, pagination: Optional[PaginationParams] = None) -> List[EvaluationPeriod]:
        """Get all evaluation periods with optional pagination within organization scope."""
        try:
            query = select(EvaluationPeriod).order_by(EvaluationPeriod.start_date.desc())
            query = self.apply_org_scope_direct(query, EvaluationPeriod.organization_id, org_id)
            
            if pagination:
                query = query.offset(pagination.offset).limit(pagination.limit)
            
            result = await self.session.execute(query)
            return list(result.scalars().all())
        except SQLAlchemyError as e:
            logger.error(f"Database error getting all evaluation periods: {e}")
            raise

    async def get_by_status(self, status: EvaluationPeriodStatus, org_id: str) -> List[EvaluationPeriod]:
        """Get evaluation periods by status within organization scope."""
        try:
            query = select(EvaluationPeriod).where(EvaluationPeriod.status == status).order_by(EvaluationPeriod.start_date.desc())
            query = self.apply_org_scope_direct(query, EvaluationPeriod.organization_id, org_id)
            result = await self.session.execute(query)
            return list(result.scalars().all())
        except SQLAlchemyError as e:
            logger.error(f"Database error getting evaluation periods by status {status} in org {org_id}: {e}")
            raise

    async def get_active_period(self, org_id: str) -> Optional[EvaluationPeriod]:
        """Get the currently active evaluation period within organization scope."""
        try:
            query = select(EvaluationPeriod).where(EvaluationPeriod.status == EvaluationPeriodStatus.ACTIVE).order_by(EvaluationPeriod.start_date.desc())
            query = self.apply_org_scope_direct(query, EvaluationPeriod.organization_id, org_id)
            result = await self.session.execute(query)
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            logger.error(f"Database error getting active evaluation period for org {org_id}: {e}")
            raise

    async def get_periods_by_date_range(self, start_date: date, end_date: date, org_id: str) -> List[EvaluationPeriod]:
        """Get evaluation periods that overlap with the given date range within organization scope."""
        try:
            query = select(EvaluationPeriod).where(
                and_(
                    EvaluationPeriod.start_date <= end_date,
                    EvaluationPeriod.end_date >= start_date
                )
            ).order_by(EvaluationPeriod.start_date.desc())
            query = self.apply_org_scope_direct(query, EvaluationPeriod.organization_id, org_id)
            result = await self.session.execute(query)
            return list(result.scalars().all())
        except SQLAlchemyError as e:
            logger.error(f"Database error getting evaluation periods by date range for org {org_id}: {e}")
            raise

    async def count_all(self, org_id: str) -> int:
        """Count total number of evaluation periods within organization scope."""
        try:
            query = select(func.count(EvaluationPeriod.id))
            query = self.apply_org_scope_direct(query, EvaluationPeriod.organization_id, org_id)
            result = await self.session.execute(query)
            return result.scalar() or 0
        except SQLAlchemyError as e:
            logger.error(f"Database error counting evaluation periods: {e}")
            raise

    # ========================================
    # UPDATE OPERATIONS
    # ========================================

    async def update_evaluation_period(self, period_id: UUID, period_data: EvaluationPeriodUpdate, org_id: str) -> Optional[EvaluationPeriod]:
        """Update an evaluation period within organization scope."""
        try:
            # Get the existing period with org verification
            existing_period = await self.get_by_id(period_id, org_id)
            if not existing_period:
                return None

            # Prepare update data (only include non-None values)
            update_data = {}
            for field, value in period_data.model_dump(exclude_unset=True).items():
                if value is not None:
                    update_data[field] = value

            if not update_data:
                return existing_period

            # Add updated_at timestamp
            update_data['updated_at'] = datetime.utcnow()

            # Execute update
            await self.session.execute(
                update(EvaluationPeriod)
                .where(EvaluationPeriod.id == period_id)
                .values(**update_data)
            )

            # Refresh the object
            await self.session.refresh(existing_period)
            
            logger.info(f"Updated evaluation period {period_id} in org {org_id}")
            return existing_period

        except SQLAlchemyError as e:
            logger.error(f"Database error updating evaluation period {period_id} in org {org_id}: {e}")
            raise

    async def update_status(self, period_id: UUID, status: EvaluationPeriodStatus, org_id: str) -> Optional[EvaluationPeriod]:
        """Update only the status of an evaluation period within organization scope."""
        try:
            # Verify the period exists and belongs to the organization before updating
            existing_period = await self.get_by_id(period_id, org_id)
            if not existing_period:
                return None
            
            await self.session.execute(
                update(EvaluationPeriod)
                .where(EvaluationPeriod.id == period_id)
                .values(status=status, updated_at=datetime.utcnow())
            )

            # Get and return the updated period
            return await self.get_by_id(period_id, org_id)

        except SQLAlchemyError as e:
            logger.error(f"Database error updating evaluation period status {period_id} in org {org_id}: {e}")
            raise

    # ========================================
    # DELETE OPERATIONS
    # ========================================

    async def delete_evaluation_period(self, period_id: UUID, org_id: str) -> bool:
        """
        Delete an evaluation period within organization scope.
        Returns True if deleted, False if not found.
        """
        try:
            # Verify the period exists and belongs to the organization before deleting
            existing_period = await self.get_by_id(period_id, org_id)
            if not existing_period:
                return False

            await self.session.delete(existing_period)
            logger.info(f"Deleted evaluation period {period_id} in org {org_id}")
            return True

        except SQLAlchemyError as e:
            logger.error(f"Database error deleting evaluation period {period_id} in org {org_id}: {e}")
            raise

    # ========================================
    # UTILITY OPERATIONS
    # ========================================

    async def check_name_exists(self, name: str, org_id: str, exclude_id: Optional[UUID] = None) -> bool:
        """Check if an evaluation period with the given name already exists within organization scope."""
        try:
            query = select(EvaluationPeriod).where(EvaluationPeriod.name == name)
            query = self.apply_org_scope_direct(query, EvaluationPeriod.organization_id, org_id)
            
            if exclude_id:
                query = query.where(EvaluationPeriod.id != exclude_id)
            
            result = await self.session.execute(query)
            return result.scalar_one_or_none() is not None

        except SQLAlchemyError as e:
            logger.error(f"Database error checking evaluation period name exists in org {org_id}: {e}")
            raise

    async def check_date_overlap(self, start_date: date, end_date: date, org_id: str, exclude_id: Optional[UUID] = None) -> bool:
        """Check if there are any evaluation periods that overlap with the given date range within organization scope."""
        try:
            query = select(EvaluationPeriod).where(
                and_(
                    EvaluationPeriod.start_date <= end_date,
                    EvaluationPeriod.end_date >= start_date
                )
            )
            query = self.apply_org_scope_direct(query, EvaluationPeriod.organization_id, org_id)
            
            if exclude_id:
                query = query.where(EvaluationPeriod.id != exclude_id)
            
            result = await self.session.execute(query)
            return result.scalar_one_or_none() is not None

        except SQLAlchemyError as e:
            logger.error(f"Database error checking evaluation period date overlap in org {org_id}: {e}")
            raise