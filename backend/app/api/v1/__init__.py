from fastapi import APIRouter

from .auth import router as auth_router
from .users import router as user_router
from .goals import router as goal_router
from .evaluations import router as evaluation_router
# from .reports import router as reports_router  # Will be defined in the future
# from .webhooks import router as webhooks_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth_router)
api_router.include_router(user_router)
api_router.include_router(goal_router)
api_router.include_router(evaluation_router)
# api_router.include_router(reports_router)

# Webhooks should be registered without the /api/v1 prefix
# webhooks_router_root = APIRouter()
# webhooks_router_root.include_router(webhooks_router)