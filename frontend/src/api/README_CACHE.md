# Next.js Cache Implementation Guide

This document describes the caching implementation for the HR Evaluation System, providing comprehensive guidance on how caching is used throughout the application.

## Overview

Our caching strategy leverages Next.js built-in caching mechanisms to improve performance and reduce unnecessary API calls. We implement two primary types of caching:

1. **Request Memoization** - Deduplicates requests within a single render cycle
2. **Data Cache** - Persistent caching across requests and deployments with smart revalidation

## Architecture

```
React Server Components
    ↓ (uses)
Server Actions (/src/api/server-actions/)
    ↓ (with cache wrapping)
Cached API Calls
    ↓ (invalidated by)
Cache Revalidation (revalidateTag)
```

## Cache Configuration

### Cache Tags and Durations

Located in `/src/api/utils/cache.ts`:

```typescript
export const CACHE_TAGS = {
  // Static/semi-static data - longer cache periods
  DEPARTMENTS: 'departments',
  ROLES: 'roles', 
  STAGES: 'stages',
  EVALUATION_PERIODS: 'evaluation-periods',
  COMPETENCIES: 'competencies',
  
  // Dynamic data - shorter cache periods
  GOALS: 'goals',
  USERS: 'users',
  SELF_ASSESSMENTS: 'self-assessments',
  SUPERVISOR_REVIEWS: 'supervisor-reviews',
  SUPERVISOR_FEEDBACKS: 'supervisor-feedbacks',
  EVALUATIONS: 'evaluations',
}
```

### Cache Durations by Data Type

| Data Type | Duration | Rationale |
|-----------|----------|-----------|
| **Static Data** (departments, roles, stages) | 1 hour (3600s) | Rarely changes, safe to cache long-term |
| **Semi-Static Data** (evaluation-periods, users) | 30 minutes (1800s) | Changes occasionally, moderate cache duration |
| **Dynamic Data** (goals, assessments, reviews) | 5 minutes (300s) | Frequently updated, short cache duration |
| **Real-time Data** | 1 minute (60s) | Highly dynamic data |

## Implementation Patterns

### 1. Static Data Server Actions

For data that changes rarely (departments, roles, stages):

```typescript
// Example: departments server action
async function _getDepartmentsAction(): Promise<ServerActionResponse<Department[]>> {
  try {
    const response = await departmentsApi.getDepartments();
    // ... error handling
    return { success: true, data: response.data };
  } catch (error) {
    // ... error handling
  }
}

export const getDepartmentsAction = createFullyCachedAction(
  _getDepartmentsAction,
  'getDepartments',
  CACHE_TAGS.DEPARTMENTS
);
```

**Key Features:**
- Uses `createFullyCachedAction()` for persistent caching
- 1-hour cache duration
- Automatic Request Memoization

### 2. Dynamic Data with Parameters

For queries with parameters (like goals with filters):

```typescript
// Example: goals with parameters
export const getGoalsAction = cache(async (params?: {
  periodId?: UUID;
  userId?: UUID;
  goalCategory?: string;
  status?: string | string[];
  page?: number;
  limit?: number;
}): Promise<ServerActionResponse<GoalListResponse>> => {
  return _getGoalsAction(params);
});
```

**Key Features:**
- Uses React `cache()` for Request Memoization only
- Automatically handles parameter variations
- Prevents duplicate calls within same render cycle

### 3. Mutation Actions with Cache Revalidation

For Create/Update/Delete operations:

```typescript
export async function createGoalAction(data: GoalCreateRequest): Promise<ServerActionResponse<GoalResponse>> {
  try {
    const response = await goalsApi.createGoal(data);
    
    if (!response.success || !response.data) {
      return { success: false, error: response.errorMessage || 'Failed to create goal' };
    }
    
    // Revalidate related caches after successful creation
    revalidateTag(CACHE_TAGS.GOALS);
    revalidateTag(CACHE_TAGS.SELF_ASSESSMENTS);
    revalidateTag(CACHE_TAGS.SUPERVISOR_REVIEWS);
    
    return { success: true, data: response.data };
  } catch (error) {
    // ... error handling
  }
}
```

**Key Features:**
- Calls `revalidateTag()` after successful mutations
- Invalidates related data caches
- Ensures data consistency across the application

## Cache Invalidation Strategy

### Cascading Revalidation

When data changes, we invalidate related caches to maintain consistency:

