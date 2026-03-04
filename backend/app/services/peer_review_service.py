from __future__ import annotations
import logging
from typing import Optional, List
from uuid import UUID

from ..database.repositories.peer_review_assignment_repo import PeerReviewAssignmentRepository
from ..database.repositories.peer_review_evaluation_repo import PeerReviewEvaluationRepository
from ..database.repositories.core_value_definition_repo import CoreValueDefinitionRepository
from ..database.repositories.core_value_evaluation_repo import CoreValueEvaluationRepository
from ..database.repositories.core_value_feedback_repo import CoreValueFeedbackRepository
from ..database.repositories.user_repo import UserRepository
from ..schemas.peer_review import (
    PeerReviewAssignReviewersRequest,
    PeerReviewAssignmentResponse,
    PeerReviewAssignmentsByReviewee,
    PeerReviewEvaluationUpdate,
    PeerReviewEvaluationResponse,
    PeerReviewAveragedScores,
    PeerReviewCoreValueAverage,
    CoreValueSummaryResponse,
    CoreValueSummarySource,
)
from ..schemas.core_value import CORE_VALUE_RATING_VALUES, CoreValueRatingCode
from ..security.context import AuthContext
from ..security.permissions import Permission
from ..security.decorators import require_any_permission
from ..security.rbac_helper import RBACHelper
from ..core.exceptions import (
    NotFoundError, PermissionDeniedError, ValidationError, BadRequestError
)
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# Build a string-keyed lookup from the canonical CORE_VALUE_RATING_VALUES
_RATING_CODE_TO_NUMERIC: dict[str, float] = {
    code.value: val for code, val in CORE_VALUE_RATING_VALUES.items()
}


