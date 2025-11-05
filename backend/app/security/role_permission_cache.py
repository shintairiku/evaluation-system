import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Set, Tuple
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from ..database.repositories.permission_repo import PermissionRepository
from .permissions import Permission as PermissionEnum

logger = logging.getLogger(__name__)

_TTL = timedelta(seconds=5)
_cache: Dict[Tuple[str, str], Tuple[Set[PermissionEnum], datetime]] = {}
_lock = asyncio.Lock()


async def get_cached_role_permissions(
    session: AsyncSession,
    organization_id: str,
    role_id: UUID,
    role_name: str,
) -> Set[PermissionEnum]:
    """
    Return cached permissions for (organization_id, role_id) if fresh, otherwise load from DB.
    Returns empty set when no DB-backed permissions exist so callers never fall back to static defaults.
    """
    cache_key = (organization_id, str(role_id))
    now = datetime.utcnow()

    async with _lock:
        cached = _cache.get(cache_key)
        if cached:
            permissions, cached_at = cached
            if now - cached_at <= _TTL:
                return permissions

    repo = PermissionRepository(session)
    permission_models = await repo.list_for_role(str(role_id), organization_id)
    if not permission_models:
        async with _lock:
            _cache[cache_key] = (set(), now)
        return set()

    dynamic_permissions: Set[PermissionEnum] = set()
    for permission in permission_models:
        try:
            dynamic_permissions.add(PermissionEnum(permission.code))
        except ValueError:
            logger.warning(
                "Unknown permission code '%s' for role '%s'; skipping during cache population",
                permission.code,
                role_name,
            )

    if not dynamic_permissions:
        async with _lock:
            _cache[cache_key] = (set(), now)
        return set()

    async with _lock:
        _cache[cache_key] = (dynamic_permissions, now)

    return dynamic_permissions


def invalidate_role_permission_cache(organization_id: str, role_id: UUID) -> None:
    """Invalidate cached permissions for a given role within an organization."""
    cache_key = (organization_id, str(role_id))
    removed = _cache.pop(cache_key, None)
    if removed:
        logger.info(
            "role_permissions.cache.invalidated",
            extra={
                "event": "role_permissions.cache.invalidated",
                "organization_id": organization_id,
                "role_id": str(role_id),
            },
        )
