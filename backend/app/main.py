from datetime import datetime
from fastapi import FastAPI, HTTPException, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
import logging

from .api.v1 import org_api_router
from .api.v2 import org_api_router_v2
from .api.v1.auth import router as auth_router
from .core.middleware import LoggingMiddleware, OrgSlugValidationMiddleware, http_exception_handler, general_exception_handler
from .core.config import settings
from .schemas.common import HealthCheckResponse
from .database.session import AsyncSessionLocal

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="HR Evaluation System API",
    description="API for managing employee evaluations, goals, and performance reports",
    version="1.0.0",
    docs_url="/docs" if settings.is_development else None,
    redoc_url="/redoc" if settings.is_development else None,
    redirect_slashes=False  # Disable automatic trailing slash redirects to prevent auth header loss
)

# CORS configuration - use settings for environment-specific origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add custom middleware
app.add_middleware(LoggingMiddleware)

# Add organization slug validation middleware
# Note: This should be added after CORS but before other middleware for proper request processing
async def get_session():
    async with AsyncSessionLocal() as session:
        yield session

app.add_middleware(OrgSlugValidationMiddleware, get_session=get_session)

# Add exception handlers
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)

# Include API routers
app.include_router(org_api_router)  # Organization-scoped routes only
app.include_router(org_api_router_v2)  # v2 organization-scoped routes

# Include auth routes separately (organization-agnostic)
auth_api_router = APIRouter(prefix="/api/v1")
auth_api_router.include_router(auth_router)
app.include_router(auth_api_router)

# Include webhooks at root level (without /api/v1 prefix)
from .api.webhooks.router import webhooks_router
app.include_router(webhooks_router)

def custom_openapi():
    """
    Custom OpenAPI schema with authentication configuration.
    """
    if app.openapi_schema:
        return app.openapi_schema
    
    logger.info("Generating custom OpenAPI schema...")
    
    # Rebuild schemas to resolve forward references before generating OpenAPI
    try:
        from .schemas.stage_competency import rebuild_models
        rebuild_models()
    except Exception as e:
        logger.warning(f"Could not rebuild schema models: {e}")
    
    openapi_schema = get_openapi(
        title="HR Evaluation System API",
        version="1.0.0",
        description="API for managing employee evaluations, goals, and performance reports",
        routes=app.routes,
    )
    
    # Add security schemes
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "Enter either:\n1. Development API keys:\n   - dev-admin-key (admin role)\n   - dev-manager-key (manager role)\n   - dev-supervisor-key (supervisor role)\n   - dev-employee-key (employee role)\n2. Your Clerk JWT token from the frontend application\n\nGet all dev keys from: GET /api/v1/auth/dev-keys"
        }
    }
    
    # Define public endpoints that don't require authentication
    public_endpoints = {
        "/",
        "/health",
        "/api/v1/auth/signup/profile-options",
        "/api/v1/auth/user/{clerk_user_id}",
        "/api/v1/auth/logout",
        "/api/v1/auth/dev-keys",
        # Note: All business endpoints are now organization-scoped under /api/org/{org_slug}/
    }
    
    # Apply security requirements to all endpoints
    logger.info("OpenAPI paths found:")
    for path, path_item in openapi_schema["paths"].items():
        logger.info(f"  Path: {path}")
        for method, method_data in path_item.items():
            if isinstance(method_data, dict) and method.lower() in ["get", "post", "put", "patch", "delete"]:
                if path in public_endpoints:
                    # Public endpoints don't require auth
                    method_data["security"] = []
                    logger.info(f"    {method.upper()}: PUBLIC (no auth)")
                else:
                    # Protected endpoints require BearerAuth
                    method_data["security"] = [{"BearerAuth": []}]
                    logger.info(f"    {method.upper()}: PROTECTED (requires auth)")
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema

# Clear any existing schema cache and assign our custom function
app.openapi_schema = None
app.openapi = custom_openapi
logger.info("Custom OpenAPI function assigned successfully")

@app.get("/", response_model=HealthCheckResponse)
async def root():
    """Root endpoint for health check."""
    return HealthCheckResponse(
        status="healthy",
        timestamp=datetime.now().isoformat(),
        version="1.0.0"
    )

@app.get("/health", response_model=HealthCheckResponse)
async def health_check():
    """Health check endpoint."""
    return HealthCheckResponse(
        status="healthy",
        timestamp=datetime.now().isoformat(),
        version="1.0.0"
    ) 
