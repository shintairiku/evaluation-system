from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any

from ...dependencies.auth import get_current_user

router = APIRouter(prefix="/evaluations", tags=["evaluations"])
