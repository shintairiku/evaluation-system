import hashlib
import logging
import time
from typing import Dict, Any, Optional

import httpx
from cachetools import TTLCache
from clerk_backend_api import Clerk
from jose import JWTError, jwk, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from ..database.repositories.user_repo import UserRepository
from ..database.repositories.department_repo import DepartmentRepository
from ..database.repositories.stage_repo import StageRepository
from ..database.repositories.role_repo import RoleRepository
from ..schemas.auth import AuthUser
from ..schemas.user import Department, Role, UserProfileOption, UserExistsResponse, ProfileOptionsResponse
from ..schemas.stage_competency import Stage
from ..core.clerk_config import get_clerk_config
from ..core.config import settings
from ..core.exceptions import UnauthorizedError

logger = logging.getLogger(__name__)

# Global JWKS cache - 15 minutes TTL for security keys
_jwks_cache: TTLCache = TTLCache(maxsize=10, ttl=900)

# Short-lived cache for decoded AuthUser by token hash to avoid repeated JWT
# verification work across rapid successive requests. TTL is intentionally
# low; entries are also validated against the token's exp claim on read.
_token_cache: TTLCache = TTLCache(maxsize=512, ttl=120)


def _token_cache_key(token: str) -> str:
    """Hash the token so we never keep the raw token string in memory."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

class AuthService:
    """Service for handling user authentication operations."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.user_repo = UserRepository(session)
        self.department_repo = DepartmentRepository(session)
        self.stage_repo = StageRepository(session)
        self.role_repo = RoleRepository(session)
        
        # Initialize Clerk client
        clerk_config = get_clerk_config()
        self.clerk = Clerk(
            bearer_auth=clerk_config.secret_key
        )

    async def _fetch_jwks(self, issuer: str) -> Dict[str, Any]:
        """Fetch JWKS from Clerk with caching."""
        cache_key = f"jwks_{issuer}"
        
        # Check cache first
        if cache_key in _jwks_cache:
            logger.debug(f"Using cached JWKS for issuer: {issuer}")
            return _jwks_cache[cache_key]
        
        # Fetch from Clerk
        jwks_url = f"{issuer}/.well-known/jwks.json"
        logger.info(f"Fetching JWKS from: {jwks_url}")
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(jwks_url, timeout=10.0)
                response.raise_for_status()
                jwks_data = response.json()
                
                # Cache the result
                _jwks_cache[cache_key] = jwks_data
                logger.info(f"Successfully cached JWKS for issuer: {issuer}")
                return jwks_data
                
        except Exception as e:
            logger.error(f"Failed to fetch JWKS from {jwks_url}: {e}")
            raise Exception(f"JWKS fetch failed: {str(e)}")

    def _select_key_from_jwks(self, jwks_data: Dict[str, Any], kid: str) -> Dict[str, Any]:
        """Select the appropriate key from JWKS based on kid."""
        keys = jwks_data.get("keys", [])
        
        for key in keys:
            if key.get("kid") == kid:
                logger.debug(f"Found matching key for kid: {kid}")
                return key
                
        raise Exception(f"No key found for kid: {kid}")

    def _normalize_claims(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize JWT claims with org_id/org_slug/org_role prioritization."""
        normalized = {}

        # Organization ID - prefer org_id over organization_id
        normalized["organization_id"] = payload.get("org_id") or payload.get("organization_id")

        # Organization slug - prefer org_slug over organization_name
        normalized["organization_slug"] = payload.get("org_slug") or payload.get("organization_name")

        # Roles handling with backward compatibility
        roles = payload.get("roles")
        if roles and isinstance(roles, list):
            # New format: roles array from user.public_metadata.roles
            normalized["roles"] = roles
            normalized["role"] = roles[0] if roles else None  # Primary role for legacy compatibility
        else:
            # Legacy format: single role field
            legacy_role = payload.get("org_role") or payload.get("role", "")
            normalized["roles"] = [legacy_role] if legacy_role else []
            normalized["role"] = legacy_role

        # Standard claims
        normalized["sub"] = payload.get("sub")
        normalized["email"] = payload.get("email", "")
        normalized["given_name"] = payload.get("given_name", "")
        normalized["family_name"] = payload.get("family_name", "")

        logger.debug(f"Normalized claims: org_id={normalized['organization_id']}, org_slug={normalized['organization_slug']}, roles={normalized['roles']}, legacy_role={normalized['role']}")
        return normalized

    async def get_user_from_token(self, token: str) -> AuthUser:
        """
        Validate Clerk JWT token with JWKS signature verification and extract user information.
        
        Args:
            token: JWT token from Clerk
            
        Returns:
            AuthUser: User information extracted from token
            
        Raises:
            Exception: If token is invalid or verification fails
        """
        try:
            cache_key = _token_cache_key(token)
            cached_entry = _token_cache.get(cache_key)
            if cached_entry:
                cached_user, cached_exp = cached_entry
                # Respect token expiry even while cached
                if not cached_exp or cached_exp > time.time():
                    logger.debug("Using cached AuthUser for token hash")
                    return cached_user
                # Drop stale entry
                _token_cache.pop(cache_key, None)

            # Get environment variables for verification
            clerk_issuer = getattr(settings, 'CLERK_ISSUER', None)
            # Allow comma-separated audiences for dev/preview without changing Clerk JWT
            clerk_audience_raw = getattr(settings, 'CLERK_AUDIENCE', None)
            if clerk_audience_raw and isinstance(clerk_audience_raw, str) and "," in clerk_audience_raw:
                clerk_audience = [aud.strip() for aud in clerk_audience_raw.split(",") if aud.strip()]
            else:
                clerk_audience = clerk_audience_raw

            # Authorized parties (azp) hardening: allow comma-separated list
            authorized_parties_raw = getattr(settings, 'CLERK_AUTHORIZED_PARTIES', None)
            authorized_parties = []
            if authorized_parties_raw:
                authorized_parties = [p.strip() for p in authorized_parties_raw.split(",") if p.strip()]

            if not clerk_issuer or (not clerk_audience and not authorized_parties):
                # In production, never allow unverified parsing
                if settings.ENVIRONMENT == settings.Environment.PRODUCTION:
                    raise Exception("Clerk JWT verification misconfigured: require CLERK_ISSUER and (CLERK_AUDIENCE or CLERK_AUTHORIZED_PARTIES) in production")
                # In non-production, fallback to unverified parsing for developer convenience
                logger.debug("CLERK_ISSUER or audience/authorized parties not configured; using unverified token parsing (non-production only)")
                payload = jwt.get_unverified_claims(token)
            else:
                # Get unverified header to extract kid
                unverified_header = jwt.get_unverified_header(token)
                kid = unverified_header.get("kid")
                
                if not kid:
                    raise Exception("No 'kid' found in token header")
                
                # Fetch JWKS and select key
                jwks_data = await self._fetch_jwks(clerk_issuer)
                key_data = self._select_key_from_jwks(jwks_data, kid)
                
                # Convert JWK to PEM format for verification
                public_key = jwk.construct(key_data)
                
                # Verify and decode token
                base_options = {
                    "verify_signature": True,
                    "verify_iss": True,
                    "verify_exp": True,
                    "verify_nbf": True,
                    "require_exp": True,
                    "require_iat": True,
                    # Tolerate minor clock drift between services/containers.
                    "leeway": settings.CLERK_JWT_LEEWAY_SECONDS,
                }

                # Build common kwargs (issuer always enforced when provided)
                common_kwargs = {
                    "algorithms": ["RS256"],
                    "issuer": clerk_issuer,
                }

                # Handle audience validation robustly across environments
                if isinstance(clerk_audience, list):
                    # jose expects a string audience; try each allowed audience
                    last_error: Optional[Exception] = None
                    payload = None
                    for aud in clerk_audience:
                        try:
                            payload = jwt.decode(
                                token,
                                public_key,
                                options={**base_options, "verify_aud": True},
                                audience=aud,
                                **common_kwargs,
                            )
                            break
                        except JWTError as e:
                            last_error = e
                            continue
                    if payload is None:
                        raise UnauthorizedError("Invalid JWT audience")
                else:
                    # Single audience (string) or not set
                    options = {**base_options, "verify_aud": bool(clerk_audience)}
                    decode_kwargs = {**common_kwargs, "options": options}
                    if clerk_audience:
                        decode_kwargs["audience"] = clerk_audience
                    payload = jwt.decode(
                        token,
                        public_key,
                        **decode_kwargs,
                    )
                logger.debug("JWT signature verification successful")

                # Additional hardening: verify 'azp' (authorized party) if configured
                if authorized_parties:
                    azp = payload.get("azp") or payload.get("authorized_party")
                    if not azp:
                        raise Exception("Missing 'azp' claim while CLERK_AUTHORIZED_PARTIES is configured")
                    if azp not in authorized_parties:
                        raise Exception("Token 'azp' not in authorized parties")
            
            # Normalize claims with priority handling
            normalized = self._normalize_claims(payload)
            
            # Extract user information
            clerk_id = normalized.get("sub")
            if not clerk_id:
                raise ValueError("User ID not found in token")

            auth_user = AuthUser(
                clerk_id=clerk_id,
                email=normalized.get("email", ""),
                first_name=normalized.get("given_name", ""),
                last_name=normalized.get("family_name", ""),
                roles=normalized.get("roles", []),
                role=normalized.get("role", ""),  # Keep legacy field for backward compatibility
                organization_id=normalized.get("organization_id"),
                organization_name=normalized.get("organization_slug"),  # Keep for backward compatibility
                organization_slug=normalized.get("organization_slug")   # For organization-scoped routing
            )

            # Cache with respect to token expiry if present
            exp_ts = None
            try:
                exp_ts = payload.get("exp") if isinstance(payload, dict) else None
            except Exception:
                exp_ts = None
            _token_cache[cache_key] = (auth_user, exp_ts)

            return auth_user
            
        except JWTError as e:
            logger.error(f"JWT verification failed: {e}")
            # Propagate as 401 so middleware/routers return Unauthorized, not 500
            raise UnauthorizedError("Invalid JWT token")
        except Exception as e:
            logger.error(f"Token validation failed: {e}")
            # Default to Unauthorized for token-related failures
            raise UnauthorizedError(f"Token validation failed: {str(e)}")

    async def check_user_exists_by_clerk_id(self, clerk_user_id: str) -> UserExistsResponse:
        """Check if user exists in database with minimal info."""
        try:
            user_data = await self.user_repo.check_user_exists_by_clerk_id(clerk_user_id)

            if user_data:
                return UserExistsResponse(
                    exists=True,
                    user_id=user_data["id"],
                    name=user_data["name"],
                    email=user_data["email"],
                    status=user_data["status"]
                )
            else:
                return UserExistsResponse(exists=False)

        except Exception as e:
            logger.error(f"Error in auth service user existence check: {e}")
            return UserExistsResponse(exists=False)

    async def get_profile_options(self, organization_id: Optional[str] = None) -> ProfileOptionsResponse:
        """
        Get all available options for signup form.

        Args:
            organization_id: If provided, returns organization-scoped data.
                           If None, returns empty data (for unauthenticated signup).

        Returns:
            ProfileOptionsResponse: Contains departments, stages, roles, and users
        """
        try:
            if organization_id:
                # User has organization context - return org-scoped data
                logger.info(f"Fetching profile options for organization: {organization_id}")

                # Get organization-scoped data
                departments_data = await self.department_repo.get_all(organization_id)
                stages_data = await self.stage_repo.get_all(organization_id)
                roles_data = await self.role_repo.get_all(organization_id)
                users_data = await self.user_repo.get_active_users(organization_id)

                # Convert SQLAlchemy models to Pydantic models
                departments = [Department.model_validate(dept, from_attributes=True) for dept in departments_data]
                stages = [Stage.model_validate(stage, from_attributes=True) for stage in stages_data]
                roles = [Role.model_validate(role, from_attributes=True) for role in roles_data]

                # Create simple user options
                users = []
                for user_data in users_data:
                    user_option = UserProfileOption(
                        id=user_data.id,
                        name=user_data.name,
                        email=user_data.email,
                        employee_code=user_data.employee_code,
                        job_title=user_data.job_title,
                        roles=[Role.model_validate(role, from_attributes=True) for role in user_data.roles]
                    )
                    users.append(user_option)

                logger.info(f"Retrieved {len(departments)} departments, {len(stages)} stages, {len(roles)} roles, {len(users)} users for org {organization_id}")
            else:
                # No organization context - return empty profile options for traditional signup
                logger.info("No organization context provided - returning empty profile options")
                departments = []
                stages = []
                roles = []
                users = []

            return ProfileOptionsResponse(
                departments=departments,
                stages=stages,
                roles=roles,
                users=users
            )

        except Exception as e:
            logger.error(f"Error getting profile options for org {organization_id}: {e}")
            # Return empty options if error occurs
            return ProfileOptionsResponse(
                departments=[],
                stages=[],
                roles=[],
                users=[]
            ) 
