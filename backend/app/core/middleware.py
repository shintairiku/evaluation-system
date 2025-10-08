import logging
import time
from typing import Callable
import re

from fastapi import Request, Response, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.datastructures import Headers

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

        # Public routes that don't require authentication
        self.public_routes = {
            '/',
            '/health',
            '/docs',
            '/redoc',
            '/openapi.json',
        }

        # Public route prefixes (for pattern matching)
        self.public_prefixes = [
            '/webhooks/',  # Webhooks use signature verification
            '/api/v1/auth/',  # Auth endpoints are organization-agnostic
        ]

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path

        # Allow OPTIONS requests (CORS preflight)
        if request.method == "OPTIONS":
            return await call_next(request)

        # Allow public routes to pass through without authentication
        if path in self.public_routes:
            return await call_next(request)

        # Allow public route prefixes to pass through
        for prefix in self.public_prefixes:
            if path.startswith(prefix):
                return await call_next(request)

        # Check if this is an organization-scoped route
        match = self.org_route_pattern.match(path)

        if not match:
            # Not an org-scoped route, proceed normally
            return await call_next(request)

        # Extract org_slug from URL
        org_slug = match.group(1)

        try:
            # Normalize headers for case-insensitive lookup
            headers = Headers(request.headers)

            # Support any casing for the Authorization header, including lowercase from proxies
            auth_header = headers.get("authorization")
            if not auth_header or not auth_header.lower().startswith("bearer "):
                raise HTTPException(
                    status_code=401,
                    detail="Missing or invalid Authorization header"
                )

            # Preserve token casing while ignoring prefix casing
            token = auth_header.split(" ", 1)[1]

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
                # Both auth_user.organization_id and organization.id are Clerk org IDs (String type)
                # We compare IDs for authoritative check, and log slugs for debugging
                user_org_id = auth_user.organization_id
                user_org_slug = auth_user.organization_slug
                db_org_id = organization.id
                db_org_slug = organization.slug

                logger.debug(
                    f"Org validation: URL slug='{org_slug}', "
                    f"JWT org_id='{user_org_id}', JWT slug='{user_org_slug}', "
                    f"DB org_id='{db_org_id}', DB slug='{db_org_slug}'"
                )

                # Primary check: organization ID must match
                if user_org_id != db_org_id:
                    logger.warning(
                        f"Organization access denied: User {auth_user.clerk_id} "
                        f"(org_id={user_org_id}, slug={user_org_slug}) "
                        f"attempted to access org slug '{org_slug}' "
                        f"(db_org_id={db_org_id}, db_slug={db_org_slug})"
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

        try:
            # Process the request and get the response
            response = await call_next(request)
            process_time = time.time() - start_time

            # Only log slow requests (>2s) or errors
            if process_time > 2.0:
                logger.warning(
                    f"Slow request: {request.method} {request.url} - "
                    f"Status: {response.status_code} - "
                    f"Process time: {process_time:.4f}s"
                )
            elif response.status_code >= 400:
                logger.warning(
                    f"Error response: {request.method} {request.url} - "
                    f"Status: {response.status_code} - "
                    f"Process time: {process_time:.4f}s"
                )
            # Use debug level for normal requests (won't show unless LOG_LEVEL=DEBUG)
            else:
                logger.debug(
                    f"{request.method} {request.url} - "
                    f"{response.status_code} - {process_time:.4f}s"
                )

            return response

        except Exception as e:
            process_time = time.time() - start_time
            # Always log errors
            logger.error(
                f"Error processing request: {request.method} {request.url} - "
                f"{str(e)} - Process time: {process_time:.4f}s"
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