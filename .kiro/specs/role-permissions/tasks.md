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
  > - [x] **2.2.1. Build RolePermissionMatrix component**
    > Create `frontend/src/app/org-management/permissions/RolePermissionMatrix.tsx` with grid layout showing roles vs permissions matrix.
  > - [x] **2.2.2. Fetch and display data**
    > Fetch permissions catalog and role assignments using existing server actions; implement typed hooks for data management.
  > - [x] **2.2.3. Interactive toggles and dirty state**
    > Add checkbox toggles with optimistic UI updates; maintain local dirty state tracking changes.
  > - [x] **2.2.4. Search and filter functionality**
    > Add filter box for permission code/description search; role selector dropdown; virtualize long lists (handled via grouped accordion UX).
  > - [x] **2.2.5. Save/Cancel controls**
    > Implement Save/Cancel buttons with loading states, inline error banners, and success toasts.
  > - [x] **2.2.6. Admin vs non-admin UX**
    > Gate write controls to admin role; show read-only mode for non-admins (disable toggles, hide destructive actions).
  > - [x] **2.2.7. Error handling and pending states**
    > Handle network errors, validation errors, and loading states throughout the component.
  > - [ ] **2.2.8. Unit tests**
    > Add unit tests covering toggle behavior, save flow, permission gating, and error states.
  >
  > **Related Requirements:** R1

  - [x] **2.2.a. Frontend endpoints wrapper for permissions**
    > Implemented `frontend/src/api/endpoints/permissions.ts` with catalog + role get/put/patch/clone.

  - [x] **2.2.b. Frontend server actions for permissions**
    > Implemented `frontend/src/api/server-actions/permissions.ts` with cached reads and revalidate-on-mutate (`CACHE_TAGS.ROLES`).

- [x] **2.3. Clone from role**
  > UI to select source role (e.g., Manager/Viewer), confirm, call clone API, refresh.
  > - [x] **2.3.1. ClonePermissionsDialog component**
    > Create dialog component with searchable role dropdown seeded from `/api/roles`.
  > - [x] **2.3.2. Permissions delta preview**
    > Display summary of permissions delta from draft diff before confirmation; require admin confirmation.
  > - [x] **2.3.3. Clone API integration**
    > Call clone endpoint, refresh assignments, and show toast with audit id reference.
  > - [x] **2.3.4. Error handling**
    > Handle API errors (409/403/500) with inline alerts and maintain modal state for retry.
  > - [ ] **2.3.5. Integration tests**
    > Extend Cypress flow to verify clone path updates matrix and audit event surfaces.
  >
  > **Related Requirements:** R3

- [x] **2.4. Concurrency errors**
  > Surface 409 with refresh prompt; preserve unsaved changes where possible.
  > - [x] **2.4.1. 409 error handling**
    > When backend returns 409 + latest `version`, show sticky warning banner prompting manual refresh.
  > - [x] **2.4.2. Preserve unsaved changes**
    > Keep local diff so admin can reapply after fetching latest data; provide "Retry with latest" CTA.
  > - [ ] **2.4.3. Error telemetry**
    > Disable auto retry for 409; log event for telemetry.
  > - [ ] **2.4.4. Unit tests**
    > Write unit test verifying banner appears and diff persists after refresh action.
  >
  > **Related Requirements:** R1