class PeerReviewService:
    """Service layer for peer review business logic."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.assignment_repo = PeerReviewAssignmentRepository(session)
        self.evaluation_repo = PeerReviewEvaluationRepository(session)
        self.cv_definition_repo = CoreValueDefinitionRepository(session)
        self.cv_evaluation_repo = CoreValueEvaluationRepository(session)
        self.cv_feedback_repo = CoreValueFeedbackRepository(session)
        self.user_repo = UserRepository(session)
        RBACHelper.initialize_with_repository(self.user_repo)

    # ========================================
    # ADMIN - ASSIGNMENTS
    # ========================================

    @require_any_permission([Permission.GOAL_READ_ALL])
    async def get_assignments_for_period(
        self,
        current_user_context: AuthContext,
        period_id: UUID
    ) -> List[PeerReviewAssignmentsByReviewee]:
        """Get all assignments for a period, grouped by reviewee (admin)."""
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")

        assignments = await self.assignment_repo.get_assignments_for_period(period_id, org_id)

        # Group by reviewee
        grouped: dict[UUID, dict] = {}
        for a in assignments:
            rid = a.reviewee_id
            if rid not in grouped:
                grouped[rid] = {
                    "reviewee_id": rid,
                    "reviewee_name": a.reviewee.name if a.reviewee else "",
                    "department_name": a.reviewee.department.name if a.reviewee and a.reviewee.department else None,
                    "assignments": [],
                }
            grouped[rid]["assignments"].append(
                PeerReviewAssignmentResponse.model_validate(a)
            )

        return [
            PeerReviewAssignmentsByReviewee(**data)
            for data in grouped.values()
        ]

    @require_any_permission([Permission.GOAL_READ_ALL])
    async def assign_reviewers(
        self,
        current_user_context: AuthContext,
        period_id: UUID,
        reviewee_id: UUID,
        data: PeerReviewAssignReviewersRequest
    ) -> List[PeerReviewAssignmentResponse]:
        """Assign reviewers to a reviewee. Validates exactly 2, no self-assign."""
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")

        reviewer_ids = data.reviewer_ids

        # Validate exactly 2 reviewers
        if len(reviewer_ids) != 2:
            raise ValidationError("Exactly 2 reviewers must be assigned")

        # No duplicates
        if len(set(reviewer_ids)) != len(reviewer_ids):
            raise ValidationError("Duplicate reviewer IDs are not allowed")

        # No self-assign
        for rid in reviewer_ids:
            if rid == reviewee_id:
                raise ValidationError("A user cannot review themselves")

        try:
            # Delete existing assignments (cascade deletes evaluations)
            await self.assignment_repo.delete_assignments_for_reviewee(period_id, reviewee_id, org_id)

            # Create new assignments + auto-create evaluations
            results = []
            for reviewer_id in reviewer_ids:
                assignment = await self.assignment_repo.create_assignment(
                    period_id=period_id,
                    reviewee_id=reviewee_id,
                    reviewer_id=reviewer_id,
                    assigned_by=current_user_context.user_id,
                    org_id=org_id,
                )
                # Auto-create evaluation in draft
                await self.evaluation_repo.create_evaluation(
                    assignment_id=assignment.id,
                    period_id=period_id,
                    reviewee_id=reviewee_id,
                    reviewer_id=reviewer_id,
                    org_id=org_id,
                )
                results.append(
                    PeerReviewAssignmentResponse.model_validate(assignment)
                )

            await self.session.commit()
            return results

        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error assigning reviewers for reviewee {reviewee_id}: {e}")
            raise

    @require_any_permission([Permission.GOAL_READ_ALL])
    async def remove_assignment(
        self,
        current_user_context: AuthContext,
        assignment_id: UUID
    ) -> bool:
        """Remove a single assignment (admin)."""
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")

        try:
            result = await self.assignment_repo.delete_assignment(assignment_id, org_id)
            await self.session.commit()
            return result
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error removing assignment {assignment_id}: {e}")
            raise

    # ========================================
    # REVIEWER - EVALUATIONS
    # ========================================

    @require_any_permission([Permission.ASSESSMENT_READ_SELF, Permission.ASSESSMENT_READ_ALL])
    async def get_my_pending_reviews(
        self,
        current_user_context: AuthContext,
        period_id: UUID
    ) -> List[PeerReviewEvaluationResponse]:
        """Get all evaluations assigned to the current user as reviewer."""
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")

        evaluations = await self.evaluation_repo.get_evaluations_for_reviewer(
            period_id, current_user_context.user_id, org_id
        )

        return [
            PeerReviewEvaluationResponse.model_validate(e)
            for e in evaluations
        ]

    @require_any_permission([Permission.ASSESSMENT_MANAGE_SELF, Permission.ASSESSMENT_READ_ALL])
    async def save_evaluation(
        self,
        current_user_context: AuthContext,
        eval_id: UUID,
        data: PeerReviewEvaluationUpdate
    ) -> PeerReviewEvaluationResponse:
        """Auto-save peer review evaluation (draft only, reviewer only)."""
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")

        try:
            existing = await self.evaluation_repo.get_evaluation_by_id(eval_id, org_id)
            if not existing:
                raise NotFoundError(f"Peer review evaluation not found: {eval_id}")

            if existing.reviewer_id != current_user_context.user_id:
                raise PermissionDeniedError("You can only save your own peer review")

            update_data = {}
            if data.scores is not None:
                update_data["scores"] = data.scores
            if data.comment is not None:
                update_data["comment"] = data.comment

            updated = await self.evaluation_repo.update_evaluation(eval_id, update_data, org_id)
            await self.session.commit()

            return PeerReviewEvaluationResponse.model_validate(updated)

        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error saving peer review evaluation {eval_id}: {e}")
            raise

    @require_any_permission([Permission.ASSESSMENT_MANAGE_SELF, Permission.ASSESSMENT_READ_ALL])
    async def submit_evaluation(
        self,
        current_user_context: AuthContext,
        eval_id: UUID
    ) -> PeerReviewEvaluationResponse:
        """Submit peer review evaluation. Validates 9 scores + 1 comment. Definitive."""
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")

        try:
            existing = await self.evaluation_repo.get_evaluation_by_id(eval_id, org_id)
            if not existing:
                raise NotFoundError(f"Peer review evaluation not found: {eval_id}")

            if existing.reviewer_id != current_user_context.user_id:
                raise PermissionDeniedError("You can only submit your own peer review")

            # Validate all 9 scores are present
            definitions = await self.cv_definition_repo.get_definitions(org_id)
            definition_ids = {str(d.id) for d in definitions}

            if not existing.scores:
                raise ValidationError("All 9 core value scores are required before submission")

            missing = definition_ids - set(existing.scores.keys())
            if missing:
                raise ValidationError(f"Missing scores for {len(missing)} core values. All 9 are required.")

            # Validate comment is present
            if not existing.comment or not existing.comment.strip():
                raise ValidationError("General comment is required before submission")

            # Submit (definitive - no reopen)
            updated = await self.evaluation_repo.submit_evaluation(eval_id, org_id)
            await self.session.commit()

            return PeerReviewEvaluationResponse.model_validate(updated)

        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error submitting peer review evaluation {eval_id}: {e}")
            raise

    # ========================================
    # REVIEWEE - AVERAGED RESULTS
    # ========================================

    @require_any_permission([Permission.ASSESSMENT_READ_SELF, Permission.ASSESSMENT_READ_ALL])
    async def get_averaged_peer_review(
        self,
        current_user_context: AuthContext,
        period_id: UUID,
        user_id: Optional[UUID] = None
    ) -> PeerReviewAveragedScores:
        """Get anonymized averaged peer review scores. Never exposes reviewer identity."""
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")

        target_user_id = user_id or current_user_context.user_id

        # Non-admin can only see their own
        if target_user_id != current_user_context.user_id:
            # Check admin permission
            accessible = await RBACHelper.get_accessible_user_ids(current_user_context)
            if accessible is not None and target_user_id not in accessible:
                raise PermissionDeniedError("You can only view your own peer review results")

        submitted = await self.evaluation_repo.get_submitted_evaluations_for_reviewee(
            period_id, target_user_id, org_id
        )

        # Calculate averages per core value
        averages = self._calculate_averages(submitted)

        return PeerReviewAveragedScores(
            reviewee_id=target_user_id,
            period_id=period_id,
            completed_reviews=len(submitted),
            averages=averages,
        )

    def _calculate_averages(self, evaluations: list) -> List[PeerReviewCoreValueAverage]:
        """Calculate average scores per core value from submitted evaluations."""
        if not evaluations:
            return []

        # Collect scores per core value definition ID
        scores_by_cv: dict[str, list[float]] = {}
        for ev in evaluations:
            if not ev.scores:
                continue
            for cv_id, rating_code in ev.scores.items():
                numeric = _RATING_CODE_TO_NUMERIC.get(rating_code)
                if numeric is not None:
                    if cv_id not in scores_by_cv:
                        scores_by_cv[cv_id] = []
                    scores_by_cv[cv_id].append(numeric)

        # Calculate averages
        result = []
        for cv_id, values in scores_by_cv.items():
            avg = sum(values) / len(values)
            result.append(
                PeerReviewCoreValueAverage(
                    core_value_definition_id=cv_id,
                    average_score=round(avg, 2),
                    rating_code=self._score_to_final_rating(avg),
                )
            )

        return result

    # ========================================
    # ADMIN - 総合評価 (CORE VALUE SUMMARY)
    # ========================================

    @require_any_permission([Permission.GOAL_READ_ALL])
    async def get_core_value_summary(
        self,
        current_user_context: AuthContext,
        period_id: UUID,
        user_id: UUID
    ) -> CoreValueSummaryResponse:
        """Get 総合評価 combining 4 sources with equal weight (admin only)."""
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")

        sources_scores: list[float] = []

        # 1. 自己評価 - from core_value_evaluations
        self_score = None
        self_rating = None
        cv_eval = await self.cv_evaluation_repo.get_evaluation(period_id, user_id, org_id)
        if cv_eval and cv_eval.status in ("submitted", "approved") and cv_eval.scores:
            self_score = self._calculate_source_average(cv_eval.scores)
            if self_score is not None:
                self_rating = self._score_to_final_rating(self_score)
                sources_scores.append(self_score)

        # 2. 同僚評価 - from peer_review_evaluations (each reviewer is a separate source)
        peer_sources: List[CoreValueSummarySource] = []
        submitted_evals = await self.evaluation_repo.get_submitted_evaluations_for_reviewee(
            period_id, user_id, org_id
        )
        for i, ev in enumerate(submitted_evals, 1):
            peer_score = self._calculate_source_average(ev.scores)
            peer_rating = self._score_to_final_rating(peer_score) if peer_score is not None else None
            peer_sources.append(
                CoreValueSummarySource(
                    label=f"同僚評価{self._to_circled_number(i)}",
                    rating_code=peer_rating,
                    score=round(peer_score, 2) if peer_score is not None else None,
                )
            )
            if peer_score is not None:
                sources_scores.append(peer_score)

        # 3. 上長評価 - from core_value_feedback
        supervisor_score = None
        supervisor_rating = None
        if cv_eval:
            feedback = await self.cv_feedback_repo.get_feedback_by_evaluation(cv_eval.id, org_id)
            if feedback and feedback.status == "submitted" and feedback.scores:
                supervisor_score = self._calculate_source_average(feedback.scores)
                if supervisor_score is not None:
                    supervisor_rating = self._score_to_final_rating(supervisor_score)
                    sources_scores.append(supervisor_score)

        # 4. 総合平均 - equal weight average of available sources
        overall_score = None
        overall_rating = None
        if sources_scores:
            overall_score = round(sum(sources_scores) / len(sources_scores), 2)
            overall_rating = self._score_to_final_rating(overall_score)

        return CoreValueSummaryResponse(
            self_rating=self_rating,
            self_score=round(self_score, 2) if self_score is not None else None,
            peer_sources=peer_sources,
            supervisor_rating=supervisor_rating,
            supervisor_score=round(supervisor_score, 2) if supervisor_score is not None else None,
            overall_rating=overall_rating,
            overall_score=overall_score,
        )

    @staticmethod
    def _to_circled_number(n: int) -> str:
        """Convert integer to circled number character (①②③...)."""
        circled = "①②③④⑤⑥⑦⑧⑨⑩"
        if 1 <= n <= len(circled):
            return circled[n - 1]
        return f"({n})"

    # ========================================
    # RATING UTILITIES
    # ========================================

    @staticmethod
    def _score_to_final_rating(score: float) -> str:
        """Convert numeric score to rating code using same thresholds as frontend."""
        if score >= 6.5:
            return "SS"
        if score >= 5.5:
            return "S"
        if score >= 4.5:
            return "A+"
        if score >= 3.7:
            return "A"
        if score >= 2.7:
            return "A-"
        if score >= 1.7:
            return "B"
        if score >= 1.0:
            return "C"
        return "D"

    @staticmethod
    def _calculate_source_average(scores: dict) -> Optional[float]:
        """Calculate the average numeric score from a scores JSONB dict."""
        if not scores:
            return None
        values = []
        for rating_code in scores.values():
            numeric = _RATING_CODE_TO_NUMERIC.get(rating_code)
            if numeric is not None:
                values.append(numeric)
        if not values:
            return None
        return sum(values) / len(values)
