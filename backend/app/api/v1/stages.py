from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any, List
from uuid import UUID

from ...dependencies.auth import get_current_user
from ...schemas.user import Stage, StageDetail, StageCreate, StageUpdate

router = APIRouter(prefix="/stages", tags=["stages"])

@router.get("/", response_model=List[Stage])
async def get_stages(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Get all stages accessible to the current user."""
    # Access rules: admin, manager, supervisor, viewer, employee - all can view stages
    allowed_roles = ["admin", "manager", "supervisor", "viewer", "employee"]
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # TODO: Implement stage service to fetch all stages
    # - Return all stages with user count and competencies
    return []

@router.post("/", response_model=StageCreate)
async def create_stage(
    stage_create: StageCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Create a new stage (admin only)."""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can create stages"
        )
    
    # TODO: Implement stage creation service
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Stage service not implemented"
    )

@router.get("/{stage_id}", response_model=StageDetail)
async def get_stage(
    stage_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get stage details by ID."""
    # Access rules: admin, manager, supervisor, viewer, employee - all can view stages
    allowed_roles = ["admin", "manager", "supervisor", "viewer", "employee"]
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # TODO: Implement stage service to fetch stage with competencies and users
    # Should return StageDetail with:
    # - Basic stage info (id, name, description, timestamps)
    # - User count and competency count for the stage
    # - Paginated list of users assigned to this stage
    # - List of competencies belonging to this stage
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Stage service not implemented"
    )

@router.put("/{stage_id}", response_model=StageUpdate)
async def update_stage(
    stage_id: UUID,
    stage_update: StageUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Update stage information (admin only)."""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can update stages"
        )
    
    # TODO: Implement stage update service
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Stage service not implemented"
    )

@router.delete("/{stage_id}")
async def delete_stage(
    stage_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Delete a stage (admin only)."""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can delete stages"
        )
    
    # TODO: Implement stage deletion service
    # - Check if any users are assigned to this stage
    # - Handle competencies associated with this stage
    return {"message": "Stage deleted successfully"}