- [x] **2.5. Permission grouping with Japanese descriptions**
  > Improve permission matrix scalability and usability with grouped permissions and Japanese descriptions.
  > - [x] **2.5.1. Backend: Database migration for permission groups**
    > Create migration `050_add_permission_group.sql` to add `permission_group` column to `permissions` table.
    > - Update existing permissions with Japanese group names: `user`, `hierarchy` → `ユーザー`; `department` → `部門`; `role` → `ロール`; `goal` → `目標`; `evaluation` → `評価`; `competency` → `コンピテンシー`; `assessment` → `自己評価`; `report` → `レポート`; `stage` → `ステージ`.
    > - Update all permission descriptions to Japanese.
    > - Update `Permission` model in `backend/app/database/models/permission.py` to include `permission_group` field.
    >
    > **Related Requirements:** R1, R3
  > - [x] **2.5.2. Backend: Repository and service updates**
    > - Add `list_permissions_grouped()` method to `PermissionRepository` returning permissions grouped by `permission_group`.
    > - Update `ensure_permission_codes()` to accept and store group parameter.
    > - Add `list_catalog_grouped()` method to `PermissionService`.
    > - Update `_ensure_catalog_seeded()` to include Japanese descriptions and groups.
    >
    > **Related Requirements:** R1, R3
  > - [x] **2.5.3. Backend: Schema and API updates**
    > - Add `permission_group` field to `PermissionCatalogItem` schema.
    > - Create `PermissionGroupResponse` schema with group name and permissions list.
    > - Create `PermissionCatalogGroupedResponse` for grouped catalog.
    > - Add endpoint `GET /roles/permissions:catalog-grouped` in `backend/app/api/v1/roles.py`.
    >
    > **Related Requirements:** R1
  > - [x] **2.5.4. Frontend: Cache configuration**
    > - Add `PERMISSIONS: 'permissions'` to `CACHE_TAGS` in `frontend/src/api/utils/cache.ts`.
    > - Add static cache strategy for permissions (1 hour duration).
    > - Update all permission mutation actions to revalidate both `CACHE_TAGS.ROLES` and `CACHE_TAGS.PERMISSIONS`.
    >
    > **Related Requirements:** R1, R5
  > - [x] **2.5.5. Frontend: Type definitions**
    > - Add `permission_group` field to `PermissionCatalogItem` in `frontend/src/api/types/permission.ts`.
    > - Create `PermissionGroup` interface.
    > - Create `PermissionCatalogGroupedResponse` type.
    >
    > **Related Requirements:** R1
  > - [x] **2.5.6. Frontend: API and server actions**
    > - Add `getGroupedCatalog()` method to `frontend/src/api/endpoints/permissions.ts`.
    > - Add `getPermissionCatalogGroupedAction()` with React cache in `frontend/src/api/server-actions/permissions.ts`.
    > - Update all mutation actions (`replaceRolePermissionsAction`, `patchRolePermissionsAction`, `cloneRolePermissionsAction`) to revalidate both cache tags.
    >
    > **Related Requirements:** R1, R5
  > - [x] **2.5.7. Frontend: Accordion-based permission matrix UI**
    > - Redesign `RolePermissionMatrix` component with Accordion layout.
    > - Each accordion item represents one permission group (e.g., "目標").
    > - Expand accordion to show individual permissions within that group.
    > - Keep role columns horizontal with checkboxes for each permission.
    > - Maintain existing save/cancel/reload functionality.
    > - Default to collapsed state; show permission count badge per group.
    > - Update to use grouped catalog API endpoint.
    >
    > **Related Requirements:** R1

- [x] **2.6. Role CRUD operations in Roles tab**
  > Add full create, update, and delete functionality for roles in the Roles tab.
  > - [x] **2.6.1. Create role functionality**
    > - Add "新しいロールを作成" button in `RolesTab` component.
    > - Create dialog form with name and description fields.
    > - Integrate with `createRoleAction` server action.
    > - Refresh roles list and update permissions matrix after creation.
    >
    > **Related Requirements:** R1
  > - [x] **2.6.2. Update role functionality**
    > - Add edit icon/button per role row.
    > - Create edit dialog with pre-filled name and description.
    > - Integrate with `updateRoleAction` server action.
    > - Update local state and refresh permissions matrix after update.
    >
    > **Related Requirements:** R1
  > - [x] **2.6.3. Delete role functionality**
    > - Add delete icon/button per role row.
    > - Show confirmation dialog before deletion.
    > - Check if role has users assigned (display user count from `roleUserMap`).
    > - Prevent deletion if users are still assigned (show error message).
    > - Integrate with `deleteRoleAction` server action.
    > - Update local state and refresh permissions matrix after deletion.
    > - Backend should validate no users have the role before allowing deletion.
    >
    > **Related Requirements:** R1
  > - [x] **2.6.4. Update OrgManagementContainer**
    > - Add state management callbacks for role creation, update, and deletion.
    > - Pass callbacks to `RolesTab` component.
    > - Ensure permissions matrix refreshes when roles change.
    >
    > **Related Requirements:** R1
  > - [x] **2.6.5. Update role server actions cache**
    > - Update `createRoleAction`, `updateRoleAction`, `deleteRoleAction` in `frontend/src/api/server-actions/roles.ts`.
    > - Ensure all mutations revalidate both `CACHE_TAGS.ROLES` and `CACHE_TAGS.PERMISSIONS`.
    >
    > **Related Requirements:** R1, R5

