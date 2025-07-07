from fastapi import FastAPI, HTTPException, Depends, status, Header
from fastapi.openapi.docs import get_swagger_ui_html, get_redoc_html
from fastapi.openapi.utils import get_openapi
from typing import Optional, Annotated

from .rbac_config import RBACConfig

# Initialize RBAC config
rbac_config = RBACConfig()


def verify_engineer_access_key(
    x_engineer_access_key: Annotated[Optional[str], Header(alias="X-Engineer-Access-Key")] = None
) -> bool:
    """
    Dependency to verify engineer access key from request headers.
    
    Args:
        x_engineer_access_key: The engineer access key from the header
        
    Returns:
        bool: True if access is granted
        
    Raises:
        HTTPException: If access is denied
    """
    if not rbac_config.is_development_mode():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API documentation is not available in this environment"
        )
    
    if not x_engineer_access_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Engineer access key is required",
            headers={"WWW-Authenticate": "X-Engineer-Access-Key"}
        )
    
    if not rbac_config.is_valid_engineer_key(x_engineer_access_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid engineer access key",
            headers={"WWW-Authenticate": "X-Engineer-Access-Key"}
        )
    
    return True


def setup_secure_docs(app: FastAPI) -> None:
    """
    Set up secure API documentation endpoints.
    
    Args:
        app: The FastAPI application instance
    """
    
    @app.get("/secure-docs", include_in_schema=False)
    async def secure_docs(authenticated: bool = Depends(verify_engineer_access_key)):
        """
        Secure Swagger UI documentation endpoint.
        Only accessible in development mode with valid engineer access key.
        """
        return get_swagger_ui_html(
            openapi_url="/secure-openapi.json",
            title=f"{app.title} - Secure Documentation",
            swagger_favicon_url="/favicon.ico" if hasattr(app, 'favicon_url') else None
        )
    
    @app.get("/secure-redoc", include_in_schema=False)
    async def secure_redoc(authenticated: bool = Depends(verify_engineer_access_key)):
        """
        Secure ReDoc documentation endpoint.
        Only accessible in development mode with valid engineer access key.
        """
        return get_redoc_html(
            openapi_url="/secure-openapi.json",
            title=f"{app.title} - Secure Documentation",
            redoc_favicon_url="/favicon.ico" if hasattr(app, 'favicon_url') else None
        )
    
    @app.get("/secure-openapi.json", include_in_schema=False)
    async def secure_openapi(authenticated: bool = Depends(verify_engineer_access_key)):
        """
        Secure OpenAPI schema endpoint.
        Only accessible in development mode with valid engineer access key.
        """
        return get_openapi(
            title=app.title,
            version=app.version,
            description=app.description,
            routes=app.routes,
        )


def disable_default_docs(app: FastAPI) -> None:
    """
    Disable default API documentation endpoints.
    
    Args:
        app: The FastAPI application instance
    """
    
    @app.get("/docs", include_in_schema=False)
    async def disabled_docs():
        """Disabled default documentation endpoint."""
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API documentation is not available in this environment"
        )
    
    @app.get("/redoc", include_in_schema=False)
    async def disabled_redoc():
        """Disabled default ReDoc endpoint."""
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API documentation is not available in this environment"
        )
    
    @app.get("/openapi.json", include_in_schema=False)
    async def disabled_openapi():
        """Disabled default OpenAPI schema endpoint."""
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API documentation is not available in this environment"
        ) 