| Primary Data Change | Invalidated Caches |
|-------------------|-------------------|
| **Goals** | goals → self-assessments → supervisor-reviews |
| **Departments** | departments → users → organization-chart |
| **Roles** | roles → users → hierarchy |
| **Stages** | stages → users → competency-data |

### Example: Goal Creation Impact

When a new goal is created:
1. `CACHE_TAGS.GOALS` - Direct cache invalidation
2. `CACHE_TAGS.SELF_ASSESSMENTS` - Dependent data invalidation
3. `CACHE_TAGS.SUPERVISOR_REVIEWS` - Cascading invalidation

## Cache Utilities

### Available Functions

```typescript
// Request Memoization only
export function createMemoizedAction<T>(action: T): T

// Data Cache only  
export function createCachedAction<T>(
  action: T, 
  cacheKey: string, 
  tags: string[], 
  revalidate: number
): T

// Combined (deprecated for parameterized queries)
export function createFullyCachedAction<T>(
  action: T, 
  cacheKey: string, 
  cacheTag: keyof typeof CACHE_STRATEGIES
): T

// Cache configuration lookup
export function getCacheConfig(cacheTag: keyof typeof CACHE_STRATEGIES)
```

### Usage Guidelines

| Use Case | Recommended Approach | Example |
|----------|---------------------|---------|
| **Simple read operations** | `createFullyCachedAction()` | `getDepartmentsAction()` |
| **Parameterized queries** | React `cache()` directly | `getGoalsAction(params)` |
| **Mutation operations** | No caching + `revalidateTag()` | `createGoalAction()` |

## Performance Benefits

### Before Caching
- Multiple API calls for same data within single page load
- Repeated database queries for static data
- Slower page load times
- Higher server resource usage

### After Caching
- ✅ **Request Deduplication**: Single API call per render cycle
- ✅ **Persistent Caching**: Data cached across requests
- ✅ **Smart Invalidation**: Only relevant caches cleared
- ✅ **Reduced Server Load**: Fewer database queries
- ✅ **Faster Page Loads**: Cached data served instantly

## Best Practices

### Do's ✅

1. **Use appropriate cache durations** based on data volatility
2. **Invalidate related caches** after mutations
3. **Use React cache()** for parameterized queries
4. **Test cache behavior** in different scenarios
5. **Monitor cache hit rates** in production

### Don'ts ❌

1. **Don't cache user-specific sensitive data** without proper isolation
2. **Don't forget to revalidate** after mutations
3. **Don't use persistent cache** for highly dynamic data
4. **Don't cache error responses** indefinitely
5. **Don't create cache keys** that are too generic

## Monitoring and Debugging

### Cache Debug Logging

In development mode, cache operations are automatically logged to help with debugging:

```typescript
// Debug logs show:
// - Cache hits/misses
// - Revalidation events  
// - Cache key generation
// - Performance metrics
```

### Common Issues and Solutions

| Issue | Symptom | Solution |
|-------|---------|----------|
| **Stale Data** | Old data showing after updates | Add `revalidateTag()` to mutation |
| **Cache Conflicts** | Wrong data for different parameters | Use React `cache()` instead of persistent cache |
| **Performance Issues** | Slow page loads despite caching | Check cache durations and hit rates |
| **Memory Usage** | High memory consumption | Reduce cache durations for large datasets |

## Migration Guide

### From Direct API Calls

**Before:**
```typescript
export async function getGoalsAction() {
  const response = await httpClient.get<GoalListResponse>('/goals');
  return response;
}
```

**After:**
```typescript
async function _getGoalsAction() {
  const response = await goalsApi.getGoals();
  return response;
}

export const getGoalsAction = createFullyCachedAction(
  _getGoalsAction,
  'getGoals', 
  CACHE_TAGS.GOALS
);
```

### Adding Cache to Existing Actions

1. **Import cache utilities**
2. **Wrap read actions** with appropriate cache function
3. **Add revalidation** to mutation actions
4. **Test thoroughly** to ensure data consistency

## Related Documentation

- [Next.js Caching Guide](https://nextjs.org/docs/app/guides/caching)
- [React Cache Documentation](https://react.dev/reference/react/cache)
- [Server Actions Standardization](../server-actions/README.md)
- [API Integration Guide](../endpoints/README.md)

---

**Last Updated:** January 2025  
**Version:** 1.0  
**Maintainer:** Development Team