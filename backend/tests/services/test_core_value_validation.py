import pytest

from app.schemas.core_value import CoreValueRatingCode, CORE_VALUE_RATING_VALUES, CoreValueFeedbackAction


def test_core_value_rating_codes_have_7_levels():
    """Core value ratings use 7-level scale (SS through C, no D)."""
    assert len(CoreValueRatingCode) == 7


def test_core_value_rating_values_match_codes():
    """Every rating code has a corresponding numeric value."""
    for code in CoreValueRatingCode:
        assert code in CORE_VALUE_RATING_VALUES, f"Missing value for {code}"


def test_core_value_rating_values_are_ordered():
    """Rating values decrease from SS(7) to C(1)."""
    expected_order = [
        (CoreValueRatingCode.SS, 7.0),
        (CoreValueRatingCode.S, 6.0),
        (CoreValueRatingCode.A_PLUS, 5.0),
        (CoreValueRatingCode.A, 4.0),
        (CoreValueRatingCode.A_MINUS, 3.0),
        (CoreValueRatingCode.B, 2.0),
        (CoreValueRatingCode.C, 1.0),
    ]
    for code, expected_value in expected_order:
        assert CORE_VALUE_RATING_VALUES[code] == expected_value


def test_core_value_feedback_actions():
    """Feedback has exactly 2 actions: PENDING and APPROVED."""
    assert len(CoreValueFeedbackAction) == 2
    assert CoreValueFeedbackAction.PENDING.value == "PENDING"
    assert CoreValueFeedbackAction.APPROVED.value == "APPROVED"


def test_rating_rules_skip_core_value_goal():
    """Core value goals use a separate evaluation system; rating_rules does not block them."""
    from app.services.rating_rules import validate_rating_code_for_goal

    # Should NOT raise — core value ratings are handled by CoreValueService
    validate_rating_code_for_goal(
        goal_category="コアバリュー",
        target_data=None,
        rating_code="A",
        actor_name="self-assessment",
    )
