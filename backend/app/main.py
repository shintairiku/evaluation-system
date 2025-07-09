from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import logging

from .api.v1 import api_router
from .core.middleware import LoggingMiddleware, http_exception_handler, general_exception_handler
from .core.secure_docs import setup_secure_docs, disable_default_docs
from .core.rbac_config import RBACConfig
from .schemas.common import HealthCheckResponse

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize RBAC config
rbac_config = RBACConfig()

# Create FastAPI app with conditional documentation settings
app = FastAPI(
    title="HR Evaluation System API",
    description="API for managing employee evaluations, goals, and performance reports",
    version="1.0.0",
    # Disable default documentation endpoints
    docs_url=None,
    redoc_url=None,
    openapi_url=None
)

# Setup secure documentation system
# Always setup secure docs - the internal logic handles environment checks
setup_secure_docs(app)
logger.info(f"Secure API documentation setup complete - Environment: {rbac_config.environment}")

# Always override default documentation endpoints with disabled versions
disable_default_docs(app)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add custom middleware
app.add_middleware(LoggingMiddleware)

# Add exception handlers
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)

# Include API routers
app.include_router(api_router)

# Include webhooks at root level (without /api/v1 prefix)
from .api.v1 import webhooks_router_root
app.include_router(webhooks_router_root)

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
    """Health check endpoint (public access)."""
    return HealthCheckResponse(
        status="healthy",
        timestamp=datetime.now().isoformat(),
        version="1.0.0"
    ) 