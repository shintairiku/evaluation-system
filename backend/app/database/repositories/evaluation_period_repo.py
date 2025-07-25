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

logger = logging.getLogger(__name__)


class EvaluationPeriodRepository:

    def __init__(self, session: AsyncSession):
        self.session = session

    # ========================================
    # CREATE OPERATIONS
    # ========================================
    
    def add(self, evaluation_period: EvaluationPeriod) -> None:
        """Add an evaluation period to the session (does not commit)."""
        self.session.add(evaluation_period)

    async def create_evaluation_period(self, period_data: EvaluationPeriodCreate) -> EvaluationPeriod:
        """
        Create a new evaluation period from EvaluationPeriodCreate schema.
        Adds to session (does not commit - let service layer handle transactions).
        """
        try:
            evaluation_period = EvaluationPeriod(
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
            
            logger.info(f"Created evaluation period: {evaluation_period.id}")
            return evaluation_period
            
        except SQLAlchemyError as e:
            logger.error(f"Database error creating evaluation period: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error creating evaluation period: {e}")
            raise

    # ========================================
    # READ OPERATIONS
    # ========================================

    async def get_by_id(self, period_id: UUID) -> Optional[EvaluationPeriod]:
        """Get evaluation period by ID."""
        try:
            result = await self.session.execute(
                select(EvaluationPeriod).where(EvaluationPeriod.id == period_id)
            )
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            logger.error(f"Database error getting evaluation period {period_id}: {e}")
            raise

    async def get_all(self, pagination: Optional[PaginationParams] = None) -> List[EvaluationPeriod]:
        """Get all evaluation periods with optional pagination."""
        try:
            query = select(EvaluationPeriod).order_by(EvaluationPeriod.start_date.desc())
            
            if pagination:
                query = query.offset(pagination.offset).limit(pagination.limit)
            
            result = await self.session.execute(query)
            return list(result.scalars().all())
        except SQLAlchemyError as e:
            logger.error(f"Database error getting all evaluation periods: {e}")
            raise

    async def get_by_status(self, status: EvaluationPeriodStatus) -> List[EvaluationPeriod]:
        """Get evaluation periods by status."""
        try:
            result = await self.session.execute(
                select(EvaluationPeriod)
                .where(EvaluationPeriod.status == status)
                .order_by(EvaluationPeriod.start_date.desc())
            )
            return list(result.scalars().all())
        except SQLAlchemyError as e:
            logger.error(f"Database error getting evaluation periods by status {status}: {e}")
            raise

    async def get_active_period(self) -> Optional[EvaluationPeriod]:
        """Get the currently active evaluation period."""
        try:
            result = await self.session.execute(
                select(EvaluationPeriod)
                .where(EvaluationPeriod.status == EvaluationPeriodStatus.ACTIVE)
                .order_by(EvaluationPeriod.start_date.desc())
            )
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            logger.error(f"Database error getting active evaluation period: {e}")
            raise

    async def get_periods_by_date_range(self, start_date: date, end_date: date) -> List[EvaluationPeriod]:
        """Get evaluation periods that overlap with the given date range."""
        try:
            result = await self.session.execute(
                select(EvaluationPeriod)
                .where(
                    and_(
                        EvaluationPeriod.start_date <= end_date,
                        EvaluationPeriod.end_date >= start_date
                    )
                )
                .order_by(EvaluationPeriod.start_date.desc())
            )
            return list(result.scalars().all())
        except SQLAlchemyError as e:
            logger.error(f"Database error getting evaluation periods by date range: {e}")
            raise

    async def count_all(self) -> int:
        """Count total number of evaluation periods."""
        try:
            result = await self.session.execute(
                select(func.count(EvaluationPeriod.id))
            )
            return result.scalar() or 0
        except SQLAlchemyError as e:
            logger.error(f"Database error counting evaluation periods: {e}")
            raise

    # ========================================
    # UPDATE OPERATIONS
    # ========================================

    async def update_evaluation_period(self, period_id: UUID, period_data: EvaluationPeriodUpdate) -> Optional[EvaluationPeriod]:
        """Update an evaluation period."""
        try:
            # Get the existing period
            existing_period = await self.get_by_id(period_id)
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
            
            logger.info(f"Updated evaluation period: {period_id}")
            return existing_period

        except SQLAlchemyError as e:
            logger.error(f"Database error updating evaluation period {period_id}: {e}")
            raise

    async def update_status(self, period_id: UUID, status: EvaluationPeriodStatus) -> Optional[EvaluationPeriod]:
        """Update only the status of an evaluation period."""
        try:
            await self.session.execute(
                update(EvaluationPeriod)
                .where(EvaluationPeriod.id == period_id)
                .values(status=status, updated_at=datetime.utcnow())
            )

            # Get and return the updated period
            return await self.get_by_id(period_id)

        except SQLAlchemyError as e:
            logger.error(f"Database error updating evaluation period status {period_id}: {e}")
            raise

    # ========================================
    # DELETE OPERATIONS
    # ========================================

    async def delete_evaluation_period(self, period_id: UUID) -> bool:
        """
        Delete an evaluation period.
        Returns True if deleted, False if not found.
        """
        try:
            existing_period = await self.get_by_id(period_id)
            if not existing_period:
                return False

            await self.session.delete(existing_period)
            logger.info(f"Deleted evaluation period: {period_id}")
            return True

        except SQLAlchemyError as e:
            logger.error(f"Database error deleting evaluation period {period_id}: {e}")
            raise

    # ========================================
    # UTILITY OPERATIONS
    # ========================================

    async def check_name_exists(self, name: str, exclude_id: Optional[UUID] = None) -> bool:
        """Check if an evaluation period with the given name already exists."""
        try:
            query = select(EvaluationPeriod).where(EvaluationPeriod.name == name)
            
            if exclude_id:
                query = query.where(EvaluationPeriod.id != exclude_id)
            
            result = await self.session.execute(query)
            return result.scalar_one_or_none() is not None

        except SQLAlchemyError as e:
            logger.error(f"Database error checking evaluation period name exists: {e}")
            raise

    async def check_date_overlap(self, start_date: date, end_date: date, exclude_id: Optional[UUID] = None) -> bool:
        """Check if there are any evaluation periods that overlap with the given date range."""
        try:
            query = select(EvaluationPeriod).where(
                and_(
                    EvaluationPeriod.start_date <= end_date,
                    EvaluationPeriod.end_date >= start_date
                )
            )
            
            if exclude_id:
                query = query.where(EvaluationPeriod.id != exclude_id)
            
            result = await self.session.execute(query)
            return result.scalar_one_or_none() is not None

        except SQLAlchemyError as e:
            logger.error(f"Database error checking evaluation period date overlap: {e}")
            raise