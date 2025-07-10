"""
Role API endpoints for CRUD operations.

Implements Role management functionality as specified in Task #73.
Uses AuthContext for security and RoleRepository for data access.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession

from ...database.session import get_db_session
from ...database.repositories.role_repo import RoleRepository
from ...schemas.role import Role, RoleDetail, RoleCreate, RoleUpdate, RoleHierarchy
from ...schemas.common import BaseResponse
from ...security import AuthContext, get_auth_context
from ...core.permissions import Permission
from ...core.exceptions import NotFoundError, ConflictError, ValidationError

router = APIRouter(prefix="/admin/roles", tags=["roles"])


@router.get("/", response_model=List[Role])
async def get_roles(
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Get all roles (admin only)."""
    # Require admin permission for role management
    context.require_permission(Permission.ROLE_MANAGE)
    
    try:
        repo = RoleRepository(session)
        roles = await repo.get_all()
        
        return [
            Role(
                id=role.id,
                name=role.name,
                code=role.code,
                description=role.description,
                permissions=role.permissions or [],
                parent_id=role.parent_id,
                created_at=role.created_at,
                updated_at=role.updated_at
            )
            for role in roles
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching roles: {str(e)}"
        )


@router.get("/hierarchy", response_model=List[RoleHierarchy])
async def get_role_hierarchy(
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Get role hierarchy (admin only)."""
    context.require_permission(Permission.ROLE_MANAGE)
    
    try:
        repo = RoleRepository(session)
        
        # Get root roles (no parent)
        root_roles = await repo.get_roles_by_parent_id(None)
        
        async def build_hierarchy(role) -> RoleHierarchy:
            children = await repo.get_roles_by_parent_id(role.id)
            child_hierarchies = []
            for child in children:
                child_hierarchies.append(await build_hierarchy(child))
            
            return RoleHierarchy(
                role=Role(
                    id=role.id,
                    name=role.name,
                    code=role.code,
                    description=role.description,
                    permissions=role.permissions or [],
                    parent_id=role.parent_id,
                    created_at=role.created_at,
                    updated_at=role.updated_at
                ),
                children=child_hierarchies
            )
        
        hierarchy = []
        for root_role in root_roles:
            hierarchy.append(await build_hierarchy(root_role))
        
        return hierarchy
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching role hierarchy: {str(e)}"
        )


@router.post("/", response_model=Role, status_code=status.HTTP_201_CREATED)
async def create_role(
    role_create: RoleCreate,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Create a new role (admin only)."""
    context.require_permission(Permission.ROLE_MANAGE)
    
    try:
        repo = RoleRepository(session)
        
        # Check for existing role with same code or name
        if await repo.check_role_exists_by_code(role_create.code):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Role with code '{role_create.code}' already exists"
            )
        
        if await repo.check_role_exists_by_name(role_create.name):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Role with name '{role_create.name}' already exists"
            )
        
        # Validate parent role exists if specified
        if role_create.parent_id is not None:
            parent_role = await repo.get_role_by_id(role_create.parent_id)
            if not parent_role:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Parent role with ID {role_create.parent_id} not found"
                )
        
        # Create the role
        new_role = await repo.create_role(
            name=role_create.name,
            code=role_create.code,
            description=role_create.description,
            permissions=role_create.permissions,
            parent_id=role_create.parent_id
        )
        
        # Commit the transaction
        await session.commit()
        
        return Role(
            id=new_role.id,
            name=new_role.name,
            code=new_role.code,
            description=new_role.description,
            permissions=new_role.permissions or [],
            parent_id=new_role.parent_id,
            created_at=new_role.created_at,
            updated_at=new_role.updated_at
        )
        
    except HTTPException:
        await session.rollback()
        raise
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating role: {str(e)}"
        )


