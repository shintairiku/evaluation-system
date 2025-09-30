# Performance Optimization Plan: User-Profiles Page

## Executive Summary

The user-profiles page currently experiences severe performance issues with loading times exceeding 12 seconds. This document outlines a comprehensive optimization strategy to reduce loading times to under 2 seconds through systematic improvements across the entire stack.

## Current Performance Issues

### 1. Critical Bottlenecks Identified

#### **Inefficient Server-Side Filtering**
- **Location**: `frontend/src/api/server-actions/users.ts:328-422`
- **Issue**: `searchUsersAction` fetches ALL users from backend, then filters client-side
- **Impact**: Downloads entire user database for every search operation
- **Code Reference**: Lines 358-361 call `usersApi.getUsers()` without search parameters, then lines 370-408 perform JavaScript filtering

#### **Redundant API Calls**
- **Location**: `frontend/src/context/ProfileOptionsContext.tsx:40-88`
- **Issue**: ProfileOptionsProvider makes 3 separate API calls on every page load
- **Impact**: Unnecessary network overhead for reference data
- **APIs Called**: `getDepartmentsAction()`, `getStagesAction()`, `getRolesAction()`

#### **Inefficient Data Flow Architecture**
- **Location**: `UserProfilesDataLoader.tsx:16` → `UserManagementWithSearch.tsx`
- **Issue**: Double API calls - initial load then search filtering
- **Impact**: Waterfall loading pattern causes cumulative delays

#### **Complex JWT Organization Context Resolution**
- **Location**: `frontend/src/api/client/http-unified-client.ts:115-163`
- **Issue**: JWT parsing for organization context on every API call
- **Impact**: Adds significant overhead per request

## Optimization Strategy

### Priority 1: Backend Filtering Implementation (Critical)

**Objective**: Move all filtering logic from frontend to backend

#### Implementation Plan:
1. **Update Backend API Endpoints**
   ```python
   # backend/app/api/v1/users.py
   @router.get("/", response_model=PaginatedResponse[UserDetailResponse])
   async def get_users(
       search: Optional[str] = Query(None),
       department_ids: Optional[list[UUID]] = Query(None),
       stage_ids: Optional[list[UUID]] = Query(None),
       role_ids: Optional[list[UUID]] = Query(None),
       statuses: Optional[list[UserStatus]] = Query(None),
       supervisor_id: Optional[UUID] = Query(None),
       page: int = Query(1, ge=1),
       limit: int = Query(10, ge=1, le=100),
   ):
   ```

2. **Implement SQL-Based Filtering**
   ```python
   # backend/app/services/user_service.py
   async def get_users_with_filters(
       self,
       search_term: str = "",
       department_ids: List[UUID] = None,
       stage_ids: List[UUID] = None,
       role_ids: List[UUID] = None,
       statuses: List[UserStatus] = None,
       supervisor_id: UUID = None,
       pagination: PaginationParams = None
   ):
       query = select(User).join(Department).join(Stage).join(UserRole).join(Role)

       if search_term:
           query = query.where(
               or_(
                   User.name.ilike(f"%{search_term}%"),
                   User.employee_code.ilike(f"%{search_term}%"),
                   User.email.ilike(f"%{search_term}%")
               )
           )

       if department_ids:
           query = query.where(User.department_id.in_(department_ids))

       # Additional filters...

       return await query.offset(pagination.offset).limit(pagination.limit).all()
   ```

3. **Update Frontend API Integration**
   ```typescript
   // frontend/src/api/endpoints/users.ts
   getUsers: async (params?: {
     page?: number;
     limit?: number;
     search?: string;
     department_ids?: string[];
     stage_ids?: string[];
     role_ids?: string[];
     statuses?: string[];
     supervisor_id?: string;
   }): Promise<ApiResponse<UserList>> => {
     const queryParams = new URLSearchParams();

     // Build query parameters properly
     if (params?.search) queryParams.append('search', params.search);
     if (params?.department_ids) {
       params.department_ids.forEach(id => queryParams.append('department_ids', id));
     }
     // Additional parameters...

     const endpoint = queryParams.toString()
       ? `${API_ENDPOINTS.USERS.LIST}?${queryParams.toString()}`
       : API_ENDPOINTS.USERS.LIST;

     return httpClient.get<UserList>(endpoint);
   }
   ```

**Expected Impact**: 80-90% reduction in data transfer volume

