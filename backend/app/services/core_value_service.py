from __future__ import annotations
import logging
from typing import Optional, List
from uuid import UUID

from ..database.repositories.core_value_definition_repo import CoreValueDefinitionRepository
from ..database.repositories.core_value_evaluation_repo import CoreValueEvaluationRepository
from ..database.repositories.core_value_feedback_repo import CoreValueFeedbackRepository
from ..database.repositories.user_repo import UserRepository
from ..schemas.core_value import (
    CoreValueDefinitionResponse,
    CoreValueEvaluationUpdate,
    CoreValueEvaluationResponse,
    CoreValueFeedbackUpdate,
    CoreValueFeedbackSubmit,
    CoreValueFeedbackReturn,
    CoreValueFeedbackResponse,
    CoreValueSubordinateDataResponse,
    CoreValueFeedbackAction,
)
from ..security.context import AuthContext
from ..security.permissions import Permission
from ..security.decorators import require_any_permission
from ..security.rbac_helper import RBACHelper
from ..core.exceptions import (
    NotFoundError, PermissionDeniedError, BadRequestError, ValidationError
)
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class CoreValueService:
    """Service layer for core value evaluation business logic."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.definition_repo = CoreValueDefinitionRepository(session)
        self.evaluation_repo = CoreValueEvaluationRepository(session)
        self.feedback_repo = CoreValueFeedbackRepository(session)
        self.user_repo = UserRepository(session)
        RBACHelper.initialize_with_repository(self.user_repo)

    # ========================================
    # DEFINITIONS
    # ========================================

    async def get_definitions(self, current_user_context: AuthContext) -> List[CoreValueDefinitionResponse]:
        """Get core value definitions for the current organization."""
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")

        definitions = await self.definition_repo.get_definitions(org_id)
        return [CoreValueDefinitionResponse.model_validate(d) for d in definitions]

    async def seed_definitions(self, current_user_context: AuthContext) -> int:
        """Seed default core value definitions (admin only)."""
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")

        inserted = await self.definition_repo.seed_default_definitions(org_id)
        await self.session.commit()
        return inserted

    # ========================================
    # EVALUATION (employee)
    # ========================================

    async def ensure_evaluation_exists(self, period_id: UUID, user_id: UUID, org_id: str):
        """Create a draft core value evaluation if it doesn't already exist."""
        try:
            existing = await self.evaluation_repo.get_evaluation(period_id, user_id, org_id)
            if existing:
                return existing
            return await self.evaluation_repo.create_evaluation(period_id, user_id, org_id)
        except Exception as e:
            logger.error(f"Error ensuring core value evaluation exists: {e}")
            # Don't re-raise to avoid blocking the calling flow
            return None

    @require_any_permission([Permission.ASSESSMENT_READ_SELF, Permission.ASSESSMENT_READ_ALL])
    async def get_my_evaluation(
        self,
        current_user_context: AuthContext,
        period_id: UUID
    ) -> Optional[CoreValueEvaluationResponse]:
        """Get the current user's core value evaluation for a period."""
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")

        evaluation = await self.evaluation_repo.get_evaluation(
            period_id, current_user_context.user_id, org_id
        )
        if not evaluation:
            return None

        return CoreValueEvaluationResponse.model_validate(evaluation)

    @require_any_permission([Permission.ASSESSMENT_READ_SELF, Permission.ASSESSMENT_READ_ALL])
    async def get_my_feedback(
        self,
        current_user_context: AuthContext,
        period_id: UUID
    ) -> Optional[CoreValueFeedbackResponse]:
        """Get the current user's core value feedback for a period."""
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")

        evaluation = await self.evaluation_repo.get_evaluation(
            period_id, current_user_context.user_id, org_id
        )
        if not evaluation:
            return None

        feedback = await self.feedback_repo.get_feedback_by_evaluation(evaluation.id, org_id)
        if not feedback:
            return None

        return CoreValueFeedbackResponse.model_validate(feedback)

    @require_any_permission([Permission.ASSESSMENT_MANAGE_SELF, Permission.ASSESSMENT_READ_ALL])
    async def save_evaluation(
        self,
        current_user_context: AuthContext,
        eval_id: UUID,
        data: CoreValueEvaluationUpdate
    ) -> CoreValueEvaluationResponse:
        """Save (auto-save) core value evaluation. Only if draft."""
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")

        try:
            existing = await self.evaluation_repo.get_by_id(eval_id, org_id)
            if not existing:
                raise NotFoundError(f"Core value evaluation not found: {eval_id}")

            # Only owner can save
            if existing.user_id != current_user_context.user_id:
                raise PermissionDeniedError("You can only save your own evaluation")

            update_data = {}
            if data.scores is not None:
                update_data["scores"] = data.scores
            if data.comment is not None:
                update_data["comment"] = data.comment

            updated = await self.evaluation_repo.update_evaluation(eval_id, update_data, org_id)
            await self.session.commit()

            return CoreValueEvaluationResponse.model_validate(updated)

        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error saving core value evaluation {eval_id}: {e}")
            raise

    @require_any_permission([Permission.ASSESSMENT_MANAGE_SELF, Permission.ASSESSMENT_READ_ALL])
    async def submit_evaluation(
        self,
        current_user_context: AuthContext,
        eval_id: UUID
    ) -> CoreValueEvaluationResponse:
        """Submit core value evaluation. Validates 9 scores, auto-creates feedback."""
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")

        try:
            existing = await self.evaluation_repo.get_by_id(eval_id, org_id)
            if not existing:
                raise NotFoundError(f"Core value evaluation not found: {eval_id}")

            if existing.user_id != current_user_context.user_id:
                raise PermissionDeniedError("You can only submit your own evaluation")

            # Validate all 9 scores are present
            definitions = await self.definition_repo.get_definitions(org_id)
            definition_ids = {str(d.id) for d in definitions}

            if not existing.scores:
                raise ValidationError("All 9 core value scores are required before submission")

            missing = definition_ids - set(existing.scores.keys())
            if missing:
                raise ValidationError(f"Missing scores for {len(missing)} core values. All 9 are required.")

            # Submit
            updated = await self.evaluation_repo.submit_evaluation(eval_id, org_id)

            # Auto-create feedback for supervisor
            await self._auto_create_feedback(updated, org_id)

            # Clear return_comment if present (employee resubmitting)
            await self.feedback_repo.clear_return_comment(eval_id, org_id)

            await self.session.commit()

            return CoreValueEvaluationResponse.model_validate(updated)

        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error submitting core value evaluation {eval_id}: {e}")
            raise

    @require_any_permission([Permission.ASSESSMENT_MANAGE_SELF, Permission.ASSESSMENT_READ_ALL])
    async def reopen_evaluation(
        self,
        current_user_context: AuthContext,
        eval_id: UUID
    ) -> CoreValueEvaluationResponse:
        """Reopen core value evaluation: submitted -> draft (not if approved)."""
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")

        try:
            existing = await self.evaluation_repo.get_by_id(eval_id, org_id)
            if not existing:
                raise NotFoundError(f"Core value evaluation not found: {eval_id}")

            if existing.user_id != current_user_context.user_id:
                raise PermissionDeniedError("You can only reopen your own evaluation")

            updated = await self.evaluation_repo.reopen_evaluation(eval_id, org_id)
            await self.session.commit()

            return CoreValueEvaluationResponse.model_validate(updated)

        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error reopening core value evaluation {eval_id}: {e}")
            raise

    async def approve_evaluation(self, eval_id: UUID, org_id: str):
        """Internal: approve evaluation (called when supervisor approves feedback)."""
        await self.evaluation_repo.approve_evaluation(eval_id, org_id)

    async def revert_to_draft(self, eval_id: UUID, org_id: str):
        """Internal: revert evaluation to draft (called when supervisor returns feedback)."""
        await self.evaluation_repo.revert_to_draft(eval_id, org_id)

    # ========================================
    # FEEDBACK (supervisor)
    # ========================================

    async def _auto_create_feedback(self, evaluation, org_id: str):
        """Auto-create feedback when employee submits evaluation."""
        try:
            # Check if feedback already exists
            existing = await self.feedback_repo.get_feedback_by_evaluation(evaluation.id, org_id)
            if existing:
                logger.info(f"CoreValueFeedback already exists for evaluation {evaluation.id}")
                return

            # Get employee's supervisor
            supervisors = await self.user_repo.get_user_supervisors(evaluation.user_id, org_id)
            if not supervisors:
                logger.warning(f"No supervisors found for user {evaluation.user_id}")
                return

            primary_supervisor = supervisors[0]

            await self.feedback_repo.create_feedback(
                cv_eval_id=evaluation.id,
                period_id=evaluation.period_id,
                supervisor_id=primary_supervisor.id,
                subordinate_id=evaluation.user_id,
                org_id=org_id
            )
            logger.info(f"Auto-created CoreValueFeedback for evaluation {evaluation.id}")

        except Exception as e:
            logger.error(f"Error auto-creating core value feedback: {e}")
            # Don't re-raise to avoid blocking evaluation submission

    @require_any_permission([Permission.GOAL_READ_ALL, Permission.GOAL_READ_SUBORDINATES])
    async def get_subordinate_data(
        self,
        current_user_context: AuthContext,
        period_id: UUID,
        subordinate_id: UUID
    ) -> CoreValueSubordinateDataResponse:
        """Get core value evaluation + feedback for a subordinate."""
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")

        # Verify supervisor has access to this subordinate
        accessible_user_ids = await RBACHelper.get_accessible_user_ids(current_user_context)
        if accessible_user_ids is not None and subordinate_id not in accessible_user_ids:
            raise PermissionDeniedError(f"You do not have permission to access data for user {subordinate_id}")

        evaluation = await self.evaluation_repo.get_evaluation(period_id, subordinate_id, org_id)

        eval_response = None
        feedback_response = None

        if evaluation:
            eval_response = CoreValueEvaluationResponse.model_validate(evaluation)

            feedback = await self.feedback_repo.get_feedback_by_evaluation(evaluation.id, org_id)
            if feedback:
                feedback_response = CoreValueFeedbackResponse.model_validate(feedback)

        return CoreValueSubordinateDataResponse(
            evaluation=eval_response,
            feedback=feedback_response
        )

    @require_any_permission([Permission.GOAL_APPROVE, Permission.GOAL_READ_ALL])
    async def count_pending_feedback(
        self,
        current_user_context: AuthContext,
        period_id: UUID
    ) -> int:
        """Count pending core value feedbacks for the current supervisor."""
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")

        return await self.feedback_repo.count_pending_feedback(
            period_id, current_user_context.user_id, org_id
        )

    @require_any_permission([Permission.GOAL_APPROVE, Permission.GOAL_READ_ALL])
    async def save_feedback(
        self,
        current_user_context: AuthContext,
        feedback_id: UUID,
        data: CoreValueFeedbackUpdate
    ) -> CoreValueFeedbackResponse:
        """Save (auto-save) core value feedback."""
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")

        try:
            existing = await self.feedback_repo.get_feedback(feedback_id, org_id)
            if not existing:
                raise NotFoundError(f"Core value feedback not found: {feedback_id}")

            if existing.supervisor_id != current_user_context.user_id:
                raise PermissionDeniedError("You can only save your own feedback")

            update_data = {}
            if data.scores is not None:
                update_data["scores"] = data.scores
            if data.comment is not None:
                update_data["comment"] = data.comment

            updated = await self.feedback_repo.update_feedback(feedback_id, update_data, org_id)
            await self.session.commit()

            return CoreValueFeedbackResponse.model_validate(updated)

        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error saving core value feedback {feedback_id}: {e}")
            raise

    @require_any_permission([Permission.GOAL_APPROVE, Permission.GOAL_READ_ALL])
    async def submit_feedback(
        self,
        current_user_context: AuthContext,
        feedback_id: UUID,
        data: CoreValueFeedbackSubmit
    ) -> CoreValueFeedbackResponse:
        """Submit core value feedback. If APPROVED, locks the evaluation."""
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")

        try:
            existing = await self.feedback_repo.get_feedback(feedback_id, org_id)
            if not existing:
                raise NotFoundError(f"Core value feedback not found: {feedback_id}")

            if existing.supervisor_id != current_user_context.user_id:
                raise PermissionDeniedError("You can only submit your own feedback")

            submit_data = {}
            if data.scores is not None:
                submit_data["scores"] = data.scores
            if data.comment is not None:
                submit_data["comment"] = data.comment

            updated = await self.feedback_repo.submit_feedback(feedback_id, submit_data, org_id)

            # If APPROVED, lock the evaluation
            if data.action == CoreValueFeedbackAction.APPROVED:
                await self.approve_evaluation(existing.core_value_evaluation_id, org_id)
                logger.info(f"Core value evaluation {existing.core_value_evaluation_id} approved via feedback {feedback_id}")

            await self.session.commit()

            return CoreValueFeedbackResponse.model_validate(updated)

        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error submitting core value feedback {feedback_id}: {e}")
            raise

    @require_any_permission([Permission.GOAL_APPROVE, Permission.GOAL_READ_ALL])
    async def return_feedback(
        self,
        current_user_context: AuthContext,
        feedback_id: UUID,
        data: CoreValueFeedbackReturn
    ) -> CoreValueFeedbackResponse:
        """Return feedback for correction (差し戻し): set return_comment + revert evaluation to draft."""
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")

        try:
            existing = await self.feedback_repo.get_feedback(feedback_id, org_id)
            if not existing:
                raise NotFoundError(f"Core value feedback not found: {feedback_id}")

            if existing.supervisor_id != current_user_context.user_id:
                raise PermissionDeniedError("You can only return your own feedback")

            # Set return_comment
            updated = await self.feedback_repo.set_return_comment(feedback_id, data.return_comment, org_id)

            # Revert evaluation to draft
            await self.revert_to_draft(existing.core_value_evaluation_id, org_id)
            logger.info(f"Core value evaluation {existing.core_value_evaluation_id} reverted to draft via feedback return {feedback_id}")

            await self.session.commit()

            return CoreValueFeedbackResponse.model_validate(updated)

        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error returning core value feedback {feedback_id}: {e}")
            raise
