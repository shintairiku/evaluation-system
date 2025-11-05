# 実装計画: Role Permissions & Viewer Visibility

## 機能A: Admin-managed Role Permissions (権限) under /org-management
```markdown
## Issue Title: Admin can manage role-permission assignments (Org Management → Permissions tab)

## Summary
管理者が /org-management 配下の「権限」タブで、各ロールに紐づく権限を閲覧・編集できるようにする。デフォルトは permissions.py を反映し、更新は監査ログ・キャッシュ無効化・同時編集対策を行う。

## Implementation Details:
### 1. Backend: permissions catalog, role-permissions CRUD, clone

- [x] **1.1. Create DB objects for permissions and role_permissions**
  > - Migration executed: `production/010_create_permissions_tables.sql` applied on 2025-11-05; created `permissions` and `role_permissions`, seeded defaults, and updated triggers/indexes successfully.
  > Tables: `permissions` (code, description), `role_permissions` (org_id, role_id, permission_id, created_at). Seed from `backend/app/security/permissions.py` + `ROLE_PERMISSIONS`.
  > - Create Alembic migration to add both tables with `organization_id`, FK to `roles.id`, unique `(organization_id, role_id, permission_id)`, timestamps, and seed hooks.
  > - Introduce SQLAlchemy models/modules (`backend/app/database/models/permission.py`, `role_permission.py`) plus repository helpers for batch reads/writes.
  > - Implement seed helpers loading the `Permission` enum and `ROLE_PERMISSIONS`; ensure per-org inserts respect existing static defaults.
  > - Add migration/unit test verifying DB catalog matches enum definitions and seeded sets mirror static mapping.
  >
  > **Related Requirements:** R1, R3, R5

- [x] **1.2. Implement endpoints**
  > `GET /api/permissions`, `GET /api/roles/{id}/permissions`, `PUT /api/roles/{id}/permissions`, `PATCH /api/roles/{id}/permissions` (Admin only). Include optimistic concurrency (If-Match ETag or `version` field).
  > - Define request/response schemas in `backend/app/api/schemas/permissions.py`, including `version` metadata for optimistic locking.
  > - Add FastAPI router (`backend/app/api/routes/permissions.py`) wiring CRUD endpoints, enforcing `require_role(["admin"])`.
  > - Create service layer (`backend/app/services/role_permissions.py`) handling diff computation, validation, concurrency checks, and DB writes.
  > - Return structured 409 errors with latest `version`, and map repository exceptions to 400/404/500 responses.
  > - Cover endpoints with API tests using async test client for admin and non-admin scenarios.
  >
  > **Related Requirements:** R1, R5

- [x] **1.3. Implement clone endpoint**
  > `POST /api/roles/{id}/permissions:clone?from_role_id=...` to replace target role’s set with source role’s set; returns applied delta and audit id.
  >
  > **Related Requirements:** R3

- [x] **1.4. Add audit logging**
  > Log actor, org_id, role, added/removed permissions, timestamp, request id. Persist to audit table or existing log strategy.
  > - Extend audit service to accept `RolePermissionChange` event with before/after diff and request correlation.
  > - Emit audit entry inside the service transaction for PUT/PATCH/clone; rollback on audit failures.
  > - Ensure logs include org_id, role_id, actor_id, added[], removed[], previous_version, new_version.
  > - Add unit tests asserting audit events fire and payloads contain expected fields.
  >
  > **Related Requirements:** R1, R5

- [x] **1.5. Caching + invalidation**
  > Per-org `(org_id, role_name)` → `Set[Permission]` in-memory cache, TTL ≤ 5s; invalidate on writes.
  > - Add cache wrapper in `backend/app/security/permission_manager.py` keyed by `(org_id, role_name)` with 5s TTL and optional warm start.
  > - Invalidate cache entries after successful writes/clone via service hook; emit structured log for observability.
  > - Respect feature flag OFF path by short-circuiting to static map; ON path consults cache/DB.
  > - Instrument metrics (cache hit ratio, load latency) via existing telemetry helpers and cover with tests.
  >
  > **Related Requirements:** R1, R5

  - [x] **1.5.a. RBAC integration: inject DB-backed permissions at auth time**
    > Implemented in `backend/app/security/dependencies.py`: populates `role_permission_overrides` using `get_cached_role_permissions` (5s TTL) and `AuthContext` computes effective permissions.

### 2. Frontend: Permissions (権限) tab UI

- [x] **2.1. Add new tab under /org-management**
  > Route and navigation; gate write controls to Admin; non-Admin read-only view.
  >
  > **Related Requirements:** R1

- [x] **2.2. Role × Permission matrix**
  > Search/filter, toggle checkboxes, pending state, error handling, Save/Cancel.
  > - Build `RolePermissionMatrix` component under `frontend/src/app/org-management/permissions/`.
  > - Fetch catalog + per-role assignments via typed hooks; maintain local dirty state and optimistic toggle UX.
  > - Provide filter box (permission code/description) and role selector; virtualize long lists to keep UI performant.
  > - Implement Save/Cancel controls with loading indicators, inline error banner, and success toast.
  > - Ensure read-only mode for non-admins by disabling toggles and hiding destructive actions.
  > - Add unit tests covering toggle behavior, save flow, and permission gating.
  >
  > **Related Requirements:** R1

  - [x] **2.2.a. Frontend endpoints wrapper for permissions**
    > Implemented `frontend/src/api/endpoints/permissions.ts` with catalog + role get/put/patch/clone.

  - [x] **2.2.b. Frontend server actions for permissions**
    > Implemented `frontend/src/api/server-actions/permissions.ts` with cached reads and revalidate-on-mutate (`CACHE_TAGS.ROLES`).

- [x] **2.3. Clone from role**
  > UI to select source role (e.g., Manager/Viewer), confirm, call clone API, refresh.
  > - Add `ClonePermissionsDialog` with searchable role dropdown seeded from `/api/roles`.
  > - Display summary of permissions delta from draft diff before confirmation; require admin confirmation.
  > - Call clone endpoint, refresh assignments, and show toast with audit id reference.
  > - Handle API errors (409/403/500) with inline alerts and maintain modal state for retry.
  > - Extend Cypress flow to verify clone path updates matrix and audit event surfaces.
  >
  > **Related Requirements:** R3

- [x] **2.4. Concurrency errors**
  > Surface 409 with refresh prompt; preserve unsaved changes where possible.
  > - When backend returns 409 + latest `version`, show sticky warning banner prompting manual refresh.
  > - Keep local diff so admin can reapply after fetching latest data; provide "Retry with latest" CTA.
  > - Disable auto retry for 409; log event for telemetry.
  > - Write unit test verifying banner appears and diff persists after refresh action.
  >
  > **Related Requirements:** R1

```