- [x] **2.7. User role editing in Users tab**
  > Enable admin users to change each user's role directly from the Users tab in /org-management page.
  > - [x] **2.7.1. Verify and enhance role editing UI**
    > - Ensure role dropdown/edit functionality is properly implemented in `UsersTab` component.
    > - Verify admin-only access control for role editing.
    > - Add loading states and error handling for role updates.
    > - Ensure role changes are reflected immediately in the UI.
    >
    > **Related Requirements:** R1
  > - [x] **2.7.2. Backend validation and audit**
    > - Ensure backend validates role assignments (e.g., prevent invalid role combinations if applicable).
    > - Add audit logging for role changes made from Users tab.
    > - Verify cache invalidation for user role changes.
    >
    > **Related Requirements:** R1, R5
  > - [x] **2.7.3. Integration testing**
    > - Test role editing flow end-to-end.
    > - Verify permissions matrix updates reflect user role changes.
    > - Test concurrent role updates and conflict handling.
    >
    > **Related Requirements:** R1

- [x] **2.8. Fixing UI component placement**
  > The `/org-management` 権限タブ currently renders the role-permission table controls outside of the 権限マトリクス card; align all subcomponents with the card layout shown in the reference screenshot.
  > - Wrap the summary tiles, filters, density toggles, and `RolePermissionMatrix` grid within the shared card container so the elevated surface matches design.
  > - Update spacing/borders in `OrgManagementContainer` and related components to ensure the card header, body, and footer flow is preserved across breakpoints.
  > - Add a regression test (Playwright, Storybook visual diff, or RTL) that asserts the card container exists and contains the matrix controls to prevent future regressions.
  >
  > **Related Requirements:** R1


```

## Hotfix & Perf – 2025-11-06

- [x] Backend: Reorder roles router so `/permissions:catalog-grouped` precedes `/{role_id}`
- [x] Backend: Migration adding indexes (users org/status/department/stage/created_at; user_roles user_id/role_id)
- [x] Frontend: Users initial load with `withCount=false`, `limit=50`
- [x] Frontend: Make grouped catalog non-fatal with flat catalog fallback
- [x] Frontend: Ensure `RolePermissionMatrix` degrades gracefully without grouped data
- [x] Tests: API route 200 for grouped catalog, and page render without grouped data
- [x] Perf check: capture p95 before/after and DB timing headers

## 機能B: Viewer Visibility Grants (resource-scoped, strict FKs; Option A)
```markdown
## Issue Title: Viewer visibility grants by user/department/supervisor_team with resource scope

## Summary
Viewer ロールに対して、ユーザー/部署/チーム単位で「どのデータ種別(Goal 等)を閲覧可能か」を付与できるようにする。DBは厳密な外部キー(3つの中間テーブル)と統合ビューを採用。

## Implementation Details:
### 3. Backend: DB schema + endpoints + RBAC integration

- [x] **3.1. Create junction tables with strict FKs**
  > `viewer_visibility_user`, `viewer_visibility_department`, `viewer_visibility_supervisor_team` + read-only view `viewer_visibility_grants`. Add composite unique and indexes on `(org_id, viewer_user_id, target, resource_type)`.
  >
  > **Related Requirements:** R2, R5

- [x] **3.2. Implement endpoints**
  > `GET /api/viewers/{viewer_id}/visibility`, `PUT /api/viewers/{viewer_id}/visibility`, `PATCH /api/viewers/{viewer_id}/visibility` (Admin only). Payload supports subject_type = user/department/supervisor_team and resource_type.
  >
  > **Related Requirements:** R2, R5

- [x] **3.3. RBACHelper integration**
  > For Viewer role only: compute effective targets per `resource_type` as `self ∪ overrides`; no implicit grant to unrelated resources.
  >
  > **Related Requirements:** R2, R5

- [x] **3.4. Audit + cache invalidation**
  > Audit actor, viewer_id, targets, resource_type, added/removed; invalidate relevant caches ≤ 5s.
  >
  > **Related Requirements:** R2, R5

### 4. Frontend: Viewer Visibility panel (Permissions tab)

- [x] **4.1. Target picker**
  > Select user/department/supervisor_team; searchable multi-select; shows current grants; bulk add/remove.
  >
  > **Related Requirements:** R2

- [x] **4.2. Resource type selector**
  > Choose data type (Goal/Evaluation/Assessment/…); default Goal; per-type list of grants.
  >
  > **Related Requirements:** R2

- [x] **4.3. Error and empty states**
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
