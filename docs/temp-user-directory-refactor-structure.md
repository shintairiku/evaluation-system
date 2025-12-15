# User-Related Frontend Refactor – Target Folder Structure

Scope for this revision (refactor-only):

- `/user-profiles` page (user directory for all roles)
- `/org-management` **Users** tab (admin bulk/inline edits)
- User-only shared UI/state/types used by both surfaces.

Primary purpose is **refactoring to improve performance and maintainability**, not adding new user features. Behavior, UX, and API contracts should remain stable unless required for performance.

Dashboard-only code remains out of scope.

---

## Update log

- **2025-12-12:** Added v2 `GET /users/me` and migrated current-user context to v2-only. Refreshed “current snapshot” below to reflect actual folder layout after the refactor steps completed so far.

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
    users.ts                # thin REST wrappers (v1 + v2, incl. v2 users/me)
    profile-options.ts      # departments/roles/stages/selectable users (if separate)

  server-actions/
    users/
      queries.ts            # getUsersPageAction, getUsersForOrgChartAction, searchUsersAction, getCurrentUserAction...
      mutations.ts          # create/update/delete, updateUserStage(s), bulkUpdateUserStatusesAction...
      page-loaders.ts       # getUserDirectoryBasePageDataAction (shared loader)
      index.ts              # public exports for user surfaces

  types/
    user.ts                 # UserDetailResponse, UserListPageResponse, ProfileOptionsResponse...
    page-loaders.ts         # UserDirectoryBasePageData (shared shape)
```

Notes:

- Splitting `users.ts` into `queries.ts` / `mutations.ts` is optional, but helps keep BFF intent clear.
- Page loaders should only compose other server actions and return a stable “page data” type.

---

## 3. Feature / UI Layer (target)

This aligns with the existing `feature/` root but clarifies the page→tab→component hierarchy and shared-user code placement.

```text
frontend/src/feature/
  user-profiles/                       # page feature for /user-profiles
    display/                           # server entries + view shells
      UserProfilesRoute.tsx            # server route root for the page
      UserProfilesDataLoader.tsx       # calls getUserDirectoryBasePageDataAction
      views/                           # view-mode “tabs”
        UserTableView.tsx
        UserGalleryView.tsx
        UserOrganizationView.tsx
    components/                        # leaf UI unique to this page
      UserSearch.tsx
      ViewModeSelector.tsx
      UserEditViewModal.tsx
      HierarchyDisplayCard.tsx
      OrganizationNodes.tsx
    hooks/
      useUserDirectoryState.ts         # filters/search/pagination/view mode
      useViewMode.ts
      useOrganizationLayout.ts
    utils/
      hierarchyLayoutUtils.ts
      mapToSimpleUser.ts
    data/
      dummy-users.json                 # delete when APIs fully wired

  org-management/                      # page feature for /org-management
    OrgManagementRoute.tsx             # server route root
    OrgManagementContainer.tsx         # client tab controller
    OrgManagementView.tsx              # presentational tab layout
    tabs/                              # page-level tabs (current *-management-tab folders map here)
      users/                           # current user-management-tab
        UsersTab.tsx                   # tab root
        components/
          UserBulkStatusBar.tsx
          StatusBadge.tsx
          ...inline edit cells/rows
        hooks/
          useUsersTabState.ts          # selection, bulk ops, optimistic updates
      roles/                           # current role-management-tab
      departments/                     # current department-management-tab
      permissions/                     # current permission-management-tab

  user-shared/                         # shared only among user pages/tabs
    components/                        # user-specific reusable UI
      UserAvatar.tsx
      UserStatusBadge.tsx
      UserRoleSelector.tsx
      DepartmentSelect.tsx
      StageSelect.tsx
    hooks/
      useProfileOptions.ts             # reads ProfileOptionsContext or loader-provided options
      useUserSearchParams.ts
    context/
      ProfileOptionsContext.tsx        # move here if it stays user-only
    utils/
      userMappers.ts
      userValidation.ts
```

Notes:

- You can keep existing `feature/org-management/user-management-tab` etc. during the refactor; the `tabs/*` layout is the target end state.
- If a user-shared component becomes truly app-wide (used outside user pages), promote it to `frontend/src/components/**`.

### Current snapshot (as of 2025-12-12)

This is the **current** structure after the refactor work to date. Remaining gaps vs target are listed inline.

```text
frontend/src/feature/
  user-profiles/
    components/
      UserSearch.tsx
      ViewModeSelector.tsx
      UserEditViewModal.tsx
      HierarchyDisplayCard.tsx
      OrganizationNodes.tsx
    data/
      dummy-users.json                  # still present; remove once APIs fully wired
    display/
      UserProfilesRoute.tsx
      UserProfilesDataLoader.tsx
      UserManagementWithSearch.tsx      # view shell (target: fold into views/)
      OrganizationViewContainer.tsx     # legacy shell
      OrganizationViewWithOrgChart.tsx
      ReadOnlyOrganizationView.tsx
      views/
        UserTableView.tsx
        UserGalleryView.tsx
        UserOrganizationView.tsx
    hooks/
      useViewMode.ts
      useOrganizationLayout.ts          # useUserDirectoryState.ts still pending
    utils/
      hierarchyLayoutUtils.ts
      mapToSimpleUser.ts

  org-management/
    OrgManagementRoute.tsx
    OrgManagementContainer.tsx
    OrgManagementView.tsx
    tabs/
      users/
        UsersTab.tsx
        UserBulkStatusBar.tsx
        StatusBadge.tsx
      roles/
        RolesTab.tsx
      departments/
        DepartmentsTab.tsx
      permissions/
        PermissionsTab.tsx
        RolePermissionMatrix.tsx
        ViewerVisibilityPanel.tsx

  user-shared/
    context/
      ProfileOptionsContext.tsx
    hooks/
      useProfileOptions.ts              # user-shared/components+utils pending as needed
```

---

## 4. Backend Endpoints Consumed by the BFF (v2 reference)

- `GET /api/v2/org/{org_slug}/users/page`  
  Primary list endpoint for both `/user-profiles` and Users tab. Returns users + meta + filters.

- `PATCH /api/v2/org/{org_slug}/users/bulk-status`  
  Bulk status mutation for Users tab.

- `GET /api/v2/org/{org_slug}/users/me`  
  Current authenticated user. Used by global “current user context” to avoid v1 auth hops.

- `GET /api/v2/org/{org_slug}/users/org-chart`  
  Org chart dataset for the organization view. **Status:** still served via v1 in backend; frontend currently uses v1 `/users/org-chart` until promoted to v2.

Backend services/schemas remain as in the prior refactor specs; this doc only clarifies frontend folder and BFF placement for a performance‑focused refactor.
