import logging
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .base import BaseRepository
from ..models.evaluation_score import SelfAssessmentSummary

logger = logging.getLogger(__name__)


class SelfAssessmentSummaryRepository(BaseRepository[SelfAssessmentSummary]):
    """Repository for persisting self-assessment summaries."""

    def __init__(self, session: AsyncSession):
        super().__init__(session, SelfAssessmentSummary)

    async def upsert_summary(self, summary: SelfAssessmentSummary) -> SelfAssessmentSummary:
        """Upsert by (organization_id, user_id, period_id)."""
        query = select(SelfAssessmentSummary).where(
            SelfAssessmentSummary.organization_id == summary.organization_id,
            SelfAssessmentSummary.user_id == summary.user_id,
            SelfAssessmentSummary.period_id == summary.period_id,
        )
        result = await self.session.execute(query)
        existing = result.scalars().first()
        if existing:
            for attr, value in summary.__dict__.items():
                if attr.startswith("_"):
                    continue
                setattr(existing, attr, value)
            logger.info("Updated self assessment summary for user %s", summary.user_id)
            return existing
        self.session.add(summary)
        logger.info("Inserted self assessment summary for user %s", summary.user_id)
        return summary

    async def get_summary(self, org_id: str, user_id: UUID, period_id: UUID) -> Optional[SelfAssessmentSummary]:
        query = select(SelfAssessmentSummary).where(
            SelfAssessmentSummary.organization_id == org_id,
            SelfAssessmentSummary.user_id == user_id,
            SelfAssessmentSummary.period_id == period_id,
        )
        result = await self.session.execute(query)
        return result.scalars().first()
