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
            (1, 'ポジティブマインドを持つ',
             '自分の夢や志を持ち、挑戦する時、数多くの壁に直面します。そのような時に他責にせず、自信を持ち、努力して乗り越えていく姿勢を「ポジティブマインド」といいます。諦めない気持ちが何よりも大切。苦しい経験は、後で振り返れば成長のきっかけだったと気づけます。前向きに取り組む姿勢は、自分自身だけでなく周りの人の人生にも良い影響を与えます。'),
            (2, '未来にワクワクし大胆に挑戦する',
             '私たちは、創業当初から変わらない"冒険家精神"を大切にし、 固定概念や常識にとらわれません。 未来を想像し「こうなりたい」とワクワクしながら、具体的な戦略を持って未来に向かい、大胆に挑戦します。未来は、待つものではなく、自ら創るもの。私たちは日本のマーケティングを前進させ、未来の模範となる会社を目指します。'),
            (3, 'ハングリーな気持ちを忘れない',
             '不完全であることが当たり前。足りていないなら、自ら創る。新大陸は発展途上のベンチャー企業です。会社に依存するのではなく、自ら創り上げていくマインドでハングリーに成長していきます。'),
            (4, '一人ひとりが起因となる',
             '私たちは、一人ひとりが主体者であるという自覚を持ち、自らの頭で考え、自らの手で機会を掴み、成果を上げます。誰かの指示を待つのではなく自ら動くことで、皆がリーダーとしての意識を持ち、周囲を巻き込み未来を創造する。自身の夢や志と会社の理念・ビジョンが重なる場所を見つけ、そこに情熱を注ぎながら、自分自身の未来も、会社の未来も、自分ごととして実現していきます。'),
            (5, '誠実でいる勇気を持ち続ける',
             '誠実さとは、自分の言葉・判断・行動に一貫性を持つことです。ときには、誤魔化して楽な道を選びたくなることもあります。でも私たちは、自分の中で「本当はこうすべきだ」とわかっていることから目をそらさず、あとから振り返っても誇れる選択をすることを大切にします。誠実であるとは、取り繕うことではなく、本音と行動が一致した"ブレない強さ"を持つこと。 その姿勢が信頼を育み、長く続く豊かな人間関係につながります。'),
            (6, '理念を実現する仲間として敬意を持つ',
             '私たちは、性別、年齢、国籍、雇用形態等に関わらず多様性を尊重し、全てのスタッフのことを「理念の実現に向け共に歩む大切な仲間」として捉え、ありのままの存在を受け入れます。変化の激しい時代を生き抜くためには自立する「強さ」が、大きな成果を得るためには互いに協力し支え合う「優しさ」が不可欠です。この「強さ」と「優しさ」を兼ね備え、感謝の気持ちを忘れず、常に『ありがとう』と伝え合うことで、公的成功に繋がります。'),
            (7, '一致団結して進む',
             '私たちは、会社の理念やビジョンを実現するために、部門を超えて一体となり、目標達成に向かいます。多様なメンバーが互いを信頼し、尊重し合い、一人では成し遂げられない大きな成果を創出します。'),
            (8, 'プロフェッショナルであろう',
             '私たちは、世界に通じるプロフェッショナルを目指します。プロフェッショナルとは、お客様からいただいた金額以上の価値と、会社から求められる役割を超える価値を提供する存在です。責任を果たすからこそ、裁量権のある環境が得られます。プロで在り続けるために日々自己研鑽を怠らず、自己の人間性やコンピテンシースキル、専門知識を高める努力をします。'),
            (9, '信頼と成果でつながるパートナーになる',
             '私たちは、クライアントの挑戦に寄り添い、長期的に伴走するパートナーです。 いただいた金額以上の価値を提供し、対等な関係の中で信頼を築いていきます。常に敬意を持って向き合いながらも、成果に責任を持ち、プロとしてリードし、共に未来を創る存在であり続けます。'),
        ]

        inserted = 0
        try:
            for display_order, name, description in default_values:
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
                        description=description,
                        is_active=True
                    )
                    self.session.add(definition)
                    inserted += 1

            logger.info(f"Seeded {inserted} core value definitions for org {org_id}")
            return inserted
        except SQLAlchemyError as e:
            logger.error(f"Error seeding core value definitions for org {org_id}: {e}")
            raise
