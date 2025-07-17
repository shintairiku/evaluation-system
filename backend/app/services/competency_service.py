from __future__ import annotations
import logging
from typing import Optional, List
from uuid import UUID
from cachetools import TTLCache

from ..database.repositories.competency_repo import CompetencyRepository
from ..database.repositories.stage_repo import StageRepository
from ..database.models.user import Competency as CompetencyModel
from ..schemas.competency import (
    CompetencyCreate, CompetencyUpdate, Competency, CompetencyDetail, CompetencyList
)
from ..schemas.common import PaginationParams, PaginatedResponse
from ..security.context import AuthContext
from ..security.permissions import Permission
from ..core.exceptions import (
    NotFoundError, ConflictError, PermissionDeniedError, BadRequestError
)
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# Cache for competency search results (100 items, 5-minute TTL)
competency_search_cache = TTLCache(maxsize=100, ttl=300)


class CompetencyService:
    """Service layer for competency-related business logic and operations"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.competency_repo = CompetencyRepository(session)
        self.stage_repo = StageRepository(session)
    
    async def get_competencies(
        self, 
        current_user_context: AuthContext,
        search_term: str = "",
        stage_ids: Optional[List[UUID]] = None,
        pagination: Optional[PaginationParams] = None
    ) -> PaginatedResponse[Competency]:
        """
        Get competencies with search and filtering
        
        Business Logic:
        - Users with READ permissions can view competencies
        - Support search by name and description
        - Filter by stage_ids if provided
        - Cache results for performance
        """
        try:
            # Permission check
            current_user_context.require_permission(Permission.COMPETENCY_READ)
            
            # Create cache key
            cache_key = f"competencies:{search_term}:{stage_ids}:{pagination.page if pagination else 1}:{pagination.limit if pagination else 'all'}"
            
            # Check cache first
            if cache_key in competency_search_cache:
                cached_data = competency_search_cache[cache_key]
                return PaginatedResponse.model_validate_json(cached_data)
            
            # Get competencies from repository
            competencies = await self.competency_repo.search_competencies(
                search_term=search_term,
                stage_ids=stage_ids
            )
            
            # Apply pagination if provided
            total_count = len(competencies)
            if pagination:
                start_idx = (pagination.page - 1) * pagination.limit
                end_idx = start_idx + pagination.limit
                competencies = competencies[start_idx:end_idx]
            
            # Convert to schema objects
            competency_schemas = []
            for competency_model in competencies:
                competency_schema = await self._enrich_competency_data(competency_model)
                competency_schemas.append(competency_schema)
            
            # Create paginated response
            total_pages = (total_count + pagination.limit - 1) // pagination.limit if pagination else 1
            
            result = PaginatedResponse(
                items=competency_schemas,
                total=total_count,
                page=pagination.page if pagination else 1,
                limit=pagination.limit if pagination else len(competency_schemas),
                pages=total_pages
            )
            
            # Cache the result
            competency_search_cache[cache_key] = result.model_dump_json()
            
            return result
            
        except Exception as e:
            logger.error(f"Error in get_competencies: {e}")
            raise
    
    async def get_competency(
        self, 
        competency_id: UUID, 
        current_user_context: AuthContext
    ) -> CompetencyDetail:
        """
        Get a specific competency by ID
        """
        try:
            # Permission check
            current_user_context.require_permission(Permission.COMPETENCY_READ)
            
            # Get competency from repository
            competency = await self.competency_repo.get_competency_by_id_with_stage(competency_id)
            if not competency:
                raise NotFoundError(f"Competency with ID {competency_id} not found")
            
            # Enrich competency data
            enriched_competency = await self._enrich_detailed_competency_data(competency)
            return enriched_competency
            
        except Exception as e:
            logger.error(f"Error getting competency {competency_id}: {str(e)}")
            raise
    
    async def get_competency_by_id(
        self, 
        competency_id: UUID, 
        current_user_context: AuthContext
    ) -> CompetencyDetail:
        """
        Get a specific competency by ID (alias for get_competency for compatibility)
        """
        return await self.get_competency(competency_id, current_user_context)
    
    async def create_competency(
        self, 
        competency_data: CompetencyCreate, 
        current_user_context: AuthContext
    ) -> CompetencyDetail:
        """
        Create a new competency with validation and business rules
        
        Business Logic:
        - Only users with CREATE permission can create competencies
        - Validate stage exists
        - Check for naming conflicts
        - Name must be unique across all competencies
        """
        try:
            # Permission check
            current_user_context.require_permission(Permission.COMPETENCY_CREATE)
            
            # Validate stage exists
            stage = await self.stage_repo.get_stage_by_id(competency_data.stage_id)
            if not stage:
                raise BadRequestError(f"Stage with ID {competency_data.stage_id} not found")
            
            # Check for naming conflicts
            existing_competency = await self.competency_repo.get_competency_by_name(competency_data.name)
            if existing_competency:
                raise ConflictError(f"Competency with name '{competency_data.name}' already exists")
            
            # Create competency model
            competency = await self.competency_repo.create_competency(
                name=competency_data.name,
                stage_id=competency_data.stage_id,
                description=competency_data.description
            )
            
            # Commit transaction
            await self.session.commit()
            await self.session.refresh(competency)
            
            # Clear cache
            competency_search_cache.clear()
            
            # Return enriched competency
            enriched_competency = await self._enrich_detailed_competency_data(competency)
            return enriched_competency
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error creating competency: {str(e)}")
            raise
    
    async def update_competency(
        self, 
        competency_id: UUID, 
        competency_data: CompetencyUpdate, 
        current_user_context: AuthContext
    ) -> CompetencyDetail:
        """
        Update a competency with validation and business rules
        
        Business Logic:
        - Only users with UPDATE permission can update competencies
        - Validate stage exists if being updated
        - Check for naming conflicts if name is being updated
        - Name must remain unique across all competencies
        """
        try:
            # Permission check
            current_user_context.require_permission(Permission.COMPETENCY_UPDATE)
            
            # Get existing competency
            existing_competency = await self.competency_repo.get_competency_by_id(competency_id)
            if not existing_competency:
                raise NotFoundError(f"Competency with ID {competency_id} not found")
            
            # Validate stage exists if being updated
            if competency_data.stage_id is not None:
                stage = await self.stage_repo.get_stage_by_id(competency_data.stage_id)
                if not stage:
                    raise BadRequestError(f"Stage with ID {competency_data.stage_id} not found")
            
            # Check for naming conflicts if name is being updated
            if competency_data.name is not None and competency_data.name != existing_competency.name:
                name_exists = await self.competency_repo.check_competency_name_exists(
                    competency_data.name, exclude_id=competency_id
                )
                if name_exists:
                    raise ConflictError(f"Competency with name '{competency_data.name}' already exists")
            
            # Update competency
            updated_competency = await self.competency_repo.update_competency(
                competency_id=competency_id,
                name=competency_data.name,
                description=competency_data.description,
                stage_id=competency_data.stage_id
            )
            
            # Commit transaction
            await self.session.commit()
            await self.session.refresh(updated_competency)
            
            # Clear cache
            competency_search_cache.clear()
            
            # Return enriched competency
            enriched_competency = await self._enrich_detailed_competency_data(updated_competency)
            return enriched_competency
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error updating competency {competency_id}: {str(e)}")
            raise
    
    async def delete_competency(
        self, 
        competency_id: UUID, 
        current_user_context: AuthContext
    ) -> bool:
        """
        Delete a competency with validation and business rules
        
        Business Logic:
        - Only users with DELETE permission can delete competencies
        - Check if competency is in use (has associated goals/evaluations)
        - Prevent deletion if competency is referenced by other entities
        """
        try:
            # Permission check
            current_user_context.require_permission(Permission.COMPETENCY_DELETE)
            
            # Get existing competency
            existing_competency = await self.competency_repo.get_competency_by_id(competency_id)
            if not existing_competency:
                raise NotFoundError(f"Competency with ID {competency_id} not found")
            
            # Business rule: Check if competency is in use
            # Note: This would need to be expanded when Goal/Evaluation entities are implemented
            # For now, we'll allow deletion
            
            # Delete competency
            deleted = await self.competency_repo.delete_competency_by_id(competency_id)
            
            if deleted:
                # Commit transaction
                await self.session.commit()
                
                # Clear cache
                competency_search_cache.clear()
                
                logger.info(f"Successfully deleted competency {competency_id}")
                return True
            else:
                raise NotFoundError(f"Competency with ID {competency_id} not found")
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error deleting competency {competency_id}: {str(e)}")
            raise
    
    async def get_all_competencies(
        self, 
        current_user_context: AuthContext
    ) -> List[Competency]:
        """
        Get all competencies (alias for get_competencies without pagination)
        """
        try:
            # Permission check
            current_user_context.require_permission(Permission.COMPETENCY_READ)
            
            # Get all competencies
            competencies = await self.competency_repo.get_all_competencies()
            
            # Convert to schema objects
            competency_schemas = []
            for competency_model in competencies:
                competency_schema = await self._enrich_competency_data(competency_model)
                competency_schemas.append(competency_schema)
            
            return competency_schemas
            
        except Exception as e:
            logger.error(f"Error getting all competencies: {str(e)}")
            raise

    async def get_competencies_by_stage(
        self, 
        stage_id: UUID, 
        current_user_context: AuthContext
    ) -> List[Competency]:
        """
        Get all competencies for a specific stage
        """
        try:
            # Permission check
            current_user_context.require_permission(Permission.COMPETENCY_READ)
            
            # Validate stage exists
            stage = await self.stage_repo.get_stage_by_id(stage_id)
            if not stage:
                raise NotFoundError(f"Stage with ID {stage_id} not found")
            
            # Get competencies for stage
            competencies = await self.competency_repo.get_competencies_by_stage_id(stage_id)
            
            # Convert to schema objects
            competency_schemas = []
            for competency_model in competencies:
                competency_schema = await self._enrich_competency_data(competency_model)
                competency_schemas.append(competency_schema)
            
            return competency_schemas
            
        except Exception as e:
            logger.error(f"Error getting competencies for stage {stage_id}: {str(e)}")
            raise
    
    # ========================================
    # PRIVATE HELPER METHODS
    # ========================================
    
    async def _enrich_competency_data(self, competency_model: CompetencyModel) -> Competency:
        """Convert competency model to schema with basic enrichment"""
        try:
            # Convert to schema
            competency_dict = {
                "id": competency_model.id,
                "name": competency_model.name,
                "description": competency_model.description,
                "stage_id": competency_model.stage_id,
                "goal_count": 0,  # Will be updated when Goal entities are implemented
                "created_at": competency_model.created_at,
                "updated_at": competency_model.updated_at
            }
            
            return Competency.model_validate(competency_dict)
            
        except Exception as e:
            logger.error(f"Error enriching competency data: {e}")
            raise
    
    async def _enrich_detailed_competency_data(self, competency_model: CompetencyModel) -> CompetencyDetail:
        """Convert competency model to detailed schema with full enrichment"""
        try:
            # Convert to basic schema first
            basic_competency = await self._enrich_competency_data(competency_model)
            
            # Create detailed schema
            detailed_dict = basic_competency.model_dump()
            
            return CompetencyDetail.model_validate(detailed_dict)
            
        except Exception as e:
            logger.error(f"Error enriching detailed competency data: {e}")
            raise