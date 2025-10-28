# 実装計画: Organization Management

```markdown
## Issue Title: Backend - v2 Bulk Status API and Repository Batching

## Summary
Implement a performant v2 endpoint to bulk update user statuses with org scoping using a single transaction and repository-level batch update.

## Implementation Details:
### 1. API & Schemas
- [x] **1.1. Add `PATCH /api/v2/users/bulk-status` in `backend/app/api/v2/users.py`**
  > Admin-only with org scope checks; validates 1–100 items; aggregates per-item results.
  >
  > **Related Requirements:** 1, 3, 8

- [ ] **1.2. Add schemas in `backend/app/schemas/user.py`**
  > `BulkUserStatusUpdateItem`, `BulkUserStatusUpdateResult`, `BulkUserStatusUpdateResponse`.
  >
  > **Related Requirements:** 8

### 2. Service & Repository
- [ ] **2.1. Implement `bulk_update_user_statuses(...)` in `user_service.py`**
  > Single DB session/transaction; pre-SELECT for org scope; one `UPDATE ... CASE` statement.
  >
  > **Related Requirements:** 3, 8

- [ ] **2.2. Add `batch_update_user_statuses(...)` in `user_repo.py`**
  > Pre-validation SELECT + single UPDATE with CASE + single COMMIT.
  >
  > **Related Requirements:** 3, 8

### 3. Tests
- [ ] **3.1. Unit/integration tests for v2 endpoint and repo batching**
  > Happy path, invalid transitions, cross-org, >100 items, partial failures.
  >
  > **Related Requirements:** 8
```

```markdown
## Issue Title: Frontend - Org Management Page, Bulk Action, and Inline Editing

## Summary
Build `/org-management` with tabs (users/departments/roles), integrate bulk status action with v2 API, and implement inline editors per requirements.

## Implementation Details:
### 1. Page & Tabs
- [ ] **1.1. Create `app/(evaluation)/(admin)/org-management/page.tsx`**
  > Server component with initial SSR data and container render.
  >
  > **Related Requirements:** 1, 2

- [ ] **1.2. Create container/view under `feature/org-management/`**
  > Tabs for Users, Departments, Roles.
  >
  > **Related Requirements:** 2

### 2. Users Tab
- [ ] **2.1. Bulk status action bar**
  > `UserBulkStatusBar.tsx` + Server Action hook-up; progress + result summary.
  >
  > **Related Requirements:** 3, 7, 8

- [ ] **2.2. Inline editors**
  > Department/Roles/Stage/Supervisor/Subordinates/Status; name/email read-only.
  >
  > **Related Requirements:** 3, 7

### 3. Departments & Roles Tabs
- [ ] **3.1. Department modals**
  > Create/Edit/Delete with validations; Users list; Add/Remove users modal.
  >
  > **Related Requirements:** 4, 7

- [ ] **3.2. Role assignments modal**
  > Show users by role; assign/unassign via v1 user update API; multi-role support.
  >
  > **Related Requirements:** 5, 7

### 4. API Client & Server Actions
- [ ] **4.1. Add `usersApi.bulkUpdateStatus`**
  > Path: `PATCH /api/v2/users/bulk-status`.
  >
  > **Related Requirements:** 8

- [ ] **4.2. Add `bulkUpdateUserStatusesAction`**
  > Revalidate `USERS` and related tags.
  >
  > **Related Requirements:** 7, 8
```

```markdown
## Issue Title: Frontend - Navigation/Middleware & Department Delete Validation

## Summary
Replace sidebar entry to "組織管理" pointing to `/org-management`, add admin matcher, and implement department delete validation.

## Implementation Details:
### 1. Navigation & Middleware
- [ ] **1.1. Replace sidebar entry**
  > Update `frontend/src/components/constants/routes.ts`.
  >
  > **Related Requirements:** 6

- [ ] **1.2. Add `/org-management` to admin route matcher**
  > Update `frontend/src/middleware.ts`.
  >
  > **Related Requirements:** 1, 6

### 2. Department Delete Validation
- [ ] **2.1. Enforce zero active users prerequisite**
  > Block deletion with guidance; handle success once zero active users.
  >
  > **Related Requirements:** 4
```

```markdown
## Issue Title: QA & Docs - Tests and Documentation Updates

## Summary
Add tests for backend/frontend flows and document routing and v2 API behaviors.

## Implementation Details:
### 1. Backend & Repo Tests
- [ ] **1.1. v2 bulk-status and repository batching tests**
  > Success/invalid/cross-org/limits/partial failures.
  >
  > **Related Requirements:** 8

### 2. Frontend Tests
- [ ] **2.1. Status toggle and bulk action flows**
  > Single and bulk transitions incl. confirm modal.
  >
  > **Related Requirements:** 3

### 3. Docs
- [ ] **3.1. Update docs for `/org-management` and sidebar**
  > Replace `/department-management` references.
  >
  > **Related Requirements:** 1, 6

- [ ] **3.2. Document `PATCH /api/v2/users/bulk-status`**
  > Request/response, limits, transitions, org scoping.
  >
  > **Related Requirements:** 8
```


