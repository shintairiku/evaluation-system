from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any

from ...dependencies.auth import get_current_user
from ...schemas.user import UserList, User, UserCreate, UserUpdate, UserProfile

router = APIRouter(prefix="/users", tags=["users"])
