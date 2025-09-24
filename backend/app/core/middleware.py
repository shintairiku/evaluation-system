import logging
import time
from typing import Callable
import re

from fastapi import Request, Response, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy.ext.asyncio import AsyncSession

from ..database.repositories.organization_repo import OrganizationRepository
from ..services.auth_service import AuthService


logger = logging.getLogger(__name__)


class OrgSlugValidationMiddleware(BaseHTTPMiddleware):
    """Middleware to validate organization slug in URL against JWT claims."""

    def __init__(self, app, get_session):
        super().__init__(app)
        self.get_session = get_session
        # Pattern to match /api/org/{org_slug}/... routes
        self.org_route_pattern = re.compile(r'^/api/org/([^/]+)/')

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Check if this is an organization-scoped route
        path = request.url.path
        match = self.org_route_pattern.match(path)

        if not match:
            # Not an org-scoped route, proceed normally
            return await call_next(request)

        # Extract org_slug from URL
        org_slug = match.group(1)

        try:
            # Get authorization header
            auth_header = request.headers.get("Authorization")
            if not auth_header or not auth_header.startswith("Bearer "):
                raise HTTPException(
                    status_code=401,
                    detail="Missing or invalid Authorization header"
                )

            token = auth_header.split(" ")[1]

            # Get database session and validate organization
            session_gen = self.get_session()
            session = await session_gen.__anext__()
            try:
                # Validate JWT and extract user info
                auth_service = AuthService(session)
                auth_user = await auth_service.get_user_from_token(token)

                # Validate organization access
                org_repo = OrganizationRepository(session)
                organization = await org_repo.get_by_slug(org_slug)

                if not organization:
                    logger.warning(f"Organization not found for slug: {org_slug}")
                    raise HTTPException(
                        status_code=404,
                        detail=f"Organization '{org_slug}' not found"
                    )

                # Check if user belongs to this organization
                if auth_user.organization_id != organization.id:
                    logger.warning(
                        f"User {auth_user.clerk_id} attempted to access org {org_slug} "
                        f"but belongs to org {auth_user.organization_id}"
                    )
                    raise HTTPException(
                        status_code=403,
                        detail="You do not have access to this organization"
                    )

                # Add validated org info to request state for downstream use
                request.state.org_slug = org_slug
                request.state.org_id = organization.id
                request.state.auth_user = auth_user

                logger.debug(f"Org slug validation successful: {org_slug} -> {organization.id}")

            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Organization validation failed: {e}")
                raise HTTPException(
                    status_code=500,
                    detail="Organization validation failed"
                )
            finally:
                await session.close()

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Unhandled exception: {e}")
            raise HTTPException(
                status_code=500,
                detail="Organization validation failed"
            )

        return await call_next(request)


# Middleware for logging requests and responses
class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()
        
        # Log the incoming request details
        logger.info(f"Request: {request.method} {request.url}")
        
        try:
            # Process the request and get the response
            response = await call_next(request)
            process_time = time.time() - start_time
            
            # Log the response details and processing time
            logger.info(
                f"Response: {response.status_code} - "
                f"Process time: {process_time:.4f}s"
            )
            
            return response
        
        except Exception as e:
            process_time = time.time() - start_time
            # Log any errors that occur during request processing
            logger.error(
                f"Error processing request: {str(e)} - "
                f"Process time: {process_time:.4f}s"
            )
            raise


# Custom handler for HTTP exceptions
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    logger.error(f"HTTP Exception: {exc.status_code} - {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": True,
            "message": exc.detail,
            "status_code": exc.status_code
        }
    )


# Custom handler for general exceptions
async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(f"Unhandled exception: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={
            "error": True,
            "message": "Internal server error",
            "status_code": 500
        }
    )