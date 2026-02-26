#!/usr/bin/env python3
"""
Comprehensive evaluation smoke flow.

Runs a minimal end-to-end service workflow against the configured database:
1) Read settings
2) Read list
3) Update settings (idempotent update using current payload)
4) Upsert manual decision
5) Read history
6) Clear manual decision
7) Read history again
"""

import asyncio
from sqlalchemy import text

from app.database.session import AsyncSessionLocal
from app.schemas.comprehensive_evaluation import ComprehensiveManualDecisionUpsertRequest
from app.security.context import AuthContext, RoleInfo
from app.services.comprehensive_evaluation_service import ComprehensiveEvaluationService


async def run_smoke() -> None:
    async with AsyncSessionLocal() as session:
        org_row = (await session.execute(text("SELECT id, slug FROM organizations ORDER BY id LIMIT 1"))).mappings().first()
        if not org_row:
            raise RuntimeError("No organizations found")
        org_id = org_row["id"]
        org_slug = org_row["slug"]

        period_row = (
            await session.execute(
                text("SELECT id FROM evaluation_periods WHERE organization_id = :org_id ORDER BY created_at DESC LIMIT 1"),
                {"org_id": org_id},
            )
        ).mappings().first()
        if not period_row:
            raise RuntimeError(f"No evaluation periods found for org={org_id}")
        period_id = period_row["id"]

        actor_row = (
            await session.execute(
                text("SELECT id FROM users WHERE clerk_organization_id = :org_id ORDER BY created_at DESC LIMIT 1"),
                {"org_id": org_id},
            )
        ).mappings().first()
        if not actor_row:
            raise RuntimeError(f"No users found for org={org_id}")
        actor_user_id = actor_row["id"]

        target_row = (
            await session.execute(
                text("SELECT id FROM users WHERE clerk_organization_id = :org_id ORDER BY created_at ASC LIMIT 1"),
                {"org_id": org_id},
            )
        ).mappings().first()
        if not target_row:
            raise RuntimeError(f"No target user found for org={org_id}")
        target_user_id = target_row["id"]

        context = AuthContext(
            user_id=actor_user_id,
            roles=[RoleInfo(id=1, name="eval_admin", description="smoke role")],
            organization_id=org_id,
            organization_slug=org_slug,
        )

        service = ComprehensiveEvaluationService(session)

        settings = await service.get_settings(context=context)
        print("smoke:get_settings:ok", len(settings.promotion.rule_groups), len(settings.demotion.rule_groups))

        listing = await service.get_comprehensive_evaluation(
            context=context,
            period_id=period_id,
            department_id=None,
            stage_id=None,
            employment_type=None,
            search=None,
            processing_status=None,
            page=1,
            limit=50,
        )
        print("smoke:list:ok", listing.meta.total, len(listing.rows))

        updated_settings = await service.update_settings(context=context, settings=settings)
        print("smoke:update_settings:ok", len(updated_settings.promotion.rule_groups), len(updated_settings.demotion.rule_groups))

        manual_request = ComprehensiveManualDecisionUpsertRequest(
            periodId=period_id,
            decision="対象外",
            reason="smoke test update",
            doubleCheckedBy="smoke-checker",
        )
        manual = await service.upsert_manual_decision(
            context=context,
            user_id=target_user_id,
            payload=manual_request,
        )
        print("smoke:upsert_manual:ok", str(manual.period_id), manual.decision)

        history = await service.get_manual_decision_history(
            context=context,
            period_id=period_id,
            page=1,
            limit=20,
        )
        print("smoke:history:ok", history.meta.total)

        await service.clear_manual_decision(
            context=context,
            user_id=target_user_id,
            period_id=period_id,
        )
        print("smoke:clear_manual:ok")

        history_after = await service.get_manual_decision_history(
            context=context,
            period_id=period_id,
            page=1,
            limit=20,
        )
        print("smoke:history_after_clear:ok", history_after.meta.total)


if __name__ == "__main__":
    asyncio.run(run_smoke())

