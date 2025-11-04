# 実装計画: Role Permissions & Viewer Visibility

## 機能A: Admin-managed Role Permissions (権限) under /org-management
```markdown
## Issue Title: Admin can manage role-permission assignments (Org Management → Permissions tab)

## Summary
管理者が /org-management 配下の「権限」タブで、各ロールに紐づく権限を閲覧・編集できるようにする。デフォルトは permissions.py を反映し、更新は監査ログ・キャッシュ無効化・同時編集対策を行う。

## Implementation Details:
### 1. Backend: permissions catalog, role-permissions CRUD, clone

- [ ] **1.1. Create DB objects for permissions and role_permissions**
  > Tables: `permissions` (code, description), `role_permissions` (org_id, role_id, permission_id, created_at). Seed from `backend/app/security/permissions.py` + `ROLE_PERMISSIONS`.
  >
  > **Related Requirements:** R1, R3, R5

- [ ] **1.2. Implement endpoints**
  > `GET /api/permissions`, `GET /api/roles/{id}/permissions`, `PUT /api/roles/{id}/permissions`, `PATCH /api/roles/{id}/permissions` (Admin only). Include optimistic concurrency (If-Match ETag or `version` field).
  >
  > **Related Requirements:** R1, R5

- [ ] **1.3. Implement clone endpoint**
  > `POST /api/roles/{id}/permissions:clone?from_role_id=...` to replace target role’s set with source role’s set; returns applied delta and audit id.
  >
  > **Related Requirements:** R3

- [ ] **1.4. Add audit logging**
  > Log actor, org_id, role, added/removed permissions, timestamp, request id. Persist to audit table or existing log strategy.
  >
  > **Related Requirements:** R1, R5

- [ ] **1.5. Caching + invalidation**
  > Per-org `(org_id, role_name)` → `Set[Permission]` in-memory cache, TTL ≤ 5s; invalidate on writes.
  >
  > **Related Requirements:** R1, R5

### 2. Frontend: Permissions (権限) tab UI

- [ ] **2.1. Add new tab under /org-management**
  > Route and navigation; gate write controls to Admin; non-Admin read-only view.
  >
  > **Related Requirements:** R1

- [ ] **2.2. Role × Permission matrix**
  > Search/filter, toggle checkboxes, pending state, error handling, Save/Cancel.
  >
  > **Related Requirements:** R1

- [ ] **2.3. Clone from role**
  > UI to select source role (e.g., Manager/Viewer), confirm, call clone API, refresh.
  >
  > **Related Requirements:** R3

- [ ] **2.4. Concurrency errors**
  > Surface 409 with refresh prompt; preserve unsaved changes where possible.
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