### Priority 2: Consolidate API Call Strategy (High)

**Objective**: Eliminate redundant API calls and waterfall loading

#### Implementation Plan:
1. **Replace Dual Loading Pattern**
   ```typescript
   // frontend/src/feature/user-profiles/display/UserProfilesDataLoader.tsx
   export default async function UserProfilesDataLoader({
     page = 1,
     limit = 50
   }: UserProfilesDataLoaderProps) {
     // Replace getUsersAction with searchUsersAction directly
     const result = await searchUsersAction({
       page,
       limit,
       // No initial search filters - just pagination
     });

     if (!result.success) {
       return <ErrorAlert message={result.error} />;
     }

     return (
       <UserManagementWithSearch
         initialUsers={result.data!.items}
         totalUsers={result.data!.total}
       />
     );
   }
   ```

2. **Optimize Search Component**
   ```typescript
   // frontend/src/feature/user-profiles/components/UserSearch.tsx
   const performSearch = async () => {
     setLoading(true);

     try {
       // Use single optimized search call
       const result = await searchUsersAction({
         page: 1,
         limit: 50,
         query: searchQuery,
         department_id: selectedDepartment,
         stage_id: selectedStage,
         role_id: selectedRole,
         status: selectedStatus
       });

       if (result.success && result.data) {
         onSearchResults(result.data.items, result.data.total, true);
       }
     } finally {
       setLoading(false);
     }
   };
   ```

**Expected Impact**: 50% reduction in initial load time

### Priority 3: Advanced Caching Strategy (High)

**Objective**: Implement multi-level caching for reference data and user results

#### Implementation Plan:
1. **HTTP Response Caching**
   ```python
   # backend/app/api/v1/departments.py
   @router.get("/", response_model=List[DepartmentResponse])
   async def get_departments(
       response: Response,
       context: AuthContext = Depends(get_auth_context),
       session: AsyncSession = Depends(get_db_session)
   ):
       # Set cache headers for reference data
       response.headers["Cache-Control"] = "public, max-age=300, s-maxage=600"
       response.headers["ETag"] = f'"{hash(str(organization_id))}"'

       departments = await department_service.get_all(context)
       return departments
   ```

2. **Enhanced ProfileOptionsContext**
   ```typescript
   // frontend/src/context/ProfileOptionsContext.tsx
   const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
   const STORAGE_KEY = 'profile-options-cache';

   export function ProfileOptionsProvider({ children }: ProfileOptionsProviderProps) {
     const [options, setOptions] = useState<ProfileOptions>(() => {
       // Load from localStorage on initialization
       if (typeof window !== 'undefined') {
         const cached = localStorage.getItem(STORAGE_KEY);
         if (cached) {
           const { data, timestamp } = JSON.parse(cached);
           if (Date.now() - timestamp < CACHE_DURATION) {
             return data;
           }
         }
       }
       return { departments: [], stages: [], roles: [] };
     });

     const fetchOptions = async () => {
       // Check localStorage cache first
       const cached = localStorage.getItem(STORAGE_KEY);
       if (cached) {
         const { data, timestamp } = JSON.parse(cached);
         if (Date.now() - timestamp < CACHE_DURATION) {
           setOptions(data);
           return;
         }
       }

       // Fetch and cache
       const results = await Promise.all([...]);

       if (allSuccessful) {
         const newOptions = { /* processed results */ };
         setOptions(newOptions);

         // Cache in localStorage
         localStorage.setItem(STORAGE_KEY, JSON.stringify({
           data: newOptions,
           timestamp: Date.now()
         }));
       }
     };
   ```

3. **Next.js Revalidation Tags**
   ```typescript
   // frontend/src/api/server-actions/users.ts
   export const getUsersAction = cache(
     async (params?: PaginationParams): Promise<ApiResponse<UserList>> => {
       try {
         const response = await usersApi.getUsers(params);

         if (response.success) {
           // Tag for revalidation
           revalidateTag(`users-org-${getCurrentOrgSlug()}`);
         }

         return response;
       } catch (error) {
         // Error handling
       }
     },
   );
   ```

**Expected Impact**: 60% reduction in repeat load times

### Priority 4: Database Query Optimization (Medium)

**Objective**: Optimize backend database queries and indexing

