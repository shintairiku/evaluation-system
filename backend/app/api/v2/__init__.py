from fastapi import APIRouter

from .users import router as users_router

org_api_router_v2 = APIRouter(prefix="/api/v2/org/{org_slug}")
org_api_router_v2.include_router(users_router)

__all__ = ["org_api_router_v2"]

