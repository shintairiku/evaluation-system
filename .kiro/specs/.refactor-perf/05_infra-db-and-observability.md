# Infra, Database & Observability – Performance Refactor

## 1. Current State (High-Level)

- Local dev and production share a single Supabase database (different organizations for isolation).
- Backend runs on Cloud Run; frontend on Vercel or containerized via `docker-compose-prod.yml`.
- DB connection is async SQLAlchemy with environment-aware pooling (`app/database/session.py`).
- There is basic logging for slow requests and errors, but no unified performance dashboard in the codebase.

## 2. Main Problems / Bottlenecks (To Detail)

- Local development always goes over the network to Supabase, making “local is slow” a common pain point.
- Cloud Run cold starts and low concurrency settings can amplify the perceived slowness of chatty pages.
- Lack of standardized metrics (p95 per endpoint, per-page server action timings) makes it hard to prioritize work.

## 3. Goals

- Make performance characteristics visible (endpoints, server actions, DB queries).
- Ensure DB schema and indexes match real query patterns as the system grows.
- Tune Cloud Run / Vercel / Docker configs for realistic concurrency and resource usage.

## 4. Proposed Direction (Outline)

- Add lightweight, code-level instrumentation:
  - Backend: middleware/service decorators to log duration, row counts, and key parameters for hot paths.
  - Frontend: measure server action durations for main pages and surface them in logs/dashboards.
- Review and adjust Cloud Run settings (concurrency, CPU, memory) and autoscaling for backend.
- Periodically review query plans for top N endpoints and adjust indexes/migrations where necessary.
- Consider introducing a simple metrics sink (e.g. Cloud Monitoring, OpenTelemetry) for long-term trending.

## 5. Open Questions

- Do we want a dedicated staging DB or keep a single multi-tenant DB for all environments?
- What SLOs should we commit to (e.g. p95 < X ms for key endpoints)?
- Which external monitoring/alerting stack will we standardize on (Cloud native vs third-party)?

