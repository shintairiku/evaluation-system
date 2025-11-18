import asyncio
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, Iterable, Set, Tuple
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from ..database.repositories.viewer_visibility_repo import (
    ViewerVisibilityGrant,
    ViewerVisibilityRepository,
)
from .viewer_visibility import ViewerSubjectType
from .rbac_types import ResourceType

_cache_ttl = timedelta(seconds=5)
_cache: Dict[Tuple[str, str], Tuple[Dict[ResourceType, Dict[ViewerSubjectType, Set[UUID]]], datetime]] = {}
_lock = asyncio.Lock()


def _group_overrides(
    grants: Iterable[ViewerVisibilityGrant],
) -> Dict[ResourceType, Dict[ViewerSubjectType, Set[UUID]]]:
    temp: Dict[ResourceType, Dict[ViewerSubjectType, Set[UUID]]] = defaultdict(lambda: defaultdict(set))
    for grant in grants:
        temp[grant.resource_type][grant.subject_type].add(grant.subject_id)
    return {
        resource_type: dict(subject_map)
        for resource_type, subject_map in temp.items()
    }


async def get_cached_viewer_visibility_overrides(
    session: AsyncSession,
    organization_id: str,
    viewer_user_id: UUID,
) -> Dict[ResourceType, Dict[ViewerSubjectType, Set[UUID]]]:
    cache_key = (organization_id, str(viewer_user_id))
    now = datetime.utcnow()

    async with _lock:
        if entry := _cache.get(cache_key):
            overrides, cached_at = entry
            if now - cached_at <= _cache_ttl:
                return overrides

    repo = ViewerVisibilityRepository(session)
    grants = await repo.list_grants(viewer_user_id, organization_id)
    overrides = _group_overrides(grants)

    async with _lock:
        _cache[cache_key] = (overrides, now)

    return overrides


def invalidate_viewer_visibility_cache(organization_id: str, viewer_user_id: UUID) -> None:
    cache_key = (organization_id, str(viewer_user_id))
    _cache.pop(cache_key, None)
