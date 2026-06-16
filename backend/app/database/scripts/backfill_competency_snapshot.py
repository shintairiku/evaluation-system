"""
Backfill `target_data.competency_snapshot` for existing approved コンピテンシー goals.

Why: the competency display/validation now read a frozen snapshot of the stage's
competencies (captured at goal approval) instead of the user's live stage. Goals
approved before this change have no snapshot, so if the user's stage changed after
the evaluation, their competency results no longer render. This script reconstructs
the snapshot from the competency ids actually present in the evaluation data
(self/supervisor rating_data + goal.competency_ids) — those competencies still exist
in the DB even after a stage change — so historical results render correctly again.

Idempotent: skips goals that already have a snapshot.

Usage (inside the backend container):
    python app/database/scripts/backfill_competency_snapshot.py            # DRY-RUN (no writes)
    python app/database/scripts/backfill_competency_snapshot.py --apply    # writes
"""

import asyncio
import json
import sys

from sqlalchemy import text

from app.database.session import AsyncSessionLocal, engine

DRY_RUN = "--apply" not in sys.argv


async def main() -> None:
    async with AsyncSessionLocal() as s:
        goals = (
            await s.execute(
                text(
                    """
                    SELECT g.id, g.user_id, g.target_data, u.name AS user_name, u.stage_id
                    FROM goals g
                    JOIN public.users u ON u.id = g.user_id
                    WHERE g.goal_category = 'コンピテンシー'
                      AND g.status = 'approved'
                      AND NOT (g.target_data ? 'competency_snapshot')
                    ORDER BY g.updated_at DESC
                    """
                )
            )
        ).mappings().all()

        print(f"Competency goals approved sem snapshot: {len(goals)}  (DRY_RUN={DRY_RUN})")
        updated = 0
        skipped = 0

        for g in goals:
            gid = g["id"]
            td = g["target_data"] or {}

            # Evaluated competency ids = union(self rating_data, supervisor rating_data, goal.competency_ids)
            eval_ids: set[str] = set()
            for rd in (
                await s.execute(
                    text("SELECT rating_data FROM self_assessments WHERE goal_id=:g AND rating_data IS NOT NULL"),
                    {"g": gid},
                )
            ).scalars().all():
                if isinstance(rd, dict):
                    eval_ids.update(str(k) for k in rd.keys())
            for rd in (
                await s.execute(
                    text(
                        """
                        SELECT sf.rating_data FROM supervisor_feedback sf
                        JOIN self_assessments s2 ON s2.id = sf.self_assessment_id
                        WHERE s2.goal_id = :g AND sf.rating_data IS NOT NULL
                        """
                    ),
                    {"g": gid},
                )
            ).scalars().all():
                if isinstance(rd, dict):
                    eval_ids.update(str(k) for k in rd.keys())
            for cid in (td.get("competency_ids") or []):
                eval_ids.add(str(cid))

            # Resolve competencies BY ID (works regardless of current stage); fall back to
            # the user's current stage only when there are no evaluated ids yet.
            if eval_ids:
                comps = (
                    await s.execute(
                        text("SELECT id, name, description FROM competencies WHERE id = ANY(:ids)"),
                        {"ids": list(eval_ids)},
                    )
                ).mappings().all()
                source = "evaluated_ids"
            elif g["stage_id"]:
                comps = (
                    await s.execute(
                        text("SELECT id, name, description FROM competencies WHERE stage_id = :st"),
                        {"st": g["stage_id"]},
                    )
                ).mappings().all()
                source = "current_stage"
            else:
                comps = []
                source = "none"

            if not comps:
                skipped += 1
                print(f"  SKIP goal {gid} ({g['user_name']}): no competencies resolved (eval_ids={len(eval_ids)})")
                continue

            snapshot = {
                "competency_ids": [str(c["id"]) for c in comps],
                "competency_names": {str(c["id"]): c["name"] for c in comps},
                "ideal_action_texts": {str(c["id"]): (c["description"] or {}) for c in comps},
                "stage_id": str(g["stage_id"]) if g["stage_id"] else None,
                "source": f"backfill:{source}",
            }
            print(f"  goal {gid} ({g['user_name']}): {len(comps)} competencies (source={source})")

            if not DRY_RUN:
                await s.execute(
                    text(
                        """
                        UPDATE goals
                        SET target_data = jsonb_set(target_data, '{competency_snapshot}', CAST(:snap AS jsonb)),
                            updated_at = now()
                        WHERE id = :g
                        """
                    ),
                    {"snap": json.dumps(snapshot, ensure_ascii=False), "g": gid},
                )
                updated += 1

        if not DRY_RUN:
            await s.commit()

        print(f"\nDone. Updated={updated} Skipped={skipped} Total={len(goals)} (DRY_RUN={DRY_RUN})")
        if DRY_RUN:
            print("Nenhuma escrita feita. Rode com --apply para gravar.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
