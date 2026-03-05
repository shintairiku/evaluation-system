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
from ..database.repositories.evaluation_period_repo import EvaluationPeriodRepository
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
    EvaluationProgressEntry,
    EvaluationProgressSource,
    CoreValueItemScore,
    EvaluationSourceComment,
    EvaluationDetailResponse,
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
        self.period_repo = EvaluationPeriodRepository(session)
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
                # Eagerly load relationships for response serialization
                # (async SQLAlchemy cannot lazy-load)
                await self.session.refresh(assignment, attribute_names=['reviewer', 'evaluation'])
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
    # ADMIN - 評価進捗 (EVALUATION PROGRESS)
    # ========================================

    @require_any_permission([Permission.GOAL_READ_ALL])
    async def get_evaluation_progress(
        self,
        current_user_context: AuthContext,
        period_id: UUID,
    ) -> List[EvaluationProgressEntry]:
        """Get evaluation progress for all active users in a period (admin)."""
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")

        # 1. All active users
        all_users = await self.user_repo.get_active_users(org_id)
        user_ids = [u.id for u in all_users]

        if not user_ids:
            return []

        # 2. Self-assessment statuses (batch)
        cv_statuses = await self.cv_evaluation_repo.get_evaluation_status_by_users(
            user_ids, period_id, org_id
        )

        # 3. Peer review assignments (already groups by reviewee with evaluation status)
        assignments = await self.assignment_repo.get_assignments_for_period(period_id, org_id)
        assignments_by_reviewee: dict[str, list] = {}
        for a in assignments:
            rid = str(a.reviewee_id)
            if rid not in assignments_by_reviewee:
                assignments_by_reviewee[rid] = []
            assignments_by_reviewee[rid].append(a)

        # 4. Supervisor feedback statuses (batch)
        feedback_rows = await self.cv_feedback_repo.get_feedbacks_status_for_period(period_id, org_id)
        feedback_by_subordinate: dict[str, dict] = {}
        for row in feedback_rows:
            feedback_by_subordinate[row["subordinate_id"]] = row

        # 5. Build entries
        entries: List[EvaluationProgressEntry] = []
        for user in all_users:
            uid = str(user.id)

            # Self assessment
            cv_status = cv_statuses.get(uid)
            self_status = None
            if cv_status:
                s = cv_status["status"]
                self_status = "submitted" if s in ("submitted", "approved") else s
            self_assessment = EvaluationProgressSource(
                evaluator_name=user.name,
                status=self_status,
            )

            # Peer reviewers
            user_assignments = assignments_by_reviewee.get(uid, [])
            # Sort by creation order
            user_assignments.sort(key=lambda a: a.created_at)

            peer1 = EvaluationProgressSource(evaluator_name=None, status=None)
            peer2 = EvaluationProgressSource(evaluator_name=None, status=None)

            for i, a in enumerate(user_assignments[:2]):
                reviewer_name = a.reviewer.name if a.reviewer else None
                eval_status = a.evaluation_status  # property on model
                source = EvaluationProgressSource(
                    evaluator_name=reviewer_name,
                    status=eval_status,
                )
                if i == 0:
                    peer1 = source
                else:
                    peer2 = source

            # Supervisor feedback
            fb = feedback_by_subordinate.get(uid)
            if fb:
                sup_name = fb["supervisor_name"]
                sup_status = fb["status"]
            else:
                # Fallback: get supervisor from user relationships
                sup_name = None
                if user.supervisor_relations:
                    sup_rel = user.supervisor_relations[0]
                    if sup_rel.supervisor:
                        sup_name = sup_rel.supervisor.name
                sup_status = None
            supervisor_source = EvaluationProgressSource(
                evaluator_name=sup_name,
                status=sup_status,
            )

            entries.append(EvaluationProgressEntry(
                user_id=user.id,
                user_name=user.name,
                department_name=user.department.name if user.department else None,
                self_assessment=self_assessment,
                peer_reviewer1=peer1,
                peer_reviewer2=peer2,
                supervisor=supervisor_source,
            ))

        return entries

    # ========================================
    # ADMIN - 評価詳細 (EVALUATION DETAIL)
    # ========================================

    @require_any_permission([Permission.GOAL_READ_ALL])
    async def get_evaluation_detail(
        self,
        current_user_context: AuthContext,
        period_id: UUID,
        user_id: UUID,
    ) -> EvaluationDetailResponse:
        """Get detailed evaluation data for a user: core value scores grid + comments (admin)."""
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")

        # 1. User info
        user = await self.user_repo.get_user_by_id_with_details(user_id, org_id)
        if not user:
            raise NotFoundError(f"User not found: {user_id}")

        # 2. Period info
        period = await self.period_repo.get_by_id(period_id, org_id)
        period_name = period.name if period else None

        # 3. Core value definitions (ordered)
        definitions = await self.cv_definition_repo.get_definitions(org_id)

        # 4. Self-assessment (joinloads feedback)
        cv_eval = await self.cv_evaluation_repo.get_evaluation(period_id, user_id, org_id)

        # 5. Peer evaluations (submitted only)
        peer_evals = await self.evaluation_repo.get_submitted_evaluations_for_reviewee(
            period_id, user_id, org_id
        )

        # 6. Peer reviewer names from assignments
        all_assignments = await self.assignment_repo.get_assignments_for_period(period_id, org_id)
        user_assignments = [
            a for a in all_assignments if a.reviewee_id == user_id
        ]
        user_assignments.sort(key=lambda a: a.created_at)

        peer1_name = user_assignments[0].reviewer.name if len(user_assignments) > 0 and user_assignments[0].reviewer else None
        peer2_name = user_assignments[1].reviewer.name if len(user_assignments) > 1 and user_assignments[1].reviewer else None

        # Map peer evaluations to slots (peer1 / peer2) by reviewer_id order
        peer1_eval = None
        peer2_eval = None
        if len(user_assignments) > 0:
            for ev in peer_evals:
                if ev.reviewer_id == user_assignments[0].reviewer_id:
                    peer1_eval = ev
                elif len(user_assignments) > 1 and ev.reviewer_id == user_assignments[1].reviewer_id:
                    peer2_eval = ev

        # 7. Supervisor feedback (from joinloaded cv_eval.feedback)
        supervisor_feedback = None
        if cv_eval and hasattr(cv_eval, 'feedback') and cv_eval.feedback:
            supervisor_feedback = cv_eval.feedback

        # 8. Build core value score grid
        core_values: List[CoreValueItemScore] = []
        for i, defn in enumerate(definitions):
            def_id_str = str(defn.id)

            self_rating = None
            if cv_eval and cv_eval.status in ("submitted", "approved") and cv_eval.scores:
                self_rating = cv_eval.scores.get(def_id_str)

            p1_rating = None
            if peer1_eval and peer1_eval.scores:
                p1_rating = peer1_eval.scores.get(def_id_str)

            p2_rating = None
            if peer2_eval and peer2_eval.scores:
                p2_rating = peer2_eval.scores.get(def_id_str)

            sup_rating = None
            if supervisor_feedback and supervisor_feedback.status == "submitted" and supervisor_feedback.scores:
                sup_rating = supervisor_feedback.scores.get(def_id_str)

            # Calculate average from available ratings
            numeric_values = []
            for r in [self_rating, p1_rating, p2_rating, sup_rating]:
                if r is not None:
                    num = _RATING_CODE_TO_NUMERIC.get(r)
                    if num is not None:
                        numeric_values.append(num)

            avg_rating = None
            if numeric_values:
                avg = sum(numeric_values) / len(numeric_values)
                avg_rating = self._score_to_final_rating(avg)

            core_values.append(CoreValueItemScore(
                definition_id=defn.id,
                display_order=i + 1,
                name=defn.name,
                self_rating=self_rating,
                peer1_rating=p1_rating,
                peer2_rating=p2_rating,
                supervisor_rating=sup_rating,
                average_rating=avg_rating,
            ))

        # 9. Build comments list
        comments: List[EvaluationSourceComment] = []

        # Self comment
        self_comment = None
        if cv_eval and cv_eval.status in ("submitted", "approved"):
            self_comment = cv_eval.comment if hasattr(cv_eval, 'comment') else None
        comments.append(EvaluationSourceComment(
            source_label=f"{user.name}（自己評価）",
            source_type="self",
            comment=self_comment,
        ))

        # Peer 1 comment
        comments.append(EvaluationSourceComment(
            source_label=f"{peer1_name or '未割当'}（同僚評価①）",
            source_type="peer1",
            comment=peer1_eval.comment if peer1_eval else None,
        ))

        # Peer 2 comment
        comments.append(EvaluationSourceComment(
            source_label=f"{peer2_name or '未割当'}（同僚評価②）",
            source_type="peer2",
            comment=peer2_eval.comment if peer2_eval else None,
        ))

        # Supervisor comment
        sup_name = None
        if user.supervisor_relations and len(user.supervisor_relations) > 0:
            sup_rel = user.supervisor_relations[0]
            if sup_rel.supervisor:
                sup_name = sup_rel.supervisor.name
        sup_comment = None
        if supervisor_feedback and supervisor_feedback.status == "submitted":
            sup_comment = supervisor_feedback.comment if hasattr(supervisor_feedback, 'comment') else None
        comments.append(EvaluationSourceComment(
            source_label=f"{sup_name or '未割当'}（上長評価）",
            source_type="supervisor",
            comment=sup_comment,
        ))

        # 10. Check if all 4 sources are submitted
        self_submitted = cv_eval is not None and cv_eval.status in ("submitted", "approved")
        peer1_submitted = peer1_eval is not None
        peer2_submitted = peer2_eval is not None
        sup_submitted = supervisor_feedback is not None and supervisor_feedback.status == "submitted"
        all_submitted = self_submitted and peer1_submitted and peer2_submitted and sup_submitted

        # 11. Calculate overall average across 4 sources
        source_scores: list[float] = []
        self_avg = self._calculate_source_average(cv_eval.scores) if cv_eval and cv_eval.status in ("submitted", "approved") and cv_eval.scores else None
        if self_avg is not None:
            source_scores.append(self_avg)
        p1_avg = self._calculate_source_average(peer1_eval.scores) if peer1_eval and peer1_eval.scores else None
        if p1_avg is not None:
            source_scores.append(p1_avg)
        p2_avg = self._calculate_source_average(peer2_eval.scores) if peer2_eval and peer2_eval.scores else None
        if p2_avg is not None:
            source_scores.append(p2_avg)
        sup_avg = self._calculate_source_average(supervisor_feedback.scores) if supervisor_feedback and supervisor_feedback.status == "submitted" and supervisor_feedback.scores else None
        if sup_avg is not None:
            source_scores.append(sup_avg)

        overall_rating = None
        if source_scores:
            overall = sum(source_scores) / len(source_scores)
            overall_rating = self._score_to_final_rating(overall)

        # User info
        dept_name = user.department.name if user.department else None
        position_name = user.job_title if hasattr(user, 'job_title') else None

        return EvaluationDetailResponse(
            user_id=user.id,
            user_name=user.name,
            department_name=dept_name,
            position_name=position_name,
            supervisor_name=sup_name,
            period_name=period_name,
            all_submitted=all_submitted,
            core_values=core_values,
            comments=comments,
            self_avg_rating=self._score_to_final_rating(self_avg) if self_avg is not None else None,
            peer1_avg_rating=self._score_to_final_rating(p1_avg) if p1_avg is not None else None,
            peer2_avg_rating=self._score_to_final_rating(p2_avg) if p2_avg is not None else None,
            supervisor_avg_rating=self._score_to_final_rating(sup_avg) if sup_avg is not None else None,
            overall_rating=overall_rating,
        )

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
