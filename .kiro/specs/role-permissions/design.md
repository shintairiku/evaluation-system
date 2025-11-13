# Design: Role Permissions & Viewer Visibility

## 1. Overview
This document describes the technical design for admin-managed role permissions and Viewer visibility overrides. It integrates with the existing RBAC module (AuthContext, PermissionManager, RBACHelper) while introducing database-backed configuration, caching, and admin tooling. There is no standalone page; permissions management lives under `/org-management` as a Permissions (権限) tab.

## 2. Architecture Design

### 2.1. System Diagram
```mermaid
graph TD
  subgraph FE[Frontend (Next.js)]
    A[/Org Management\nTabs: Roles | Departments | Permissions(権限)/]
    B[Permissions Tab: Viewer Visibility Panel]
  end

  subgraph API[Backend (FastAPI)]
    C[/Roles API/]
    D[/Permissions API/]
    E[/Role-Permissions API/]
    F[/Viewer Visibility API/]

    subgraph SEC[Security Module]
      G[AuthContext]
      H[PermissionManager]
      I[RBACHelper]
    end
  end

  subgraph DB[(PostgreSQL)]
    J[(roles)]
    K[(permissions)]
    L[(role_permissions)]
    M[(viewer_visibility_overrides)]
  end

  A --> C
  A --> D
  A --> E
  A --> F

  SEC --> DB
  C --> J
  D --> K
  E --> L
  F --> M
```

### 2.2. Technology Stack
- Frontend: Next.js, TypeScript, Tailwind
- Backend: FastAPI (Python), SQLAlchemy
- DB/Infra: PostgreSQL (Supabase), Docker Compose
- Auth: Clerk; existing AuthContext and dependencies

## 3. Database Design

### 3.1. ER Diagram
```mermaid
erDiagram
  ROLE ||--o{ ROLE_PERMISSION : assigns
  PERMISSION ||--o{ ROLE_PERMISSION : included
  USER ||--o{ VIEWER_VISIBILITY : grants
  USER ||--o{ USER_ROLE : has

  ROLE {
    uuid id PK
    string organization_id
    string name
    string description
    int hierarchy_order
    timestamp created_at
    timestamp updated_at
  }

  PERMISSION {
    uuid id PK
    string code  // e.g., "user:read:self"
    string description
    timestamp created_at
  }

  ROLE_PERMISSION {
    uuid role_id FK
    uuid permission_id FK
    string organization_id
    timestamp created_at
    UNIQUE (organization_id, role_id, permission_id)
  }

  VIEWER_VISIBILITY_USER {
    uuid id PK
    string organization_id
    uuid viewer_user_id FK        // users.id; must have role Viewer
    uuid target_user_id FK        // users.id
    enum resource_type            // from rbac_types.ResourceType (e.g., GOAL, EVALUATION, ASSESSMENT)
    uuid created_by FK            // users.id (admin)
    timestamp created_at
    UNIQUE (organization_id, viewer_user_id, target_user_id, resource_type)
  }

  VIEWER_VISIBILITY_DEPARTMENT {
    uuid id PK
    string organization_id
    uuid viewer_user_id FK        // users.id; must have role Viewer
    uuid target_department_id FK  // departments.id
    enum resource_type            // from rbac_types.ResourceType
    uuid created_by FK            // users.id (admin)
    timestamp created_at
    UNIQUE (organization_id, viewer_user_id, target_department_id, resource_type)
  }

  VIEWER_VISIBILITY_SUPERVISOR_TEAM {
    uuid id PK
    string organization_id
    uuid viewer_user_id FK        // users.id; must have role Viewer
    uuid supervisor_user_id FK    // users.id representing the team lead/supervisor
    enum resource_type            // from rbac_types.ResourceType
    uuid created_by FK            // users.id (admin)
    timestamp created_at
    UNIQUE (organization_id, viewer_user_id, supervisor_user_id, resource_type)
  }

  -- DB VIEW (read-only convenience)
  VIEW viewer_visibility_grants AS
    SELECT organization_id, viewer_user_id, 'user' AS subject_type, target_user_id AS subject_id, resource_type, created_by, created_at
      FROM VIEWER_VISIBILITY_USER
    UNION ALL
    SELECT organization_id, viewer_user_id, 'department' AS subject_type, target_department_id AS subject_id, resource_type, created_by, created_at
      FROM VIEWER_VISIBILITY_DEPARTMENT
    UNION ALL
    SELECT organization_id, viewer_user_id, 'supervisor_team' AS subject_type, supervisor_user_id AS subject_id, resource_type, created_by, created_at
      FROM VIEWER_VISIBILITY_SUPERVISOR_TEAM
  ;

  USER_ROLE {
    uuid user_id FK
    uuid role_id FK
    UNIQUE (user_id, role_id)
  }
```