@router.get("/{role_id}", response_model=RoleDetail)
async def get_role(
    role_id: int,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Get role details by ID with metadata (admin only)."""
    context.require_permission(Permission.ROLE_MANAGE)
    
    try:
        repo = RoleRepository(session)
        role = await repo.get_role_by_id(role_id)
        
        if not role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Role with ID {role_id} not found"
            )
        
        # Get user count for this role
        user_count = await repo.count_users_with_role(role_id)
        
        # Build parent role detail if exists
        parent_detail = None
        if role.parent:
            parent_detail = RoleDetail(
                id=role.parent.id,
                name=role.parent.name,
                code=role.parent.code,
                description=role.parent.description,
                permissions=role.parent.permissions or [],
                parent_id=role.parent.parent_id,
                created_at=role.parent.created_at,
                updated_at=role.parent.updated_at,
                user_count=None,
                parent=None,
                children=[]
            )
        
        # Build children role details
        children_details = []
        for child in role.children:
            children_details.append(RoleDetail(
                id=child.id,
                name=child.name,
                code=child.code,
                description=child.description,
                permissions=child.permissions or [],
                parent_id=child.parent_id,
                created_at=child.created_at,
                updated_at=child.updated_at,
                user_count=None,
                parent=None,
                children=[]
            ))
        
        return RoleDetail(
            id=role.id,
            name=role.name,
            code=role.code,
            description=role.description,
            permissions=role.permissions or [],
            parent_id=role.parent_id,
            created_at=role.created_at,
            updated_at=role.updated_at,
            user_count=user_count,
            parent=parent_detail,
            children=children_details
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching role: {str(e)}"
        )


@router.put("/{role_id}", response_model=Role)
async def update_role(
    role_id: int,
    role_update: RoleUpdate,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Update role information (admin only)."""
    context.require_permission(Permission.ROLE_MANAGE)
    
    try:
        repo = RoleRepository(session)
        
        # Check if role exists
        existing_role = await repo.get_role_by_id(role_id)
        if not existing_role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Role with ID {role_id} not found"
            )
        
        # Check for conflicts with code and name if they're being updated
        if role_update.code is not None:
            if await repo.check_role_exists_by_code(role_update.code, exclude_id=role_id):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Role with code '{role_update.code}' already exists"
                )
        
        if role_update.name is not None:
            if await repo.check_role_exists_by_name(role_update.name, exclude_id=role_id):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Role with name '{role_update.name}' already exists"
                )
        
        # Validate parent role exists if specified
        if role_update.parent_id is not None:
            if role_update.parent_id == role_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Role cannot be its own parent"
                )
            
            parent_role = await repo.get_role_by_id(role_update.parent_id)
            if not parent_role:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Parent role with ID {role_update.parent_id} not found"
                )
        
        # Update the role
        updated_role = await repo.update_role(
            role_id=role_id,
            name=role_update.name,
            code=role_update.code,
            description=role_update.description,
            permissions=role_update.permissions,
            parent_id=role_update.parent_id
        )
        
        # Commit the transaction
        await session.commit()
        
        return Role(
            id=updated_role.id,
            name=updated_role.name,
            code=updated_role.code,
            description=updated_role.description,
            permissions=updated_role.permissions or [],
            parent_id=updated_role.parent_id,
            created_at=updated_role.created_at,
            updated_at=updated_role.updated_at
        )
        
    except HTTPException:
        await session.rollback()
        raise
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating role: {str(e)}"
        )


@router.delete("/{role_id}", response_model=BaseResponse)
async def delete_role(
    role_id: int,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Delete a role (admin only)."""
    context.require_permission(Permission.ROLE_MANAGE)
    
    try:
        repo = RoleRepository(session)
        
        # Check if role exists
        existing_role = await repo.get_role_by_id(role_id)
        if not existing_role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Role with ID {role_id} not found"
            )
        
        # Check if any users have this role
        user_count = await repo.count_users_with_role(role_id)
        if user_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete role: {user_count} users still have this role"
            )
        
        # Check if role has children
        children = await repo.get_roles_by_parent_id(role_id)
        if children:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete role: {len(children)} child roles depend on this role"
            )
        
        # Delete the role
        success = await repo.delete_role(role_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete role"
            )
        
        # Commit the transaction
        await session.commit()
        
        return BaseResponse(message="Role deleted successfully")
        
    except HTTPException:
        await session.rollback()
        raise
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting role: {str(e)}"
        )