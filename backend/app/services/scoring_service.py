from decimal import Decimal
from typing import Dict, List, Tuple, Any

from sqlalchemy.ext.asyncio import AsyncSession

from ..database.repositories.score_mapping_repo import ScoreMappingRepository
from ..core.exceptions import BadRequestError


class ScoringService:
    """
    Computes self-assessment scores using DB-driven mappings, thresholds, and policies.
    This service is intentionally side-effect free; callers orchestrate persistence.
    """

    def __init__(self, session: AsyncSession):
        self.score_repo = ScoreMappingRepository(session)

    async def get_score_for_rating(self, organization_id: str, rating_code: str) -> Decimal:
        score = await self.score_repo.get_score(organization_id, rating_code)
        if score is None:
            raise BadRequestError(f"Rating code '{rating_code}' not found for organization {organization_id}")
        return Decimal(score)

    async def compute_bucket_average(self, organization_id: str, rating_codes: List[str]) -> Decimal:
        if not rating_codes:
            return Decimal("0")
        scores: List[Decimal] = []
        for code in rating_codes:
            score = await self.get_score_for_rating(organization_id, code)
            scores.append(score)
        total = sum(scores)
        return (total / Decimal(len(scores))).quantize(Decimal("0.01"))

    async def apply_stage_weights(
        self,
        organization_id: str,
        bucket_ratings: Dict[str, List[str]],
        stage_weights: Dict[str, float]
    ) -> Tuple[List[Dict[str, Any]], Decimal]:
        per_bucket: List[Dict[str, Any]] = []
        total = Decimal("0")
        # Calculate total weight for normalizing contributions (not for display weights)
        # Display weights are stored as raw values (e.g., 100% + 10% = 110% total)
        total_weight = sum(float(w or 0) for w in stage_weights.values())
        total_weight_decimal = Decimal(str(total_weight)) if total_weight else Decimal("0")

        for bucket, weight_value in stage_weights.items():
            ratings = bucket_ratings.get(bucket, [])
            raw_weight = Decimal(str(weight_value or 0))

            # If there is no weight total, skip contribution.
            if total_weight_decimal == 0 or raw_weight == 0:
                per_bucket.append({
                    "bucket": bucket,
                    "weight": 0.0,
                    "avg_score": Decimal("0"),
                    "contribution": Decimal("0"),
                })
                continue

            # Normalized weight fraction for contribution calculation (e.g., 100 + 10 => 100/110, 10/110)
            weight_fraction = (raw_weight / total_weight_decimal).quantize(Decimal("0.0001"))
            avg = await self.compute_bucket_average(organization_id, ratings)
            contribution = (avg * weight_fraction).quantize(Decimal("0.01"))
            total += contribution
            per_bucket.append({
                "bucket": bucket,
                # Store raw weight as-is (e.g., 100%, 10% -> total 110%)
                # Normalization is only used for contribution calculation
                "weight": float(raw_weight),
                "avg_score": avg,
                "contribution": contribution,
            })
        return per_bucket, total.quantize(Decimal("0.01"))

    async def map_numeric_to_grade(self, organization_id: str, total_score: Decimal) -> str:
        thresholds = await self.score_repo.list_thresholds(organization_id)
        if not thresholds:
            raise BadRequestError("rating_thresholds empty")
        for threshold in thresholds:
            if total_score >= Decimal(threshold.min_score):
                return threshold.rating_code
        # fallback to the lowest grade
        return thresholds[-1].rating_code

    async def evaluate_policy_flags(self, organization_id: str, bucket_ratings: Dict[str, List[str]]) -> Dict[str, Any]:
        flags = {"fail": False, "notes": []}
        mbo_flag = await self.score_repo.get_policy_flag(organization_id, "mbo_d_is_fail")
        if mbo_flag and mbo_flag.value.get("enabled"):
            quantitative = bucket_ratings.get("quantitative", [])
            if any(code == "D" for code in quantitative):
                flags["fail"] = True
                flags["notes"].append("MBO rating D")
        return flags

    async def attach_level_preview(self, organization_id: str, rating_code: str) -> Dict[str, Any]:
        delta = await self.score_repo.get_level_adjustment(organization_id, rating_code)
        if delta is None:
            return {}
        return {"rating": rating_code, "delta": delta}

    async def compute_summary(
        self,
        organization_id: str,
        bucket_ratings: Dict[str, List[str]],
        stage_weights: Dict[str, float]
    ) -> Dict[str, Any]:
        per_bucket, weighted_total = await self.apply_stage_weights(organization_id, bucket_ratings, stage_weights)
        flags = await self.evaluate_policy_flags(organization_id, bucket_ratings)
        final_rating = await self.map_numeric_to_grade(organization_id, weighted_total)
        if flags.get("fail"):
            final_rating = "D"
        level_preview = await self.attach_level_preview(organization_id, final_rating)
        return {
            "per_bucket": per_bucket,
            "weighted_total": weighted_total,
            "final_rating": final_rating,
            "flags": flags,
            "level_adjustment_preview": level_preview,
        }
