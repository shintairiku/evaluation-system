from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ...database.session import get_db_session

router = APIRouter(prefix="/auth", tags=["authentication"])

@router.post("/logout") 
async def logout():
    """
    Logout endpoint - Clerk handles session management client-side.
    """
    return {
        "success": True,
        "message": "Logout successful. Please clear your client-side session."
    }