# SSR Optimization for Vercel + GCP Deployment

## Current Architecture (Already SSR!)

```
Browser → Vercel Next.js Server → Internet → GCP FastAPI → Database
```

**Key Realization**: Your current server actions ARE Server-Side Rendering! They run on Vercel's servers, not the browser.

## Performance Bottlenecks in Vercel + GCP

### 1. **Network Latency (Unavoidable)**
- Vercel → GCP: ~100-300ms per request
- Can't use internal networking (different cloud providers)
- Multiple API calls = multiple latency hits

### 2. **API Response Size**
- Current APIs return full objects with all relations
- Large JSON payloads across internet
- No response compression

### 3. **N+1 API Call Problem**
```typescript
// Current: Multiple sequential API calls
const users = await getUsersAction()          // 300ms
const departments = await getDepartmentsAction() // 300ms
const goals = await getGoalsAction()          // 300ms
// Total: ~900ms
```

### 4. **Authentication Overhead**
- JWT validation on every API call
- Organization validation repeated
- Database queries for auth context

## Optimization Strategy

### Phase 1: Bundle API Calls (Backend)

#### 1.1 Create Page-Specific Endpoints
```python
# app/api/v1/ssr/pages.py
@router.get("/org/{org_slug}/user-profiles-page")
async def get_user_profiles_page_data(
    org_slug: str,
    page: int = 1,
    auth_context: AuthContext = Depends(get_auth_context)
):
    """Single API call for entire user profiles page."""

    # Parallel database queries (much faster)
    users_task = user_service.get_users_paginated(auth_context.org_id, page)
    departments_task = department_service.get_all(auth_context.org_id)
    roles_task = role_service.get_all(auth_context.org_id)
    stats_task = user_service.get_user_stats(auth_context.org_id)

    users, departments, roles, stats = await asyncio.gather(
        users_task, departments_task, roles_task, stats_task
    )

    return {
        "users": users,
        "departments": departments,
        "roles": roles,
        "stats": stats,
        "metadata": {
            "page": page,
            "total_pages": users.pages,
            "generated_at": datetime.utcnow()
        }
    }
```

#### 1.2 Optimize Response Size
```python
# Return minimal data for SSR
@router.get("/org/{org_slug}/users-minimal")
async def get_users_minimal_for_ssr(org_slug: str, auth_context: AuthContext = Depends(get_auth_context)):
    """Minimal user data optimized for SSR."""

    users = await user_service.get_users_minimal(
        org_id=auth_context.org_id,
        fields=["id", "name", "email", "department_name", "role_names", "status"]  # Only essential fields
    )

    return {"users": users}
```

### Phase 2: Frontend Optimization

#### 2.1 Replace Multiple Server Actions with Single Calls
```typescript
// lib/data/user-profiles-ssr.ts
export async function getUserProfilesPageData(page: number = 1) {
  const { getToken } = await auth()
  const token = await getToken({ template: 'org-jwt' })

  // Single API call instead of multiple
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/ssr/org/test/user-profiles-page?page=${page}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept-Encoding': 'gzip', // Enable compression
    },
    next: { revalidate: 300 } // Cache for 5 minutes
  })

  return response.json()
}
```

#### 2.2 Update Page Components
```typescript
// app/user-profiles/page.tsx
export default async function UserProfilesPage({ searchParams }) {
  // Single API call gets ALL data needed for page
  const pageData = await getUserProfilesPageData(searchParams.page || 1)

  return (
    <UserManagementWithSearch
      initialUsers={pageData.users.items}
      departments={pageData.departments}
      roles={pageData.roles}
      stats={pageData.stats}
    />
  )
}
```

### Phase 3: Response Optimization (Backend)

#### 3.1 Add Compression Middleware
```python
# app/main.py
from fastapi.middleware.gzip import GZipMiddleware

app.add_middleware(GZipMiddleware, minimum_size=1000)
```

#### 3.2 Add Caching Headers
```python
# app/core/middleware.py
class SSRCacheMiddleware:
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # Cache SSR endpoints for 5 minutes
        if request.url.path.startswith("/api/ssr/"):
            response.headers["Cache-Control"] = "public, max-age=300"
            response.headers["ETag"] = f'"{hash(str(response.body))}"'

        return response
```

### Phase 4: Advanced Optimizations

#### 4.1 Implement Edge Caching
```typescript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=300, stale-while-revalidate=600'
          }
        ]
      }
    ]
  }
}
```

#### 4.2 Background Data Refresh
```python
# app/services/cache_service.py
class BackgroundCacheRefresh:
    async def refresh_dashboard_cache(self, org_id: str):
        """Refresh dashboard data in background to reduce SSR latency."""

        # Pre-compute expensive queries
        dashboard_data = await self.compute_dashboard_data(org_id)

        # Store in Redis/Memory cache
        await cache.set(f"dashboard:{org_id}", dashboard_data, ttl=300)
```

## Expected Performance Improvements

### Current Performance:
```
User Profiles Page Load:
- getUsersAction(): 300ms
- getDepartmentsAction(): 300ms
- getRolesAction(): 300ms
- Total: ~900ms
```

### Optimized Performance:
```
User Profiles Page Load:
- getUserProfilesPageData(): 320ms (single call + compression)
- Total: ~320ms (65% improvement!)
```

### Additional Benefits:
- **Reduced API calls**: 3+ calls → 1 call
- **Smaller payloads**: Minimal data fields
- **Better caching**: Edge caching + backend caching
- **Improved UX**: Faster page loads

## Implementation Timeline

### Week 1: Backend Bundle APIs
- [ ] Create SSR-optimized endpoints
- [ ] Add response compression
- [ ] Implement parallel database queries

### Week 2: Frontend Single Calls
- [ ] Replace multiple server actions with bundled calls
- [ ] Update page components to use new data structure
- [ ] Add request caching

### Week 3: Caching Layer
- [ ] Implement backend caching
- [ ] Add edge caching configuration
- [ ] Performance monitoring

### Week 4: Advanced Optimizations
- [ ] Background cache refresh
- [ ] Response size optimization
- [ ] Performance tuning

## Key Benefits for Vercel + GCP

1. **Maintains Current Architecture**: No deployment changes needed
2. **Reduces Network Calls**: Multiple calls → Single call per page
3. **Smaller Payloads**: Minimal data transfer
4. **Better Caching**: Multiple caching layers
5. **Still True SSR**: Pages rendered on Vercel servers

This approach optimizes your current SSR architecture without requiring architectural changes!