import logging
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from ..models.user import Role
from ...schemas.user import RoleCreate, RoleUpdate, RoleReorderItem
from .base import BaseRepository


logger = logging.getLogger(__name__)


class RoleRepository(BaseRepository[Role]):
    def __init__(self, session: AsyncSession):
        super().__init__(session, Role)

    # ============================================================================
    # CREATE OPERATIONS
    # ============================================================================
    
    async def create_role(self, role_data: RoleCreate, org_id: str) -> Role:
        """Create a new role with automatic hierarchy_order assignment within organization scope."""
        try:
            # Get the next hierarchy_order within organization
            if role_data.hierarchy_order is None:
                query = select(func.max(Role.hierarchy_order))
                query = self.apply_org_scope_direct(query, Role.organization_id, org_id)
                result = await self.session.execute(query)
                max_order = result.scalar()
                hierarchy_order = (max_order or 0) + 1
            else:
                hierarchy_order = role_data.hierarchy_order
                # Make space for the new role at this position within organization
                await self._make_space_at_order(hierarchy_order, org_id)

            # Create the role
            role = Role(
                organization_id=org_id,
                name=role_data.name,
                description=role_data.description,
                hierarchy_order=hierarchy_order,
                created_at=self._get_current_timestamp(),
                updated_at=self._get_current_timestamp()
            )
            
            self.session.add(role)
            await self.session.flush()
            await self.session.refresh(role)
            
            logger.info(f"Created role for org {org_id}: {role.name} with hierarchy_order: {role.hierarchy_order}")
            return role
            
        except IntegrityError as e:
            logger.error(f"IntegrityError creating role for org {org_id}: {e}")
            await self.session.rollback()
            if "unique constraint" in str(e).lower():
                raise ValueError(f"Role name '{role_data.name}' already exists in organization")
            raise

    # ============================================================================
    # READ OPERATIONS
    # ============================================================================

    async def get_by_id(self, role_id: UUID, org_id: str) -> Optional[Role]:
        """Get role by ID within organization scope."""
        query = select(Role).where(Role.id == role_id)
        query = self.apply_org_scope_direct(query, Role.organization_id, org_id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def get_all(self, org_id: str) -> List[Role]:
        """Get all roles ordered by hierarchy within organization scope."""
        query = select(Role).order_by(Role.hierarchy_order)
        query = self.apply_org_scope_direct(query, Role.organization_id, org_id)
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_by_name(self, name: str, org_id: str) -> Optional[Role]:
        """Get role by name within organization scope."""
        query = select(Role).where(Role.name == name)
        query = self.apply_org_scope_direct(query, Role.organization_id, org_id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def get_by_hierarchy_order(self, hierarchy_order: int, org_id: str) -> Optional[Role]:
        """Get role by hierarchy order within organization scope."""
        query = select(Role).where(Role.hierarchy_order == hierarchy_order)
        query = self.apply_org_scope_direct(query, Role.organization_id, org_id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_user_roles(self, user_id: UUID, org_id: str) -> List[Role]:
        """Get user roles by user ID within organization scope."""
        from ..models.user import user_roles
        
        query = (
            select(Role)
            .join(user_roles, Role.id == user_roles.c.role_id)
            .where(user_roles.c.user_id == user_id)
            .order_by(Role.hierarchy_order)
        )
        query = self.apply_org_scope_direct(query, Role.organization_id, org_id)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    # ============================================================================
    # UPDATE OPERATIONS
    # ============================================================================
    
    async def update_role(self, role_id: UUID, role_data: RoleUpdate, org_id: str) -> Optional[Role]:
        """Update a role (name/description only, not hierarchy_order) within organization scope."""
        role = await self.get_by_id(role_id, org_id)
        if not role:
            return None
        
        if role_data.name is not None:
            role.name = role_data.name
        if role_data.description is not None:
            role.description = role_data.description
        
        # Update timestamp
        role.updated_at = self._get_current_timestamp()
        
        await self.session.flush()
        await self.session.refresh(role)
        return role

    # ============================================================================
    # DELETE OPERATIONS
    # ============================================================================
    
    async def delete_role(self, role_id: UUID, org_id: str) -> bool:
        """Delete a role inside an organization and adjust remaining hierarchy."""
        role = await self.get_by_id(role_id, org_id)
        if not role:
            return False
        
        deleted_order = role.hierarchy_order
        
        # Delete the role
        await self.session.delete(role)
        await self.session.flush()
        
        # Adjust hierarchy_order for roles that were after the deleted role
        await self.session.execute(
            update(Role)
            .where(Role.organization_id == org_id)
            .where(Role.hierarchy_order > deleted_order)
            .values(hierarchy_order=Role.hierarchy_order - 1)
        )
        await self.session.flush()
        
        return True

    # ============================================================================
    # HIERARCHY MANAGEMENT OPERATIONS
    # ============================================================================
       
    async def reorder_roles(self, role_items: List[RoleReorderItem]) -> List[Role]:
        """
        Simple reorder: Frontend sends ALL roles with their new hierarchy_order.
        We just update all roles with their new positions in one operation.
        """
        logger.info(f"Reordering all {len(role_items)} roles from frontend state")
        
        # Validate that all role IDs exist
        role_ids = [item.id for item in role_items]
        existing_roles = await self.session.execute(
            select(Role).where(Role.id.in_(role_ids))
        )
        existing_role_ids = {role.id for role in existing_roles.scalars()}
        
        missing_ids = set(role_ids) - existing_role_ids
        if missing_ids:
            raise ValueError(f"Role IDs not found: {missing_ids}")
        
        # Validate hierarchy_order values are unique and sequential from 1
        orders = [item.hierarchy_order for item in role_items]
        expected_orders = list(range(1, len(role_items) + 1))
        if sorted(orders) != expected_orders:
            raise ValueError(f"hierarchy_order values must be unique and sequential from 1 to {len(role_items)}")
        
        try:
            # Update each role's hierarchy_order based on frontend state
            for item in role_items:
                await self.session.execute(
                    update(Role)
                    .where(Role.id == item.id)
                    .values(
                        hierarchy_order=item.hierarchy_order,
                        updated_at=self._get_current_timestamp()
                    )
                )
            
            await self.session.flush()
            
            # Return all updated roles in their new order
            result = await self.session.execute(
                select(Role)
                .where(Role.id.in_(role_ids))
                .order_by(Role.hierarchy_order)
            )
            updated_roles = list(result.scalars().all())
            
            logger.info(f"Successfully reordered all {len(updated_roles)} roles")
            return updated_roles
            
        except Exception as e:
            logger.error(f"Error reordering roles: {e}")
            raise

    # ============================================================================
    # PRIVATE HELPER METHODS
    # ============================================================================
    
    async def _make_space_at_order(self, target_order: int, org_id: str) -> None:
        """Make space at the target hierarchy order by shifting other roles within organization."""
        await self.session.execute(
            update(Role)
            .where(Role.hierarchy_order >= target_order)
            .where(Role.organization_id == org_id)
            .values(hierarchy_order=Role.hierarchy_order + 1)
        )
        await self.session.flush()

    def _get_current_timestamp(self) -> datetime:
        """Get current UTC timestamp."""
        return datetime.utcnow()
