from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Optional

from ..core.exceptions import ValidationError

_QUANTITATIVE_TYPES = {"quantitative", "定量目標"}


def _as_text(value: Any) -> Optional[str]:
    if value is None:
        return None
    if hasattr(value, "value"):
        value = value.value
    text = str(value).strip()
    return text or None


def _extract_performance_goal_type(target_data: Any) -> Optional[str]:
    if isinstance(target_data, Mapping):
        return _as_text(target_data.get("performance_goal_type"))
    return None


def validate_rating_code_for_goal(
    *,
    goal_category: Optional[str],
    target_data: Any,
    rating_code: Any,
    actor_name: str,
) -> None:
    rating_code_text = _as_text(rating_code)
    if rating_code_text is None:
        return

    goal_category_text = _as_text(goal_category)
    if goal_category_text == "コアバリュー":
        raise ValidationError(
            f"Core Value goals (コアバリュー) cannot have {actor_name} rating."
        )

    if goal_category_text == "コンピテンシー" and rating_code_text == "D":
        raise ValidationError(
            "Competency goals (コンピテンシー) cannot have D rating."
        )

    if rating_code_text == "D" and goal_category_text in {"業績目標", "定量目標", "定性目標"}:
        if goal_category_text == "定量目標":
            return
        performance_goal_type = _extract_performance_goal_type(target_data)
        if performance_goal_type not in _QUANTITATIVE_TYPES:
            raise ValidationError(
                "D rating is only allowed for quantitative performance goals (定量目標)."
            )
