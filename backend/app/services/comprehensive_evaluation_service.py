from __future__ import annotations

import logging
from math import ceil
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from ..core.exceptions import BadRequestError, NotFoundError, PermissionDeniedError
from ..database.models.evaluation import EvaluationPeriodStatus
from ..database.repositories.comprehensive_evaluation_repo import ComprehensiveEvaluationRepository
from ..database.repositories.department_repo import DepartmentRepository
from ..database.repositories.evaluation_period_repo import EvaluationPeriodRepository
from ..database.repositories.stage_repo import StageRepository
from ..database.repositories.user_repo import UserRepository
from ..schemas.comprehensive_evaluation import (
    ComprehensiveDecision,
    ComprehensiveDefaultAssignmentUpdateRequest,
    ComprehensiveDepartmentAssignmentUpdateRequest,
    ComprehensiveEvaluationComputedState,
    ComprehensiveEvaluationFinalizeResponse,
    ComprehensiveEvaluationListMeta,
    ComprehensiveEvaluationListResponse,
    ComprehensiveEvaluationProcessUserResponse,
    ComprehensiveEvaluationRow,
    ComprehensiveEvaluationSettings,
    ComprehensiveEvaluationSettingsWorkspace,
    ComprehensiveManualDecisionHistoryEntry,
    ComprehensiveManualDecisionHistoryResponse,
    ComprehensiveManualDecisionResponse,
    ComprehensiveManualDecisionUpsertRequest,
    ComprehensiveRulesetAssignment,
    ComprehensiveStageAssignmentUpdateRequest,
    ComprehensiveRulesetTemplate,
    ComprehensiveRulesetUpsertRequest,
    DemotionRuleGroup,
    EvaluationRank,
    PromotionRuleGroup,
)
from ..security.context import AuthContext


logger = logging.getLogger(__name__)


RANK_ORDER: List[EvaluationRank] = ["SS", "S", "A+", "A", "A-", "B", "C", "D"]
RANK_INDEX: Dict[EvaluationRank, int] = {rank: idx for idx, rank in enumerate(RANK_ORDER)}
DEFAULT_THRESHOLDS: Dict[EvaluationRank, float] = {
    "SS": 6.5,
    "S": 5.5,
    "A+": 4.5,
    "A": 3.7,
    "A-": 2.7,
    "B": 1.7,
    "C": 1.0,
    "D": 0.1,
}
DEFAULT_LEVEL_DELTAS: Dict[EvaluationRank, int] = {
    "SS": 10,
    "S": 8,
    "A+": 6,
    "A": 5,
    "A-": 2,
    "B": 1,
    "C": -5,
    "D": -8,
}
USER_LEVEL_MIN = 1
USER_LEVEL_MAX = 30


