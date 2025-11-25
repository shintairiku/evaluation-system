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

# Simple in-process counters for observability and tests
_metrics: Dict[str, int] = {"hits": 0, "misses": 0, "loads": 0}


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
                _metrics["hits"] += 1
                ttl_remaining_ms = max(0, int((_TTL - (now - cached_at)).total_seconds() * 1000))
                logger.info(
                    "role_permissions.cache.hit",
                    extra={
                        "event": "role_permissions.cache.hit",
                        "organization_id": organization_id,
                        "role_id": str(role_id),
                        "role_name": role_name,
                        "permission_count": len(permissions),
                        "ttl_remaining_ms": ttl_remaining_ms,
                    },
                )
                return permissions

    repo = PermissionRepository(session)
    permission_models = await repo.list_for_role(str(role_id), organization_id)
    _metrics["misses"] += 1
    if not permission_models:
        async with _lock:
            _cache[cache_key] = (set(), now)
        logger.info(
            "role_permissions.cache.miss",
            extra={
                "event": "role_permissions.cache.miss",
                "organization_id": organization_id,
                "role_id": str(role_id),
                "role_name": role_name,
                "permission_count": 0,
            },
        )
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
        logger.info(
            "role_permissions.cache.miss",
            extra={
                "event": "role_permissions.cache.miss",
                "organization_id": organization_id,
                "role_id": str(role_id),
                "role_name": role_name,
                "permission_count": 0,
            },
        )
        return set()

    async with _lock:
        _cache[cache_key] = (dynamic_permissions, now)
    _metrics["loads"] += 1
    logger.info(
        "role_permissions.cache.load",
        extra={
            "event": "role_permissions.cache.load",
            "organization_id": organization_id,
            "role_id": str(role_id),
            "role_name": role_name,
            "permission_count": len(dynamic_permissions),
        },
    )

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


def get_cache_metrics() -> Dict[str, int]:
    """Return current cache counters (hits, misses, loads) for diagnostics/tests."""
    return dict(_metrics)
