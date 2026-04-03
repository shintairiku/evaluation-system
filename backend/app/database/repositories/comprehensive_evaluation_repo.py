import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Sequence, Tuple
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

class ComprehensiveEvaluationRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_rows(
        self,
        *,
        org_id: str,
        period_id: UUID,
        user_id: Optional[UUID],
        department_id: Optional[UUID],
        stage_id: Optional[UUID],
        employment_type: Optional[str],
        search: Optional[str],
        processing_status: Optional[str],
        page: int,
        limit: int,
    ) -> Tuple[List[Dict[str, Any]], int]:
        offset = (page - 1) * limit
        search_value = search.strip().lower() if search else None
        search_like = f"%{search_value}%" if search_value else None

        sql = text(
            """
            WITH target_users AS (
                SELECT
                    u.id AS user_id,
                    u.employee_code,
                    u.name,
                    d.name AS department_name,
                    s.name AS current_stage,
                    u.level AS current_level,
                    u.department_id,
                    u.stage_id,
                    CASE
                        WHEN EXISTS (
                            SELECT 1
                            FROM user_roles ur
                            JOIN roles r ON r.id = ur.role_id
                            WHERE ur.user_id = u.id
                              AND r.organization_id = :org_id
                              AND lower(r.name) = 'parttime'
                        ) THEN 'parttime'
                        ELSE 'employee'
                    END AS employment_type
                FROM users u
                LEFT JOIN departments d ON d.id = u.department_id
                LEFT JOIN stages s ON s.id = u.stage_id
                WHERE u.clerk_organization_id = :org_id
                  AND (CAST(:user_id AS uuid) IS NULL OR u.id = CAST(:user_id AS uuid))
                  AND (CAST(:department_id AS uuid) IS NULL OR u.department_id = CAST(:department_id AS uuid))
                  AND (CAST(:stage_id AS uuid) IS NULL OR u.stage_id = CAST(:stage_id AS uuid))
                  AND (
                      CAST(:employment_type AS text) IS NULL
                      OR (
                          CASE
                              WHEN EXISTS (
                                  SELECT 1
                                  FROM user_roles ur2
                                  JOIN roles r2 ON r2.id = ur2.role_id
                                  WHERE ur2.user_id = u.id
                                    AND r2.organization_id = :org_id
                                    AND lower(r2.name) = 'parttime'
                              ) THEN 'parttime'
                              ELSE 'employee'
                          END
                      ) = CAST(:employment_type AS text)
                  )
                  AND (
                      CAST(:search_like AS text) IS NULL
                      OR lower(concat_ws(' ', coalesce(u.employee_code, ''), coalesce(u.name, ''), coalesce(d.name, ''), coalesce(s.name, '')))
                         LIKE CAST(:search_like AS text)
                  )
            ),
            goal_feedback AS (
                SELECT
                    g.user_id,
                    g.goal_category,
                    g.weight,
                    g.status AS goal_status,
                    sf.status AS feedback_status,
                    sf.action AS feedback_action,
                    sf.supervisor_rating,
                    sf.supervisor_rating_code
                FROM goals g
                LEFT JOIN self_assessments sa
                  ON sa.goal_id = g.id
                 AND sa.period_id = :period_id
                LEFT JOIN supervisor_feedback sf
                  ON sf.self_assessment_id = sa.id
                 AND sf.period_id = :period_id
                WHERE g.period_id = :period_id
                  AND g.status = 'approved'
                  AND g.user_id IN (SELECT user_id FROM target_users)
            ),
            aggregated AS (
                SELECT
                    tu.user_id,
                    tu.employee_code,
                    tu.name,
                    tu.department_id,
                    tu.stage_id,
                    tu.department_name,
                    tu.employment_type,
                    tu.current_stage,
                    tu.current_level,
                    COALESCE(SUM(gf.weight) FILTER (WHERE gf.goal_category = '業績目標'), 0)::numeric AS performance_weight_percent,
                    COALESCE(SUM(gf.weight) FILTER (WHERE gf.goal_category = 'コンピテンシー'), 0)::numeric AS competency_weight_percent,
                    SUM((gf.supervisor_rating * gf.weight) / 100.0)
                        FILTER (
                            WHERE gf.goal_category = '業績目標'
                              AND gf.feedback_status = 'submitted'
                              AND gf.supervisor_rating IS NOT NULL
                        )::numeric AS performance_score,
                    (
                        SUM(gf.supervisor_rating * gf.weight)
                            FILTER (
                                WHERE gf.goal_category = '業績目標'
                                  AND gf.feedback_status = 'submitted'
                                  AND gf.supervisor_rating IS NOT NULL
                            )
                        /
                        NULLIF(
                            SUM(gf.weight)
                                FILTER (
                                    WHERE gf.goal_category = '業績目標'
                                      AND gf.feedback_status = 'submitted'
                                      AND gf.supervisor_rating IS NOT NULL
                                ),
                            0
                        )
                    )::numeric AS performance_raw_score,
                    SUM(
                        (gf.weight / 5.0) *
                        CASE gf.supervisor_rating_code
                            WHEN 'SS' THEN 5.0 WHEN 'S' THEN 4.0
                            WHEN 'A'  THEN 3.0 WHEN 'B' THEN 2.0
                            WHEN 'C'  THEN 1.0 WHEN 'D' THEN 0.0
                            ELSE 0.0
                        END
                    )
                        FILTER (
                            WHERE gf.goal_category = '業績目標'
                              AND gf.feedback_status = 'submitted'
                              AND gf.supervisor_rating_code IS NOT NULL
                        )::numeric AS mbo_total_100,
                    SUM((gf.supervisor_rating * gf.weight) / 100.0)
                        FILTER (
                            WHERE gf.goal_category = 'コンピテンシー'
                              AND gf.feedback_status = 'submitted'
                              AND gf.supervisor_rating IS NOT NULL
                        )::numeric AS competency_score,
                    AVG(gf.supervisor_rating)
                        FILTER (
                            WHERE gf.goal_category = 'コンピテンシー'
                              AND gf.feedback_status = 'submitted'
                              AND gf.supervisor_rating IS NOT NULL
                        )::numeric AS competency_raw_score,
                    NULL::numeric AS core_value_score,
                    (
                        SELECT AVG(source_avg) FROM (
                            -- Supervisor evaluation
                            SELECT AVG(
                                CASE j.value
                                    WHEN 'SS' THEN 7.0 WHEN 'S' THEN 6.0
                                    WHEN 'A+' THEN 5.0 WHEN 'A' THEN 4.0
                                    WHEN 'A-' THEN 3.0 WHEN 'B' THEN 2.0
                                    WHEN 'C' THEN 1.0
                                END
                            ) AS source_avg
                            FROM core_value_evaluations cve_sup
                            JOIN core_value_feedback cvf
                              ON cvf.core_value_evaluation_id = cve_sup.id
                              AND cvf.status = 'submitted'
                              AND cvf.action = 'APPROVED'
                            CROSS JOIN jsonb_each_text(cvf.scores) AS j(key, value)
                            WHERE cve_sup.period_id = :period_id
                              AND cve_sup.user_id = tu.user_id

                            UNION ALL

                            -- Peer evaluations (each peer = separate row)
                            SELECT AVG(
                                CASE j.value
                                    WHEN 'SS' THEN 7.0 WHEN 'S' THEN 6.0
                                    WHEN 'A+' THEN 5.0 WHEN 'A' THEN 4.0
                                    WHEN 'A-' THEN 3.0 WHEN 'B' THEN 2.0
                                    WHEN 'C' THEN 1.0
                                END
                            ) AS source_avg
                            FROM peer_review_assignments pra
                            JOIN peer_review_evaluations pre
                              ON pre.assignment_id = pra.id
                              AND pre.status = 'submitted'
                            CROSS JOIN jsonb_each_text(pre.scores) AS j(key, value)
                            WHERE pra.period_id = :period_id
                              AND pra.reviewee_id = tu.user_id
                            GROUP BY pre.id
                        ) sources
                        HAVING COUNT(source_avg) = 3
                    )::numeric AS core_value_raw_score
                FROM target_users tu
                LEFT JOIN goal_feedback gf
                  ON gf.user_id = tu.user_id
                GROUP BY
                    tu.user_id,
                    tu.employee_code,
                    tu.name,
                    tu.department_id,
                    tu.stage_id,
                    tu.department_name,
                    tu.employment_type,
                    tu.current_stage,
                    tu.current_level
            ),
            with_manual AS (
                SELECT
                    a.user_id,
                    a.employee_code,
                    a.name,
                    a.department_id,
                    a.stage_id,
                    a.department_name,
                    a.employment_type,
                    CASE
                        WHEN cps.user_id IS NOT NULL
                            THEN 'processed'
                        ELSE 'unprocessed'
                    END AS processing_status,
                    ROUND(a.performance_weight_percent, 2)::numeric AS performance_weight_percent,
                    ROUND(a.competency_weight_percent, 2)::numeric AS competency_weight_percent,
                    ROUND(a.performance_score, 2)::numeric AS performance_score,
                    ROUND(a.performance_raw_score, 2)::numeric AS performance_raw_score,
                    ROUND(a.mbo_total_100, 2)::numeric AS mbo_total_100,
                    ROUND(a.competency_score, 2)::numeric AS competency_score,
                    ROUND(a.competency_raw_score, 2)::numeric AS competency_raw_score,
                    ROUND(a.core_value_score, 2)::numeric AS core_value_score,
                    ROUND(a.core_value_raw_score, 2)::numeric AS core_value_raw_score,
                    a.current_stage,
                    a.current_level,
                    md.decision AS manual_decision,
                    md.stage_after AS manual_stage_after,
                    md.level_after AS manual_level_after,
                    md.reason AS manual_reason,
                    NULLIF(md.double_checked_by, '') AS manual_double_checked_by,
                    md.applied_by_user_id AS manual_applied_by_user_id,
                    md.applied_at AS manual_applied_at
                FROM aggregated a
                LEFT JOIN comprehensive_processing_statuses cps
                  ON cps.organization_id = :org_id
                 AND cps.period_id = :period_id
                 AND cps.user_id = a.user_id
                LEFT JOIN comprehensive_manual_decisions md
                  ON md.organization_id = :org_id
                 AND md.period_id = :period_id
                 AND md.user_id = a.user_id
            )
            SELECT
                concat(CAST(:period_id AS text), ':', wm.user_id::text) AS id,
                wm.user_id,
                wm.employee_code,
                wm.name,
                wm.department_id,
                wm.stage_id,
                wm.department_name,
                wm.employment_type,
                wm.processing_status,
                wm.performance_weight_percent,
                wm.competency_weight_percent,
                wm.performance_score,
                wm.performance_raw_score,
                wm.mbo_total_100,
                wm.competency_score,
                wm.competency_raw_score,
                wm.core_value_score,
                wm.core_value_raw_score,
                wm.current_stage,
                wm.current_level,
                wm.manual_decision,
                wm.manual_stage_after,
                wm.manual_level_after,
                wm.manual_reason,
                wm.manual_double_checked_by,
                wm.manual_applied_by_user_id,
                wm.manual_applied_at,
                COUNT(*) OVER()::integer AS total_count
            FROM with_manual wm
            WHERE (CAST(:processing_status AS text) IS NULL OR wm.processing_status = CAST(:processing_status AS text))
            ORDER BY wm.employee_code ASC, wm.user_id ASC
            OFFSET :offset
            LIMIT :limit
            """
        )

        params = {
            "org_id": org_id,
            "period_id": period_id,
            "user_id": user_id,
            "department_id": department_id,
            "stage_id": stage_id,
            "employment_type": employment_type,
            "search_like": search_like,
            "processing_status": processing_status,
            "offset": offset,
            "limit": limit,
        }

        result = await self.session.execute(sql, params)
        records = [dict(row._mapping) for row in result.fetchall()]

        total = int(records[0]["total_count"]) if records else 0
        for record in records:
            record.pop("total_count", None)

        return records, total

    async def list_rulesets(self, *, org_id: str) -> List[Dict[str, Any]]:
        result = await self.session.execute(
            text(
                """
                SELECT
                    id,
                    name,
                    settings_json,
                    is_default_template,
                    created_at,
                    updated_at
                FROM comprehensive_rulesets
                WHERE organization_id = :organization_id
                ORDER BY is_default_template DESC, lower(name) ASC, created_at ASC
                """
            ),
            {"organization_id": org_id},
        )
        return [self._normalize_record(dict(row._mapping)) for row in result.fetchall()]

    async def get_ruleset_by_id(self, *, org_id: str, ruleset_id: UUID) -> Optional[Dict[str, Any]]:
        result = await self.session.execute(
            text(
                """
                SELECT
                    id,
                    name,
                    settings_json,
                    is_default_template,
                    created_at,
                    updated_at
                FROM comprehensive_rulesets
                WHERE organization_id = :organization_id
                  AND id = :ruleset_id
                """
            ),
            {"organization_id": org_id, "ruleset_id": ruleset_id},
        )
        row = result.fetchone()
        return self._normalize_record(dict(row._mapping)) if row else None

    async def get_ruleset_by_name(self, *, org_id: str, name: str) -> Optional[Dict[str, Any]]:
        result = await self.session.execute(
            text(
                """
                SELECT
                    id,
                    name,
                    settings_json,
                    is_default_template,
                    created_at,
                    updated_at
                FROM comprehensive_rulesets
                WHERE organization_id = :organization_id
                  AND name = :name
                """
            ),
            {"organization_id": org_id, "name": name},
        )
        row = result.fetchone()
        return self._normalize_record(dict(row._mapping)) if row else None

    async def get_default_ruleset(self, *, org_id: str) -> Optional[Dict[str, Any]]:
        result = await self.session.execute(
            text(
                """
                SELECT
                    id,
                    name,
                    settings_json,
                    is_default_template,
                    created_at,
                    updated_at
                FROM comprehensive_rulesets
                WHERE organization_id = :organization_id
                  AND is_default_template = TRUE
                LIMIT 1
                """
            ),
            {"organization_id": org_id},
        )
        row = result.fetchone()
        return self._normalize_record(dict(row._mapping)) if row else None

    async def count_rulesets(self, *, org_id: str) -> int:
        result = await self.session.execute(
            text(
                """
                SELECT COUNT(*) AS count
                FROM comprehensive_rulesets
                WHERE organization_id = :organization_id
                """
            ),
            {"organization_id": org_id},
        )
        row = result.fetchone()
        return int(row._mapping["count"]) if row else 0

    async def create_ruleset(
        self,
        *,
        org_id: str,
        name: str,
        settings_json: Dict[str, Any],
        is_default_template: bool,
    ) -> Dict[str, Any]:
        now = datetime.now(timezone.utc)
        settings_payload = json.dumps(settings_json)

        if is_default_template:
            await self.session.execute(
                text(
                    """
                    UPDATE comprehensive_rulesets
                    SET is_default_template = FALSE,
                        updated_at = :updated_at
                    WHERE organization_id = :organization_id
                      AND is_default_template = TRUE
                    """
                ),
                {"organization_id": org_id, "updated_at": now},
            )

        result = await self.session.execute(
            text(
                """
                INSERT INTO comprehensive_rulesets (
                    id,
                    organization_id,
                    name,
                    settings_json,
                    is_default_template,
                    created_at,
                    updated_at
                ) VALUES (
                    gen_random_uuid(),
                    :organization_id,
                    :name,
                    CAST(:settings_json AS jsonb),
                    :is_default_template,
                    :created_at,
                    :updated_at
                )
                RETURNING
                    id,
                    name,
                    settings_json,
                    is_default_template,
                    created_at,
                    updated_at
                """
            ),
            {
                "organization_id": org_id,
                "name": name,
                "settings_json": settings_payload,
                "is_default_template": is_default_template,
                "created_at": now,
                "updated_at": now,
            },
        )
        row = result.fetchone()
        return self._normalize_record(dict(row._mapping))

    async def update_ruleset(
        self,
        *,
        org_id: str,
        ruleset_id: UUID,
        name: str,
        settings_json: Dict[str, Any],
        is_default_template: bool,
    ) -> Optional[Dict[str, Any]]:
        now = datetime.now(timezone.utc)
        settings_payload = json.dumps(settings_json)

        if is_default_template:
            await self.session.execute(
                text(
                    """
                    UPDATE comprehensive_rulesets
                    SET is_default_template = FALSE,
                        updated_at = :updated_at
                    WHERE organization_id = :organization_id
                      AND id <> :ruleset_id
                      AND is_default_template = TRUE
                    """
                ),
                {
                    "organization_id": org_id,
                    "ruleset_id": ruleset_id,
                    "updated_at": now,
                },
            )

        result = await self.session.execute(
            text(
                """
                UPDATE comprehensive_rulesets
                SET name = :name,
                    settings_json = CAST(:settings_json AS jsonb),
                    is_default_template = :is_default_template,
                    updated_at = :updated_at
                WHERE organization_id = :organization_id
                  AND id = :ruleset_id
                RETURNING
                    id,
                    name,
                    settings_json,
                    is_default_template,
                    created_at,
                    updated_at
                """
            ),
            {
                "organization_id": org_id,
                "ruleset_id": ruleset_id,
                "name": name,
                "settings_json": settings_payload,
                "is_default_template": is_default_template,
                "updated_at": now,
            },
        )
        row = result.fetchone()
        return self._normalize_record(dict(row._mapping)) if row else None

    async def delete_ruleset(self, *, org_id: str, ruleset_id: UUID) -> bool:
        result = await self.session.execute(
            text(
                """
                DELETE FROM comprehensive_rulesets
                WHERE organization_id = :organization_id
                  AND id = :ruleset_id
                """
            ),
            {"organization_id": org_id, "ruleset_id": ruleset_id},
        )
        return bool(result.rowcount)

    async def list_period_assignments(self, *, org_id: str, period_id: UUID) -> List[Dict[str, Any]]:
        result = await self.session.execute(
            text(
                """
                SELECT
                    a.id,
                    a.period_id,
                    a.department_id,
                    d.name AS department_name,
                    a.stage_id,
                    s.name AS stage_name,
                    a.settings_json,
                    a.source_ruleset_id,
                    a.source_ruleset_name_snapshot,
                    a.created_at,
                    a.updated_at
                FROM comprehensive_ruleset_assignments a
                LEFT JOIN departments d
                  ON d.id = a.department_id
                LEFT JOIN stages s
                  ON s.id = a.stage_id
                WHERE a.organization_id = :organization_id
                  AND a.period_id = :period_id
                ORDER BY
                    CASE
                        WHEN a.department_id IS NULL AND a.stage_id IS NULL THEN 0
                        WHEN a.department_id IS NOT NULL THEN 1
                        ELSE 2
                    END ASC,
                    lower(COALESCE(d.name, s.name, '')) ASC,
                    a.created_at ASC
                """
            ),
            {"organization_id": org_id, "period_id": period_id},
        )
        return [self._normalize_record(dict(row._mapping)) for row in result.fetchall()]

    async def get_assignment(
        self,
        *,
        org_id: str,
        period_id: UUID,
        department_id: Optional[UUID],
        stage_id: Optional[UUID],
    ) -> Optional[Dict[str, Any]]:
        if department_id is not None and stage_id is not None:
            raise ValueError("Only one scoped assignment target can be requested at a time")

        if department_id is None and stage_id is None:
            sql = text(
                """
                SELECT
                    a.id,
                    a.period_id,
                    a.department_id,
                    d.name AS department_name,
                    a.stage_id,
                    s.name AS stage_name,
                    a.settings_json,
                    a.source_ruleset_id,
                    a.source_ruleset_name_snapshot,
                    a.created_at,
                    a.updated_at
                FROM comprehensive_ruleset_assignments a
                LEFT JOIN departments d
                  ON d.id = a.department_id
                LEFT JOIN stages s
                  ON s.id = a.stage_id
                WHERE a.organization_id = :organization_id
                  AND a.period_id = :period_id
                  AND a.department_id IS NULL
                  AND a.stage_id IS NULL
                LIMIT 1
                """
            )
            params = {"organization_id": org_id, "period_id": period_id}
        elif department_id is not None:
            sql = text(
                """
                SELECT
                    a.id,
                    a.period_id,
                    a.department_id,
                    d.name AS department_name,
                    a.stage_id,
                    s.name AS stage_name,
                    a.settings_json,
                    a.source_ruleset_id,
                    a.source_ruleset_name_snapshot,
                    a.created_at,
                    a.updated_at
                FROM comprehensive_ruleset_assignments a
                LEFT JOIN departments d
                  ON d.id = a.department_id
                LEFT JOIN stages s
                  ON s.id = a.stage_id
                WHERE a.organization_id = :organization_id
                  AND a.period_id = :period_id
                  AND a.department_id = :department_id
                  AND a.stage_id IS NULL
                LIMIT 1
                """
            )
            params = {"organization_id": org_id, "period_id": period_id, "department_id": department_id}
        else:
            sql = text(
                """
                SELECT
                    a.id,
                    a.period_id,
                    a.department_id,
                    d.name AS department_name,
                    a.stage_id,
                    s.name AS stage_name,
                    a.settings_json,
                    a.source_ruleset_id,
                    a.source_ruleset_name_snapshot,
                    a.created_at,
                    a.updated_at
                FROM comprehensive_ruleset_assignments a
                LEFT JOIN departments d
                  ON d.id = a.department_id
                LEFT JOIN stages s
                  ON s.id = a.stage_id
                WHERE a.organization_id = :organization_id
                  AND a.period_id = :period_id
                  AND a.department_id IS NULL
                  AND a.stage_id = :stage_id
                LIMIT 1
                """
            )
            params = {"organization_id": org_id, "period_id": period_id, "stage_id": stage_id}

        result = await self.session.execute(sql, params)
        row = result.fetchone()
        return self._normalize_record(dict(row._mapping)) if row else None

    async def create_default_ruleset_if_missing(
        self,
        *,
        org_id: str,
        settings_json: Dict[str, Any],
        name: str = "Default",
    ) -> Dict[str, Any]:
        existing_default = await self.get_default_ruleset(org_id=org_id)
        if existing_default is not None:
            return existing_default

        existing_by_name = await self.get_ruleset_by_name(org_id=org_id, name=name)
        if existing_by_name is not None:
            updated = await self.update_ruleset(
                org_id=org_id,
                ruleset_id=existing_by_name["id"],
                name=existing_by_name["name"],
                settings_json=settings_json,
                is_default_template=True,
            )
            return updated or existing_by_name

        return await self.create_ruleset(
            org_id=org_id,
            name=name,
            settings_json=settings_json,
            is_default_template=True,
        )

    async def ensure_period_default_assignment(
        self,
        *,
        org_id: str,
        period_id: UUID,
        settings_json: Dict[str, Any],
        source_ruleset_id: Optional[UUID],
        source_ruleset_name_snapshot: Optional[str],
    ) -> Dict[str, Any]:
        existing = await self.get_assignment(
            org_id=org_id,
            period_id=period_id,
            department_id=None,
            stage_id=None,
        )
        if existing is not None:
            return existing
        return await self.upsert_default_assignment(
            org_id=org_id,
            period_id=period_id,
            settings_json=settings_json,
            source_ruleset_id=source_ruleset_id,
            source_ruleset_name_snapshot=source_ruleset_name_snapshot,
        )

    async def upsert_default_assignment(
        self,
        *,
        org_id: str,
        period_id: UUID,
        settings_json: Dict[str, Any],
        source_ruleset_id: Optional[UUID],
        source_ruleset_name_snapshot: Optional[str],
    ) -> Dict[str, Any]:
        now = datetime.now(timezone.utc)
        settings_payload = json.dumps(settings_json)

        update_result = await self.session.execute(
            text(
                """
                UPDATE comprehensive_ruleset_assignments
                SET settings_json = CAST(:settings_json AS jsonb),
                    source_ruleset_id = :source_ruleset_id,
                    source_ruleset_name_snapshot = :source_ruleset_name_snapshot,
                    updated_at = :updated_at
                WHERE organization_id = :organization_id
                  AND period_id = :period_id
                  AND department_id IS NULL
                  AND stage_id IS NULL
                RETURNING
                    id,
                    period_id,
                    department_id,
                    stage_id,
                    settings_json,
                    source_ruleset_id,
                    source_ruleset_name_snapshot,
                    created_at,
                    updated_at
                """
            ),
            {
                "organization_id": org_id,
                "period_id": period_id,
                "settings_json": settings_payload,
                "source_ruleset_id": source_ruleset_id,
                "source_ruleset_name_snapshot": source_ruleset_name_snapshot,
                "updated_at": now,
            },
        )
        row = update_result.fetchone()
        if row is not None:
            return self._normalize_record(dict(row._mapping))

        insert_result = await self.session.execute(
            text(
                """
                INSERT INTO comprehensive_ruleset_assignments (
                    id,
                    organization_id,
                    period_id,
                    department_id,
                    stage_id,
                    settings_json,
                    source_ruleset_id,
                    source_ruleset_name_snapshot,
                    created_at,
                    updated_at
                ) VALUES (
                    gen_random_uuid(),
                    :organization_id,
                    :period_id,
                    NULL,
                    NULL,
                    CAST(:settings_json AS jsonb),
                    :source_ruleset_id,
                    :source_ruleset_name_snapshot,
                    :created_at,
                    :updated_at
                )
                RETURNING
                    id,
                    period_id,
                    department_id,
                    stage_id,
                    settings_json,
                    source_ruleset_id,
                    source_ruleset_name_snapshot,
                    created_at,
                    updated_at
                """
            ),
            {
                "organization_id": org_id,
                "period_id": period_id,
                "settings_json": settings_payload,
                "source_ruleset_id": source_ruleset_id,
                "source_ruleset_name_snapshot": source_ruleset_name_snapshot,
                "created_at": now,
                "updated_at": now,
            },
        )
        row = insert_result.fetchone()
        return self._normalize_record(dict(row._mapping))

    async def upsert_department_assignment(
        self,
        *,
        org_id: str,
        period_id: UUID,
        department_id: UUID,
        settings_json: Dict[str, Any],
        source_ruleset_id: Optional[UUID],
        source_ruleset_name_snapshot: Optional[str],
    ) -> Dict[str, Any]:
        now = datetime.now(timezone.utc)
        settings_payload = json.dumps(settings_json)

        update_result = await self.session.execute(
            text(
                """
                UPDATE comprehensive_ruleset_assignments
                SET settings_json = CAST(:settings_json AS jsonb),
                    source_ruleset_id = :source_ruleset_id,
                    source_ruleset_name_snapshot = :source_ruleset_name_snapshot,
                    updated_at = :updated_at
                WHERE organization_id = :organization_id
                  AND period_id = :period_id
                  AND department_id = :department_id
                  AND stage_id IS NULL
                RETURNING
                    id,
                    period_id,
                    department_id,
                    stage_id,
                    settings_json,
                    source_ruleset_id,
                    source_ruleset_name_snapshot,
                    created_at,
                    updated_at
                """
            ),
            {
                "organization_id": org_id,
                "period_id": period_id,
                "department_id": department_id,
                "settings_json": settings_payload,
                "source_ruleset_id": source_ruleset_id,
                "source_ruleset_name_snapshot": source_ruleset_name_snapshot,
                "updated_at": now,
            },
        )
        row = update_result.fetchone()
        if row is not None:
            return self._normalize_record(dict(row._mapping))

        insert_result = await self.session.execute(
            text(
                """
                INSERT INTO comprehensive_ruleset_assignments (
                    id,
                    organization_id,
                    period_id,
                    department_id,
                    stage_id,
                    settings_json,
                    source_ruleset_id,
                    source_ruleset_name_snapshot,
                    created_at,
                    updated_at
                ) VALUES (
                    gen_random_uuid(),
                    :organization_id,
                    :period_id,
                    :department_id,
                    NULL,
                    CAST(:settings_json AS jsonb),
                    :source_ruleset_id,
                    :source_ruleset_name_snapshot,
                    :created_at,
                    :updated_at
                )
                RETURNING
                    id,
                    period_id,
                    department_id,
                    stage_id,
                    settings_json,
                    source_ruleset_id,
                    source_ruleset_name_snapshot,
                    created_at,
                    updated_at
                """
            ),
            {
                "organization_id": org_id,
                "period_id": period_id,
                "department_id": department_id,
                "settings_json": settings_payload,
                "source_ruleset_id": source_ruleset_id,
                "source_ruleset_name_snapshot": source_ruleset_name_snapshot,
                "created_at": now,
                "updated_at": now,
            },
        )
        row = insert_result.fetchone()
        return self._normalize_record(dict(row._mapping))

    async def upsert_stage_assignment(
        self,
        *,
        org_id: str,
        period_id: UUID,
        stage_id: UUID,
        settings_json: Dict[str, Any],
        source_ruleset_id: Optional[UUID],
        source_ruleset_name_snapshot: Optional[str],
    ) -> Dict[str, Any]:
        now = datetime.now(timezone.utc)
        settings_payload = json.dumps(settings_json)

        update_result = await self.session.execute(
            text(
                """
                UPDATE comprehensive_ruleset_assignments
                SET settings_json = CAST(:settings_json AS jsonb),
                    source_ruleset_id = :source_ruleset_id,
                    source_ruleset_name_snapshot = :source_ruleset_name_snapshot,
                    updated_at = :updated_at
                WHERE organization_id = :organization_id
                  AND period_id = :period_id
                  AND department_id IS NULL
                  AND stage_id = :stage_id
                RETURNING
                    id,
                    period_id,
                    department_id,
                    stage_id,
                    settings_json,
                    source_ruleset_id,
                    source_ruleset_name_snapshot,
                    created_at,
                    updated_at
                """
            ),
            {
                "organization_id": org_id,
                "period_id": period_id,
                "stage_id": stage_id,
                "settings_json": settings_payload,
                "source_ruleset_id": source_ruleset_id,
                "source_ruleset_name_snapshot": source_ruleset_name_snapshot,
                "updated_at": now,
            },
        )
        row = update_result.fetchone()
        if row is not None:
            return self._normalize_record(dict(row._mapping))

        insert_result = await self.session.execute(
            text(
                """
                INSERT INTO comprehensive_ruleset_assignments (
                    id,
                    organization_id,
                    period_id,
                    department_id,
                    stage_id,
                    settings_json,
                    source_ruleset_id,
                    source_ruleset_name_snapshot,
                    created_at,
                    updated_at
                ) VALUES (
                    gen_random_uuid(),
                    :organization_id,
                    :period_id,
                    NULL,
                    :stage_id,
                    CAST(:settings_json AS jsonb),
                    :source_ruleset_id,
                    :source_ruleset_name_snapshot,
                    :created_at,
                    :updated_at
                )
                RETURNING
                    id,
                    period_id,
                    department_id,
                    stage_id,
                    settings_json,
                    source_ruleset_id,
                    source_ruleset_name_snapshot,
                    created_at,
                    updated_at
                """
            ),
            {
                "organization_id": org_id,
                "period_id": period_id,
                "stage_id": stage_id,
                "settings_json": settings_payload,
                "source_ruleset_id": source_ruleset_id,
                "source_ruleset_name_snapshot": source_ruleset_name_snapshot,
                "created_at": now,
                "updated_at": now,
            },
        )
        row = insert_result.fetchone()
        return self._normalize_record(dict(row._mapping))

    async def delete_department_assignment(
        self,
        *,
        org_id: str,
        period_id: UUID,
        department_id: UUID,
    ) -> bool:
        result = await self.session.execute(
            text(
                """
                DELETE FROM comprehensive_ruleset_assignments
                WHERE organization_id = :organization_id
                  AND period_id = :period_id
                  AND department_id = :department_id
                  AND stage_id IS NULL
                """
            ),
            {
                "organization_id": org_id,
                "period_id": period_id,
                "department_id": department_id,
            },
        )
        return bool(result.rowcount)

    async def delete_stage_assignment(
        self,
        *,
        org_id: str,
        period_id: UUID,
        stage_id: UUID,
    ) -> bool:
        result = await self.session.execute(
            text(
                """
                DELETE FROM comprehensive_ruleset_assignments
                WHERE organization_id = :organization_id
                  AND period_id = :period_id
                  AND department_id IS NULL
                  AND stage_id = :stage_id
                """
            ),
            {
                "organization_id": org_id,
                "period_id": period_id,
                "stage_id": stage_id,
            },
        )
        return bool(result.rowcount)

    async def get_settings_rules(self, org_id: str) -> Dict[str, List[Dict[str, Any]]]:
        overall_result = await self.session.execute(
            text(
                """
                SELECT
                    overall_rank,
                    min_score,
                    max_score,
                    level_delta,
                    display_order
                FROM comprehensive_overall_rank_rules
                WHERE organization_id = :org_id
                  AND is_active = TRUE
                ORDER BY display_order ASC
                """
            ),
            {"org_id": org_id},
        )
        overall_rules = [dict(row._mapping) for row in overall_result.fetchall()]

        group_result = await self.session.execute(
            text(
                """
                SELECT
                    g.id,
                    g.decision_type,
                    g.group_name,
                    g.display_order,
                    r.condition_order,
                    r.field_name,
                    r.operator,
                    r.threshold_rank
                FROM comprehensive_decision_rule_groups g
                JOIN comprehensive_decision_rules r
                  ON r.group_id = g.id
                 AND r.organization_id = g.organization_id
                WHERE g.organization_id = :org_id
                  AND g.is_active = TRUE
                  AND r.is_active = TRUE
                ORDER BY g.decision_type ASC, g.display_order ASC, r.condition_order ASC
                """
            ),
            {"org_id": org_id},
        )
        group_rules = [dict(row._mapping) for row in group_result.fetchall()]

        return {"overall_rules": overall_rules, "group_rules": group_rules}

    async def replace_settings(
        self,
        *,
        org_id: str,
        overall_rules: Sequence[Dict[str, Any]],
        promotion_groups: Sequence[Dict[str, Any]],
        demotion_groups: Sequence[Dict[str, Any]],
    ) -> None:
        await self.session.execute(
            text("DELETE FROM comprehensive_decision_rules WHERE organization_id = :org_id"),
            {"org_id": org_id},
        )
        await self.session.execute(
            text("DELETE FROM comprehensive_decision_rule_groups WHERE organization_id = :org_id"),
            {"org_id": org_id},
        )
        await self.session.execute(
            text("DELETE FROM comprehensive_overall_rank_rules WHERE organization_id = :org_id"),
            {"org_id": org_id},
        )

        now = datetime.now(timezone.utc)

        for item in overall_rules:
            await self.session.execute(
                text(
                    """
                    INSERT INTO comprehensive_overall_rank_rules (
                        id,
                        organization_id,
                        overall_rank,
                        min_score,
                        max_score,
                        level_delta,
                        display_order,
                        is_active,
                        created_at,
                        updated_at
                    ) VALUES (
                        gen_random_uuid(),
                        :organization_id,
                        :overall_rank,
                        :min_score,
                        :max_score,
                        :level_delta,
                        :display_order,
                        TRUE,
                        :created_at,
                        :updated_at
                    )
                    """
                ),
                {
                    "organization_id": org_id,
                    "overall_rank": item["overall_rank"],
                    "min_score": item["min_score"],
                    "max_score": item["max_score"],
                    "level_delta": item["level_delta"],
                    "display_order": item["display_order"],
                    "created_at": now,
                    "updated_at": now,
                },
            )

        async def _insert_groups(groups: Sequence[Dict[str, Any]], decision_type: str) -> None:
            for group in groups:
                group_result = await self.session.execute(
                    text(
                        """
                        INSERT INTO comprehensive_decision_rule_groups (
                            id,
                            organization_id,
                            decision_type,
                            group_name,
                            display_order,
                            is_active,
                            created_at,
                            updated_at
                        ) VALUES (
                            gen_random_uuid(),
                            :organization_id,
                            :decision_type,
                            :group_name,
                            :display_order,
                            TRUE,
                            :created_at,
                            :updated_at
                        )
                        RETURNING id
                        """
                    ),
                    {
                        "organization_id": org_id,
                        "decision_type": decision_type,
                        "group_name": group.get("group_name"),
                        "display_order": group["display_order"],
                        "created_at": now,
                        "updated_at": now,
                    },
                )
                group_id = group_result.scalar_one()

                for condition in group["conditions"]:
                    await self.session.execute(
                        text(
                            """
                            INSERT INTO comprehensive_decision_rules (
                                id,
                                organization_id,
                                group_id,
                                condition_order,
                                field_name,
                                operator,
                                threshold_rank,
                                is_active,
                                created_at,
                                updated_at
                            ) VALUES (
                                gen_random_uuid(),
                                :organization_id,
                                :group_id,
                                :condition_order,
                                :field_name,
                                :operator,
                                :threshold_rank,
                                TRUE,
                                :created_at,
                                :updated_at
                            )
                            """
                        ),
                        {
                            "organization_id": org_id,
                            "group_id": group_id,
                            "condition_order": condition["condition_order"],
                            "field_name": condition["field_name"],
                            "operator": condition["operator"],
                            "threshold_rank": condition["threshold_rank"],
                            "created_at": now,
                            "updated_at": now,
                        },
                    )

        await _insert_groups(promotion_groups, "promotion")
        await _insert_groups(demotion_groups, "demotion")

    async def insert_settings_audit(
        self,
        *,
        org_id: str,
        actor_user_id: UUID,
        action: str,
        period_id: Optional[UUID] = None,
        department_id: Optional[UUID] = None,
        stage_id: Optional[UUID] = None,
        ruleset_id: Optional[UUID] = None,
        before_json: Optional[Dict[str, Any]],
        after_json: Optional[Dict[str, Any]],
    ) -> None:
        before_payload = json.dumps(before_json) if before_json is not None else None
        after_payload = json.dumps(after_json) if after_json is not None else None

        await self.session.execute(
            text(
                """
                INSERT INTO comprehensive_settings_audit_log (
                    id,
                    organization_id,
                    actor_user_id,
                    action,
                    period_id,
                    department_id,
                    stage_id,
                    ruleset_id,
                    before_json,
                    after_json,
                    changed_at
                ) VALUES (
                    gen_random_uuid(),
                    :organization_id,
                    :actor_user_id,
                    :action,
                    :period_id,
                    :department_id,
                    :stage_id,
                    :ruleset_id,
                    CAST(:before_json AS jsonb),
                    CAST(:after_json AS jsonb),
                    :changed_at
                )
                """
            ),
            {
                "organization_id": org_id,
                "actor_user_id": actor_user_id,
                "action": action,
                "period_id": period_id,
                "department_id": department_id,
                "stage_id": stage_id,
                "ruleset_id": ruleset_id,
                "before_json": before_payload,
                "after_json": after_payload,
                "changed_at": datetime.now(timezone.utc),
            },
        )

    async def get_user_employment_profile(self, *, org_id: str, user_id: UUID) -> Optional[Dict[str, Any]]:
        result = await self.session.execute(
            text(
                """
                SELECT
                    u.id,
                    u.level,
                    s.name AS stage_name,
                    CASE
                        WHEN EXISTS (
                            SELECT 1
                            FROM user_roles ur
                            JOIN roles r ON r.id = ur.role_id
                            WHERE ur.user_id = u.id
                              AND r.organization_id = :org_id
                              AND lower(r.name) = 'parttime'
                        ) THEN 'parttime'
                        ELSE 'employee'
                    END AS employment_type
                FROM users u
                LEFT JOIN stages s ON s.id = u.stage_id
                WHERE u.id = :user_id
                  AND u.clerk_organization_id = :org_id
                """
            ),
            {"org_id": org_id, "user_id": user_id},
        )
        row = result.fetchone()
        return dict(row._mapping) if row else None

    async def upsert_processing_status(
        self,
        *,
        org_id: str,
        period_id: UUID,
        user_id: UUID,
        processed_by_user_id: UUID,
    ) -> None:
        now = datetime.now(timezone.utc)
        await self.session.execute(
            text(
                """
                INSERT INTO comprehensive_processing_statuses (
                    id,
                    organization_id,
                    period_id,
                    user_id,
                    processed_by_user_id,
                    processed_at,
                    created_at,
                    updated_at
                ) VALUES (
                    gen_random_uuid(),
                    :organization_id,
                    :period_id,
                    :user_id,
                    :processed_by_user_id,
                    :processed_at,
                    :created_at,
                    :updated_at
                )
                ON CONFLICT (organization_id, period_id, user_id)
                DO UPDATE SET
                    processed_by_user_id = EXCLUDED.processed_by_user_id,
                    processed_at = EXCLUDED.processed_at,
                    updated_at = EXCLUDED.updated_at
                """
            ),
            {
                "organization_id": org_id,
                "period_id": period_id,
                "user_id": user_id,
                "processed_by_user_id": processed_by_user_id,
                "processed_at": now,
                "created_at": now,
                "updated_at": now,
            },
        )

    async def clear_processing_status(
        self,
        *,
        org_id: str,
        period_id: UUID,
        user_id: UUID,
    ) -> bool:
        result = await self.session.execute(
            text(
                """
                DELETE FROM comprehensive_processing_statuses
                WHERE organization_id = :organization_id
                  AND period_id = :period_id
                  AND user_id = :user_id
                """
            ),
            {
                "organization_id": org_id,
                "period_id": period_id,
                "user_id": user_id,
            },
        )
        return result.rowcount > 0

    async def is_user_processed(
        self,
        *,
        org_id: str,
        period_id: UUID,
        user_id: UUID,
    ) -> bool:
        result = await self.session.execute(
            text(
                """
                SELECT 1
                FROM comprehensive_processing_statuses
                WHERE organization_id = :organization_id
                  AND period_id = :period_id
                  AND user_id = :user_id
                LIMIT 1
                """
            ),
            {
                "organization_id": org_id,
                "period_id": period_id,
                "user_id": user_id,
            },
        )
        return result.scalar_one_or_none() is not None

    async def upsert_manual_decision(
        self,
        *,
        org_id: str,
        period_id: UUID,
        user_id: UUID,
        decision: str,
        stage_after: Optional[str],
        level_after: Optional[int],
        reason: str,
        double_checked_by: Optional[str],
        applied_by_user_id: UUID,
    ) -> Dict[str, Any]:
        applied_at = datetime.now(timezone.utc)
        # Backward compatibility:
        # Some environments still have NOT NULL on this column.
        # Store empty string when omitted, and normalize back to NULL on reads.
        double_checked_by_value = (double_checked_by or "").strip()

        result = await self.session.execute(
            text(
                """
                INSERT INTO comprehensive_manual_decisions (
                    id,
                    organization_id,
                    period_id,
                    user_id,
                    decision,
                    stage_after,
                    level_after,
                    reason,
                    double_checked_by,
                    applied_by_user_id,
                    applied_at,
                    created_at,
                    updated_at
                ) VALUES (
                    gen_random_uuid(),
                    :organization_id,
                    :period_id,
                    :user_id,
                    :decision,
                    :stage_after,
                    :level_after,
                    :reason,
                    :double_checked_by,
                    :applied_by_user_id,
                    :applied_at,
                    :created_at,
                    :updated_at
                )
                ON CONFLICT (organization_id, period_id, user_id)
                DO UPDATE SET
                    decision = EXCLUDED.decision,
                    stage_after = EXCLUDED.stage_after,
                    level_after = EXCLUDED.level_after,
                    reason = EXCLUDED.reason,
                    double_checked_by = EXCLUDED.double_checked_by,
                    applied_by_user_id = EXCLUDED.applied_by_user_id,
                    applied_at = EXCLUDED.applied_at,
                    updated_at = EXCLUDED.updated_at
                RETURNING
                    period_id,
                    decision,
                    stage_after,
                    level_after,
                    reason,
                    NULLIF(double_checked_by, '') AS double_checked_by,
                    applied_by_user_id,
                    applied_at
                """
            ),
            {
                "organization_id": org_id,
                "period_id": period_id,
                "user_id": user_id,
                "decision": decision,
                "stage_after": stage_after,
                "level_after": level_after,
                "reason": reason,
                "double_checked_by": double_checked_by_value,
                "applied_by_user_id": applied_by_user_id,
                "applied_at": applied_at,
                "created_at": applied_at,
                "updated_at": applied_at,
            },
        )
        row = result.fetchone()
        return dict(row._mapping)

    async def get_manual_decision(
        self,
        *,
        org_id: str,
        period_id: UUID,
        user_id: UUID,
    ) -> Optional[Dict[str, Any]]:
        result = await self.session.execute(
            text(
                """
                SELECT
                    decision,
                    stage_after,
                    level_after,
                    reason,
                    NULLIF(double_checked_by, '') AS double_checked_by,
                    applied_by_user_id,
                    applied_at
                FROM comprehensive_manual_decisions
                WHERE organization_id = :organization_id
                  AND period_id = :period_id
                  AND user_id = :user_id
                """
            ),
            {
                "organization_id": org_id,
                "period_id": period_id,
                "user_id": user_id,
            },
        )
        row = result.fetchone()
        return dict(row._mapping) if row else None

    async def clear_manual_decision(
        self,
        *,
        org_id: str,
        period_id: UUID,
        user_id: UUID,
    ) -> bool:
        result = await self.session.execute(
            text(
                """
                DELETE FROM comprehensive_manual_decisions
                WHERE organization_id = :organization_id
                  AND period_id = :period_id
                  AND user_id = :user_id
                """
            ),
            {
                "organization_id": org_id,
                "period_id": period_id,
                "user_id": user_id,
            },
        )
        return result.rowcount > 0

    async def insert_manual_decision_history(
        self,
        *,
        org_id: str,
        period_id: UUID,
        user_id: UUID,
        operation: str,
        decision: Optional[str],
        stage_after: Optional[str],
        level_after: Optional[int],
        reason: Optional[str],
        double_checked_by: Optional[str],
        applied_by_user_id: Optional[UUID],
        applied_at: Optional[datetime],
    ) -> None:
        await self.session.execute(
            text(
                """
                INSERT INTO comprehensive_manual_decision_history (
                    id,
                    organization_id,
                    period_id,
                    user_id,
                    operation,
                    decision,
                    stage_after,
                    level_after,
                    reason,
                    double_checked_by,
                    applied_by_user_id,
                    applied_at,
                    changed_at
                ) VALUES (
                    gen_random_uuid(),
                    :organization_id,
                    :period_id,
                    :user_id,
                    :operation,
                    :decision,
                    :stage_after,
                    :level_after,
                    :reason,
                    :double_checked_by,
                    :applied_by_user_id,
                    :applied_at,
                    :changed_at
                )
                """
            ),
            {
                "organization_id": org_id,
                "period_id": period_id,
                "user_id": user_id,
                "operation": operation,
                "decision": decision,
                "stage_after": stage_after,
                "level_after": level_after,
                "reason": reason,
                "double_checked_by": double_checked_by,
                "applied_by_user_id": applied_by_user_id,
                "applied_at": applied_at,
                "changed_at": datetime.now(timezone.utc),
            },
        )

    async def list_manual_decision_history(
        self,
        *,
        org_id: str,
        period_id: Optional[UUID],
        page: int,
        limit: int,
    ) -> Tuple[List[Dict[str, Any]], int]:
        offset = (page - 1) * limit

        result = await self.session.execute(
            text(
                """
                SELECT
                    h.id,
                    h.period_id,
                    ep.name AS period_name,
                    h.user_id,
                    u.employee_code,
                    u.name AS user_name,
                    h.operation,
                    h.decision,
                    h.stage_after,
                    h.level_after,
                    h.reason,
                    NULLIF(h.double_checked_by, '') AS double_checked_by,
                    h.applied_by_user_id,
                    actor.name AS applied_by_user_name,
                    h.applied_at,
                    h.changed_at,
                    COUNT(*) OVER()::integer AS total_count
                FROM comprehensive_manual_decision_history h
                LEFT JOIN users u
                  ON u.id = h.user_id
                LEFT JOIN users actor
                  ON actor.id = h.applied_by_user_id
                LEFT JOIN evaluation_periods ep
                  ON ep.id = h.period_id
                 AND ep.organization_id = h.organization_id
                WHERE h.organization_id = :organization_id
                  AND (CAST(:period_id AS uuid) IS NULL OR h.period_id = CAST(:period_id AS uuid))
                ORDER BY h.changed_at DESC
                OFFSET :offset
                LIMIT :limit
                """
            ),
            {
                "organization_id": org_id,
                "period_id": period_id,
                "offset": offset,
                "limit": limit,
            },
        )

        records = [dict(row._mapping) for row in result.fetchall()]
        total = int(records[0]["total_count"]) if records else 0
        for record in records:
            record.pop("total_count", None)

        return records, total

    @staticmethod
    def _normalize_record(record: Dict[str, Any]) -> Dict[str, Any]:
        normalized = dict(record)
        if "settings_json" in normalized:
            normalized["settings_json"] = ComprehensiveEvaluationRepository._normalize_json_document(
                normalized.get("settings_json")
            )
        return normalized

    @staticmethod
    def _normalize_json_document(value: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, str):
            return json.loads(value)
        return value