#### Implementation Plan:
1. **Add Database Indexes**
   ```sql
   -- Migration: Add indexes for commonly filtered columns
   CREATE INDEX CONCURRENTLY idx_users_department_id ON users (department_id);
   CREATE INDEX CONCURRENTLY idx_users_stage_id ON users (stage_id);
   CREATE INDEX CONCURRENTLY idx_users_supervisor_id ON users (supervisor_id);
   CREATE INDEX CONCURRENTLY idx_users_status ON users (status);
   CREATE INDEX CONCURRENTLY idx_users_search ON users USING GIN (
     to_tsvector('english', name || ' ' || employee_code || ' ' || email)
   );

   -- Composite index for common filter combinations
   CREATE INDEX CONCURRENTLY idx_users_dept_stage_status
   ON users (department_id, stage_id, status)
   WHERE status = 'ACTIVE';
   ```

2. **Implement Eager Loading**
   ```python
   # backend/app/services/user_service.py
   async def get_users_with_filters(self, ...):
       query = (
           select(User)
           .options(
               joinedload(User.department),
               joinedload(User.stage),
               joinedload(User.supervisor),
               joinedload(User.roles).joinedload(UserRole.role)
           )
           .where(User.organization_id == self.org_id)
       )

       # Apply filters with proper joins to avoid N+1
       if department_ids:
           query = query.where(User.department_id.in_(department_ids))

       # Use subquery for complex role filtering
       if role_ids:
           role_subquery = select(UserRole.user_id).where(
               UserRole.role_id.in_(role_ids)
           )
           query = query.where(User.id.in_(role_subquery))

       return await self.session.execute(query)
   ```

3. **Query Performance Monitoring**
   ```python
   # backend/app/core/database.py
   import time
   from sqlalchemy.event import listen

   def log_slow_queries(conn, cursor, statement, parameters, context, executemany):
       start_time = time.time()
       try:
           return cursor.execute(statement, parameters)
       finally:
           duration = time.time() - start_time
           if duration > 0.1:  # Log queries taking more than 100ms
               logger.warning(f"Slow query ({duration:.3f}s): {statement[:200]}...")

   listen(engine, "before_cursor_execute", log_slow_queries)
   ```

**Expected Impact**: 70% reduction in database query time

### Priority 5: Frontend Performance Enhancements (Medium)

**Objective**: Optimize React rendering and user experience

#### Implementation Plan:
1. **Virtual Scrolling for Large Lists**
   ```typescript
   // frontend/src/feature/user-profiles/display/VirtualizedUserTable.tsx
   import { FixedSizeList as List } from 'react-window';

   const ITEM_HEIGHT = 64;
   const CONTAINER_HEIGHT = 600;

   export function VirtualizedUserTable({ users }: { users: UserDetailResponse[] }) {
     const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
       <div style={style}>
         <UserTableRow user={users[index]} />
       </div>
     );

     return (
       <List
         height={CONTAINER_HEIGHT}
         itemCount={users.length}
         itemSize={ITEM_HEIGHT}
         width="100%"
       >
         {Row}
       </List>
     );
   }
   ```

2. **Progressive Loading with Suspense**
   ```typescript
   // frontend/src/app/(evaluation)/user-profiles/page.tsx
   export default async function UserProfilesPage({ searchParams }: UserProfilesPageProps) {
     return (
       <div className="container mx-auto p-6">
         <Suspense fallback={<UserProfilesSkeleton />}>
           <UserProfilesDataLoader page={page} limit={limit} />
         </Suspense>
       </div>
     );
   }

   // Progressive loading skeleton
   function UserProfilesSkeleton() {
     return (
       <div className="space-y-6">
         <div className="flex items-center justify-between">
           <Skeleton className="h-8 w-48" />
           <Skeleton className="h-10 w-32" />
         </div>

         <div className="grid gap-4">
           {Array.from({ length: 6 }).map((_, i) => (
             <Skeleton key={i} className="h-16 w-full" />
           ))}
         </div>
       </div>
     );
   }
   ```

