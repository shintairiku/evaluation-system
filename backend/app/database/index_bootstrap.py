"""One-time index bootstrap for hot org-scoped list endpoints.

These indexes are created with IF NOT EXISTS to be safe in shared/dev DBs.
They directly target the slow endpoints called out in
docs/issues/optimize-rbac-and-org-list-endpoints.md.
"""

from sqlalchemy import text

from .session import engine


PERF_INDEX_STATEMENTS = [
    # Users list/search
    """
    CREATE INDEX IF NOT EXISTS ix_users_org_name
    ON users (clerk_organization_id, name)
    """,
    """
    CREATE INDEX IF NOT EXISTS ix_users_org_status
    ON users (clerk_organization_id, status)
    """,
    """
    CREATE INDEX IF NOT EXISTS ix_users_org_stage
    ON users (clerk_organization_id, stage_id)
    """,
    # Role filters
    """
    CREATE INDEX IF NOT EXISTS ix_user_roles_role_id
    ON user_roles (role_id)
    """,
    # Supervisor review pending queue
    """
    CREATE INDEX IF NOT EXISTS ix_supervisor_reviews_supervisor_status_period_subordinate
    ON supervisor_reviews (supervisor_id, status, period_id, subordinate_id)
    """,
    # Stages admin list
    """
    CREATE INDEX IF NOT EXISTS ix_stages_org_name
    ON stages (organization_id, name)
    """,
]


async def ensure_perf_indexes() -> None:
    async with engine.begin() as conn:
        for stmt in PERF_INDEX_STATEMENTS:
            try:
                await conn.execute(text(stmt))
            except Exception as exc:
                message = str(exc)
                # IF NOT EXISTS is not fully race-safe across concurrent startups.
                # Ignore duplicate index creation attempts and proceed.
                if "pg_class_relname_nsp_index" in message or "already exists" in message:
                    continue
                raise
