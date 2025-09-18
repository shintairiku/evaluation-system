import logging
from typing import Optional
from uuid import UUID

from sqlalchemy import select, update, delete, func
from sqlalchemy.orm import joinedload
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.stage_competency import Competency
from .base import BaseRepository

logger = logging.getLogger(__name__)


class CompetencyRepository(BaseRepository[Competency]):

    def __init__(self, session: AsyncSession):
        super().__init__(session, Competency)
        self.session = session

    # ========================================
    # CREATE OPERATIONS
    # ========================================
    
    def add(self, competency: Competency) -> None:
        """Add a competency to the session (does not commit)."""
        self.session.add(competency)

    async def create(self, name: str, stage_id: UUID, org_id: str, description: Optional[str] = None) -> Competency:
        """
        Create a new competency within organization scope.
        Adds to session (does not commit - let service layer handle transactions).
        """
        try:
            # Validate stage belongs to organization
            from ..models.stage_competency import Stage
            stage_result = await self.session.execute(
                select(Stage.organization_id).where(Stage.id == stage_id)
            )
            stage_org_id = stage_result.scalar()
            if not stage_org_id:
                raise ValueError(f"Stage {stage_id} not found")
            if stage_org_id != org_id:
                raise ValueError(f"Stage belongs to org {stage_org_id}, expected {org_id}")
            
            competency = Competency(
                organization_id=org_id,
                name=name,
                stage_id=stage_id,
                description=description
            )
            
            self.session.add(competency)
            logger.info(f"Added competency to session for org {org_id}: {competency.name}")
            return competency
        except SQLAlchemyError as e:
            logger.error(f"Error creating competency with name {name} for org {org_id}: {e}")
            raise

    # ========================================
    # READ OPERATIONS
    # ========================================

    async def get_by_id(self, competency_id: UUID, org_id: str) -> Optional[Competency]:
        """Get competency by ID within organization scope."""
        try:
            query = select(Competency).filter(Competency.id == competency_id)
            query = self.apply_org_scope_direct(query, Competency.organization_id, org_id)
            result = await self.session.execute(query)
            return result.scalars().first()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching competency by ID {competency_id} in org {org_id}: {e}")
            raise

    # async def get_competency_by_id_with_stage(self, competency_id: UUID) -> Optional[Competency]:
    #     """Get competency by ID with stage relationship loaded."""
    #     try:
    #         result = await self.session.execute(
    #             select(Competency)
    #             .options(joinedload(Competency.stage))
    #             .filter(Competency.id == competency_id)
    #         )
    #         return result.scalars().unique().first()
    #     except SQLAlchemyError as e:
    #         logger.error(f"Error fetching competency with stage for ID {competency_id}: {e}")
    #         raise

    async def get_by_name(self, name: str, org_id: str) -> Optional[Competency]:
        """Get competency by name within organization scope."""
        try:
            query = select(Competency).filter(Competency.name == name)
            query = self.apply_org_scope_direct(query, Competency.organization_id, org_id)
            result = await self.session.execute(query)
            return result.scalars().first()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching competency by name {name} in org {org_id}: {e}")
            raise

    async def get_by_stage_id(self, stage_id: UUID, org_id: str) -> list[Competency]:
        """Get all competencies for a specific stage within organization scope."""
        try:
            query = select(Competency).options(
                joinedload(Competency.stage)
            ).filter(Competency.stage_id == stage_id).order_by(Competency.name)
            query = self.apply_org_scope_direct(query, Competency.organization_id, org_id)
            result = await self.session.execute(query)
            return result.scalars().unique().all()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching competencies for stage {stage_id} in org {org_id}: {e}")
            raise

    async def get_all(self, org_id: str) -> list[Competency]:
        """Get all competencies with stage information within organization scope."""
        try:
            query = select(Competency).options(
                joinedload(Competency.stage)
            ).order_by(Competency.name)
            query = self.apply_org_scope_direct(query, Competency.organization_id, org_id)
            result = await self.session.execute(query)
            return result.scalars().unique().all()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching all competencies for org {org_id}: {e}")
            raise

    async def search(self, org_id: str, search_term: str = "", stage_ids: Optional[list[UUID]] = None) -> list[Competency]:
        """
        Search competencies by name or description with optional stage filtering within organization scope.
        """
        try:
            query = select(Competency).options(joinedload(Competency.stage))
            query = self.apply_org_scope_direct(query, Competency.organization_id, org_id)

            if search_term:
                search_ilike = f"%{search_term.lower()}%"
                query = query.filter(
                    func.lower(Competency.name).ilike(search_ilike) |
                    func.lower(Competency.description).ilike(search_ilike)
                )

            if stage_ids:
                query = query.filter(Competency.stage_id.in_(stage_ids))

            query = query.order_by(Competency.name)

            result = await self.session.execute(query)
            return result.scalars().unique().all()
        except SQLAlchemyError as e:
            logger.error(f"Error searching competencies for org {org_id}: {e}")
            raise

    # ========================================
    # UPDATE OPERATIONS
    # ========================================

    async def update(self, competency_id: UUID, org_id: str, name: Optional[str] = None, 
                               description: Optional[str] = None, stage_id: Optional[UUID] = None) -> Optional[Competency]:
        """Update a competency within organization scope (does not commit)."""
        try:
            # Get the existing competency within organization scope
            existing_competency = await self.get_by_id(competency_id, org_id)
            if not existing_competency:
                return None
            
            # If updating stage_id, validate it belongs to the same organization
            if stage_id is not None:
                from ..models.stage_competency import Stage
                stage_result = await self.session.execute(
                    select(Stage.organization_id).where(Stage.id == stage_id)
                )
                stage_org_id = stage_result.scalar()
                if not stage_org_id:
                    raise ValueError(f"Stage {stage_id} not found")
                if stage_org_id != org_id:
                    raise ValueError(f"Stage belongs to org {stage_org_id}, expected {org_id}")
            
            # Update fields if provided
            if name is not None:
                existing_competency.name = name
            if description is not None:
                existing_competency.description = description
            if stage_id is not None:
                existing_competency.stage_id = stage_id
            
            # Mark as modified in session
            self.session.add(existing_competency)
            logger.info(f"Updated competency in session for org {org_id}: {existing_competency.name}")
            return existing_competency
            
        except SQLAlchemyError as e:
            logger.error(f"Error updating competency {competency_id}: {e}")
            raise

    # ========================================
    # DELETE OPERATIONS
    # ========================================

    async def delete(self, competency_id: UUID) -> bool:
        """Delete a competency by ID (does not commit)."""
        try:
            stmt = delete(Competency).where(Competency.id == competency_id).returning(Competency.id)
            result = await self.session.execute(stmt)
            
            deleted_id = result.scalar_one_or_none()
            if deleted_id:
                logger.info(f"Successfully deleted competency {competency_id}")
                return True
            
            logger.warning(f"Attempted to delete non-existent competency {competency_id}")
            return False

        except SQLAlchemyError as e:
            logger.error(f"Error deleting competency {competency_id}: {e}")
            raise

    # ========================================
    # OTHER OPERATIONS
    # ========================================

    async def count_competencies(self, stage_ids: Optional[list[UUID]] = None) -> int:
        """Count competencies, optionally filtered by stage."""
        try:
            query = select(func.count(Competency.id))

            if stage_ids:
                query = query.filter(Competency.stage_id.in_(stage_ids))

            result = await self.session.execute(query)
            return result.scalar_one()
        except SQLAlchemyError as e:
            logger.error(f"Error counting competencies: {e}")
            raise

    async def check_competency_name_exists(self, name: str, exclude_id: Optional[UUID] = None) -> bool:
        """Check if a competency name already exists, optionally excluding a specific ID."""
        try:
            query = select(func.count(Competency.id)).filter(Competency.name == name)
            
            if exclude_id:
                query = query.filter(Competency.id != exclude_id)
            
            result = await self.session.execute(query)
            count = result.scalar_one()
            return count > 0
        except SQLAlchemyError as e:
            logger.error(f"Error checking competency name existence: {e}")
            raise