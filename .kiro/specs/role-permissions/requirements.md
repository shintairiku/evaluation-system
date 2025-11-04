# Requirements: Role Permissions & Viewer Visibility

## 0. hand-wirtten Requirements
- As admin user, I want to select the permissions for each role; currently, engineers manually select permissions and assign each role, but admin should be able to select permissions for each role.
- As admin user, only applying to "viewer" role, I want to select the users who can view the data of other users. for example, manager and supervisor can view the data of their subordinates, but they can also view the data of other users. Those other users should be specified from the user list by the admin user.

## 1. Overview
This initiative introduces admin-managed role permissions and fine-grained viewer visibility. Today, engineers edit static mappings (backend/app/security/permissions.py). Admin users must be able to configure which permissions each role has, and explicitly grant which users a Viewer can see beyond their own data. The change should preserve existing RBAC behavior (managers/supervisors can see subordinates) while enabling dynamic configuration, org-scoped persistence, and safe rollout with auditability. There is no new standalone page; place the UI under `/org-management` as a new Permissions (権限) tab.

## 2. Requirements List

### Requirement 1: Admin-Managed Role Permissions (under /org-management → Permissions tab)

**User Story:**
> As an Admin, I want to view and update the permissions assigned to each role so I can manage access without code changes.

**Acceptance Criteria:**
```gherkin
WHEN an Admin opens /org-management and selects the Permissions (権限) tab
THEN the system shows all roles and their assigned permissions (read-only for non-admins)

WHEN an Admin selects a role
AND toggles one or more permissions
AND clicks Save
THEN the changes are persisted org-wide and take effect for subsequent authorization checks

WHEN a permission set is updated
THEN permission caches are invalidated within ≤ 5 seconds
AND an audit record is created with actor, role, added/removed permissions, timestamp

WHEN conflicting updates occur (concurrent Admin edits)
THEN the system rejects stale writes and prompts the user to refresh (optimistic concurrency)

WHEN a network or server error occurs on Save
THEN the UI shows a descriptive error and does not partially persist changes
```

### Requirement 2: Viewer Visibility Overrides (Viewer Only, resource-scoped; supports user/department/team)

**User Story:**
> As an Admin, I want to specify which additional users a Viewer can see so that certain Viewers can read the data of explicitly allowed users.

Notes and assumptions:
- Applies only to Viewer; Manager/Supervisor visibility (subordinates) remains unchanged.
- Overrides are org-scoped and additive to the Viewer’s default “self-only” access.
- Each override specifies both target scope (individual user, department, or team) and the resource type it grants read access to (e.g., Goal, Evaluation, Assessment). Example: allow viewing selected users’ Goals but not Stage or detailed profile.

**Acceptance Criteria:**
```gherkin
WHEN an Admin edits a Viewer’s visibility in /org-management → Permissions (権限)
THEN the UI provides selectors for Target Type (user/department/team), target(s), and Data Type (Goal/Evaluation/Assessment/...)

WHEN an override (Viewer V, Targets T, Resource=Goal) is saved
THEN V can read Goals for T but cannot read unrelated resources (e.g., Stage) unless also granted

WHEN an Admin removes user A from Viewer V’s allowed targets
THEN V immediately loses read access to A’s data after cache invalidation (≤ 5s)

WHEN a non-Admin attempts to modify a Viewer’s visibility list
THEN the system denies the action with a 403 and shows an appropriate message

WHEN the Admin saves changes
THEN the system writes an audit log entry (actor, viewer_id, targets, resource_type, added[], removed[], timestamp)

WHEN a Viewer has no overrides
THEN the effective scope remains self-only (no implicit department/team access)
```

### Requirement 3: Defaults from permissions.py and Clone/Copy

**User Story:**
> As an Admin, I can initialize and copy permission sets from an existing role (e.g., Manager or Viewer) so setup is fast and consistent.

**Acceptance Criteria:**
```gherkin
GIVEN a new organization or first migration
WHEN defaults are seeded
THEN each role’s permissions match backend/app/security/permissions.py (Permission enum + ROLE_PERMISSIONS)

WHEN Admin selects "Clone from role X" for role Y on the Permissions tab
THEN Y’s permissions are replaced by X’s current set after confirmation
```

### Requirement 4: Backward Compatibility & Rollout

**User Story:**
> As a Platform Engineer, I want a safe rollout that preserves current behavior until Admin configuration is enabled.

**Acceptance Criteria:**
```gherkin
GIVEN the dynamic permissions feature flag is OFF
WHEN authorization checks run
THEN the system uses the existing static PermissionManager mapping

GIVEN the feature flag is ON
WHEN authorization checks run
THEN the system uses DB-backed role-permission assignments with a fallback to static defaults if no DB rows exist

GIVEN a migration is executed
WHEN the service boots
THEN default role-permission rows are seeded to match current static mapping
```

### Requirement 5: Non-Functional Requirements

**Requirements:**
- Performance: 95th percentile authorization checks complete in ≤ 5 ms with warm cache; ≤ 50 ms cold.
- Security: Only Admin can mutate role-permission assignments and viewer overrides; all writes audited.
- Observability: Emit structured logs on writes and cache invalidations; include org_id, role, actor.
- Multitenancy: All data org-scoped; no cross-organization reads or writes.
- Reliability: Atomic updates; optimistic concurrency to prevent last-write-wins issues.

**Acceptance Criteria:**
```gherkin
GIVEN 100 concurrent Admin updates to different roles
WHEN requests complete
THEN all persisted states are consistent and audit entries exist

GIVEN 1000 RPS of authorization checks
WHEN caches are warm
THEN p95 latency ≤ 5 ms and error rate < 0.1%
```

---

## Appendix A: Decisions
- Viewer overrides support groups: department and team (in addition to individuals).
- No time-bounded overrides in v1.
- Admin can clone/copy permission sets from existing roles.

## Appendix B: Out of Scope (v1)
- Editing Manager/Supervisor subordinate visibility logic
- Cross-organization sharing
- Bulk import/export of permission matrices
