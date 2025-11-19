import logging
from typing import List, Optional
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .base import BaseRepository
from ..models.evaluation_score import (
    EvaluationScoreMapping,
    RatingThreshold,
    EvaluationPolicyFlag,
    LevelAdjustmentMaster,
)

logger = logging.getLogger(__name__)


class ScoreMappingRepository(BaseRepository[EvaluationScoreMapping]):
    """Repository for rating masters/thresholds/policies per organization."""

    def __init__(self, session: AsyncSession):
        super().__init__(session, EvaluationScoreMapping)

    async def get_score(self, organization_id: str, rating_code: str) -> Optional[Decimal]:
        query = select(EvaluationScoreMapping.score_value).where(
            EvaluationScoreMapping.organization_id == organization_id,
            EvaluationScoreMapping.rating_code == rating_code,
            EvaluationScoreMapping.is_active.is_(True),
        )
        result = await self.session.execute(query)
        # Use first() to tolerate duplicate rows instead of raising on scalar_one_or_none
        value = result.scalars().first()
        return Decimal(value) if value is not None else None

    async def list_scores(self, organization_id: str) -> List[EvaluationScoreMapping]:
        query = select(EvaluationScoreMapping).where(
            EvaluationScoreMapping.organization_id == organization_id,
            EvaluationScoreMapping.is_active.is_(True),
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def list_thresholds(self, organization_id: str) -> List[RatingThreshold]:
        query = (
            select(RatingThreshold)
            .where(RatingThreshold.organization_id == organization_id)
            .order_by(RatingThreshold.min_score.desc())
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_policy_flag(self, organization_id: str, key: str) -> Optional[EvaluationPolicyFlag]:
        query = select(EvaluationPolicyFlag).where(
            EvaluationPolicyFlag.organization_id == organization_id,
            EvaluationPolicyFlag.key == key,
        )
        result = await self.session.execute(query)
        return result.scalars().first()

    async def get_level_adjustment(self, organization_id: str, rating_code: str) -> Optional[int]:
        query = select(LevelAdjustmentMaster.level_delta).where(
            LevelAdjustmentMaster.organization_id == organization_id,
            LevelAdjustmentMaster.rating_code == rating_code,
        )
        result = await self.session.execute(query)
        delta = result.scalar_one_or_none()
        return int(delta) if delta is not None else None
