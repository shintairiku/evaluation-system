from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Dict, Any, List, Optional
from uuid import UUID

from ...dependencies.auth import get_current_user
from ...schemas.goal import GoalCategory, GoalCategoryDetail, GoalCategoryList, GoalCategoryCreate, GoalCategoryUpdate
from ...schemas.common import PaginationParams

router = APIRouter(prefix="/goal-categories", tags=["goal-categories"])

@router.get("/", response_model=GoalCategoryList)
async def get_goal_categories(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get goal categories list."""
    # TODO: Implement goal category service
    # - Get all goal categories from database (id, name)
    # - Calculate goal counts for each category
    # - Add computed fields (description, required_fields) based on category name
    
    # For now, return the standard categories with computed fields
    categories = [
        {
            "id": 1,
            "name": "performance",
            "description": "Performance Goals",
            "goalCount": 0,
            "requiredFields": ["performanceGoalType", "specificGoalText", "achievementCriteriaText", "meansMethodsText"]
        },
        {
            "id": 2,
            "name": "competency", 
            "description": "Competency Goals",
            "goalCount": 0,
            "requiredFields": ["competencyId", "actionPlan"]
        },
        {
            "id": 3,
            "name": "core_value",
            "description": "Core Value Goals", 
            "goalCount": 0,
            "requiredFields": ["coreValuePlan"]
        }
    ]
    
    # TODO: When implementing the service, use PaginationParams for real pagination
    # For now, return all categories without pagination
    return GoalCategoryList(
        items=categories,
        total=len(categories),
        page=1,
        limit=len(categories),
        pages=1
    )

@router.post("/", response_model=GoalCategory)
async def create_goal_category(
    category_create: GoalCategoryCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Create a new goal category (admin only)."""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can create goal categories"
        )
    
    # TODO: Implement goal category creation service
    # - Validate unique name
    # - Create category with provided information
    # - Set appropriate required_fields based on category type
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Goal category service not implemented"
    )

@router.get("/{category_id}", response_model=GoalCategoryDetail)
async def get_goal_category(
    category_id: int,
    pagination: PaginationParams = Depends(),
    period_id: Optional[UUID] = Query(None, alias="periodId", description="Filter goals by evaluation period"),
    status: Optional[str] = Query(None, description="Filter goals by status"),
    user_id: Optional[UUID] = Query(None, alias="userId", description="Filter goals by user (supervisor/admin only)"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get detailed goal category information by ID with paginated goals list."""
    # Access control for user_id filter
    if user_id and current_user.get("role") not in ["supervisor", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only supervisors and administrators can view other users' goals"
        )
    
    # TODO: Implement goal category service
    # - Get category by ID (verify exists)
    # - Get paginated goals list for this category using pagination.page, pagination.limit, pagination.offset
    # - Apply filters: period_id, status, user_id (with permission check)
    # - Use PaginatedResponse.create(goals, total, pagination) for goals field
    # - Calculate usage statistics (active, draft, approved counts)
    # - Include goal counts and required fields
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Goal category service not implemented"
    )

@router.put("/{category_id}", response_model=GoalCategory)
async def update_goal_category(
    category_id: int,
    category_update: GoalCategoryUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Update a goal category (admin only)."""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can update goal categories"
        )
    
    # TODO: Implement goal category update service
    # - Verify category exists
    # - Update category information
    # - Handle display_order changes
    # - Update required_fields if needed
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Goal category service not implemented"
    )

@router.delete("/{category_id}")
async def delete_goal_category(
    category_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Delete a goal category (admin only)."""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can delete goal categories"
        )
    
    # TODO: Implement goal category deletion service
    # - Verify category exists
    # - Check if category has associated goals (prevent deletion if so)
    # - Or provide option to migrate goals to another category
    return {"message": "Goal category deleted successfully"}



