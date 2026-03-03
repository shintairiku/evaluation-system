import pytest

from app.core.exceptions import ValidationError
from app.services.rating_rules import validate_rating_code_for_goal


def test_allows_d_for_quantitative_performance_goal():
    validate_rating_code_for_goal(
        goal_category="業績目標",
        target_data={"performance_goal_type": "quantitative"},
        rating_code="D",
        actor_name="self-assessment",
    )


def test_rejects_d_for_qualitative_performance_goal():
    with pytest.raises(ValidationError):
        validate_rating_code_for_goal(
            goal_category="業績目標",
            target_data={"performance_goal_type": "qualitative"},
            rating_code="D",
            actor_name="self-assessment",
        )


def test_rejects_d_for_competency_goal():
    with pytest.raises(ValidationError):
        validate_rating_code_for_goal(
            goal_category="コンピテンシー",
            target_data=None,
            rating_code="D",
            actor_name="supervisor",
        )


def test_skips_core_value_goal():
    """Core value goals use a separate evaluation system; rating_rules does not block them."""
    validate_rating_code_for_goal(
        goal_category="コアバリュー",
        target_data=None,
        rating_code="A",
        actor_name="supervisor",
    )
