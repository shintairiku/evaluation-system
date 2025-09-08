from __future__ import annotations
import logging
from typing import Optional, List
from uuid import UUID
from cachetools import TTLCache

from ..database.repositories.competency_repo import CompetencyRepository
from ..database.repositories.stage_repo import StageRepository
from ..database.repositories.user_repo import UserRepository
from ..database.models.stage_competency import Competency as CompetencyModel
from ..schemas.stage_competency import (
    CompetencyCreate, CompetencyUpdate, Competency, CompetencyDetail
)
from ..schemas.common import PaginationParams, PaginatedResponse
from ..security.context import AuthContext
from ..security.permissions import Permission
from ..security.decorators import require_permission, require_any_permission
from ..core.exceptions import (
    NotFoundError, ConflictError, PermissionDeniedError, BadRequestError
)
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# Cache for competency search results (100 items, 5-minute TTL)
competency_search_cache = TTLCache(maxsize=100, ttl=300)

# Cache for user stage lookups within competency service (100 items, 5-minute TTL)
user_stage_cache = TTLCache(maxsize=100, ttl=300)


class CompetencyService:
    """Service layer for competency-related business logic and operations"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.competency_repo = CompetencyRepository(session)
        self.stage_repo = StageRepository(session)
        self.user_repo = UserRepository(session)
    
    @require_any_permission([Permission.COMPETENCY_READ, Permission.COMPETENCY_READ_SELF])
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
        - Admin: can see all competencies for all stages
        - Other roles: can only see competencies for their own stage
        - Support search by name and description
        - Filter by stage_ids if provided
        - Cache results for performance
        """
        try:
            # Permission check handled by @require_any_permission decorator
            
            # Apply stage-based filtering for non-admin users
            filtered_stage_ids = stage_ids
            if not current_user_context.is_admin():
                user_stage_id = await self._get_user_stage_id(current_user_context.user_id)
                if user_stage_id is None:
                    raise PermissionDeniedError("User has no stage assigned")
                
                # Non-admin users can only see competencies for their own stage
                if stage_ids:
                    # If stage_ids were provided, check if user's stage is included
                    if user_stage_id not in stage_ids:
                        # User requested stages they don't have access to
                        raise PermissionDeniedError("Access denied to requested stages")
                    filtered_stage_ids = [user_stage_id]  # Only allow user's own stage
                else:
                    # No specific stages requested, use user's stage
                    filtered_stage_ids = [user_stage_id]
            
            # Create cache key (include user role for cache segregation)
            user_role = current_user_context.role_names[0] if current_user_context.role_names else "unknown"
            cache_key = f"competencies:{user_role}:{search_term}:{filtered_stage_ids}:{pagination.page if pagination else 1}:{pagination.limit if pagination else 'all'}"
            
            # Check cache first
            if cache_key in competency_search_cache:
                cached_data = competency_search_cache[cache_key]
                return PaginatedResponse.model_validate_json(cached_data)
            
            # Get competencies from repository
            competencies = await self.competency_repo.search_competencies(
                search_term=search_term,
                stage_ids=filtered_stage_ids
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
    
    @require_any_permission([Permission.COMPETENCY_READ, Permission.COMPETENCY_READ_SELF])
    async def get_competency(
        self, 
        competency_id: UUID, 
        current_user_context: AuthContext
    ) -> CompetencyDetail:
        """
        Get a specific competency by ID
        
        Business Logic:
        - Admin: can get any competency and see CompetencyDetail.users
        - Other roles: can only get competencies from their stage, CompetencyDetail.users is empty
        """
        try:
            # Permission check handled by @require_any_permission decorator
            
            # Get competency from repository
            competency = await self.competency_repo.get_competency_by_id_with_stage(competency_id)
            if not competency:
                raise NotFoundError(f"Competency with ID {competency_id} not found")
            
            # Validate stage access
            await self._validate_stage_access(current_user_context, UUID(str(competency.stage_id)))
            
            # Enrich competency data (with or without users based on role)
            enriched_competency = await self._enrich_detailed_competency_data(competency, current_user_context)
            return enriched_competency
            
        except Exception as e:
            logger.error(f"Error getting competency {competency_id}: {str(e)}")
            raise
    
    @require_permission(Permission.COMPETENCY_MANAGE)
    async def create_competency(
        self, 
        competency_data: CompetencyCreate, 
        current_user_context: AuthContext
    ) -> Competency:
        """
        Create a new competency with validation and business rules
        
        Business Logic:
        - Only admin can create competencies
        - Validate stage exists
        - Check for naming conflicts
        - Name must be unique across all competencies
        """
        try:
            # Permission check handled by @require_permission decorator
            
            # Validate stage exists
            stage = await self.stage_repo.get_by_id(competency_data.stage_id)
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
            enriched_competency = await self._enrich_competency_data(competency)
            return enriched_competency
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error creating competency: {str(e)}")
            raise
    
    @require_permission(Permission.COMPETENCY_MANAGE)
    async def update_competency(
        self, 
        competency_id: UUID, 
        competency_data: CompetencyUpdate, 
        current_user_context: AuthContext
    ) -> Competency:
        """
        Update a competency with validation and business rules
        
        Business Logic:
        - Only admin can update competencies
        - Validate stage exists if being updated
        - Check for naming conflicts if name is being updated
        - Name must remain unique across all competencies
        """
        try:
            # Permission check handled by @require_permission decorator
            
            # Get existing competency
            existing_competency = await self.competency_repo.get_competency_by_id(competency_id)
            if not existing_competency:
                raise NotFoundError(f"Competency with ID {competency_id} not found")
            
            # Validate stage exists if being updated
            if competency_data.stage_id is not None:
                stage = await self.stage_repo.get_by_id(competency_data.stage_id)
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
            enriched_competency = await self._enrich_competency_data(updated_competency)
            return enriched_competency
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error updating competency {competency_id}: {str(e)}")
            raise
    
    @require_permission(Permission.COMPETENCY_MANAGE)
    async def delete_competency(
        self, 
        competency_id: UUID, 
        current_user_context: AuthContext
    ) -> bool:
        """
        Delete a competency with validation and business rules
        
        Business Logic:
        - Only admin can delete competencies
        - Check if competency is in use (has associated goals/evaluations)
        - Prevent deletion if competency is referenced by other entities
        """
        try:
            # Permission check handled by @require_permission decorator
            
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
    
    @require_any_permission([Permission.COMPETENCY_READ, Permission.COMPETENCY_READ_SELF])
    async def get_all_competencies(
        self, 
        current_user_context: AuthContext
    ) -> List[Competency]:
        """
        Get all competencies (alias for get_competencies without pagination)
        
        Business Logic:
        - Admin: can see all competencies for all stages
        - Other roles: can only see competencies for their own stage
        """
        try:
            # Permission check handled by @require_any_permission decorator
            
            # Apply stage-based filtering for non-admin users
            if current_user_context.is_admin():
                # Admin can see all competencies
                competencies = await self.competency_repo.get_all_competencies()
            else:
                # Non-admin users can only see competencies for their own stage
                user_stage_id = await self._get_user_stage_id(current_user_context.user_id)
                if user_stage_id is None:
                    raise PermissionDeniedError("User has no stage assigned")
                competencies = await self.competency_repo.get_competencies_by_stage_id(user_stage_id)
            
            # Convert to schema objects
            competency_schemas = []
            for competency_model in competencies:
                competency_schema = await self._enrich_competency_data(competency_model)
                competency_schemas.append(competency_schema)
            
            return competency_schemas
            
        except Exception as e:
            logger.error(f"Error getting all competencies: {str(e)}")
            raise

    @require_any_permission([Permission.COMPETENCY_READ, Permission.COMPETENCY_READ_SELF])
    async def get_competencies_by_stage(
        self, 
        stage_id: UUID, 
        current_user_context: AuthContext
    ) -> List[Competency]:
        """
        Get all competencies for a specific stage
        
        Business Logic:
        - Admin: can get competencies for any stage
        - Other roles: can only get competencies for their own stage
        """
        try:
            # Permission check handled by @require_any_permission decorator
            
            # Validate stage access
            await self._validate_stage_access(current_user_context, stage_id)
            
            # Validate stage exists
            stage = await self.stage_repo.get_by_id(stage_id)
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
    
    async def _get_user_stage_id(self, user_id: UUID) -> Optional[UUID]:
        """Get user's stage_id efficiently with caching."""
        try:
            # Check cache first
            cache_key = f"user_stage_{user_id}"
            cached_stage_id = user_stage_cache.get(cache_key)
            if cached_stage_id is not None:
                return cached_stage_id
            
            # Fetch from database via repository
            stage_id = await self.user_repo.get_user_stage_id(user_id)
            
            # Cache the result (including None values)
            user_stage_cache[cache_key] = stage_id
            
            return stage_id
            
        except Exception as e:
            logger.error(f"Error getting stage_id for user {user_id}: {str(e)}")
            raise
    
    async def _validate_stage_access(self, current_user_context: AuthContext, required_stage_id: Optional[UUID] = None) -> Optional[UUID]:
        """
        Validate that the user has access to a stage and return the user's stage_id.
        
        Args:
            current_user_context: The current user's auth context
            required_stage_id: If provided, validate user has access to this specific stage
            
        Returns:
            Optional[UUID]: The user's stage_id (may be None for admin users without explicit stage)
            
        Raises:
            PermissionDeniedError: If user has no stage or doesn't have access to required_stage_id
        """
        if current_user_context.is_admin():
            # Admin users don't need stage validation - they can access any stage
            if required_stage_id:
                return required_stage_id
            # If no specific stage required, we still need to get user's stage for some operations
            user_stage_id = await self._get_user_stage_id(current_user_context.user_id)
            return user_stage_id
        else:
            # Non-admin users can only access their own stage
            user_stage_id = await self._get_user_stage_id(current_user_context.user_id)
            if user_stage_id is None:
                raise PermissionDeniedError("User has no stage assigned")
            
            if required_stage_id and required_stage_id != user_stage_id:
                raise PermissionDeniedError("Access denied to competencies from different stage")
            
            return user_stage_id
    
    async def _enrich_competency_data(self, competency_model: CompetencyModel) -> Competency:
        """Convert competency model to schema with basic enrichment"""
        try:
            # Convert to schema
            competency_dict = {
                "id": competency_model.id,
                "name": competency_model.name,
                "description": competency_model.description,
                "stage_id": competency_model.stage_id,
                "created_at": competency_model.created_at,
                "updated_at": competency_model.updated_at
            }
            
            return Competency.model_validate(competency_dict)
            
        except Exception as e:
            logger.error(f"Error enriching competency data: {e}")
            raise
    
    async def _enrich_detailed_competency_data(self, competency_model: CompetencyModel, current_user_context: Optional[AuthContext] = None) -> CompetencyDetail:
        """Convert competency model to detailed schema with full enrichment"""
        try:
            # Convert to basic schema first
            basic_competency = await self._enrich_competency_data(competency_model)
            
            # Create detailed schema
            detailed_dict = basic_competency.model_dump()
            
            # Add users field based on role permissions
            if current_user_context and current_user_context.is_admin():
                # TODO: Admin can see users - for now empty list until User relationships are implemented; need to get the current evaluation periods and who chose this competency
                detailed_dict["users"] = []
            else:
                # Non-admin users cannot see users list
                detailed_dict["users"] = None
            
            return CompetencyDetail.model_validate(detailed_dict)
            
        except Exception as e:
            logger.error(f"Error enriching detailed competency data: {e}")
            raise