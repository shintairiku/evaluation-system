import logging
from decimal import Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.evaluation_score_mapping import EvaluationScoreMapping
from ...schemas.common import RatingCode, RATING_CODE_VALUES
from ...core.exceptions import ValidationError
from .base import BaseRepository

logger = logging.getLogger(__name__)


class EvaluationScoreMappingRepository(BaseRepository[EvaluationScoreMapping]):
    """Repository for reading organization-scoped evaluation score mappings."""

    def __init__(self, session: AsyncSession):
        super().__init__(session, EvaluationScoreMapping)

    async def get_numeric_value_for_rating_code(
        self,
        organization_id: str,
        rating_code: RatingCode,
    ) -> Decimal:
        """
        Resolve numeric value for a rating code using organization mapping.

        Resolution order:
        1) organization-specific active mapping row
        2) legacy hardcoded fallback (RATING_CODE_VALUES)
        """
        if not organization_id:
            raise ValidationError("Organization context is required for score mapping")
        if rating_code is None:
            raise ValidationError("rating_code is required")

        resolved = await self._lookup_score_value(organization_id, rating_code.value)

        if resolved is None:
            fallback = RATING_CODE_VALUES.get(rating_code)
            if fallback is None:
                raise ValidationError(f"No score mapping configured for rating code: {rating_code.value}")
            logger.warning(
                "Falling back to legacy hardcoded score mapping for org=%s, code=%s",
                organization_id,
                rating_code.value,
            )
            resolved = Decimal(str(fallback))

        if resolved < Decimal("0") or resolved > Decimal("100"):
            raise ValidationError(
                f"Mapped score {resolved} for rating code {rating_code.value} is outside supported range 0-100"
            )

        return resolved

    async def _lookup_score_value(self, organization_id: str, rating_code: str) -> Optional[Decimal]:
        """Internal lookup helper. Returns None if missing or table unavailable."""
        try:
            result = await self.session.execute(
                select(EvaluationScoreMapping.score_value)
                .where(EvaluationScoreMapping.organization_id == organization_id)
                .where(EvaluationScoreMapping.rating_code == rating_code)
                .where(EvaluationScoreMapping.is_active.is_(True))
            )
            score_value = result.scalar_one_or_none()
            return Decimal(str(score_value)) if score_value is not None else None
        except SQLAlchemyError as e:
            if self._is_missing_table_error(e):
                logger.warning(
                    "evaluation_score_mapping table not available; using legacy score mapping fallback"
                )
                return None
            logger.error(
                "Error loading evaluation score mapping for org=%s, code=%s: %s",
                organization_id,
                rating_code,
                e,
            )
            raise

    @staticmethod
    def _is_missing_table_error(error: SQLAlchemyError) -> bool:
        message = str(error).lower()
        return "no such table" in message or "does not exist" in message or "undefinedtable" in message
