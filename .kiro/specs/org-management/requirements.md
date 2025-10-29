## Organization Management - Requirements

### 1) Access Control & Routing
- Admin-only page. Non-admins are redirected to `'/access-denied'`.
- New route: `'/org-management'`.
- Replace old route completely: remove `'/department-management'` and update sidebar label from "部門管理" to "組織管理" linking to `'/org-management'`.
- Add `'/org-management'` to admin-route matcher (authorization middleware) to enforce `org:admin` access.

### 2) Page Structure (Tabs)
- The page provides multiple tabs:
    - User Management
    - Department Management
    - Role Management
    - (others may be added later)

### 3) User Management Tab
- Visibility in table:
    - Show user's name, email, department, roles, stage, status.
- Editable fields (inline editable in table):
    - department, roles, stage, supervisor, subordinates, status
    - Note: name and email are NOT editable (display-only).
- Status update behavior (one-click):
    - `pending_approval → active`: toggle without confirmation.
    - `active → inactive`: requires confirmation modal.
    - `inactive → active`: allowed via status control (confirmation not required).
-- Bulk status update:
    - Provide selection and bulk action for status updates.
    - Backend endpoint (v2): `PATCH /api/v2/users/bulk-status`（単一 DB セッション/単一コミットで高速一括更新）。
        - Request body: array of `{ userId: UUID, newStatus: 'pending_approval' | 'active' | 'inactive' }`.
        - Max items per request: 100.
        - Org-scoped restriction: all updates must belong to the caller's organization; reject any out-of-scope user updates.
        - Implementation note: 事前 SELECT による組織スコープ検証 + `UPDATE ... CASE` による 1 ステートメント一括更新。
    - Partial failure handling: return per-item success/failure with error messages (UI surfaces a summary).

### 4) Department Management Tab
- Fetch all departments as a table.
- Edit/Create via modal dialogs (not inline):
    - Click "edit" icon/button → open modal to update department.
    - Click "create" → open modal to create a department.
- User count per department:
    - Clicking the number opens a modal listing users in the department.
- Add/Remove users to/from a department:
    - Use a modal to multi-select users to add/remove (Current State: Option C).
    - Implementation approach: reuse existing user update API to set/unset `department_id` for selected users (sequential or small batches on the client).
- Delete department:
    - Requires confirmation modal.
    - Deletion is only allowed when the department has zero active users.
    - If users exist, admin must transfer them to other departments or remove them first; enforce this rule before allowing deletion.

### 5) Role Management Tab
- Scope: manage user-role assignments only. No role CRUD in this screen.
- Fetch roles as a table (with user counts).
- Clicking a role's user count opens a modal listing all users whose roles include that specific role.
- Users can have multiple roles; UI must support multi-role assignment.
- Add/Remove users to/from a role:
    - Use existing v1 user update API (`PUT /users/{id}`) with `role_ids` to add/remove roles per user (individual updates are acceptable here).

### 6) Navigation & Sidebar
- Remove `/department-management` route.
- Replace the sidebar entry from "部門管理" to "組織管理" and link to `'/org-management'`.
- Ensure the middleware admin matcher includes `'/org-management'`.

### 7) Non-Functional & UX Standards
- Users tab uses inline editing for the allowed fields to minimize context switching.
- Departments tab uses modal-based editing to prevent accidental bulk changes.
- For bulk operations, show progress and outcome summary; do not block the UI unnecessarily.
- Follow existing server-actions with cache revalidation on mutations for users/departments/roles.

### 8) API Contract Additions
-- `PATCH /api/v2/users/bulk-status`
    - Auth: Admin-only; org-scoped.
    - Request: `[{ userId: UUID, newStatus: 'pending_approval' | 'active' | 'inactive' }]` (1–100 items).
    - Response: `{ results: [{ userId, success: boolean, error?: string }], successCount: number, failureCount: number }`.
    - Behavior: All updates must be within the caller's organization; reject cross-org updates. Validate in one pre-check and update in one `UPDATE ... CASE` statement; do not fail the entire request due to some invalid items.

### 9) Acceptance Criteria (Examples)
- Access Control
    - WHEN a non-admin visits `/org-management`
      THEN they are redirected to `/access-denied`.
    - WHEN an admin visits `/org-management`
      THEN the page renders with tabs visible.
- Routing/Navigation
    - WHEN a user visits `/department-management`
      THEN the route is not available; the sidebar shows "組織管理" linking to `/org-management`.
- User Status (single)
    - WHEN an admin clicks status toggle button on a `pending_approval` user
      THEN it becomes `active` without a confirmation modal.
    - WHEN an admin attempts to set an `active` user to `inactive`
      THEN a confirmation modal appears; on confirm, status changes to `inactive`.
- User Status (bulk)
    - WHEN an admin submits up to 100 status changes to `PATCH /api/v2/users/bulk-status`
      THEN only users in the same organization are processed; results return per-item success/failure.
- Department Delete
    - GIVEN a department with active users
      WHEN admin attempts delete
      THEN deletion is blocked with instructions to transfer/remove users first.
    - GIVEN a department with zero active users
      WHEN admin confirms in modal
      THEN the department is deleted successfully.
- Role User Count
    - WHEN admin clicks a role's user count
      THEN a modal shows all users that have that role; admin can add/remove that role for users (multi-role supported).
