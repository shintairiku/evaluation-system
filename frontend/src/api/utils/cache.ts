import { cache } from 'react';
import { unstable_cache } from 'next/cache';

/**
 * Cache tags for different data types to enable granular revalidation
 */
export const CACHE_TAGS = {
  // Static/semi-static data - longer cache periods
  DEPARTMENTS: 'departments',
  ROLES: 'roles', 
  STAGES: 'stages',
  EVALUATION_PERIODS: 'evaluation-periods',
  COMPETENCIES: 'competencies',
  PERMISSIONS: 'permissions',
  
  // Dynamic data - shorter cache periods
  GOALS: 'goals',
  USERS: 'users',
  SELF_ASSESSMENTS: 'self-assessments',
  SUPERVISOR_REVIEWS: 'supervisor-reviews',
  SUPERVISOR_FEEDBACKS: 'supervisor-feedbacks',
  EVALUATIONS: 'evaluations',
  ADMIN_DASHBOARD: 'admin-dashboard',
} as const;

/**
 * Cache durations for different types of data
 */
export const CACHE_DURATIONS = {
  // Static data: 1 hour
  STATIC: 60 * 60, // 3600 seconds
  
  // Semi-static data: 30 minutes  
  SEMI_STATIC: 30 * 60, // 1800 seconds
  
  // Dynamic data: 5 minutes
  DYNAMIC: 5 * 60, // 300 seconds
  
  // Real-time data: 1 minute
  REALTIME: 60, // 60 seconds
} as const;

/**
 * Cache strategy configuration for different data types
 */
export const CACHE_STRATEGIES = {
  [CACHE_TAGS.DEPARTMENTS]: {
    duration: CACHE_DURATIONS.STATIC,
    tags: [CACHE_TAGS.DEPARTMENTS] as string[],
  },
  [CACHE_TAGS.ROLES]: {
    duration: CACHE_DURATIONS.STATIC, 
    tags: [CACHE_TAGS.ROLES] as string[],
  },
  [CACHE_TAGS.PERMISSIONS]: {
    duration: CACHE_DURATIONS.STATIC,
    tags: [CACHE_TAGS.PERMISSIONS] as string[],
  },
  [CACHE_TAGS.STAGES]: {
    duration: CACHE_DURATIONS.STATIC,
    tags: [CACHE_TAGS.STAGES] as string[],
  },
  [CACHE_TAGS.EVALUATION_PERIODS]: {
    duration: CACHE_DURATIONS.SEMI_STATIC,
    tags: [CACHE_TAGS.EVALUATION_PERIODS] as string[],
  },
  [CACHE_TAGS.COMPETENCIES]: {
    duration: CACHE_DURATIONS.STATIC,
    tags: [CACHE_TAGS.COMPETENCIES] as string[],
  },
  [CACHE_TAGS.GOALS]: {
    duration: CACHE_DURATIONS.DYNAMIC,
    tags: [CACHE_TAGS.GOALS] as string[],
  },
  [CACHE_TAGS.USERS]: {
    duration: CACHE_DURATIONS.SEMI_STATIC,
    tags: [CACHE_TAGS.USERS] as string[],
  },
  [CACHE_TAGS.SELF_ASSESSMENTS]: {
    duration: CACHE_DURATIONS.DYNAMIC,
    tags: [CACHE_TAGS.SELF_ASSESSMENTS, CACHE_TAGS.GOALS] as string[],
  },
  [CACHE_TAGS.SUPERVISOR_REVIEWS]: {
    duration: CACHE_DURATIONS.DYNAMIC,
    tags: [CACHE_TAGS.SUPERVISOR_REVIEWS, CACHE_TAGS.GOALS] as string[],
  },
  [CACHE_TAGS.SUPERVISOR_FEEDBACKS]: {
    duration: CACHE_DURATIONS.DYNAMIC,
    tags: [CACHE_TAGS.SUPERVISOR_FEEDBACKS, CACHE_TAGS.SUPERVISOR_REVIEWS] as string[],
  },
  [CACHE_TAGS.EVALUATIONS]: {
    duration: CACHE_DURATIONS.DYNAMIC,
    tags: [CACHE_TAGS.EVALUATIONS] as string[],
  },
  [CACHE_TAGS.ADMIN_DASHBOARD]: {
    duration: CACHE_DURATIONS.REALTIME,
    tags: [CACHE_TAGS.ADMIN_DASHBOARD] as string[],
  },
} as const;

/**
 * Request Memoization wrapper using React cache()
 * Deduplicates requests within a single render cycle
 */
export function createMemoizedAction<T extends (...args: unknown[]) => Promise<unknown>>(
  action: T
): T {
  return cache(action);
}

/**
 * Data Cache wrapper using unstable_cache() for persistent caching
 * Caches results across requests and deployments
 */
export function createCachedAction<T extends (...args: unknown[]) => Promise<unknown>>(
  action: T,
  cacheKey: string,
  tags: string[],
  revalidate: number
): T {
  return unstable_cache(
    action,
    [cacheKey],
    {
      tags,
      revalidate,
    }
  ) as T;
}

/**
 * Combined wrapper that applies both Request Memoization and Data Cache
 * @deprecated Use React cache() directly for parameterized queries
 */
export function createFullyCachedAction<T extends (...args: unknown[]) => Promise<unknown>>(
  action: T,
  cacheKey: string,
  cacheTag: keyof typeof CACHE_STRATEGIES
): T {
  const strategy = CACHE_STRATEGIES[cacheTag];
  
  // First apply Data Cache with unstable_cache
  const cachedAction = unstable_cache(
    action,
    [cacheKey],
    {
      tags: strategy.tags,
      revalidate: strategy.duration,
    }
  );
  
  // Then apply Request Memoization with React cache
  return cache(cachedAction) as T;
}

/**
 * Helper to get cache configuration for a specific data type
 */
export function getCacheConfig(cacheTag: keyof typeof CACHE_STRATEGIES) {
  return CACHE_STRATEGIES[cacheTag];
}
