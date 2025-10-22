# Repository Guidelines

## Project Structure & Module Organization
- `frontend/` runs the Next.js client; routes belong in `frontend/src/app`, reusable UI in `frontend/src/components`, and static assets under `frontend/public`.
- `backend/` serves FastAPI; keep endpoints in `backend/app/api`, business logic in `backend/app/services`, and persistence helpers in `backend/app/database`.
- Tests live in `backend/tests` (unit/integration) and `tests/clerk` (Clerk smoke script); architecture and infrastructure notes stay in `docs/` and `supabase/`.

## Build, Test & Development Commands
- `docker-compose up --build` brings up the full stack; add `-d` to detach, and use `docker-compose down` to stop.
- `cd frontend && npm run dev` boots the web app; run `npm run build` for CI and `npm run lint` before pushes.
- `cd backend && uvicorn app.main:app --reload` starts the API; `cd backend && pytest` runs the suite; `python3 tests/clerk/simple-test.py` checks Clerk keys.

## Coding Standards & Naming
- Use 2-space indents for TypeScript, PascalCase components, camelCase utilities, and colocate module styles in `frontend/src/styles`.
- Tailwind utilities read best when ordered layout -> spacing -> typography.
- Python sticks to PEP 8, 4-space indents, annotated interfaces, and dependency wiring through FastAPI routers; keep database/session helpers in `app/dependencies`.

## Testing Expectations
- Mirror module names in `backend/tests/**` (e.g., `test_department_repository.py`) and mark async cases with `pytest.mark.asyncio`.
- Extend `tests/clerk/simple-test.py` whenever auth integration changes.
- Document fixtures and shared mocks in `backend/tests/conftest.py` so new contributors can reuse them.

## Commit & PR Workflow
- Follow Conventional Commit prefixes (`feat:`, `fix:`, `refactor:`, `chore:`) with <=72 character summaries and meaningful bodies over multiple commits.
- Squash WIP commits; each PR should note scope, test evidence (`pytest`, `npm run lint`, container status), linked issue/task, and UI/API artifacts when applicable.
- Request reviewers for every affected surface (frontend, backend, ops) and flag required env or schema changes in the description.

## Environment & Secrets
- Duplicate `.env.sample` to `.env`, plus service-specific files like `frontend/.env.local`; never commit secrets.
- Keep Clerk and Supabase keys in your secret manager and rerun `tests/clerk/simple-test.py` after updates.
- Coordinate infra or deployment edits in `supabase/` or `docs/deployment.md` with DevOps before merge.
