"""
Shared rating utilities for core value evaluations.

Provides numeric conversion, averaging, and display helpers used by
peer review, core value evaluation, and comprehensive evaluation services.
"""

from __future__ import annotations

from typing import Optional

from ..schemas.core_value import CORE_VALUE_RATING_VALUES

# String-keyed lookup from the canonical CORE_VALUE_RATING_VALUES
RATING_CODE_TO_NUMERIC: dict[str, float] = {
    code.value: val for code, val in CORE_VALUE_RATING_VALUES.items()
}


def score_to_final_rating(score: float) -> str:
    """Convert numeric score to rating code using threshold boundaries."""
    if score >= 6.5:
        return "SS"
    if score >= 5.5:
        return "S"
    if score >= 4.5:
        return "A+"
    if score >= 3.7:
        return "A"
    if score >= 2.7:
        return "A-"
    if score >= 1.7:
        return "B"
    if score >= 1.0:
        return "C"
    return "D"


def calculate_source_average(scores: dict) -> Optional[float]:
    """Calculate the average numeric score from a scores JSONB dict."""
    if not scores:
        return None
    values = []
    for rating_code in scores.values():
        numeric = RATING_CODE_TO_NUMERIC.get(rating_code)
        if numeric is not None:
            values.append(numeric)
    if not values:
        return None
    return sum(values) / len(values)


def to_circled_number(n: int) -> str:
    """Convert integer to circled number character (①②③...)."""
    circled = "①②③④⑤⑥⑦⑧⑨⑩"
    if 1 <= n <= len(circled):
        return circled[n - 1]
    return f"({n})"
