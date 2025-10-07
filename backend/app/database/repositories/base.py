from abc import ABC
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import Select
from typing import Optional, TypeVar, Generic
import logging

logger = logging.getLogger(__name__)

T = TypeVar('T')

class BaseRepository(ABC, Generic[T]):
    """
    Base repository with organization filtering capabilities following task 5.1 specification.
    
    Implements three filtering patterns:
    1. Direct organization column filtering
    2. Via user relationship filtering  
    3. Via goal→user relationship filtering
    """
    
    def __init__(self, session: AsyncSession, model_class: T = None):
        self.session = session
        self.model = model_class

    def apply_org_scope_direct(self, query: Select, org_col, org_id: str) -> Select:
        """
        Apply organization scope for tables with direct organization columns.
        
        Args:
            query: SQLAlchemy query to filter
            org_col: Organization column reference (e.g., Model.clerk_organization_id)
            org_id: Organization ID to filter by
            
        Returns:
            Filtered query: query.where(org_col == org_id)
        """
        if not org_id:
            raise ValueError("org_id is required and cannot be None")
            
        logger.debug(f"Applying direct organization scope: org_id = {org_id}")
        return query.where(org_col == org_id)

    def apply_org_scope_via_user(self, query: Select, user_fk_col, org_id: str) -> Select:
        """
        Apply organization scope via user relationship for tables with user foreign keys.
        
        Args:
            query: SQLAlchemy query to filter
            user_fk_col: User foreign key column reference (e.g., Model.user_id)
            org_id: Organization ID to filter by
            
        Returns:
            Filtered query: query.join(User).where(User.clerk_organization_id == org_id)
        """
        if not org_id:
            raise ValueError("org_id is required and cannot be None")
            
        from ..models.user import User
        logger.debug(f"Applying organization scope via user: org_id = {org_id}")
        return query.join(User, user_fk_col == User.id).where(User.clerk_organization_id == org_id)

    def apply_org_scope_via_goal(self, query: Select, goal_fk_col, org_id: str) -> Select:
        """
        Apply organization scope via goal→user relationship for tables accessed through goals.
        
        Args:
            query: SQLAlchemy query to filter
            goal_fk_col: Goal foreign key column reference (e.g., Model.goal_id)
            org_id: Organization ID to filter by
            
        Returns:
            Filtered query: query.join(Goal).join(User).where(User.clerk_organization_id == org_id)
        """
        if not org_id:
            raise ValueError("org_id is required and cannot be None")
            
        from ..models.goal import Goal
        from ..models.user import User
        logger.debug(f"Applying organization scope via goal: org_id = {org_id}")
        return (query
                .join(Goal, goal_fk_col == Goal.id)
                .join(User, Goal.user_id == User.id)
                .where(User.clerk_organization_id == org_id))

    def apply_org_scope_via_goal_with_status(self, query: Select, goal_fk_col, org_id: str, goal_status: str) -> Select:
        """
        Apply organization scope via goal→user relationship with goal status filter.

        Args:
            query: SQLAlchemy query to filter
            goal_fk_col: Goal foreign key column reference (e.g., Model.goal_id)
            org_id: Organization ID to filter by
            goal_status: Goal status to filter by (e.g., 'submitted')

        Returns:
            Filtered query with goal status and organization scope
        """
        if not org_id:
            raise ValueError("org_id is required and cannot be None")

        from ..models.goal import Goal
        from ..models.user import User
        logger.debug(f"Applying organization scope via goal with status {goal_status}: org_id = {org_id}")
        return (query
                .join(Goal, goal_fk_col == Goal.id)
                .join(User, Goal.user_id == User.id)
                .where(User.clerk_organization_id == org_id)
                .where(Goal.status == goal_status))

    def apply_org_scope_via_goal_with_owner(self, query: Select, goal_fk_col, org_id: str, owner_user_id) -> Select:
        """
        Apply organization scope via goal→user relationship with goal owner filter.

        Args:
            query: SQLAlchemy query to filter
            goal_fk_col: Goal foreign key column reference (e.g., Model.goal_id)
            org_id: Organization ID to filter by
            owner_user_id: User ID who owns the goals

        Returns:
            Filtered query with goal owner and organization scope
        """
        if not org_id:
            raise ValueError("org_id is required and cannot be None")

        from ..models.goal import Goal
        from ..models.user import User
        logger.debug(f"Applying organization scope via goal with owner {owner_user_id}: org_id = {org_id}")
        return (query
                .join(Goal, goal_fk_col == Goal.id)
                .join(User, Goal.user_id == User.id)
                .where(User.clerk_organization_id == org_id)
                .where(Goal.user_id == owner_user_id))

    def verify_org_consistency_direct(self, org_id: str, target_org_id: Optional[str], entity_description: str = "record") -> None:
        """
        Verify organization consistency for records with direct organization columns.
        
        Args:
            org_id: Expected organization ID
            target_org_id: Actual organization ID of the target record
            entity_description: Description of the entity for error messages
            
        Raises:
            ValueError: If organization IDs don't match or if org_id is None
        """
        if not org_id:
            raise ValueError("org_id is required for organization consistency verification")
            
        if target_org_id != org_id:
            error_msg = f"Organization mismatch: {entity_description} belongs to org {target_org_id}, expected {org_id}"
            logger.error(error_msg)
            raise ValueError(error_msg)
            
        logger.debug(f"Direct organization consistency verified for {entity_description}: {org_id}")

    async def verify_org_consistency_via_user(self, org_id: str, user_id: str, entity_description: str = "record") -> None:
        """
        Verify organization consistency via user relationship.
        
        Args:
            org_id: Expected organization ID
            user_id: User ID to verify organization through
            entity_description: Description of the entity for error messages
            
        Raises:
            ValueError: If organization IDs don't match or if org_id is None
        """
        if not org_id:
            raise ValueError("org_id is required for organization consistency verification")
            
        from ..models.user import User
        result = await self.session.execute(
            select(User.clerk_organization_id).where(User.id == user_id)
        )
        user_org_id = result.scalar()
        
        if not user_org_id:
            raise ValueError(f"User {user_id} not found or has no organization")
            
        if user_org_id != org_id:
            error_msg = f"Organization mismatch: {entity_description} belongs to user in org {user_org_id}, expected {org_id}"
            logger.error(error_msg)
            raise ValueError(error_msg)
            
        logger.debug(f"User-based organization consistency verified for {entity_description}: {org_id}")

    async def verify_org_consistency_via_goal(self, org_id: str, goal_id: str, entity_description: str = "record") -> None:
        """
        Verify organization consistency via goal→user relationship.
        
        Args:
            org_id: Expected organization ID
            goal_id: Goal ID to verify organization through
            entity_description: Description of the entity for error messages
            
        Raises:
            ValueError: If organization IDs don't match or if org_id is None
        """
        if not org_id:
            raise ValueError("org_id is required for organization consistency verification")
            
        from ..models.goal import Goal
        from ..models.user import User
        result = await self.session.execute(
            select(User.clerk_organization_id)
            .join(Goal, Goal.user_id == User.id)
            .where(Goal.id == goal_id)
        )
        goal_org_id = result.scalar()
        
        if not goal_org_id:
            raise ValueError(f"Goal {goal_id} not found or has no associated user/organization")
            
        if goal_org_id != org_id:
            error_msg = f"Organization mismatch: {entity_description} belongs to goal in org {goal_org_id}, expected {org_id}"
            logger.error(error_msg)
            raise ValueError(error_msg)
            
        logger.debug(f"Goal-based organization consistency verified for {entity_description}: {org_id}")

    def ensure_org_filter_applied(self, query_description: str, org_id: Optional[str]) -> None:
        """
        Audit logging for organization filter application.
        
        Args:
            query_description: Description of the query for logging
            org_id: Organization ID being filtered by
        """
        if org_id:
            logger.info(f"Organization filter applied to {query_description}: org_id={org_id}")
        else:
            logger.warning(f"No organization filter applied to {query_description} - potential security risk")