## 機能B: Viewer Visibility Grants (resource-scoped, strict FKs; Option A)
```markdown
## Issue Title: Viewer visibility grants by user/department/supervisor_team with resource scope

## Summary
Viewer ロールに対して、ユーザー/部署/チーム単位で「どのデータ種別(Goal 等)を閲覧可能か」を付与できるようにする。DBは厳密な外部キー(3つの中間テーブル)と統合ビューを採用。

## Implementation Details:
### 3. Backend: DB schema + endpoints + RBAC integration

- [ ] **3.1. Create junction tables with strict FKs**
  > `viewer_visibility_user`, `viewer_visibility_department`, `viewer_visibility_supervisor_team` + read-only view `viewer_visibility_grants`. Add composite unique and indexes on `(org_id, viewer_user_id, target, resource_type)`.
  >
  > **Related Requirements:** R2, R5

- [ ] **3.2. Implement endpoints**
  > `GET /api/viewers/{viewer_id}/visibility`, `PUT /api/viewers/{viewer_id}/visibility`, `PATCH /api/viewers/{viewer_id}/visibility` (Admin only). Payload supports subject_type = user/department/supervisor_team and resource_type.
  >
  > **Related Requirements:** R2, R5

- [ ] **3.3. RBACHelper integration**
  > For Viewer role only: compute effective targets per `resource_type` as `self ∪ overrides`; no implicit grant to unrelated resources.
  >
  > **Related Requirements:** R2, R5

- [ ] **3.4. Audit + cache invalidation**
  > Audit actor, viewer_id, targets, resource_type, added/removed; invalidate relevant caches ≤ 5s.
  >
  > **Related Requirements:** R2, R5

### 4. Frontend: Viewer Visibility panel (Permissions tab)

- [ ] **4.1. Target picker**
  > Select user/department/supervisor_team; searchable multi-select; shows current grants; bulk add/remove.
  >
  > **Related Requirements:** R2

- [ ] **4.2. Resource type selector**
  > Choose data type (Goal/Evaluation/Assessment/…); default Goal; per-type list of grants.
  >
  > **Related Requirements:** R2

- [ ] **4.3. Error and empty states**
  > Clear UX for 403, 409, network errors; empty list guidance.
  >
  > **Related Requirements:** R2

```

```markdown
## Issue Title: Seed, feature flag, and static fallback to permissions.py

## Summary
permissions.py の定義をソースオブトゥルースとして初期シード・動的機能フラグと連動し、機能無効時は既存の静的マッピングを使用する。

## Implementation Details:
### 5. Seed, feature flag, and fallback

- [ ] **5.1. Seeding scripts**
  > Seed `permissions` and `role_permissions` from `Permission` enum and `ROLE_PERMISSIONS`; add migration test to assert 1:1 parity with static mapping.
  >
  > **Related Requirements:** R3

- [ ] **5.2. Feature flag wiring**
  > OFF → static PermissionManager mapping; ON → DB-backed with fallback if empty.
  >
  > **Related Requirements:** R4

- [ ] **5.3. Observability**
  > Structured logs for writes and invalidations (org_id, role/viewer, resource_type); metrics for cache hit ratio and p95 authorization latency.
  >
  > **Related Requirements:** R5

```

### 6. テストと品質保証

- [ ] **6.1. Unit tests (≥80% coverage on security module changes)**
- [ ] **6.2. RBAC matrix tests updated**
- [ ] **6.3. API contract tests (role-permissions, clone, viewer visibility)**
- [ ] **6.4. Concurrency tests (409 on stale write)**
- [ ] **6.5. Performance checks (p95 ≤ 5ms warm, ≤ 50ms cold)**

### 7. インフラ構築とデプロイ

- [ ] **7.1. Database migrations**
- [ ] **7.2. CI step to verify enum ↔ catalog parity**
- [ ] **7.3. Feature flag default OFF; env toggle for staging/prod**

## Additional Notes:
> - Align naming and i18n: “Permissions (権限)” in UI; keep API/resource names in English.
> - Coordinate with DevOps for migration rollout and feature-flag enablement.
> - Ensure multitenancy scoping on every read/write (org_id) and validate in tests.
