"""
Simple in-memory cache for frequently accessed data.
This provides basic caching to reduce database load without requiring Redis.
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Callable, Awaitable
from functools import wraps
import asyncio

logger = logging.getLogger(__name__)


class SimpleCache:
    """
    Thread-safe in-memory cache with TTL support.
    Suitable for caching dashboard data, user lookups, etc.
    """

    def __init__(self):
        self._cache: Dict[str, tuple[Any, datetime]] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache if not expired"""
        async with self._lock:
            if key in self._cache:
                value, expiry = self._cache[key]
                if datetime.now() < expiry:
                    logger.debug(f"Cache HIT: {key}")
                    return value
                else:
                    # Remove expired entry
                    del self._cache[key]
                    logger.debug(f"Cache EXPIRED: {key}")
            else:
                logger.debug(f"Cache MISS: {key}")
            return None

    async def set(self, key: str, value: Any, ttl_seconds: int = 300):
        """Set value in cache with TTL (default 5 minutes)"""
        async with self._lock:
            expiry = datetime.now() + timedelta(seconds=ttl_seconds)
            self._cache[key] = (value, expiry)
            logger.debug(f"Cache SET: {key} (TTL: {ttl_seconds}s)")

    async def delete(self, key: str):
        """Delete specific key from cache"""
        async with self._lock:
            if key in self._cache:
                del self._cache[key]
                logger.debug(f"Cache DELETE: {key}")

    async def clear(self):
        """Clear all cache entries"""
        async with self._lock:
            self._cache.clear()
            logger.info("Cache CLEARED")

    async def clear_pattern(self, pattern: str):
        """Clear all keys matching pattern (simple prefix match)"""
        async with self._lock:
            keys_to_delete = [k for k in self._cache.keys() if k.startswith(pattern)]
            for key in keys_to_delete:
                del self._cache[key]
            logger.info(f"Cache CLEARED pattern '{pattern}': {len(keys_to_delete)} keys")

    def size(self) -> int:
        """Get current cache size"""
        return len(self._cache)


# Global cache instance
_global_cache = SimpleCache()


def get_cache() -> SimpleCache:
    """Get the global cache instance"""
    return _global_cache


def cached(ttl_seconds: int = 300, key_prefix: str = ""):
    """
    Decorator for caching async function results.

    Args:
        ttl_seconds: Time to live in seconds (default 5 minutes)
        key_prefix: Prefix for cache keys (default: function name)

    Example:
        @cached(ttl_seconds=60, key_prefix="user")
        async def get_user_by_id(user_id: str) -> User:
            return await db.query(User).get(user_id)
    """
    def decorator(func: Callable[..., Awaitable[Any]]):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Build cache key from function name and arguments
            prefix = key_prefix or func.__name__

            # Convert arguments to string for cache key
            # Skip self/cls arguments
            args_str = "_".join(str(arg) for arg in args if not hasattr(arg, '__self__'))
            kwargs_str = "_".join(f"{k}={v}" for k, v in sorted(kwargs.items()))
            cache_key = f"{prefix}:{args_str}:{kwargs_str}" if args_str or kwargs_str else prefix

            # Try to get from cache
            cache = get_cache()
            cached_value = await cache.get(cache_key)
            if cached_value is not None:
                return cached_value

            # Execute function and cache result
            result = await func(*args, **kwargs)
            await cache.set(cache_key, result, ttl_seconds)

            return result

        return wrapper
    return decorator


# Cache key helpers
def make_cache_key(*parts: str) -> str:
    """Helper to create consistent cache keys"""
    return ":".join(str(p) for p in parts)


# Invalidation helpers
async def invalidate_user_cache(user_id: str):
    """Invalidate all cache entries for a user"""
    cache = get_cache()
    await cache.clear_pattern(f"user:{user_id}")
    await cache.clear_pattern(f"user_detail:{user_id}")


async def invalidate_dashboard_cache(org_id: str):
    """Invalidate all dashboard cache entries for an organization"""
    cache = get_cache()
    await cache.clear_pattern(f"dashboard:{org_id}")
    await cache.clear_pattern(f"admin_dashboard:{org_id}")
    await cache.clear_pattern(f"supervisor_dashboard:{org_id}")
    await cache.clear_pattern(f"employee_dashboard:{org_id}")


async def invalidate_org_cache(org_id: str):
    """Invalidate all cache entries for an organization"""
    cache = get_cache()
    await cache.clear_pattern(f"org:{org_id}")
    await invalidate_dashboard_cache(org_id)
