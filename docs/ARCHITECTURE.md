# HR Evaluation System - Architecture Documentation

## Overview

This document provides comprehensive guidance on the sophisticated multi-layer architecture of the HR Evaluation System, ensuring all engineers understand the design principles, component interactions, and best practices for development and deployment.

## Core Architecture Pattern

```
React Components → Server Actions → Endpoints → HTTP Client → Backend API
                          ↓
                 Cache System (Request Memoization + Data Cache)
                          ↓
                Deployment (Vercel Frontend + GCP Backend)
```

## 1. Frontend Architecture (Next.js 15 + React 19)

### 1.1 Layered API Architecture

#### **Server Actions (Primary Interface)**
- **Location**: `/src/api/server-actions/`
- **Purpose**: Public API interface for React components
- **Usage**: Called directly by components for both SSR and client-side interactions
- **Features**:
  - Built-in caching with smart revalidation
  - Error handling and type safety
  - Authentication context
  - Request memoization

```typescript
// ✅ CORRECT: Use server actions (primary interface)
const users = await getUsersAction({ page: 1, limit: 10 });

// ❌ WRONG: Don't call endpoints directly
const users = await usersApi.getUsers({ page: 1, limit: 10 });
```

#### **Endpoints (Implementation Layer)**
- **Location**: `/src/api/endpoints/`
- **Purpose**: Internal HTTP client abstraction layer
- **Usage**: Called by server actions, never directly by components
- **Features**:
  - Context-aware token handling (server vs client)
  - Unified error handling
  - Organization-scoped API calls
  - Production-ready HTTP client

```typescript
// Server-side endpoints use Clerk server auth
const buildServerUserEndpoint = async (endpoint: string): Promise<string | null> => {
  const { getToken } = await auth();
  const token = await getToken({ template: 'org-jwt' });
  // ...
};

// Client-side endpoints use ClientAuth helper
const buildUserEndpoint = (endpoint: string): string | null => {
  const token = ClientAuth.getToken();
  // ...
};
```

#### **HTTP Client (Transport Layer)**
- **Location**: `/src/api/client/http-unified-client.ts`
- **Purpose**: Unified HTTP client with enterprise features
- **Features**:
  - Automatic authentication (server/client context detection)
  - 30-second timeout protection
  - Exponential backoff retry (3 attempts)
  - Environment-aware logging
  - Response compression
  - Production optimizations

#### **Constants (Configuration Layer)**
- **Location**: `/src/api/constants/config.ts`
- **Purpose**: Centralized API configuration and endpoint definitions
- **Features**:
  - Environment-based configuration
  - Production-ready settings
  - Comprehensive endpoint mapping
  - Cache configuration

### 1.2 Caching System

#### **Multi-Layer Caching Strategy**

1. **Request Memoization** (React `cache()`)
   - Deduplicates API calls within single render cycle
   - Automatic for parameterized queries
   - Zero configuration needed

```typescript
export const getGoalsAction = cache(async (params?: GoalParams) => {
  return _getGoalsAction(params); // Only called once per render cycle
});
```

2. **Data Cache** (Next.js `unstable_cache`)
   - Persistent caching across requests
   - Configurable durations by data type
   - Smart revalidation

```typescript
export const getDepartmentsAction = createFullyCachedAction(
  _getDepartmentsAction,
  'getDepartments',
  CACHE_TAGS.DEPARTMENTS
);
```

3. **Cache Configuration by Data Type**
```typescript
CACHE_STRATEGIES = {
  [CACHE_TAGS.DEPARTMENTS]: { duration: 3600 },    // 1 hour
  [CACHE_TAGS.USERS]: { duration: 1800 },          // 30 minutes
  [CACHE_TAGS.GOALS]: { duration: 300 },           // 5 minutes
}
```

#### **Cascading Cache Invalidation**

When data changes, automatically invalidate related caches:
```typescript
// Creating a goal invalidates:
revalidateTag(CACHE_TAGS.GOALS);           // Direct data
revalidateTag(CACHE_TAGS.SELF_ASSESSMENTS); // Dependent data
revalidateTag(CACHE_TAGS.SUPERVISOR_REVIEWS); // Related data
```

### 1.3 Server-Side Rendering (SSR)

#### **Server Components (Recommended)**
```typescript
export default async function UsersPage() {
  // ✅ CORRECT: Server-side data fetching
  const usersResult = await getUsersAction({ page: 1, limit: 10 });

  if (!usersResult.success) {
    return <div>Error: {usersResult.error}</div>;
  }

  return <UsersList users={usersResult.data.items} />;
}
```

