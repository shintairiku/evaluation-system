from fastapi import APIRouter

from .auth import router as auth_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth_router)

# Webhooks should be registered without the /api/v1 prefix
webhooks_router_root = APIRouter()