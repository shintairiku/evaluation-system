# Frontend Architecture & Coding Rules

This repo’s frontend is **Next.js App Router (Next 15) + React 19** with a **server-first** data model.

This document is the engineer-facing summary of the rules we follow for **performance + maintainability**.

Authoritative performance refactor spec:

- `.kiro/specs/.refactor-perf/02_frontend-data-fetch-and-ui.md`

---

## Directory map (high-level)

```text
frontend/
  src/
    app/                    # Next.js routes (router-only)
    feature/                # Page features (page → display → views/components → hooks/utils)
    components/             # App-wide reusable UI (not domain-specific)
    api/                    # Endpoints + Server Actions + types + caching utilities
    context/                # App contexts (thin, prefer loader-provided data)
    hooks/                  # App-wide hooks (domain/page hooks belong in feature/*/hooks)
    styles/                 # Global and shared styles
    utils/                  # Cross-cutting utilities (avoid feature-specific helpers here)
```

Rule of thumb:

- **Page-specific** UI/state → `src/feature/<page>/**`
- **Shared across user pages only** → `src/feature/user-shared/**`
- **Shared across unrelated pages** → `src/components/**`

---

## App Router rules (`src/app/**`)

### Router-only pages
`app/**/page.tsx` should be a thin entrypoint:

- Delegates to a server route component in `src/feature/**/display/*Route.tsx`
- Does not implement business logic or multi-step data fetching

### Dynamic vs static

- Default to **static/ISR** for pages that do not depend on auth.
- Pages that call `auth()` become dynamic; avoid global `force-dynamic` unless required.
- Keep dynamic rendering **scoped** to the smallest route group/layout possible.

---

## Data fetching rules (performance)

### One page = one loader
Each core screen should have **one** main server action that returns everything needed for initial render.

- Put page loaders in `src/api/server-actions/page-loaders.ts` (cross-domain) or a domain folder (e.g. `src/api/server-actions/users/page-loaders.ts`).
- Loader output must be **serializable** (plain objects/arrays).
- Client components should receive loader output via props/context; avoid “client waterfalls” of server-action calls.

### BFF lives in server actions
Aggregation, caching, and revalidation belong in server actions:

```text
React UI → server-actions → endpoints → HTTP client → backend
```

Reference:

- `src/api/README.md`
- `.kiro/specs/.refactor-perf/02_frontend-data-fetch-and-ui.md`

### Org context caching
Org slug/context should be memoized per request to avoid repeated JWT parsing and redundant lookups.

---

## Module ownership (`src/feature/**`)

Preferred hierarchy:

```text
feature/<domain-or-page>/
  display/                  # server entries + view shells
  components/               # leaf UI unique to this page
  hooks/                    # page-specific hooks
  utils/                    # page-specific utilities
```

If a component becomes shared:

- Used by multiple user surfaces only → move to `feature/user-shared/**`
- Used outside user surfaces → move to `components/**`

---

## API layer rules (`src/api/**`)

### Standard pattern

- `endpoints/**` are thin HTTP wrappers (no UI/state).
- `server-actions/**` expose typed read/write actions, caching, and revalidation.
- `types/**` mirrors backend schemas and server-action contracts.

See:

- `src/api/README.md`
- `src/api/server-actions/README.md`

### Users (example domain)

- User BFF: `src/api/server-actions/users/**` (see its README)
- User feature shared UI/state: `src/feature/user-shared/**`
- Folder rules for the user directory refactor: `docs/temp-user-directory-refactor-structure.md`

---

## Conventions (enforced)

- TypeScript: **2-space** indents; PascalCase components; camelCase utilities.
- Tailwind ordering: layout → spacing → typography.
- Simplicity: prefer descriptive names over comments; avoid clever abstractions.

