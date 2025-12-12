# User-Related Frontend Refactor – Target Folder Structure

Scope for this revision (refactor-only):

- `/user-profiles` page (user directory for all roles)
- `/org-management` **Users** tab (admin bulk/inline edits)
- User-only shared UI/state/types used by both surfaces.

Primary purpose is **refactoring to improve performance and maintainability**, not adding new user features. Behavior, UX, and API contracts should remain stable unless required for performance.

Dashboard-only code remains out of scope.

---

## 0. Principles (Performance Refactor + BFF + UI)

- **Router-only pages:** `app/**/page.tsx` delegates to a feature route component; no UI logic, no multi-action fetching.
- **One user page = one loader:** each user-facing page/tab starts from a single page-level server action that returns the full initial dataset.
- **Frontend BFF lives in server actions:** `api/server-actions/**` aggregates backend v2 endpoints, handles caching/revalidation, and exposes typed read/write actions. No React state or UI concerns in this layer.
- **Feature modules own UI:** page‑specific components stay inside that page feature; cross‑user‑page pieces live in a user‑shared feature; app‑wide primitives stay in `src/components/**`.
- **Hierarchy is explicit:** `page feature -> tab/view -> leaf components -> hooks/utils`.
- **Refactor, don’t expand:** avoid net‑new features; prefer consolidation, caching, batching, and removing redundant fetches.
- **Backend work is v2-only:** create or update user endpoints under `/v2/**`; do not add new v1 routes. Any remaining v1 usage is legacy and should be migrated to v2 where practical.

---

## 1. App Router Layer (Next.js `app/`) – unchanged

- `frontend/src/app/(evaluation)/user-profiles/page.tsx`  
  Router-only entry for `/user-profiles`, delegating to the User Directory feature.

- `frontend/src/app/(evaluation)/(admin)/org-management/page.tsx`  
  Router-only entry for `/org-management`, delegating to Org Management feature (including Users tab).

---

## 2. Frontend BFF & Types (target)

Keep all user BFF code grouped so both `/user-profiles` and Users tab reuse the same contract.

```text
frontend/src/api/
  endpoints/
    users.ts                # thin REST wrappers (v1 legacy + v2 primary)
    departments.ts          # existing option sources used by user pages
    roles.ts
    stages.ts

  server-actions/
    users.ts                # existing: all user read/write actions
    page-loaders.ts         # existing: shared loaders incl. getUserDirectoryBasePageDataAction
    users/                  # optional decomposition of users.ts (no new exports/features)
      queries.ts            # split from users.ts for read actions
      mutations.ts          # split from users.ts for write actions

  types/
    user.ts                 # existing user types
    page-loaders.ts         # UserDirectoryBasePageData (shared shape)
```

Notes:

- The `server-actions/users/` folder is **optional** and only for splitting the current `users.ts` by responsibility; it must not introduce new BFF capabilities.
- Page loaders should only compose existing server actions and return stable “page data” types.

---

## 3. Feature / UI Layer (target, based on existing files)

This mirrors the current `feature/` tree and only suggests **moves/renames or decompositions** of existing files (no new user features).

```text
frontend/src/feature/
  user-profiles/                         # /user-profiles page feature
    display/                             # server entries + view shells
      UserProfilesDataLoader.tsx         # server root; uses getUserDirectoryBasePageDataAction
      UserManagementWithSearch.tsx       # client shell for search + view switching
      UserTableView.tsx                  # view mode: table
      UserGalleryView.tsx                # view mode: gallery
      UserOrganizationView.tsx           # view mode: org chart
      OrganizationViewWithOrgChart.tsx
      OrganizationViewContainer.tsx
      ReadOnlyOrganizationView.tsx
      ViewModeSelector.tsx               # view-mode tabs
      UserEditViewModal.tsx              # edit modal
    components/                          # leaf UI unique to this page
      UserSearch.tsx
      HierarchyDisplayCard.tsx
      OrganizationNodes.tsx
    hooks/
      useViewMode.ts
      useOrganizationLayout.ts
      useUserDirectoryState.ts           # optional extraction from existing state
    utils/
      hierarchyLayoutUtils.ts
      mapToSimpleUser.ts
    data/
      dummy-users.json

  org-management/                        # /org-management page feature
    OrgManagementContainer.tsx           # client tab controller
    OrgManagementView.tsx                # presentational tab layout
    index.ts
    user-management-tab/                 # Users tab (current folder)
      UsersTab.tsx
      UserBulkStatusBar.tsx
      StatusBadge.tsx
      components/                        # optional decompositions from UsersTab.tsx
      hooks/                             # optional decompositions from UsersTab.tsx
    role-management-tab/
      RolesTab.tsx
    department-management-tab/
      DepartmentsTab.tsx
    permission-management-tab/
      PermissionsTab.tsx
      RolePermissionMatrix.tsx
      ViewerVisibilityPanel.tsx
      __tests__/
        RolePermissionMatrix.card.test.tsx
```

Notes:

- `useUserDirectoryState.ts` is **optional** and should be created only by extracting state logic already present across the current directory views.
- There is no dedicated `feature/user-shared/` today. If you extract user-only shared pieces from existing files, add that folder later and move only decomposed code there (no new features).
- If an extracted piece becomes app-wide (used outside user pages), promote it to `frontend/src/components/**`.

---

## 4. Backend Endpoints Consumed by the BFF (v2 reference)

- `GET /v2/{org_slug}/users/page`  
  Primary list endpoint for both `/user-profiles` and Users tab. Returns users + meta + filters.

- `PATCH /v2/{org_slug}/users/bulk-status`  
  Bulk status mutation for Users tab.

- `GET /v2/{org_slug}/users/org-chart`  
  Org chart dataset for the organization view. If this v2 route doesn’t exist yet, promote the existing v1 handler to v2 and keep v1 as legacy/compat only.

Backend services/schemas remain as in the prior refactor specs; this doc only clarifies frontend folder and BFF placement for a performance‑focused refactor.
