from fastapi import APIRouter

from .clerk import router as clerk_webhook_router

# Main webhooks router
webhooks_router = APIRouter(prefix="/webhooks")

# Include specific webhook handlers
webhooks_router.include_router(clerk_webhook_router)