### 3.2. Notes
- Permissions catalog is canonicalized from `backend/app/security/permissions.py` (Permission enum).
- All tables include `organization_id` to enforce strict multitenancy.
- Seed `permissions` and `role_permissions` to mirror the static mapping (`ROLE_PERMISSIONS`) on migration; add a migration test to assert 1:1 parity.

### 3.3. Chosen Approach (Option A)
- Use three junction tables with strict foreign keys and a unifying read-only view `viewer_visibility_grants`.
- Benefits: referential integrity, simple indexes, predictable query plans, and clean migrations.

Alternative (not selected): Single-table polymorphic (`subject_type` + `subject_id`) with app-level validation and optional triggers. Simpler DDL, weaker FK guarantees.

## 4. API Endpoints

- `GET /api/roles` → list roles (org-scoped)
- `GET /api/permissions` → list permission catalog (from permissions.py)
- `GET /api/roles/{role_id}/permissions` → list assigned permissions
- `PUT /api/roles/{role_id}/permissions` → replace assignment set (Admin only, audited)
- `PATCH /api/roles/{role_id}/permissions` → add/remove subset (Admin only, audited)
- `POST /api/roles/{role_id}/permissions:clone` (query: `from_role_id`) → clone source role’s set into target role (Admin only)
- `GET /api/viewers/{viewer_user_id}/visibility` → list overrides grouped by target_kind and resource_type
- `PUT /api/viewers/{viewer_user_id}/visibility` → replace full set (Admin only, audited)
- `PATCH /api/viewers/{viewer_user_id}/visibility` → add/remove overrides (Admin only, audited)

Errors: 400 (validation), 403 (forbidden), 404 (not found), 409 (edit conflict), 500 (server).

## 5. Integration with Security Module

- Source of truth for permission names is `permissions.py`.
- Role-permission evaluation: feature flag OFF → static mapping; ON → DB mapping with fallback to static if empty.
- Caching: in-memory per-org cache (TTL ≤ 5s) keyed by `(org_id, role_name)`; invalidate on writes.
- Viewer overrides at authorization time:
  - For a given resource_type (e.g., GOAL), compute effective targets as `self ∪ explicit_overrides` where overrides are filtered by resource_type and target_kind.
  - No implicit grant to unrelated resources (e.g., Stage remains hidden unless explicitly granted).
  - Other roles unchanged; subordinate logic remains as-is.

## 6. Caching & Invalidation
- Write operations (role-permission update, viewer visibility change) emit cache-bust events scoped by `organization_id` and relevant role/user keys.
- TTL-based safety net (≤ 5s) ensures eventual consistency.

## 7. UI/UX Design
- Placement: `/org-management` with a new Permissions (権限) tab; no new page.
- Role Permissions:
  - Matrix view (roles × permissions) with filter/search; Admin can toggle; non-Admin read-only.
  - "Clone from role" action to copy another role’s set into the selected role.
  - Dirty-state indicators; optimistic updates with server confirmation; conflict handling on 409.
- Viewer Visibility panel (within Permissions tab):
  - Target Type selector (user/department/team) with searchable pickers.
  - Data Type selector (Goal/Evaluation/Assessment/…); default to Goal.
  - Shows current overrides with ability to add/remove in bulk.
  - Access limited to Admin; show 403 for others.

## 8. Migration Plan
- Create `permissions`, `role_permissions`.
- Create junction tables with strict FKs:
  - `viewer_visibility_user`
  - `viewer_visibility_department`
  - `viewer_visibility_supervisor_team`
- Create view `viewer_visibility_grants` (read-only) to unify the three tables for read paths.
- Seed `permissions` with all values from `Permission` enum.
- Seed `role_permissions` per current static mapping for each org (from `ROLE_PERMISSIONS`).
- Feature flag defaults OFF; enable per environment after validation.

## 9. Observability & Audit
- Audit log on every write: actor, organization_id, entity, before/after, timestamp.
- Metrics: cache hit ratio, permission check latency, write error rates.
- Logs: structured JSON with correlation/request IDs.

## 10. Risks & Mitigations
- Stale caches → TTL + targeted invalidation on write.
- Divergence between enum and DB catalog → migration tests to assert 1:1 mapping and CI guard.
- Over-broad Admin rights → endpoint-level `require_role(['admin'])` and defense-in-depth checks.

```text
Decision: Keep static PermissionManager as fallback to reduce rollout risk and support local/dev without DB bootstrap.
```
