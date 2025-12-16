import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Iterable, Sequence, Set, Tuple
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from ..database.repositories.permission_repo import (
    PermissionRepository,
    RolePermissionRepository,
)
from .permissions import Permission as PermissionEnum

logger = logging.getLogger(__name__)

# Short-lived cache to avoid repeated permission lookups on hot paths.
_TTL = timedelta(seconds=30)
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


async def get_cached_permissions_for_roles(
    session: AsyncSession,
    organization_id: str,
    roles: Sequence,
) -> Dict[str, Set[PermissionEnum]]:
    """
    Batch-aware helper that returns permissions for multiple roles, loading all cache
    misses in a single query to minimise DB round-trips on cold paths.
    """
    now = datetime.utcnow()
    permissions_by_role: Dict[str, Set[PermissionEnum]] = {}
    roles_to_load: Dict[str, Tuple[UUID, str]] = {}

    async with _lock:
        for role in roles:
            if not getattr(role, "id", None) or not isinstance(role.id, UUID):
                continue
            cache_key = (organization_id, str(role.id))
            cached = _cache.get(cache_key)
            if cached and now - cached[1] <= _TTL:
                _metrics["hits"] += 1
                permissions_by_role[role.name.lower()] = cached[0]
            else:
                roles_to_load[cache_key] = (role.id, role.name)
                _metrics["misses"] += 1

    if not roles_to_load:
        return permissions_by_role

    role_ids: Iterable[UUID] = [role_id for role_id, _ in roles_to_load.values()]
    repo = RolePermissionRepository(session)
    fetched = await repo.fetch_permissions_for_roles(role_ids, organization_id)

    updates: Dict[Tuple[str, str], Tuple[Set[PermissionEnum], datetime]] = {}
    for cache_key, (role_id, role_name) in roles_to_load.items():
        permissions_models = fetched.get(str(role_id), ([], None))[0]
        perm_set: Set[PermissionEnum] = set()
        for permission in permissions_models:
            try:
                perm_set.add(PermissionEnum(permission.code))
            except ValueError:
                logger.warning(
                    "Unknown permission code '%s' for role '%s'; skipping during batch cache population",
                    permission.code,
                    role_name,
                )
        updates[cache_key] = (perm_set, now)
        permissions_by_role[role_name.lower()] = perm_set

    async with _lock:
        _cache.update(updates)
        _metrics["loads"] += 1

    return permissions_by_role


async def invalidate_role_permission_cache(organization_id: str, role_id: UUID) -> None:
    """Invalidate cached permissions for a given role within an organization."""
    cache_key = (organization_id, str(role_id))
    async with _lock:
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
