"""
Tests for shared rating utility functions.
Pattern: sync tests, no DB, no mocking — same as test_core_value_validation.py.
"""

import pytest

from app.core.rating_utils import (
    RATING_CODE_TO_NUMERIC,
    score_to_final_rating,
    calculate_source_average,
    to_circled_number,
)


# ============================================================
# RATING_CODE_TO_NUMERIC module dict
# ============================================================

def test_rating_code_to_numeric_has_7_entries():
    """Core value ratings use 7-level scale (SS through C)."""
    assert len(RATING_CODE_TO_NUMERIC) == 7


def test_rating_code_to_numeric_values_are_ordered():
    """Rating values decrease from SS(7) to C(1)."""
    expected = {
        "SS": 7.0,
        "S": 6.0,
        "A+": 5.0,
        "A": 4.0,
        "A-": 3.0,
        "B": 2.0,
        "C": 1.0,
    }
    for code, value in expected.items():
        assert RATING_CODE_TO_NUMERIC[code] == value, f"Expected {code}={value}"


# ============================================================
# score_to_final_rating
# ============================================================

class TestScoreToFinalRating:
    """Boundary tests for score_to_final_rating threshold logic."""

    @pytest.mark.parametrize("score,expected", [
        (7.0, "SS"),
        (6.5, "SS"),
        (6.49, "S"),
        (5.5, "S"),
        (5.49, "A+"),
        (4.5, "A+"),
        (4.49, "A"),
        (3.7, "A"),
        (3.69, "A-"),
        (2.7, "A-"),
        (2.69, "B"),
        (1.7, "B"),
        (1.69, "C"),
        (1.0, "C"),
        (0.99, "D"),
        (0.5, "D"),
        (0.0, "D"),
    ])
    def test_threshold_boundaries(self, score: float, expected: str):
        assert score_to_final_rating(score) == expected

    def test_high_score_returns_ss(self):
        assert score_to_final_rating(10.0) == "SS"

    def test_exact_middle_values(self):
        assert score_to_final_rating(4.0) == "A"
        assert score_to_final_rating(3.0) == "A-"
        assert score_to_final_rating(2.0) == "B"


# ============================================================
# calculate_source_average
# ============================================================

class TestCalculateSourceAverage:
    """Tests for calculate_source_average (scores dict → average numeric)."""

    def test_empty_dict_returns_none(self):
        assert calculate_source_average({}) is None

    def test_none_returns_none(self):
        assert calculate_source_average(None) is None

    def test_single_valid_score(self):
        result = calculate_source_average({"cv1": "A"})
        assert result == 4.0

    def test_multiple_valid_scores(self):
        scores = {"cv1": "SS", "cv2": "C"}
        result = calculate_source_average(scores)
        # SS=7.0, C=1.0 → avg=4.0
        assert result == 4.0

    def test_all_same_rating(self):
        scores = {"cv1": "A", "cv2": "A", "cv3": "A"}
        result = calculate_source_average(scores)
        assert result == 4.0

    def test_invalid_rating_codes_skipped(self):
        scores = {"cv1": "A", "cv2": "INVALID"}
        result = calculate_source_average(scores)
        # Only "A"=4.0 is valid
        assert result == 4.0

    def test_all_invalid_returns_none(self):
        scores = {"cv1": "X", "cv2": "Y"}
        result = calculate_source_average(scores)
        assert result is None

    def test_full_9_scores_average(self):
        scores = {
            f"cv{i}": code
            for i, code in enumerate(["SS", "S", "A+", "A", "A-", "B", "C", "A", "A"], 1)
        }
        result = calculate_source_average(scores)
        # (7+6+5+4+3+2+1+4+4)/9 = 36/9 = 4.0
        assert result == 4.0


# ============================================================
# to_circled_number
# ============================================================

class TestToCircledNumber:
    """Tests for to_circled_number (integer → circled character)."""

    @pytest.mark.parametrize("n,expected", [
        (1, "①"),
        (2, "②"),
        (3, "③"),
        (4, "④"),
        (5, "⑤"),
        (6, "⑥"),
        (7, "⑦"),
        (8, "⑧"),
        (9, "⑨"),
        (10, "⑩"),
    ])
    def test_valid_range(self, n: int, expected: str):
        assert to_circled_number(n) == expected

    def test_zero_returns_fallback(self):
        assert to_circled_number(0) == "(0)"

    def test_out_of_range_returns_fallback(self):
        assert to_circled_number(11) == "(11)"

    def test_negative_returns_fallback(self):
        assert to_circled_number(-1) == "(-1)"
