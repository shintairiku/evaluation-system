import logging
from typing import List
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.core_value import CoreValueDefinition
from .base import BaseRepository

logger = logging.getLogger(__name__)


class CoreValueDefinitionRepository(BaseRepository[CoreValueDefinition]):
    """Repository for CoreValueDefinition database operations."""

    def __init__(self, session: AsyncSession):
        super().__init__(session, CoreValueDefinition)

    async def get_definitions(self, org_id: str, active_only: bool = True) -> List[CoreValueDefinition]:
        """Get core value definitions for an organization, ordered by display_order."""
        try:
            query = (
                select(CoreValueDefinition)
                .filter(CoreValueDefinition.organization_id == org_id)
            )
            if active_only:
                query = query.filter(CoreValueDefinition.is_active == True)
            query = query.order_by(CoreValueDefinition.display_order)

            result = await self.session.execute(query)
            return list(result.scalars().all())
        except SQLAlchemyError as e:
            logger.error(f"Error fetching core value definitions for org {org_id}: {e}")
            raise

    async def seed_default_definitions(self, org_id: str) -> int:
        """
        Seed the 9 default core values for an organization.
        Uses INSERT ... ON CONFLICT DO NOTHING for idempotency.
        Returns the number of rows inserted.
        """
        default_values = [
            (1, 'ポジティブマインドを持つ'),
            (2, '未来にワクワクし大胆に挑戦する'),
            (3, 'ハングリーな気持ちを忘れない'),
            (4, '一人ひとりが起因となる'),
            (5, '誠実でいる勇気を持ち続ける'),
            (6, '理念を実現する仲間として敬意を持つ'),
            (7, '一致団結して進む'),
            (8, 'プロフェッショナルであろう'),
            (9, '信頼と成果でつながるパートナーになる'),
        ]

        inserted = 0
        try:
            for display_order, name in default_values:
                # Check if exists
                existing = await self.session.execute(
                    select(CoreValueDefinition).filter(
                        CoreValueDefinition.organization_id == org_id,
                        CoreValueDefinition.display_order == display_order
                    )
                )
                if existing.scalars().first() is None:
                    definition = CoreValueDefinition(
                        organization_id=org_id,
                        display_order=display_order,
                        name=name,
                        is_active=True
                    )
                    self.session.add(definition)
                    inserted += 1

            logger.info(f"Seeded {inserted} core value definitions for org {org_id}")
            return inserted
        except SQLAlchemyError as e:
            logger.error(f"Error seeding core value definitions for org {org_id}: {e}")
            raise