#### **Client Components with useActionState (React 19)**
```typescript
'use client';
import { useActionState } from 'react';

export function CreateUserForm() {
  const [state, formAction, isPending] = useActionState(createUserAction, null);

  return (
    <form action={formAction}>
      <button disabled={isPending}>
        {isPending ? 'Creating...' : 'Create User'}
      </button>
      {state?.error && <div className="error">{state.error}</div>}
    </form>
  );
}
```

#### **Streaming with Suspense**
```typescript
<Suspense fallback={<UsersSkeleton />}>
  <UsersDataLoader />
</Suspense>
```

## 2. Backend Architecture (FastAPI + GCP)

### 2.1 Organization-Scoped API Design

#### **Multi-tenant Architecture**
```python
# Organization context is required for all operations
@router.get("/org/{org_slug}/users")
async def get_users(
    org_slug: str,
    auth_context: AuthContext = Depends(get_auth_context)  # Validates org membership
):
    users = await user_service.get_users(auth_context.org_id)
    return users
```

#### **JWT Token Structure**
```python
# Custom JWT template 'org-jwt' includes:
{
  "organization_id": "org_123",
  "organization_slug": "acme-corp",
  "organization_name": "ACME Corporation",
  "role": "admin",
  "internal_user_id": "user_456"
}
```

### 2.2 Database Design Patterns

#### **Soft Deletes and Status Management**
```python
# Users table with status management
class UserStatus(str, Enum):
    PENDING_APPROVAL = "pending_approval"
    ACTIVE = "active"
    INACTIVE = "inactive"

class User(Base):
    id: UUID
    status: UserStatus
    deleted_at: datetime | None  # Soft delete
    # ...
```

#### **Audit Trail**
```python
# Automatic audit logging
class AuditLog(Base):
    id: UUID
    table_name: str
    record_id: UUID
    action: str  # CREATE, UPDATE, DELETE
    user_id: UUID
    changes: JSON  # Before/after comparison
    created_at: datetime
```

### 2.3 Performance Optimizations

#### **Database Query Optimization**
```python
# Use async/await for better performance
async def get_users_with_relations(org_id: UUID):
    # Parallel queries instead of sequential
    users_task = user_service.get_users(org_id)
    departments_task = department_service.get_all(org_id)
    roles_task = role_service.get_all()

    users, departments, roles = await asyncio.gather(
        users_task, departments_task, roles_task
    )
    return {"users": users, "departments": departments, "roles": roles}
```

#### **Response Compression**
```python
# Automatic GZip compression for large responses
from fastapi.middleware.gzip import GZipMiddleware

app.add_middleware(GZipMiddleware, minimum_size=1000)
```

## 3. Deployment Architecture

### 3.1 Frontend Deployment (Vercel)

#### **Next.js Configuration**
```typescript
// next.config.ts
const nextConfig: NextConfig = {
  output: 'standalone',  // Optimal for Vercel
  // Other optimizations...
};
```

#### **Environment Variables**
```bash
# Production environment
NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com
NODE_ENV=production
```

#### **Deployment Optimization**
```dockerfile
# Multi-stage build for optimal performance
FROM node:22-alpine AS base
FROM base AS deps
RUN npm ci --only=production
FROM base AS builder
RUN npm run build
FROM node:22-alpine AS production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
CMD ["node", "server.js"]
```

### 3.2 Backend Deployment (GCP)

#### **Container Deployment**
```yaml
# docker-compose.yml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://...
      - REDIS_URL=redis://...
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 2G
```

#### **Cloud Run Configuration**
```yaml
# cloudbuild.yaml
steps:
- name: 'gcr.io/cloud-builders/docker'
  args: ['build', '-t', 'gcr.io/$PROJECT_ID/hr-evaluation-backend', '.']
- name: 'gcr.io/cloud-builders/docker'
  args: ['push', 'gcr.io/$PROJECT_ID/hr-evaluation-backend']
- name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
  args:
  - gcloud
  - run
  - deploy
  - hr-evaluation-backend
  - --image
  - gcr.io/$PROJECT_ID/hr-evaluation-backend
  - --platform
  - managed
  - --region
  - us-central1
  - --allow-unauthenticated
```

### 3.3 Cross-Cloud Performance Optimization

#### **Single API Call Pattern**
```typescript
// ❌ AVOID: Multiple sequential calls
const users = await getUsersAction();          // 300ms
const departments = await getDepartmentsAction(); // 300ms
const roles = await getRolesAction();          // 300ms
// Total: 900ms

// ✅ CORRECT: Single bundled call
const pageData = await getUserProfilesPageData(); // 320ms
// Total: 320ms (65% improvement)
```

