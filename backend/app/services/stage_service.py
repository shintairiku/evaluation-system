import logging
from typing import List, Dict
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from ..database.repositories.stage_repo import StageRepository
from ..database.repositories.competency_repo import CompetencyRepository
from ..schemas.stage_competency import (
    Stage, StageDetail, StageCreate, StageUpdate, StageWithUserCount, Competency
)
from ..security.context import AuthContext
from ..security.permissions import Permission
from ..security.decorators import require_permission
from ..core.exceptions import NotFoundError, ConflictError, BadRequestError

logger = logging.getLogger(__name__)


class StageService:
    """Service layer for stage-related business logic and operations"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.stage_repo = StageRepository(session)
        self.competency_repo = CompetencyRepository(session)
    
    @require_permission(Permission.STAGE_MANAGE)
    async def create_stage(self, current_user_context: AuthContext, stage_data: StageCreate) -> StageDetail:
        """
        Create a new stage.
        
        Args:
            stage_data: Stage creation data
            
        Returns:
            StageDetail: Created stage with metadata
            
        Raises:
            ConflictError: If stage name already exists
        """
        try:
            # Permission check handled by @require_permission decorator
            
            # Check if stage name already exists
            existing_stage = await self.stage_repo.get_by_name(stage_data.name, current_user_context.organization_id)
            if existing_stage:
                raise ConflictError(f"Stage with name '{stage_data.name}' already exists")

            # Create new stage
            stage_model = await self.stage_repo.create(stage_data, current_user_context.organization_id)
            await self.session.commit()
            await self.session.refresh(stage_model)
            
            logger.info(f"Successfully created stage: {stage_model.name}")
            
            # Get competencies for the stage (will be empty for new stage)
            competencies = await self._get_competencies_for_stage(stage_model.id)
            
            return StageDetail(
                id=stage_model.id,
                name=stage_model.name,
                description=stage_model.description,
                created_at=stage_model.created_at,
                updated_at=stage_model.updated_at,
                user_count=0,
                users=None,
                competencies=competencies
            )
            
        except ConflictError:
            await self.session.rollback()
            raise
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error creating stage: {e}")
            raise BadRequestError("Failed to create stage")
    
    @require_permission(Permission.STAGE_READ_ALL)
    async def get_stage(self, current_user_context: AuthContext, stage_id: UUID) -> StageDetail:
        """
        Get stage by ID with detailed information.
        
        Args:
            stage_id: Stage UUID
            
        Returns:
            StageDetail: Stage with metadata
            
        Raises:
            NotFoundError: If stage not found
        """
        # Permission check handled by @require_permission decorator

        stage_model = await self.stage_repo.get_by_id(stage_id, current_user_context.organization_id)
        if not stage_model:
            raise NotFoundError(f"Stage with ID {stage_id} not found")

        # Count users in this stage
        user_count = await self.stage_repo.count_users_by_stage(stage_id, current_user_context.organization_id)
        
        # Get competencies for the stage
        competencies = await self._get_competencies_for_stage(stage_id)
        
        return StageDetail(
            id=stage_model.id,
            name=stage_model.name,
            description=stage_model.description,
            created_at=stage_model.created_at,
            updated_at=stage_model.updated_at,
            user_count=user_count,
            users=None,
            competencies=competencies
        )
    
    @require_permission(Permission.STAGE_READ_ALL)
    async def get_all_stages(self, current_user_context: AuthContext) -> List[Stage]:
        """
        Get all stages for selection purposes.

        Returns:
            List[Stage]: All available stages
        """
        # Permission check handled by @require_permission decorator

        stage_models = await self.stage_repo.get_all(current_user_context.organization_id)

        return [
            Stage(
                id=stage.id,
                name=stage.name,
                description=stage.description
            )
            for stage in stage_models
        ]
    
    @require_permission(Permission.STAGE_MANAGE)
    async def get_stages_with_user_count(self, current_user_context: AuthContext) -> List[StageWithUserCount]:
        """
        Get all stages with user count for administrative views.

        Returns:
            List[StageWithUserCount]: Stages with user counts
        """
        # Permission check handled by @require_permission decorator

        # Use optimized single query instead of N+1 queries
        stages_with_counts = await self.stage_repo.get_all_with_user_counts(current_user_context.organization_id)

        return [
            StageWithUserCount(
                id=stage.id,
                name=stage.name,
                description=stage.description,
                user_count=user_count,
                created_at=stage.created_at,
                updated_at=stage.updated_at
            )
            for stage, user_count in stages_with_counts
        ]
    
    @require_permission(Permission.STAGE_MANAGE)
    async def update_stage(self, current_user_context: AuthContext, stage_id: UUID, stage_data: StageUpdate) -> StageDetail:
        """
        Update an existing stage.
        
        Args:
            stage_id: Stage UUID
            stage_data: Updated stage data
            
        Returns:
            StageDetail: Updated stage with metadata
            
        Raises:
            NotFoundError: If stage not found
            ConflictError: If updated name conflicts with existing stage
        """
        try:
            # Permission check handled by @require_permission decorator
            
            # Check if stage exists
            existing_stage = await self.stage_repo.get_by_id(stage_id, current_user_context.organization_id)
            if not existing_stage:
                raise NotFoundError(f"Stage with ID {stage_id} not found")

            # Check name conflict (only if name is being updated)
            if stage_data.name and stage_data.name != existing_stage.name:
                conflicting_stage = await self.stage_repo.get_by_name(stage_data.name, current_user_context.organization_id)
                if conflicting_stage:
                    raise ConflictError(f"Stage with name '{stage_data.name}' already exists")

            # Update stage
            updated_stage = await self.stage_repo.update(stage_id, stage_data, current_user_context.organization_id)
            if not updated_stage:
                raise NotFoundError(f"Stage with ID {stage_id} not found")
                
            await self.session.commit()
            await self.session.refresh(updated_stage)
            
            logger.info(f"Successfully updated stage: {updated_stage.name}")

            # Get user count for response
            user_count = await self.stage_repo.count_users_by_stage(stage_id, current_user_context.organization_id)
            
            # Get competencies for the stage
            competencies = await self._get_competencies_for_stage(stage_id)
            
            return StageDetail(
                id=updated_stage.id,
                name=updated_stage.name,
                description=updated_stage.description,
                created_at=updated_stage.created_at,
                updated_at=updated_stage.updated_at,
                user_count=user_count,
                users=None,
                competencies=competencies
            )
            
        except (NotFoundError, ConflictError):
            await self.session.rollback()
            raise
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error updating stage {stage_id}: {e}")
            raise BadRequestError("Failed to update stage")
    
    @require_permission(Permission.STAGE_MANAGE)
    async def delete_stage(self, current_user_context: AuthContext, stage_id: UUID) -> Dict[str, str]:
        """
        Delete a stage.
        
        Args:
            stage_id: Stage UUID
            
        Returns:
            Dict[str, str]: Success message
            
        Raises:
            NotFoundError: If stage not found
            BadRequestError: If stage has assigned users
        """
        try:
            # Permission check handled by @require_permission decorator
            
            # Check if stage exists
            existing_stage = await self.stage_repo.get_by_id(stage_id, current_user_context.organization_id)
            if not existing_stage:
                raise NotFoundError(f"Stage with ID {stage_id} not found")

            # Check if stage has users
            user_count = await self.stage_repo.count_users_by_stage(stage_id, current_user_context.organization_id)
            if user_count > 0:
                raise BadRequestError(f"Cannot delete stage: {user_count} users are assigned to this stage")

            # Delete stage
            deleted = await self.stage_repo.delete(stage_id, current_user_context.organization_id)
            if not deleted:
                raise NotFoundError(f"Stage with ID {stage_id} not found")
            
            await self.session.commit()
            logger.info(f"Successfully deleted stage with ID: {stage_id}")
            
            return {"message": "Stage deleted successfully"}
            
        except (NotFoundError, BadRequestError):
            await self.session.rollback()
            raise
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error deleting stage {stage_id}: {e}")
            raise BadRequestError("Failed to delete stage")
    
    async def _get_competencies_for_stage(self, stage_id: UUID) -> List[Competency]:
        """
        Get all competencies for a specific stage.
        
        Args:
            stage_id: Stage UUID
            
        Returns:
            List[Competency]: List of competencies for the stage
        """
        try:
            competency_models = await self.competency_repo.get_by_stage_id(stage_id)
            
            # Convert to schema objects
            competencies = []
            for competency_model in competency_models:
                competency = Competency(
                    id=competency_model.id,
                    name=competency_model.name,
                    description=competency_model.description,
                    stage_id=competency_model.stage_id,
                    created_at=competency_model.created_at,
                    updated_at=competency_model.updated_at
                )
                competencies.append(competency)
            
            return competencies
        except Exception as e:
            logger.error(f"Error getting competencies for stage {stage_id}: {e}")
            return []