3. **Memoization and Callback Optimization**
   ```typescript
   // frontend/src/feature/user-profiles/display/UserManagementWithSearch.tsx
   import { memo, useCallback, useMemo } from 'react';

   export default memo(function UserManagementWithSearch({ initialUsers }: UserManagementWithSearchProps) {
     const [users, setUsers] = useState<UserDetailResponse[]>(initialUsers);

     // Memoize expensive computations
     const sortedUsers = useMemo(() =>
       users.sort((a, b) => a.name.localeCompare(b.name)),
       [users]
     );

     // Memoize callbacks to prevent child re-renders
     const handleUserUpdate = useCallback((updatedUser: UserDetailResponse) => {
       setUsers(prevUsers =>
         prevUsers.map(user =>
           user.id === updatedUser.id ? updatedUser : user
         )
       );
     }, []);

     const handleSearchResults = useCallback((searchUsers: UserDetailResponse[], total: number) => {
       setUsers(searchUsers);
     }, []);

     return (
       <div className="space-y-6">
         <UserSearch onSearchResults={handleSearchResults} />
         <UserTableView users={sortedUsers} onUserUpdate={handleUserUpdate} />
       </div>
     );
   });
   ```

**Expected Impact**: 40% improvement in perceived performance

### Priority 6: Organization Context Optimization (Low)

**Objective**: Reduce JWT parsing overhead

#### Implementation Plan:
1. **JWT Token Caching**
   ```typescript
   // frontend/src/api/client/auth-helper.ts
   class ClientAuth {
     private static tokenCache: {
       token: string | null;
       orgSlug: string | null;
       timestamp: number;
     } = { token: null, orgSlug: null, timestamp: 0 };

     private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

     static getOrgSlug(): string | null {
       const now = Date.now();
       if (
         this.tokenCache.orgSlug &&
         (now - this.tokenCache.timestamp) < this.CACHE_DURATION
       ) {
         return this.tokenCache.orgSlug;
       }

       // Parse fresh token
       const token = this.getToken();
       if (token) {
         const orgSlug = this.parseOrgSlugFromToken(token);
         this.tokenCache = {
           token,
           orgSlug,
           timestamp: now
         };
         return orgSlug;
       }

       return null;
     }
   }
   ```

**Expected Impact**: 20% reduction in auth overhead

## Implementation Timeline

### Phase 1: Critical Backend Fixes (Week 1-2)
- [ ] Implement server-side filtering in backend API
- [ ] Add database indexes for user queries
- [ ] Update frontend API integration
- [ ] Test filtering performance

### Phase 2: Caching Implementation (Week 2-3)
- [ ] Add HTTP caching headers to reference data endpoints
- [ ] Implement localStorage caching in ProfileOptionsContext
- [ ] Set up Next.js revalidation tags
- [ ] Test cache invalidation scenarios

### Phase 3: Frontend Optimizations (Week 3-4)
- [ ] Implement virtual scrolling for user tables
- [ ] Add progressive loading states
- [ ] Optimize React rendering with memoization
- [ ] Implement search debouncing

### Phase 4: Monitoring and Fine-tuning (Week 4)
- [ ] Add performance monitoring
- [ ] Load test with realistic data volumes
- [ ] Fine-tune cache durations
- [ ] Document performance best practices

## Success Metrics

### Performance Targets:
- **Initial Page Load**: < 2 seconds (from 12+ seconds)
- **Search Operations**: < 500ms (from 3-5 seconds)
- **Navigation Between Views**: < 200ms
- **Reference Data Loading**: < 100ms (cached)

### Monitoring:
```typescript
// Add performance tracking
function trackPerformance(operation: string, startTime: number) {
  const duration = Date.now() - startTime;
  console.log(`Performance: ${operation} took ${duration}ms`);

  // Send to analytics
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'performance', {
      operation,
      duration,
      page: window.location.pathname
    });
  }
}
```

## Risk Mitigation

### Potential Risks:
1. **Database Performance**: Large organizations with 10k+ users
   - **Mitigation**: Implement pagination limits, add query timeouts

2. **Cache Invalidation**: Stale reference data
   - **Mitigation**: Implement cache versioning and manual refresh options

3. **Memory Usage**: Virtual scrolling with large datasets
   - **Mitigation**: Implement windowing and memory cleanup

### Rollback Plan:
- Feature flags for new filtering logic
- Gradual rollout to monitor performance impact
- Quick rollback to current implementation if issues arise

## Conclusion

This comprehensive optimization plan addresses the root causes of performance issues in the user-profiles page. By implementing server-side filtering, optimizing caching strategies, and enhancing frontend rendering, we expect to achieve sub-2-second loading times while maintaining all existing functionality.

The phased approach ensures minimal disruption to current operations while delivering immediate improvements in the most critical areas.