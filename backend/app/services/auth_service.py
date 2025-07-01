from typing import Any
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..database.session import get_db_session


class AuthService:
    """Minimal auth service for middleware compatibility."""
    
    def __init__(self, session: AsyncSession = Depends(get_db_session)):
        self.session = session
    
    def get_user_from_token(self, token: str) -> Any:
        """Placeholder for JWT token verification - not used in current auth workflow."""
        raise NotImplementedError("JWT verification not implemented for current auth workflow")