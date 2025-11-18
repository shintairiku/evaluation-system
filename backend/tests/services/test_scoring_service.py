import pytest
from decimal import Decimal

from app.services.scoring_service import ScoringService
from app.database.models.evaluation_score import (
    EvaluationScoreMapping,
    RatingThreshold,
    EvaluationPolicyFlag,
)
from app.database.models.organization import Organization


@pytest.mark.asyncio
async def test_compute_summary_forces_fail_on_mbo_policy(test_session):
    org = Organization(id="org_test", name="Test Org", slug="test-org")
    test_session.add(org)

    # Seed minimal rating master and thresholds
    ratings = [
        ("SS", Decimal("7.0")),
        ("S", Decimal("6.0")),
        ("A+", Decimal("5.0")),
        ("A", Decimal("4.0")),
        ("A-", Decimal("3.0")),
        ("B", Decimal("2.0")),
        ("C", Decimal("1.0")),
        ("D", Decimal("0.0")),
    ]
    for code, score in ratings:
        test_session.add(
            EvaluationScoreMapping(
                organization_id=org.id,
                rating_code=code,
                rating_label=code,
                score_value=score,
                is_active=True,
            )
        )
    thresholds = [
        ("SS", Decimal("6.50")),
        ("S", Decimal("5.50")),
        ("A+", Decimal("4.50")),
        ("A", Decimal("3.70")),
        ("A-", Decimal("2.70")),
        ("B", Decimal("1.70")),
        ("C", Decimal("1.00")),
        ("D", Decimal("0.00")),
    ]
    for code, min_score in thresholds:
        test_session.add(
            RatingThreshold(
                organization_id=org.id,
                rating_code=code,
                min_score=min_score,
            )
        )

    # Enable policy flag: MBO D fails the overall rating
    test_session.add(
        EvaluationPolicyFlag(
            organization_id=org.id,
            key="mbo_d_is_fail",
            value={"enabled": True},
        )
    )
    await test_session.flush()

    service = ScoringService(test_session)
    stage_weights = {"quantitative": 100.0, "qualitative": 0.0, "competency": 0.0}
    bucket_ratings = {"quantitative": ["S", "D"]}  # average = 3.0 -> normally A-

    summary = await service.compute_summary(org.id, bucket_ratings, stage_weights)

    assert summary["flags"]["fail"] is True
    assert summary["final_rating"] == "D"
    assert summary["weighted_total"] == Decimal("3.00")