class ComprehensiveEvaluationService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = ComprehensiveEvaluationRepository(session)
        self.department_repo = DepartmentRepository(session)
        self.period_repo = EvaluationPeriodRepository(session)
        self.stage_repo = StageRepository(session)
        self.user_repo = UserRepository(session)

    async def get_comprehensive_evaluation(
        self,
        *,
        context: AuthContext,
        period_id: UUID,
        department_id: Optional[UUID],
        stage_id: Optional[UUID],
        employment_type: Optional[str],
        search: Optional[str],
        processing_status: Optional[str],
        page: int,
        limit: int,
        candidate_view: bool = False,
    ) -> ComprehensiveEvaluationListResponse:
        org_id = self._require_org(context)
        self._require_list_read_role(context=context, candidate_view=candidate_view)
        await self._ensure_period_exists(period_id, org_id)

        default_settings, settings_by_department, settings_by_stage = await self._get_period_settings_map(
            org_id=org_id,
            period_id=period_id,
        )
        rows_data, total = await self.repo.list_rows(
            org_id=org_id,
            period_id=period_id,
            user_id=None,
            department_id=department_id,
            stage_id=stage_id,
            employment_type=employment_type,
            search=search,
            processing_status=processing_status,
            page=page,
            limit=limit,
        )

        rows = [
            self._build_row_from_repo_item(
                item=item,
                period_id=period_id,
                settings=self._resolve_settings_for_assignment_target(
                    department_id=item.get("department_id"),
                    stage_id=item.get("stage_id"),
                    default_settings=default_settings,
                    settings_by_department=settings_by_department,
                    settings_by_stage=settings_by_stage,
                ),
            )
            for item in rows_data
        ]

        meta = ComprehensiveEvaluationListMeta(
            total=total,
            page=page,
            limit=limit,
            pages=max(1, ceil(total / limit)) if limit > 0 else 1,
        )
        return ComprehensiveEvaluationListResponse(rows=rows, meta=meta)

    async def get_stage_options(self, *, context: AuthContext) -> List[str]:
        org_id = self._require_org(context)
        self._require_read_role(context)

        stage_models = await self.stage_repo.get_all(org_id)
        seen = set()
        stage_names: List[str] = []
        for stage in stage_models:
            name = (stage.name or "").strip()
            if not name or name in seen:
                continue
            seen.add(name)
            stage_names.append(name)

        return stage_names

    async def get_settings_workspace(
        self,
        *,
        context: AuthContext,
        period_id: UUID,
    ) -> ComprehensiveEvaluationSettingsWorkspace:
        org_id = self._require_org(context)
        self._require_read_role(context)

        period = await self._ensure_period_exists(period_id, org_id)
        templates_raw = await self.repo.list_rulesets(org_id=org_id)
        assignment_rows = await self.repo.list_period_assignments(org_id=org_id, period_id=period_id)

        default_assignment_record = next(
            (
                row
                for row in assignment_rows
                if row.get("department_id") is None and row.get("stage_id") is None
            ),
            None,
        )
        if default_assignment_record is None:
            default_assignment = await self._build_fallback_default_assignment(
                org_id=org_id,
                period_id=period_id,
                templates_raw=templates_raw,
            )
        else:
            default_assignment = self._build_assignment_response(default_assignment_record)

        templates = [self._build_ruleset_response(item) for item in templates_raw]
        department_assignments = [
            self._build_assignment_response(item)
            for item in assignment_rows
            if item.get("department_id") is not None
        ]
        stage_assignments = [
            self._build_assignment_response(item)
            for item in assignment_rows
            if item.get("stage_id") is not None
        ]

        return ComprehensiveEvaluationSettingsWorkspace(
            locked=self._is_settings_locked(period),
            templates=templates,
            defaultAssignment=default_assignment,
            departmentAssignments=department_assignments,
            stageAssignments=stage_assignments,
        )

    async def update_default_assignment(
        self,
        *,
        context: AuthContext,
        payload: ComprehensiveDefaultAssignmentUpdateRequest,
    ) -> ComprehensiveRulesetAssignment:
        org_id = self._require_org(context)
        actor_user_id = self._require_user_id(context)
        self._require_write_role(context)

        period = await self._ensure_period_exists(payload.period_id, org_id)
        self._ensure_period_allows_settings_mutation(period)
        self._validate_settings(payload.settings)

        source_ruleset = await self._resolve_source_ruleset(
            org_id=org_id,
            source_ruleset_id=payload.source_ruleset_id,
        )
        before_assignment = await self._get_default_assignment_for_audit(
            org_id=org_id,
            period_id=payload.period_id,
        )

        try:
            persisted = await self.repo.upsert_default_assignment(
                org_id=org_id,
                period_id=payload.period_id,
                settings_json=payload.settings.model_dump(mode="json", by_alias=True),
                source_ruleset_id=source_ruleset["id"] if source_ruleset else None,
                source_ruleset_name_snapshot=source_ruleset["name"] if source_ruleset else None,
            )
            persisted_response = self._build_assignment_response(persisted)
            await self.repo.insert_settings_audit(
                org_id=org_id,
                actor_user_id=actor_user_id,
                action="default_assignment_update",
                period_id=payload.period_id,
                ruleset_id=source_ruleset["id"] if source_ruleset else None,
                before_json=before_assignment.settings.model_dump(mode="json", by_alias=True),
                after_json=persisted_response.settings.model_dump(mode="json", by_alias=True),
            )
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise

        return persisted_response

    async def update_department_assignment(
        self,
        *,
        context: AuthContext,
        department_id: UUID,
        payload: ComprehensiveDepartmentAssignmentUpdateRequest,
    ) -> ComprehensiveRulesetAssignment:
        org_id = self._require_org(context)
        actor_user_id = self._require_user_id(context)
        self._require_write_role(context)

        period = await self._ensure_period_exists(payload.period_id, org_id)
        self._ensure_period_allows_settings_mutation(period)

        department = await self.department_repo.get_by_id(department_id, org_id)
        if department is None:
            raise NotFoundError("Department not found")

        source_ruleset = await self._resolve_source_ruleset(
            org_id=org_id,
            source_ruleset_id=payload.source_ruleset_id,
        )
        before_assignment = await self._get_department_assignment_for_audit(
            org_id=org_id,
            period_id=payload.period_id,
            department_id=department_id,
            department_name=department.name,
        )

        try:
            if payload.inherit_default:
                await self.repo.delete_department_assignment(
                    org_id=org_id,
                    period_id=payload.period_id,
                    department_id=department_id,
                )
                after_assignment = await self._build_inherited_department_assignment(
                    org_id=org_id,
                    period_id=payload.period_id,
                    department_id=department_id,
                    department_name=department.name,
                )
                action = "department_assignment_clear"
                audit_ruleset_id = None
            else:
                assert payload.settings is not None
                self._validate_settings(payload.settings)
                persisted = await self.repo.upsert_department_assignment(
                    org_id=org_id,
                    period_id=payload.period_id,
                    department_id=department_id,
                    settings_json=payload.settings.model_dump(mode="json", by_alias=True),
                    source_ruleset_id=source_ruleset["id"] if source_ruleset else None,
                    source_ruleset_name_snapshot=source_ruleset["name"] if source_ruleset else None,
                )
                after_assignment = self._build_assignment_response(
                    {**persisted, "department_name": department.name}
                )
                action = "department_assignment_update"
                audit_ruleset_id = source_ruleset["id"] if source_ruleset else None

            await self.repo.insert_settings_audit(
                org_id=org_id,
                actor_user_id=actor_user_id,
                action=action,
                period_id=payload.period_id,
                department_id=department_id,
                ruleset_id=audit_ruleset_id,
                before_json=before_assignment.settings.model_dump(mode="json", by_alias=True),
                after_json=after_assignment.settings.model_dump(mode="json", by_alias=True),
            )
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise

        return after_assignment

    async def update_stage_assignment(
        self,
        *,
        context: AuthContext,
        stage_id: UUID,
        payload: ComprehensiveStageAssignmentUpdateRequest,
    ) -> ComprehensiveRulesetAssignment:
        org_id = self._require_org(context)
        actor_user_id = self._require_user_id(context)
        self._require_write_role(context)

        period = await self._ensure_period_exists(payload.period_id, org_id)
        self._ensure_period_allows_settings_mutation(period)

        stage = await self.stage_repo.get_by_id(stage_id, org_id)
        if stage is None:
            raise NotFoundError("Stage not found")

        source_ruleset = await self._resolve_source_ruleset(
            org_id=org_id,
            source_ruleset_id=payload.source_ruleset_id,
        )
        before_assignment = await self._get_stage_assignment_for_audit(
            org_id=org_id,
            period_id=payload.period_id,
            stage_id=stage_id,
            stage_name=stage.name,
        )

        try:
            if payload.inherit_default:
                await self.repo.delete_stage_assignment(
                    org_id=org_id,
                    period_id=payload.period_id,
                    stage_id=stage_id,
                )
                after_assignment = await self._build_inherited_stage_assignment(
                    org_id=org_id,
                    period_id=payload.period_id,
                    stage_id=stage_id,
                    stage_name=stage.name,
                )
                action = "stage_assignment_clear"
                audit_ruleset_id = None
            else:
                assert payload.settings is not None
                self._validate_settings(payload.settings)
                persisted = await self.repo.upsert_stage_assignment(
                    org_id=org_id,
                    period_id=payload.period_id,
                    stage_id=stage_id,
                    settings_json=payload.settings.model_dump(mode="json", by_alias=True),
                    source_ruleset_id=source_ruleset["id"] if source_ruleset else None,
                    source_ruleset_name_snapshot=source_ruleset["name"] if source_ruleset else None,
                )
                after_assignment = self._build_assignment_response(
                    {**persisted, "stage_name": stage.name}
                )
                action = "stage_assignment_update"
                audit_ruleset_id = source_ruleset["id"] if source_ruleset else None

            await self.repo.insert_settings_audit(
                org_id=org_id,
                actor_user_id=actor_user_id,
                action=action,
                period_id=payload.period_id,
                stage_id=stage_id,
                ruleset_id=audit_ruleset_id,
                before_json=before_assignment.settings.model_dump(mode="json", by_alias=True),
                after_json=after_assignment.settings.model_dump(mode="json", by_alias=True),
            )
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise

        return after_assignment

    async def create_ruleset(
        self,
        *,
        context: AuthContext,
        payload: ComprehensiveRulesetUpsertRequest,
    ) -> ComprehensiveRulesetTemplate:
        org_id = self._require_org(context)
        actor_user_id = self._require_user_id(context)
        self._require_write_role(context)

        name = payload.name.strip()
        if not name:
            raise BadRequestError("name is required")
        self._validate_settings(payload.settings)

        existing = await self.repo.get_ruleset_by_name(org_id=org_id, name=name)
        if existing is not None:
            raise BadRequestError("Ruleset name already exists")

        is_first_ruleset = await self.repo.count_rulesets(org_id=org_id) == 0
        should_be_default = payload.is_default_template or is_first_ruleset

        try:
            created = await self.repo.create_ruleset(
                org_id=org_id,
                name=name,
                settings_json=payload.settings.model_dump(mode="json", by_alias=True),
                is_default_template=should_be_default,
            )
            response = self._build_ruleset_response(created)
            await self.repo.insert_settings_audit(
                org_id=org_id,
                actor_user_id=actor_user_id,
                action="ruleset_create",
                ruleset_id=response.id,
                before_json=None,
                after_json=response.settings.model_dump(mode="json", by_alias=True),
            )
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise

        return response

    async def update_ruleset(
        self,
        *,
        context: AuthContext,
        ruleset_id: UUID,
        payload: ComprehensiveRulesetUpsertRequest,
    ) -> ComprehensiveRulesetTemplate:
        org_id = self._require_org(context)
        actor_user_id = self._require_user_id(context)
        self._require_write_role(context)

        existing = await self.repo.get_ruleset_by_id(org_id=org_id, ruleset_id=ruleset_id)
        if existing is None:
            raise NotFoundError("Ruleset not found")

        name = payload.name.strip()
        if not name:
            raise BadRequestError("name is required")
        self._validate_settings(payload.settings)

        duplicate = await self.repo.get_ruleset_by_name(org_id=org_id, name=name)
        if duplicate is not None and duplicate["id"] != ruleset_id:
            raise BadRequestError("Ruleset name already exists")

        if existing.get("is_default_template") and not payload.is_default_template:
            raise BadRequestError("Default ruleset cannot be unset directly")

        try:
            updated = await self.repo.update_ruleset(
                org_id=org_id,
                ruleset_id=ruleset_id,
                name=name,
                settings_json=payload.settings.model_dump(mode="json", by_alias=True),
                is_default_template=payload.is_default_template or bool(existing.get("is_default_template")),
            )
            if updated is None:
                raise NotFoundError("Ruleset not found")
            response = self._build_ruleset_response(updated)
            await self.repo.insert_settings_audit(
                org_id=org_id,
                actor_user_id=actor_user_id,
                action="ruleset_update",
                ruleset_id=ruleset_id,
                before_json=self._settings_json_from_record(existing),
                after_json=response.settings.model_dump(mode="json", by_alias=True),
            )
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise

        return response

    async def delete_ruleset(
        self,
        *,
        context: AuthContext,
        ruleset_id: UUID,
    ) -> None:
        org_id = self._require_org(context)
        actor_user_id = self._require_user_id(context)
        self._require_write_role(context)

        existing = await self.repo.get_ruleset_by_id(org_id=org_id, ruleset_id=ruleset_id)
        if existing is None:
            raise NotFoundError("Ruleset not found")
        if existing.get("is_default_template"):
            raise BadRequestError("Default ruleset cannot be deleted")

        try:
            deleted = await self.repo.delete_ruleset(org_id=org_id, ruleset_id=ruleset_id)
            if not deleted:
                raise NotFoundError("Ruleset not found")
            await self.repo.insert_settings_audit(
                org_id=org_id,
                actor_user_id=actor_user_id,
                action="ruleset_delete",
                ruleset_id=ruleset_id,
                before_json=self._settings_json_from_record(existing),
                after_json=None,
            )
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise

    async def finalize_evaluation_period(
        self,
        *,
        context: AuthContext,
        period_id: UUID,
    ) -> ComprehensiveEvaluationFinalizeResponse:
        org_id = self._require_org(context)
        self._require_user_id(context)
        self._require_write_role(context)

        period = await self._ensure_period_exists(period_id, org_id)
        previous_status = self._get_period_status(period)

        if previous_status == "cancelled":
            raise BadRequestError("Cancelled evaluation periods cannot be finalized")
        if previous_status not in ("draft", "active", "completed"):
            raise BadRequestError(
                "Only draft, active, or completed evaluation periods can be finalized"
            )

        first_page = await self.get_comprehensive_evaluation(
            context=context,
            period_id=period_id,
            department_id=None,
            stage_id=None,
            employment_type=None,
            search=None,
            processing_status=None,
            page=1,
            limit=200,
        )
        rows = list(first_page.rows)
        total_users = len(first_page.rows)

        if getattr(first_page.meta, "pages", 1) > 1:
            total_users = getattr(first_page.meta, "total", total_users)
            for page in range(2, first_page.meta.pages + 1):
                page_result = await self.get_comprehensive_evaluation(
                    context=context,
                    period_id=period_id,
                    department_id=None,
                    stage_id=None,
                    employment_type=None,
                    search=None,
                    processing_status=None,
                    page=page,
                    limit=200,
                )
                rows.extend(page_result.rows)

        level_updates: Dict[UUID, int] = {}
        stage_updates: Dict[UUID, UUID] = {}
        stage_name_to_id: Optional[Dict[str, UUID]] = None
        stage_name_folded_to_id: Optional[Dict[str, UUID]] = None

        for row in rows:
            applied_state = row.applied

            if row.employment_type == "employee" and applied_state.new_level is not None:
                try:
                    proposed_level = int(applied_state.new_level)
                except (TypeError, ValueError):
                    raise BadRequestError("applied level is invalid") from None

                next_level = max(USER_LEVEL_MIN, min(USER_LEVEL_MAX, proposed_level))
                if row.current_level is None or row.current_level != next_level:
                    level_updates[row.user_id] = next_level

            requested_stage_name = self._normalize_stage_name(
                getattr(applied_state, "new_stage", None)
            )
            current_stage_name = self._normalize_stage_name(getattr(row, "current_stage", None))
            if requested_stage_name and (
                current_stage_name is None or requested_stage_name.casefold() != current_stage_name.casefold()
            ):
                if stage_name_to_id is None or stage_name_folded_to_id is None:
                    stage_name_to_id, stage_name_folded_to_id = await self._get_stage_name_maps(org_id)
                stage_id = self._resolve_stage_id(
                    stage_name=requested_stage_name,
                    stage_name_to_id=stage_name_to_id,
                    stage_name_folded_to_id=stage_name_folded_to_id,
                )
                if stage_id is None:
                    raise BadRequestError("applied stage is not registered in this organization")
                stage_updates[row.user_id] = stage_id

        updated_user_levels = 0

        try:
            if level_updates:
                updated_users = await self.user_repo.batch_update_user_levels(org_id, level_updates)
                updated_user_levels = len(updated_users)
            if stage_updates:
                await self.user_repo.batch_update_user_stages(org_id, stage_updates)
            if previous_status != "completed":
                await self.period_repo.update_status(period_id, EvaluationPeriodStatus.COMPLETED, org_id)
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise

        return ComprehensiveEvaluationFinalizeResponse(
            periodId=period_id,
            previousStatus=previous_status,
            currentStatus="completed",
            totalUsers=total_users,
            updatedUserLevels=updated_user_levels,
        )

    async def process_user_evaluation(
        self,
        *,
        context: AuthContext,
        period_id: UUID,
        user_id: UUID,
    ) -> ComprehensiveEvaluationProcessUserResponse:
        org_id = self._require_org(context)
        actor_user_id = self._require_user_id(context)
        self._require_write_role(context)

        period = await self._ensure_period_exists(period_id, org_id)
        self._ensure_period_allows_user_processing(period)

        default_settings, settings_by_department, settings_by_stage = await self._get_period_settings_map(
            org_id=org_id,
            period_id=period_id,
        )
        row_items, _ = await self.repo.list_rows(
            org_id=org_id,
            period_id=period_id,
            user_id=user_id,
            department_id=None,
            stage_id=None,
            employment_type=None,
            search=None,
            processing_status=None,
            page=1,
            limit=1,
        )
        if not row_items:
            raise NotFoundError("Target user not found in this organization")

        row = self._build_row_from_repo_item(
            item=row_items[0],
            period_id=period_id,
            settings=self._resolve_settings_for_assignment_target(
                department_id=row_items[0].get("department_id"),
                stage_id=row_items[0].get("stage_id"),
                default_settings=default_settings,
                settings_by_department=settings_by_department,
                settings_by_stage=settings_by_stage,
            ),
        )
        applied_state = row.applied

        updated_level = False
        updated_stage = False

        requested_stage_name = self._normalize_stage_name(applied_state.new_stage)
        current_stage_name = self._normalize_stage_name(row.current_stage)
        if requested_stage_name and (
            current_stage_name is None or requested_stage_name.casefold() != current_stage_name.casefold()
        ):
            stage_name_to_id, stage_name_folded_to_id = await self._get_stage_name_maps(org_id)
            stage_id = self._resolve_stage_id(
                stage_name=requested_stage_name,
                stage_name_to_id=stage_name_to_id,
                stage_name_folded_to_id=stage_name_folded_to_id,
            )
            if stage_id is None:
                raise BadRequestError("applied stage is not registered in this organization")
            updated = await self.user_repo.update_user_stage(user_id, stage_id, org_id)
            updated_stage = updated is not None

        if row.employment_type == "employee" and applied_state.new_level is not None:
            try:
                proposed_level = int(applied_state.new_level)
            except (TypeError, ValueError):
                raise BadRequestError("applied level is invalid") from None

            next_level = max(USER_LEVEL_MIN, min(USER_LEVEL_MAX, proposed_level))
            if row.current_level is None or row.current_level != next_level:
                updated_users = await self.user_repo.batch_update_user_levels(org_id, {user_id: next_level})
                updated_level = user_id in updated_users

        try:
            await self.repo.upsert_processing_status(
                org_id=org_id,
                period_id=period_id,
                user_id=user_id,
                processed_by_user_id=actor_user_id,
            )
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise

        return ComprehensiveEvaluationProcessUserResponse(
            periodId=period_id,
            userId=user_id,
            processingStatus="processed",
            updatedLevel=updated_level,
            updatedStage=updated_stage,
        )

    async def upsert_manual_decision(
        self,
        *,
        context: AuthContext,
        user_id: UUID,
        payload: ComprehensiveManualDecisionUpsertRequest,
    ) -> ComprehensiveManualDecisionResponse:
        org_id = self._require_org(context)
        actor_user_id = self._require_user_id(context)
        self._require_write_role(context)

        period = await self._ensure_period_exists(payload.period_id, org_id)
        self._ensure_period_allows_manual_decision(period)
        is_processed = await self.repo.is_user_processed(
            org_id=org_id,
            period_id=payload.period_id,
            user_id=user_id,
        )
        if not is_processed:
            raise BadRequestError("User evaluation must be processed before manual decision")
        user_profile = await self.repo.get_user_employment_profile(org_id=org_id, user_id=user_id)
        if not user_profile:
            raise NotFoundError("Target user not found in this organization")

        reason = payload.reason.strip()
        if not reason:
            raise BadRequestError("reason is required")
        double_checked_by = payload.double_checked_by.strip() if payload.double_checked_by else None

        if payload.decision != "対象外":
            if not payload.stage_after or not payload.stage_after.strip():
                raise BadRequestError("stageAfter is required when decision is not 対象外")

        if payload.level_after is not None and (payload.level_after < 1 or payload.level_after > 30):
            raise BadRequestError("levelAfter must be between 1 and 30")

        stage_after = (
            payload.stage_after.strip()
            if payload.decision != "対象外" and payload.stage_after
            else None
        )
        level_after = (
            payload.level_after
            if payload.decision != "対象外" and user_profile["employment_type"] == "employee"
            else None
        )

        target_stage_id: Optional[UUID] = None
        if stage_after is not None:
            stage = await self.stage_repo.get_by_name(stage_after, org_id)
            if stage is None:
                raise BadRequestError("stageAfter must match an existing stage in this organization")
            target_stage_id = stage.id

        try:
            persisted = await self.repo.upsert_manual_decision(
                org_id=org_id,
                period_id=payload.period_id,
                user_id=user_id,
                decision=payload.decision,
                stage_after=stage_after,
                level_after=level_after,
                reason=reason,
                double_checked_by=double_checked_by,
                applied_by_user_id=actor_user_id,
            )

            if payload.decision != "対象外":
                if target_stage_id is not None:
                    await self.user_repo.update_user_stage(user_id, target_stage_id, org_id)

                if user_profile["employment_type"] == "employee":
                    current_level = user_profile.get("level")
                    target_level = level_after if level_after is not None else current_level
                    if target_level is not None and target_level != current_level:
                        await self.user_repo.batch_update_user_levels(org_id, {user_id: int(target_level)})

            await self.repo.upsert_processing_status(
                org_id=org_id,
                period_id=payload.period_id,
                user_id=user_id,
                processed_by_user_id=actor_user_id,
            )

            await self.repo.insert_manual_decision_history(
                org_id=org_id,
                period_id=payload.period_id,
                user_id=user_id,
                operation="UPSERT",
                decision=persisted.get("decision"),
                stage_after=persisted.get("stage_after"),
                level_after=persisted.get("level_after"),
                reason=persisted.get("reason"),
                double_checked_by=persisted.get("double_checked_by"),
                applied_by_user_id=persisted.get("applied_by_user_id"),
                applied_at=persisted.get("applied_at"),
            )
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise

        return ComprehensiveManualDecisionResponse(
            periodId=persisted["period_id"],
            decision=persisted["decision"],
            stageAfter=persisted.get("stage_after"),
            levelAfter=persisted.get("level_after"),
            reason=persisted.get("reason") or "",
            doubleCheckedBy=persisted.get("double_checked_by"),
            appliedByUserId=persisted["applied_by_user_id"],
            appliedAt=persisted["applied_at"],
        )

    async def clear_manual_decision(
        self,
        *,
        context: AuthContext,
        user_id: UUID,
        period_id: UUID,
    ) -> None:
        org_id = self._require_org(context)
        actor_user_id = self._require_user_id(context)
        self._require_write_role(context)

        period = await self._ensure_period_exists(period_id, org_id)
        self._ensure_period_allows_manual_decision(period)
        is_processed = await self.repo.is_user_processed(
            org_id=org_id,
            period_id=period_id,
            user_id=user_id,
        )
        if not is_processed:
            raise BadRequestError("User evaluation must be processed before manual decision")
        user_profile = await self.repo.get_user_employment_profile(org_id=org_id, user_id=user_id)
        if not user_profile:
            raise NotFoundError("Target user not found in this organization")

        existing = await self.repo.get_manual_decision(
            org_id=org_id,
            period_id=period_id,
            user_id=user_id,
        )

        try:
            await self.repo.clear_manual_decision(
                org_id=org_id,
                period_id=period_id,
                user_id=user_id,
            )

            await self.repo.insert_manual_decision_history(
                org_id=org_id,
                period_id=period_id,
                user_id=user_id,
                operation="CLEAR",
                decision=existing.get("decision") if existing else None,
                stage_after=existing.get("stage_after") if existing else None,
                level_after=existing.get("level_after") if existing else None,
                reason=existing.get("reason") if existing else None,
                double_checked_by=existing.get("double_checked_by") if existing else None,
                applied_by_user_id=existing.get("applied_by_user_id") if existing else actor_user_id,
                applied_at=existing.get("applied_at") if existing else None,
            )
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise

    async def get_manual_decision_history(
        self,
        *,
        context: AuthContext,
        period_id: Optional[UUID],
        page: int,
        limit: int,
    ) -> ComprehensiveManualDecisionHistoryResponse:
        org_id = self._require_org(context)
        self._require_read_role(context)

        if period_id:
            await self._ensure_period_exists(period_id, org_id)

        records, total = await self.repo.list_manual_decision_history(
            org_id=org_id,
            period_id=period_id,
            page=page,
            limit=limit,
        )

        items = [
            ComprehensiveManualDecisionHistoryEntry(
                id=item["id"],
                periodId=item["period_id"],
                periodName=item.get("period_name"),
                userId=item["user_id"],
                employeeCode=item.get("employee_code"),
                userName=item.get("user_name"),
                operation=item["operation"],
                decision=item.get("decision"),
                stageAfter=item.get("stage_after"),
                levelAfter=item.get("level_after"),
                reason=item.get("reason"),
                doubleCheckedBy=item.get("double_checked_by"),
                appliedByUserId=item.get("applied_by_user_id"),
                appliedByUserName=item.get("applied_by_user_name"),
                appliedAt=item.get("applied_at"),
                changedAt=item["changed_at"],
            )
            for item in records
        ]

        meta = ComprehensiveEvaluationListMeta(
            total=total,
            page=page,
            limit=limit,
            pages=max(1, ceil(total / limit)) if limit > 0 else 1,
        )
        return ComprehensiveManualDecisionHistoryResponse(items=items, meta=meta)

    async def ensure_period_default_assignment_seeded(
        self,
        *,
        org_id: str,
        period_id: UUID,
    ) -> None:
        default_ruleset = await self.repo.get_default_ruleset(org_id=org_id)
        if default_ruleset is None:
            default_settings = self._build_default_settings()
            default_ruleset = await self.repo.create_default_ruleset_if_missing(
                org_id=org_id,
                settings_json=default_settings.model_dump(mode="json", by_alias=True),
            )

        await self.repo.ensure_period_default_assignment(
            org_id=org_id,
            period_id=period_id,
            settings_json=self._settings_json_from_record(default_ruleset),
            source_ruleset_id=default_ruleset.get("id"),
            source_ruleset_name_snapshot=default_ruleset.get("name"),
        )

    async def _get_period_settings_map(
        self,
        *,
        org_id: str,
        period_id: UUID,
    ) -> Tuple[
        ComprehensiveEvaluationSettings,
        Dict[UUID, ComprehensiveEvaluationSettings],
        Dict[UUID, ComprehensiveEvaluationSettings],
    ]:
        assignment_rows = await self.repo.list_period_assignments(org_id=org_id, period_id=period_id)
        default_record = next(
            (
                row
                for row in assignment_rows
                if row.get("department_id") is None and row.get("stage_id") is None
            ),
            None,
        )

        if default_record is None:
            default_assignment = await self._build_fallback_default_assignment(
                org_id=org_id,
                period_id=period_id,
            )
            default_settings = default_assignment.settings
        else:
            default_settings = self._build_settings_from_json(default_record.get("settings_json"))

        settings_by_department: Dict[UUID, ComprehensiveEvaluationSettings] = {}
        settings_by_stage: Dict[UUID, ComprehensiveEvaluationSettings] = {}
        for row in assignment_rows:
            department_id = row.get("department_id")
            stage_id = row.get("stage_id")
            if department_id is not None:
                settings_by_department[department_id] = self._build_settings_from_json(row.get("settings_json"))
                continue
            if stage_id is not None:
                settings_by_stage[stage_id] = self._build_settings_from_json(row.get("settings_json"))

        return default_settings, settings_by_department, settings_by_stage

    def _resolve_settings_for_assignment_target(
        self,
        *,
        department_id: Optional[UUID],
        stage_id: Optional[UUID],
        default_settings: ComprehensiveEvaluationSettings,
        settings_by_department: Dict[UUID, ComprehensiveEvaluationSettings],
        settings_by_stage: Dict[UUID, ComprehensiveEvaluationSettings],
    ) -> ComprehensiveEvaluationSettings:
        # Department overrides are the most specific target.
        if department_id is not None and department_id in settings_by_department:
            return settings_by_department[department_id]
        if stage_id is not None and stage_id in settings_by_stage:
            return settings_by_stage[stage_id]
        return default_settings

    async def _build_fallback_default_assignment(
        self,
        *,
        org_id: str,
        period_id: UUID,
        templates_raw: Optional[List[Dict[str, Any]]] = None,
    ) -> ComprehensiveRulesetAssignment:
        templates = templates_raw if templates_raw is not None else await self.repo.list_rulesets(org_id=org_id)
        default_template = next((item for item in templates if item.get("is_default_template")), None)

        if default_template is not None:
            settings = self._build_settings_from_json(default_template.get("settings_json"))
            source_ruleset_id = default_template.get("id")
            source_ruleset_name = default_template.get("name")
        else:
            settings = self._build_default_settings()
            source_ruleset_id = None
            source_ruleset_name = None

        return ComprehensiveRulesetAssignment(
            periodId=period_id,
            settings=settings,
            sourceRulesetId=source_ruleset_id,
            sourceRulesetNameSnapshot=source_ruleset_name,
            inheritsDefault=False,
        )

    def _build_ruleset_response(self, record: Dict[str, Any]) -> ComprehensiveRulesetTemplate:
        return ComprehensiveRulesetTemplate(
            id=record["id"],
            name=record["name"],
            settings=self._build_settings_from_json(record.get("settings_json")),
            isDefaultTemplate=bool(record.get("is_default_template")),
            createdAt=record["created_at"],
            updatedAt=record["updated_at"],
        )

    def _build_assignment_response(self, record: Dict[str, Any]) -> ComprehensiveRulesetAssignment:
        return ComprehensiveRulesetAssignment(
            id=record.get("id"),
            periodId=record["period_id"],
            departmentId=record.get("department_id"),
            departmentName=record.get("department_name"),
            stageId=record.get("stage_id"),
            stageName=record.get("stage_name"),
            settings=self._build_settings_from_json(record.get("settings_json")),
            sourceRulesetId=record.get("source_ruleset_id"),
            sourceRulesetNameSnapshot=record.get("source_ruleset_name_snapshot"),
            inheritsDefault=False,
            createdAt=record.get("created_at"),
            updatedAt=record.get("updated_at"),
        )

    async def _resolve_source_ruleset(
        self,
        *,
        org_id: str,
        source_ruleset_id: Optional[UUID],
    ) -> Optional[Dict[str, Any]]:
        if source_ruleset_id is None:
            return None

        ruleset = await self.repo.get_ruleset_by_id(org_id=org_id, ruleset_id=source_ruleset_id)
        if ruleset is None:
            raise NotFoundError("Ruleset not found")
        return ruleset

    async def _get_default_assignment_for_audit(
        self,
        *,
        org_id: str,
        period_id: UUID,
    ) -> ComprehensiveRulesetAssignment:
        assignment = await self.repo.get_assignment(
            org_id=org_id,
            period_id=period_id,
            department_id=None,
            stage_id=None,
        )
        if assignment is not None:
            return self._build_assignment_response(assignment)
        return await self._build_fallback_default_assignment(org_id=org_id, period_id=period_id)

    async def _get_department_assignment_for_audit(
        self,
        *,
        org_id: str,
        period_id: UUID,
        department_id: UUID,
        department_name: str,
    ) -> ComprehensiveRulesetAssignment:
        assignment = await self.repo.get_assignment(
            org_id=org_id,
            period_id=period_id,
            department_id=department_id,
            stage_id=None,
        )
        if assignment is not None:
            return self._build_assignment_response({**assignment, "department_name": department_name})
        return await self._build_inherited_department_assignment(
            org_id=org_id,
            period_id=period_id,
            department_id=department_id,
            department_name=department_name,
        )

    async def _build_inherited_department_assignment(
        self,
        *,
        org_id: str,
        period_id: UUID,
        department_id: UUID,
        department_name: str,
    ) -> ComprehensiveRulesetAssignment:
        default_assignment = await self._get_default_assignment_for_audit(
            org_id=org_id,
            period_id=period_id,
        )
        return ComprehensiveRulesetAssignment(
            periodId=period_id,
            departmentId=department_id,
            departmentName=department_name,
            settings=default_assignment.settings,
            sourceRulesetId=default_assignment.source_ruleset_id,
            sourceRulesetNameSnapshot=default_assignment.source_ruleset_name_snapshot,
            inheritsDefault=True,
        )

    async def _get_stage_assignment_for_audit(
        self,
        *,
        org_id: str,
        period_id: UUID,
        stage_id: UUID,
        stage_name: str,
    ) -> ComprehensiveRulesetAssignment:
        assignment = await self.repo.get_assignment(
            org_id=org_id,
            period_id=period_id,
            department_id=None,
            stage_id=stage_id,
        )
        if assignment is not None:
            return self._build_assignment_response({**assignment, "stage_name": stage_name})
        return await self._build_inherited_stage_assignment(
            org_id=org_id,
            period_id=period_id,
            stage_id=stage_id,
            stage_name=stage_name,
        )

    async def _build_inherited_stage_assignment(
        self,
        *,
        org_id: str,
        period_id: UUID,
        stage_id: UUID,
        stage_name: str,
    ) -> ComprehensiveRulesetAssignment:
        default_assignment = await self._get_default_assignment_for_audit(
            org_id=org_id,
            period_id=period_id,
        )
        return ComprehensiveRulesetAssignment(
            periodId=period_id,
            stageId=stage_id,
            stageName=stage_name,
            settings=default_assignment.settings,
            sourceRulesetId=default_assignment.source_ruleset_id,
            sourceRulesetNameSnapshot=default_assignment.source_ruleset_name_snapshot,
            inheritsDefault=True,
        )

    def _build_settings_from_json(self, settings_json: Optional[Dict[str, Any]]) -> ComprehensiveEvaluationSettings:
        if not settings_json:
            return self._build_default_settings()

        try:
            settings = ComprehensiveEvaluationSettings.model_validate(settings_json)
        except Exception as exc:
            logger.warning("Failed to parse comprehensive settings JSON, using defaults: %s", exc)
            settings = self._build_default_settings()

        self._validate_settings(settings)
        return settings

    def _build_default_settings(self) -> ComprehensiveEvaluationSettings:
        return ComprehensiveEvaluationSettings(
            promotion={
                "ruleGroups": [
                    {
                        "id": "promotion-default",
                        "conditions": [
                            {"type": "rank_at_least", "field": "overallRank", "minimumRank": "A+"},
                            {"type": "rank_at_least", "field": "competencyFinalRank", "minimumRank": "A+"},
                            {"type": "rank_at_least", "field": "coreValueFinalRank", "minimumRank": "A+"},
                        ],
                    }
                ]
            },
            demotion={
                "ruleGroups": [
                    {
                        "id": "demotion-default",
                        "conditions": [
                            {"type": "rank_at_or_worse", "field": "overallRank", "thresholdRank": "D"},
                        ],
                    }
                ]
            },
            overallScoreThresholds=dict(DEFAULT_THRESHOLDS),
            levelDeltaByOverallRank=dict(DEFAULT_LEVEL_DELTAS),
        )

    def _settings_json_from_record(self, record: Dict[str, Any]) -> Dict[str, Any]:
        settings_json = record.get("settings_json")
        if settings_json:
            return settings_json
        return self._build_default_settings().model_dump(mode="json", by_alias=True)

    def _build_row_from_repo_item(
        self,
        *,
        item: Dict[str, object],
        period_id: UUID,
        settings: ComprehensiveEvaluationSettings,
    ) -> ComprehensiveEvaluationRow:
        performance_score = self._to_optional_float(item.get("performance_score"))
        competency_score = self._to_optional_float(item.get("competency_score"))
        core_value_score = self._to_optional_float(item.get("core_value_score"))
        # Category final rank must be judged by the category's raw score (0-7 scale),
        # not by weighted contribution used for total-score aggregation.
        performance_rank_score = self._to_optional_float(item.get("performance_raw_score"))
        competency_rank_score = self._to_optional_float(item.get("competency_raw_score"))
        core_value_rank_score = self._to_optional_float(item.get("core_value_raw_score"))
        performance_weight = self._to_optional_float(item.get("performance_weight_percent"))
        competency_weight = self._to_optional_float(item.get("competency_weight_percent"))

        if performance_rank_score is None:
            performance_rank_score = performance_score
        if competency_rank_score is None:
            competency_rank_score = competency_score
        if core_value_rank_score is None:
            core_value_rank_score = core_value_score

        performance_rank = self._rank_from_score(performance_rank_score, settings.overall_score_thresholds)
        competency_rank = self._rank_from_score(competency_rank_score, settings.overall_score_thresholds)
        core_value_rank = self._rank_from_score(core_value_rank_score, settings.overall_score_thresholds)

        total_score = (
            round(performance_score + competency_score, 2)
            if performance_score is not None and competency_score is not None
            else None
        )
        overall_rank = self._rank_from_score(total_score, settings.overall_score_thresholds)

        employment = item["employment_type"]
        current_level = item.get("current_level")
        current_stage = item.get("current_stage")

        level_delta = None
        if employment == "employee" and overall_rank is not None:
            level_delta = int(settings.level_delta_by_overall_rank[overall_rank])

        new_level = current_level + level_delta if current_level is not None and level_delta is not None else None
        new_stage = current_stage

        rule_context = {
            "overallRank": overall_rank,
            "competencyFinalRank": competency_rank,
            "coreValueFinalRank": core_value_rank,
        }

        promotion_rule_hit = self._evaluate_promotion_groups(
            settings.promotion.rule_groups,
            rule_context,
        )
        demotion_rule_hit = self._evaluate_demotion_groups(
            settings.demotion.rule_groups,
            rule_context,
        )

        promotion_flag = (
            employment == "employee"
            and new_level is not None
            and new_level >= 30
            and promotion_rule_hit
        )
        demotion_flag = demotion_rule_hit

        auto_decision = self._select_auto_decision(
            promotion_flag=promotion_flag,
            demotion_flag=demotion_flag,
        )

        auto_state = ComprehensiveEvaluationComputedState(
            totalScore=total_score,
            overallRank=overall_rank,
            decision=auto_decision,
            promotionFlag=promotion_flag,
            demotionFlag=demotion_flag,
            stageDelta=0,
            levelDelta=level_delta,
            newStage=new_stage,
            newLevel=new_level,
            isPromotionCandidate=promotion_flag,
            isDemotionCandidate=demotion_flag,
        )

        manual_decision = None
        if item.get("manual_decision"):
            manual_decision = ComprehensiveManualDecisionResponse(
                periodId=period_id,
                decision=item["manual_decision"],
                stageAfter=item.get("manual_stage_after"),
                levelAfter=item.get("manual_level_after"),
                reason=item.get("manual_reason") or "",
                doubleCheckedBy=item.get("manual_double_checked_by"),
                appliedByUserId=item.get("manual_applied_by_user_id"),
                appliedAt=item.get("manual_applied_at"),
            )

        applied_state = self._apply_manual_decision(
            auto_state=auto_state,
            manual_decision=manual_decision,
            current_stage=current_stage,
            current_level=current_level,
            employment_type=employment,
        )

        return ComprehensiveEvaluationRow(
            id=item["id"],
            userId=item["user_id"],
            evaluationPeriodId=period_id,
            employeeCode=item["employee_code"],
            name=item["name"],
            departmentName=item.get("department_name"),
            employmentType=employment,
            processingStatus=item["processing_status"],
            performanceFinalRank=performance_rank,
            performanceWeightPercent=performance_weight,
            performanceScore=performance_score,
            competencyFinalRank=competency_rank,
            competencyWeightPercent=competency_weight,
            competencyScore=competency_score,
            coreValueFinalRank=core_value_rank,
            leaderInterviewCleared=None,
            divisionHeadPresentationCleared=None,
            ceoInterviewCleared=None,
            currentStage=current_stage,
            currentLevel=current_level,
            auto=auto_state,
            applied=applied_state,
            manualDecision=manual_decision,
        )
    def _build_settings_from_rules(self, rule_data: Dict[str, List[Dict]]) -> ComprehensiveEvaluationSettings:
        overall_rules = sorted(
            rule_data.get("overall_rules", []),
            key=lambda row: int(row["display_order"]),
        )

        threshold_map: Dict[EvaluationRank, float] = {}
        level_delta_map: Dict[EvaluationRank, int] = {}

        for rank in RANK_ORDER:
            matched = next((row for row in overall_rules if row["overall_rank"] == rank), None)
            if matched:
                threshold_map[rank] = float(matched["min_score"])
                level_delta_map[rank] = int(matched["level_delta"])
            else:
                threshold_map[rank] = DEFAULT_THRESHOLDS[rank]
                level_delta_map[rank] = DEFAULT_LEVEL_DELTAS[rank]

        group_rules = rule_data.get("group_rules", [])
        promotion_groups: List[Dict] = []
        demotion_groups: List[Dict] = []

        grouped_map: Dict[Tuple[str, str], Dict] = {}
        for row in group_rules:
            key = (row["decision_type"], str(row["id"]))
            if key not in grouped_map:
                grouped_map[key] = {
                    "id": str(row["id"]),
                    "decision_type": row["decision_type"],
                    "display_order": int(row["display_order"]),
                    "conditions": [],
                }
            grouped_map[key]["conditions"].append(row)

        grouped_values = sorted(grouped_map.values(), key=lambda g: (g["decision_type"], g["display_order"]))
        for group in grouped_values:
            if group["decision_type"] == "promotion":
                promotion_groups.append(
                    {
                        "id": group["id"],
                        "conditions": [
                            {
                                "type": "rank_at_least",
                                "field": condition["field_name"],
                                "minimumRank": condition["threshold_rank"],
                            }
                            for condition in sorted(group["conditions"], key=lambda c: int(c["condition_order"]))
                        ],
                    }
                )
            elif group["decision_type"] == "demotion":
                demotion_groups.append(
                    {
                        "id": group["id"],
                        "conditions": [
                            {
                                "type": "rank_at_or_worse",
                                "field": condition["field_name"],
                                "thresholdRank": condition["threshold_rank"],
                            }
                            for condition in sorted(group["conditions"], key=lambda c: int(c["condition_order"]))
                        ],
                    }
                )

        if len(promotion_groups) == 0:
            promotion_groups = [
                {
                    "id": "promotion-default",
                    "conditions": [
                        {"type": "rank_at_least", "field": "overallRank", "minimumRank": "A+"},
                        {"type": "rank_at_least", "field": "competencyFinalRank", "minimumRank": "A+"},
                        {"type": "rank_at_least", "field": "coreValueFinalRank", "minimumRank": "A+"},
                    ],
                }
            ]

        if len(demotion_groups) == 0:
            demotion_groups = [
                {
                    "id": "demotion-default",
                    "conditions": [
                        {"type": "rank_at_or_worse", "field": "overallRank", "thresholdRank": "D"},
                    ],
                }
            ]

        return ComprehensiveEvaluationSettings(
            promotion={"ruleGroups": promotion_groups},
            demotion={"ruleGroups": demotion_groups},
            overallScoreThresholds=threshold_map,
            levelDeltaByOverallRank=level_delta_map,
        )

    def _validate_settings(self, settings: ComprehensiveEvaluationSettings) -> None:
        missing_thresholds = [rank for rank in RANK_ORDER if rank not in settings.overall_score_thresholds]
        if missing_thresholds:
            raise BadRequestError(f"Missing threshold ranks: {', '.join(missing_thresholds)}")

        missing_deltas = [rank for rank in RANK_ORDER if rank not in settings.level_delta_by_overall_rank]
        if missing_deltas:
            raise BadRequestError(f"Missing level delta ranks: {', '.join(missing_deltas)}")

        threshold_values = [float(settings.overall_score_thresholds[rank]) for rank in RANK_ORDER]
        for i in range(len(threshold_values) - 1):
            if threshold_values[i] <= threshold_values[i + 1]:
                raise BadRequestError("overallScoreThresholds must be strictly descending from SS to D")

        if len(settings.promotion.rule_groups) == 0:
            raise BadRequestError("promotion.ruleGroups must contain at least one group")
        if len(settings.demotion.rule_groups) == 0:
            raise BadRequestError("demotion.ruleGroups must contain at least one group")

        for group in settings.promotion.rule_groups:
            if len(group.conditions) == 0:
                raise BadRequestError("Each promotion rule group must contain at least one condition")

        for group in settings.demotion.rule_groups:
            if len(group.conditions) == 0:
                raise BadRequestError("Each demotion rule group must contain at least one condition")

    def _build_overall_rules_payload(self, settings: ComprehensiveEvaluationSettings) -> List[Dict[str, object]]:
        payload: List[Dict[str, object]] = []

        for idx, rank in enumerate(RANK_ORDER):
            min_score = float(settings.overall_score_thresholds[rank])
            max_score = None if idx == 0 else float(settings.overall_score_thresholds[RANK_ORDER[idx - 1]])
            payload.append(
                {
                    "overall_rank": rank,
                    "min_score": min_score,
                    "max_score": max_score,
                    "level_delta": int(settings.level_delta_by_overall_rank[rank]),
                    "display_order": idx + 1,
                }
            )

        return payload

    def _build_group_payload(self, groups: Sequence, *, decision_type: str) -> List[Dict[str, object]]:
        payload: List[Dict[str, object]] = []

        for group_idx, group in enumerate(groups):
            condition_payload = []
            for condition_idx, condition in enumerate(group.conditions):
                if decision_type == "promotion":
                    threshold_rank = condition.minimum_rank
                    operator = "rank_at_least"
                else:
                    threshold_rank = condition.threshold_rank
                    operator = "rank_at_or_worse"

                condition_payload.append(
                    {
                        "condition_order": condition_idx + 1,
                        "field_name": condition.field,
                        "operator": operator,
                        "threshold_rank": threshold_rank,
                    }
                )

            payload.append(
                {
                    "group_name": f"{decision_type}-group-{group_idx + 1}",
                    "display_order": group_idx + 1,
                    "conditions": condition_payload,
                }
            )

        return payload

    def _evaluate_promotion_groups(
        self,
        groups: Sequence[PromotionRuleGroup],
        values: Dict[str, Optional[EvaluationRank]],
    ) -> bool:
        for group in groups:
            evaluated_count = 0
            all_passed = True
            for condition in group.conditions:
                actual = values.get(condition.field)
                if actual is None:
                    continue

                evaluated_count += 1
                if not self._is_rank_at_least(actual, condition.minimum_rank):
                    all_passed = False
                    break

            if evaluated_count > 0 and all_passed:
                return True
        return False

    def _evaluate_demotion_groups(
        self,
        groups: Sequence[DemotionRuleGroup],
        values: Dict[str, Optional[EvaluationRank]],
    ) -> bool:
        for group in groups:
            evaluated_count = 0
            all_passed = True
            for condition in group.conditions:
                actual = values.get(condition.field)
                if actual is None:
                    continue

                evaluated_count += 1
                if not self._is_rank_at_or_worse(actual, condition.threshold_rank):
                    all_passed = False
                    break

            if evaluated_count > 0 and all_passed:
                return True
        return False

    def _apply_manual_decision(
        self,
        *,
        auto_state: ComprehensiveEvaluationComputedState,
        manual_decision: Optional[ComprehensiveManualDecisionResponse],
        current_stage: Optional[str],
        current_level: Optional[int],
        employment_type: str,
    ) -> ComprehensiveEvaluationComputedState:
        if manual_decision is None:
            return auto_state

        decision = manual_decision.decision
        stage_after = auto_state.new_stage
        level_after = auto_state.new_level

        if decision != "対象外" and manual_decision.stage_after and manual_decision.stage_after.strip():
            stage_after = manual_decision.stage_after.strip()

        if (
            decision != "対象外"
            and employment_type == "employee"
        ):
            if manual_decision.level_after is not None:
                level_after = manual_decision.level_after
            elif current_level is not None:
                level_after = current_level

        stage_delta = self._parse_stage_delta(current_stage, stage_after)
        if current_level is not None and level_after is not None:
            level_delta = level_after - current_level
        else:
            level_delta = auto_state.level_delta

        return ComprehensiveEvaluationComputedState(
            totalScore=auto_state.total_score,
            overallRank=auto_state.overall_rank,
            decision=decision,
            promotionFlag=auto_state.promotion_flag,
            demotionFlag=auto_state.demotion_flag,
            stageDelta=stage_delta,
            levelDelta=level_delta,
            newStage=stage_after,
            newLevel=level_after,
            isPromotionCandidate=auto_state.is_promotion_candidate,
            isDemotionCandidate=auto_state.is_demotion_candidate,
        )

    def _parse_stage_delta(self, current_stage: Optional[str], next_stage: Optional[str]) -> int:
        current = self._parse_stage_number(current_stage)
        nxt = self._parse_stage_number(next_stage)
        if current is None or nxt is None:
            return 0
        return nxt - current

    def _parse_stage_number(self, stage_name: Optional[str]) -> Optional[int]:
        if not stage_name:
            return None

        lowered = stage_name.lower().replace(" ", "")
        if "stage" not in lowered:
            return None

        digits = "".join(ch for ch in lowered if ch.isdigit())
        if not digits:
            return None

        try:
            return int(digits)
        except ValueError:
            return None

    def _select_auto_decision(self, *, promotion_flag: bool, demotion_flag: bool) -> ComprehensiveDecision:
        if promotion_flag and not demotion_flag:
            return "昇格"
        if demotion_flag and not promotion_flag:
            return "降格"
        return "対象外"

    def _rank_from_score(
        self,
        score: Optional[float],
        thresholds: Dict[EvaluationRank, float],
    ) -> Optional[EvaluationRank]:
        if score is None:
            return None

        for rank in RANK_ORDER:
            if score >= float(thresholds[rank]):
                return rank
        return RANK_ORDER[-1]

    def _is_rank_at_least(self, actual: EvaluationRank, minimum: EvaluationRank) -> bool:
        return RANK_INDEX[actual] <= RANK_INDEX[minimum]

    def _is_rank_at_or_worse(self, actual: EvaluationRank, threshold: EvaluationRank) -> bool:
        return RANK_INDEX[actual] >= RANK_INDEX[threshold]

    async def _ensure_period_exists(self, period_id: UUID, org_id: str):
        period = await self.period_repo.get_by_id(period_id, org_id)
        if period is None:
            raise NotFoundError("Evaluation period not found")
        return period

    def _ensure_period_allows_settings_mutation(self, period) -> None:
        if self._is_settings_locked(period):
            raise BadRequestError("Cannot modify settings for completed or cancelled evaluation periods")

    def _ensure_period_allows_manual_decision(self, period) -> None:
        status = self._get_period_status(period)
        if status == "cancelled":
            raise BadRequestError("Cannot modify manual decisions for cancelled evaluation periods")
        if status != "completed":
            raise BadRequestError("Manual decisions are allowed only after finalization")

    def _ensure_period_allows_user_processing(self, period) -> None:
        status = self._get_period_status(period)
        if status == "cancelled":
            raise BadRequestError("Cannot process evaluations for cancelled evaluation periods")

    def _get_period_status(self, period) -> str:
        status = getattr(period.status, "value", period.status)
        return str(status).lower()

    def _is_settings_locked(self, period) -> bool:
        return self._get_period_status(period) in {"completed", "cancelled"}

    def _require_read_role(self, context: AuthContext) -> None:
        if not context.has_any_role(["admin", "eval_admin"]):
            raise PermissionDeniedError("Access denied. Requires admin or eval_admin role")

    def _require_list_read_role(self, *, context: AuthContext, candidate_view: bool) -> None:
        if candidate_view:
            self._require_write_role(context)
            return
        self._require_read_role(context)

    def _require_write_role(self, context: AuthContext) -> None:
        if not context.has_role("eval_admin"):
            raise PermissionDeniedError("Access denied. Requires eval_admin role")

    def _require_org(self, context: AuthContext) -> str:
        if not context.organization_id:
            raise PermissionDeniedError("Organization context required")
        return context.organization_id

    def _require_user_id(self, context: AuthContext) -> UUID:
        if not context.user_id:
            raise PermissionDeniedError("Authenticated user is required")
        return context.user_id

    def _to_optional_float(self, value) -> Optional[float]:
        if value is None:
            return None
        return float(value)

    async def _get_stage_name_maps(self, org_id: str) -> Tuple[Dict[str, UUID], Dict[str, UUID]]:
        stage_models = await self.stage_repo.get_all(org_id)
        stage_name_to_id: Dict[str, UUID] = {}
        stage_name_folded_to_id: Dict[str, UUID] = {}

        for stage in stage_models:
            stage_name = self._normalize_stage_name(getattr(stage, "name", None))
            if stage_name is None:
                continue

            stage_name_to_id[stage_name] = stage.id
            stage_name_folded_to_id.setdefault(stage_name.casefold(), stage.id)

        return stage_name_to_id, stage_name_folded_to_id

    def _resolve_stage_id(
        self,
        *,
        stage_name: str,
        stage_name_to_id: Dict[str, UUID],
        stage_name_folded_to_id: Dict[str, UUID],
    ) -> Optional[UUID]:
        direct_match = stage_name_to_id.get(stage_name)
        if direct_match is not None:
            return direct_match
        return stage_name_folded_to_id.get(stage_name.casefold())

    def _normalize_stage_name(self, stage_name: Optional[str]) -> Optional[str]:
        if stage_name is None:
            return None
        normalized = stage_name.strip()
        return normalized if normalized else None