#### **Edge Caching**
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

## 4. Common Misunderstandings & Best Practices

### 4.1 ❌ Common Mistakes

1. **Calling Endpoints Directly**
   ```typescript
   // ❌ WRONG: Bypasses caching and error handling
   const users = await usersApi.getUsers();

   // ✅ CORRECT: Use server actions
   const users = await getUsersAction();
   ```

2. **Not Using Suspense Boundaries**
   ```typescript
   // ❌ WRONG: No loading states
   <UsersPage />

   // ✅ CORRECT: Proper streaming
   <Suspense fallback={<UsersSkeleton />}>
     <UsersPage />
   </Suspense>
   ```

3. **Missing Cache Revalidation**
   ```typescript
   // ❌ WRONG: Data becomes stale
   await createUserAction(userData);

   // ✅ CORRECT: Invalidate related caches
   await createUserAction(userData);
   revalidateTag(CACHE_TAGS.USERS);
   ```

4. **Client-Side Data Fetching**
   ```typescript
   // ❌ WRONG: Poor performance and SEO
   useEffect(() => { fetch('/api/users') }, []);

   // ✅ CORRECT: Server-side rendering
   const users = await getUsersAction();
   ```

### 4.2 ✅ Best Practices

1. **Always Use Server Actions**
   - They provide caching, error handling, and authentication
   - Enable SSR and proper loading states
   - Support both server and client components

2. **Implement Proper Loading States**
   ```typescript
   // Use Suspense for streaming
   <Suspense fallback={<Skeleton />}>
     <DataComponent />
   </Suspense>

   // Use useActionState for forms
   const [state, action, isPending] = useActionState(myAction, null);
   ```

3. **Handle Errors Gracefully**
   ```typescript
   const result = await getUsersAction();
   if (!result.success) {
     return <ErrorMessage error={result.error} />;
   }
   return <UsersList users={result.data} />;
   ```

4. **Use Cache Appropriately**
   ```typescript
   // Static data: Use createFullyCachedAction
   export const getDepartmentsAction = createFullyCachedAction(
     _getDepartmentsAction,
     'getDepartments',
     CACHE_TAGS.DEPARTMENTS
   );

   // Dynamic data: Use React cache()
   export const getGoalsAction = cache(async (params) => {
     return _getGoalsAction(params);
   });
   ```

## 5. Development Workflow

### 5.1 Local Development
```bash
# Frontend
cd frontend
npm install
npm run dev  # Runs on http://localhost:3000

# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload  # Runs on http://localhost:8000
```

### 5.2 Environment Setup
```bash
# .env.local (Frontend)
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
NODE_ENV=development
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# .env (Backend)
DATABASE_URL=postgresql://localhost/hr_evaluation
REDIS_URL=redis://localhost:6379
```

### 5.3 Testing
```bash
# Frontend
npm run lint
npm run build  # Test production build

# Backend
pytest
pytest --cov  # Coverage report
```

### 5.4 Deployment
```bash
# Frontend (Vercel)
npm run build
# Deploy via Vercel CLI or GitHub integration

# Backend (GCP)
docker build -t hr-evaluation-backend .
gcloud run deploy hr-evaluation-backend --image gcr.io/$PROJECT_ID/hr-evaluation-backend
```

## 6. Performance Monitoring

### 6.1 Key Metrics
- **Time to First Byte (TTFB)**: Target < 300ms
- **Largest Contentful Paint (LCP)**: Target < 2.5s
- **Cumulative Layout Shift (CLS)**: Target < 0.1
- **First Input Delay (FID)**: Target < 100ms

### 6.2 Monitoring Tools
- **Frontend**: Vercel Analytics, Google PageSpeed Insights
- **Backend**: Google Cloud Monitoring, Application Performance Monitoring
- **Caching**: Custom logging for cache hit/miss rates

## 7. Security Considerations

### 7.1 Authentication Flow
1. User signs in via Clerk
2. Clerk redirects with JWT token
3. Middleware validates token and org membership
4. Server actions include auth context in API calls
5. Backend validates JWT and organization context

### 7.2 Data Protection
- All sensitive data encrypted at rest
- API calls use HTTPS only
- JWT tokens have short expiration times
- Organization-level data isolation

This architecture provides a solid foundation for a scalable, maintainable, and high-performance HR evaluation system. The layered approach ensures clear separation of concerns while the comprehensive caching strategy optimizes performance across the Vercel-GCP boundary.
