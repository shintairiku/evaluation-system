import logging
import re
import time
import os
from typing import Callable

from cachetools import TTLCache
from fastapi import HTTPException, Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.datastructures import Headers

from ..database.repositories.organization_repo import OrganizationRepository
from ..services.auth_service import AuthService
from .config import settings


logger = logging.getLogger(__name__)

# Short TTL caches to avoid repeated DB lookups for the same org slug and
# repeated JWT decoding in rapid, successive calls hitting this middleware.
_org_slug_cache: TTLCache = TTLCache(maxsize=256, ttl=120)


class OrgSlugValidationMiddleware(BaseHTTPMiddleware):
    """Middleware to validate organization slug in URL against JWT claims."""

    def __init__(self, app, get_session):
        super().__init__(app)
        self.get_session = get_session
        # Pattern to match /api/org/{org_slug}/... or /api/v{n}/org/{org_slug}/...
        self.org_route_pattern = re.compile(r'^/api(?:/v\d+)?/org/([^/]+)/')

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
        session = None
        session_owner = False

        try:
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

            try:
                # Extract org_slug from URL
                org_slug = match.group(1)
                org_slug_key = org_slug.lower()

                # If previous middleware already attached org context, reuse it
                existing_org_id = getattr(request.state, "org_id", None)
                existing_org_slug = getattr(request.state, "org_slug", None)
                cached_org = _org_slug_cache.get(org_slug_key)

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

                # Validate JWT and extract user info (no DB required)
                auth_service = AuthService(None)
                auth_user = await auth_service.get_user_from_token(token)

                # Determine organization id/slug using, in order of priority:
                # 1) Previously set request.state (same request), 2) short-term cache,
                # 3) DB lookup as a fallback.
                if existing_org_id and existing_org_slug == org_slug:
                    db_org_id = existing_org_id
                    db_org_slug = existing_org_slug
                elif cached_org:
                    db_org_id, db_org_slug = cached_org
                else:
                    # Only open a DB session if we must resolve the org slug.
                    session = getattr(request.state, "db_session", None)
                    if session is None:
                        session_gen = self.get_session()
                        session = await session_gen.__anext__()
                        request.state.db_session = session
                        request.state._db_session_owner = True
                        session_owner = True

                    org_repo = OrganizationRepository(session)
                    organization = await org_repo.get_by_slug(org_slug)

                    if not organization:
                        logger.warning(f"Organization not found for slug: {org_slug}")
                        raise HTTPException(
                            status_code=404,
                            detail=f"Organization '{org_slug}' not found"
                        )

                    db_org_id = organization.id
                    db_org_slug = organization.slug
                    _org_slug_cache[org_slug_key] = (db_org_id, db_org_slug)

                # Check if user belongs to this organization
                # Both auth_user.organization_id and organization.id are Clerk org IDs (String type)
                # We compare IDs for authoritative check, and log slugs for debugging
                user_org_id = auth_user.organization_id
                user_org_slug = auth_user.organization_slug

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
                request.state.org_id = db_org_id
                request.state.auth_user = auth_user

                logger.debug(f"Org slug validation successful: {org_slug} -> {db_org_id}")

            except HTTPException as e:
                # BaseHTTPMiddleware can emit noisy ExceptionGroup traces when exceptions
                # bubble out; return a response directly instead.
                return JSONResponse(
                    status_code=e.status_code,
                    content={"detail": e.detail},
                    headers=getattr(e, "headers", None),
                )
            except Exception as e:
                logger.error(f"Unhandled exception: {e}")
                return JSONResponse(
                    status_code=500,
                    content={"detail": "Organization validation failed"},
                )

            return await call_next(request)
        finally:
            if session_owner and session is not None:
                await session.close()
                if getattr(request.state, "db_session", None) is session:
                    request.state.db_session = None
                    request.state._db_session_owner = False


# Middleware for logging requests and responses
class LoggingMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        # In Docker/dev, people often expect to see request/response logs.
        # Keep production quieter by default, but allow explicit opt-in.
        self.log_all_requests = (
            os.getenv("LOG_ALL_REQUESTS", "false").lower() == "true"
            or settings.DEBUG
            or settings.LOG_LEVEL.upper() == "DEBUG"
        )

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()

        try:
            # Process the request and get the response
            response = await call_next(request)
            process_time = time.time() - start_time

            # Only log slow requests (>2s) or errors by default; opt-in to log all requests.
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
            elif self.log_all_requests:
                logger.info(
                    f"{request.method} {request.url} - "
                    f"{response.status_code} - {process_time:.4f}s"
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
