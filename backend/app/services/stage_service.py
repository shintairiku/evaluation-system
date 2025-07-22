import logging
from typing import List, Dict
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from ..database.repositories.stage_repo import StageRepository
from ..schemas.stage_competency import (
    Stage, StageDetail, StageCreate, StageUpdate, StageWithUserCount
)
from ..core.exceptions import NotFoundError, ConflictError, BadRequestError

logger = logging.getLogger(__name__)


class StageService:
    """Service layer for stage-related business logic and operations"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.stage_repo = StageRepository(session)
    
    async def create_stage(self, stage_data: StageCreate) -> StageDetail:
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
            # Check if stage name already exists
            existing_stage = await self.stage_repo.get_by_name(stage_data.name)
            if existing_stage:
                raise ConflictError(f"Stage with name '{stage_data.name}' already exists")
            
            # Create new stage
            stage_model = await self.stage_repo.create(stage_data)
            await self.session.commit()
            await self.session.refresh(stage_model)
            
            logger.info(f"Successfully created stage: {stage_model.name}")
            
            return StageDetail(
                id=stage_model.id,
                name=stage_model.name,
                description=stage_model.description,
                created_at=stage_model.created_at,
                updated_at=stage_model.updated_at,
                user_count=0,
                users=None,
                competencies=None
            )
            
        except ConflictError:
            await self.session.rollback()
            raise
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error creating stage: {e}")
            raise BadRequestError("Failed to create stage")
    
    async def get_stage(self, stage_id: UUID) -> StageDetail:
        """
        Get stage by ID with detailed information.
        
        Args:
            stage_id: Stage UUID
            
        Returns:
            StageDetail: Stage with metadata
            
        Raises:
            NotFoundError: If stage not found
        """
        stage_model = await self.stage_repo.get_by_id(stage_id)
        if not stage_model:
            raise NotFoundError(f"Stage with ID {stage_id} not found")
        
        # Count users in this stage
        user_count = await self.stage_repo.count_users_by_stage(stage_id)
        
        return StageDetail(
            id=stage_model.id,
            name=stage_model.name,
            description=stage_model.description,
            created_at=stage_model.created_at,
            updated_at=stage_model.updated_at,
            user_count=user_count
        )
    
    async def get_all_stages(self) -> List[Stage]:
        """
        Get all stages for selection purposes.
        
        Returns:
            List[Stage]: All available stages
        """
        stage_models = await self.stage_repo.get_all()
        
        return [
            Stage(
                id=stage.id,
                name=stage.name,
                description=stage.description
            )
            for stage in stage_models
        ]
    
    async def get_stages_with_user_count(self) -> List[StageWithUserCount]:
        """
        Get all stages with user count for administrative views.
        
        Returns:
            List[StageWithUserCount]: Stages with user counts
        """
        stage_models = await self.stage_repo.get_all()
        stages_with_count = []
        
        for stage in stage_models:
            user_count = await self.stage_repo.count_users_by_stage(stage.id)
            stages_with_count.append(
                StageWithUserCount(
                    id=stage.id,
                    name=stage.name,
                    description=stage.description,
                    user_count=user_count,
                    created_at=stage.created_at,
                    updated_at=stage.updated_at
                )
            )
        
        return stages_with_count
    
    async def update_stage(self, stage_id: UUID, stage_data: StageUpdate) -> StageDetail:
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
            # Check if stage exists
            existing_stage = await self.stage_repo.get_by_id(stage_id)
            if not existing_stage:
                raise NotFoundError(f"Stage with ID {stage_id} not found")
            
            # Check name conflict (only if name is being updated)
            if stage_data.name and stage_data.name != existing_stage.name:
                conflicting_stage = await self.stage_repo.get_by_name(stage_data.name)
                if conflicting_stage:
                    raise ConflictError(f"Stage with name '{stage_data.name}' already exists")
            
            # Update stage
            updated_stage = await self.stage_repo.update(stage_id, stage_data)
            if not updated_stage:
                raise NotFoundError(f"Stage with ID {stage_id} not found")
                
            await self.session.commit()
            await self.session.refresh(updated_stage)
            
            logger.info(f"Successfully updated stage: {updated_stage.name}")
            
            # Get user count for response
            user_count = await self.stage_repo.count_users_by_stage(stage_id)
            
            return StageDetail(
                id=updated_stage.id,
                name=updated_stage.name,
                description=updated_stage.description,
                created_at=updated_stage.created_at,
                updated_at=updated_stage.updated_at,
                user_count=user_count,
                users=None,
                competencies=None
            )
            
        except (NotFoundError, ConflictError):
            await self.session.rollback()
            raise
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error updating stage {stage_id}: {e}")
            raise BadRequestError("Failed to update stage")
    
    async def delete_stage(self, stage_id: UUID) -> Dict[str, str]:
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
            # Check if stage exists
            existing_stage = await self.stage_repo.get_by_id(stage_id)
            if not existing_stage:
                raise NotFoundError(f"Stage with ID {stage_id} not found")
            
            # Check if stage has users
            user_count = await self.stage_repo.count_users_by_stage(stage_id)
            if user_count > 0:
                raise BadRequestError(f"Cannot delete stage: {user_count} users are assigned to this stage")
            
            # Delete stage
            deleted = await self.stage_repo.delete(stage_id)
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