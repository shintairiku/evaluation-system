import type { RatingCode, FinalRatingCode } from '@/api/types';
import { RATING_CODE_VALUES } from '@/api/types/common';
import type { CoreValueRatingCode } from '@/api/types/core-value';
import { CORE_VALUE_RATING_VALUES } from '@/api/types/core-value';

/**
 * Rating calculation utilities for the evaluation system.
 * Centralizes the 8-level rating scale conversion logic.
 *
 * Scale: SS(7) > S(6) > A+(5) > A(4) > A-(3) > B(2) > C(1) > D(0)
 */

/**
 * Converts a numeric score to a final rating code (8-level scale).
 *
 * @param score - The numeric score (0.0 - 7.0)
 * @returns The corresponding FinalRatingCode
 *
 * Thresholds:
 * - >= 6.5 → SS
 * - >= 5.5 → S
 * - >= 4.5 → A+
 * - >= 3.7 → A
 * - >= 2.7 → A-
 * - >= 1.7 → B
 * - >= 1.0 → C
 * - < 1.0  → D
 */
export function scoreToFinalRating(score: number): FinalRatingCode {
  if (score >= 6.5) return 'SS';
  if (score >= 5.5) return 'S';
  if (score >= 4.5) return 'A+';
  if (score >= 3.7) return 'A';
  if (score >= 2.7) return 'A-';
  if (score >= 1.7) return 'B';
  if (score >= 1.0) return 'C';
  return 'D';
}

/**
 * Calculates the average score from a list of rating codes.
 *
 * @param ratings - Array of RatingCode values
 * @returns The average score, or null if no valid ratings
 */
export function calculateRatingAverage(ratings: RatingCode[]): number | null {
  if (ratings.length === 0) return null;

  let sum = 0;
  let count = 0;

  for (const rating of ratings) {
    const value = RATING_CODE_VALUES[rating];
    if (value !== undefined) {
      sum += value;
      count++;
    }
  }

  if (count === 0) return null;
  return sum / count;
}

/**
 * Calculates the weighted average score from ratings with weights.
 *
 * @param items - Array of { rating, weight } objects
 * @returns The weighted average score, or null if no valid ratings
 */
export function calculateWeightedRatingAverage(
  items: Array<{ rating?: RatingCode; weight: number }>
): number | null {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const item of items) {
    if (item.rating && RATING_CODE_VALUES[item.rating] !== undefined) {
      weightedSum += RATING_CODE_VALUES[item.rating] * item.weight;
      totalWeight += item.weight;
    }
  }

  if (totalWeight === 0) return null;
  return weightedSum / totalWeight;
}

/**
 * Calculates the average rating from a list of rating codes and returns
 * the corresponding FinalRatingCode as a string.
 *
 * @param ratings - Array of RatingCode values
 * @returns The FinalRatingCode string, or '−' if no valid ratings
 */
export function calculateAverageRatingCode(ratings: RatingCode[]): string {
  const avg = calculateRatingAverage(ratings);
  if (avg === null) return '−';
  return scoreToFinalRating(avg);
}

/**
 * Calculates the weighted average rating and returns the corresponding
 * FinalRatingCode as a string.
 *
 * @param items - Array of { rating, weight } objects
 * @returns The FinalRatingCode string, or '−' if no valid ratings
 */
export function calculateWeightedAverageRatingCode(
  items: Array<{ rating?: RatingCode; weight: number }>
): string {
  const avg = calculateWeightedRatingAverage(items);
  if (avg === null) return '−';
  return scoreToFinalRating(avg);
}

/**
 * Calculates the average score from a list of core value rating codes.
 * Uses CORE_VALUE_RATING_VALUES (7-level scale: SS/S/A+/A/A-/B/C).
 *
 * @param ratings - Array of CoreValueRatingCode values
 * @returns The average score, or null if no valid ratings
 */
export function calculateCoreValueRatingAverage(
  ratings: CoreValueRatingCode[]
): number | null {
  if (ratings.length === 0) return null;

  let sum = 0;
  let count = 0;

  for (const rating of ratings) {
    const value = CORE_VALUE_RATING_VALUES[rating];
    if (value !== undefined) {
      sum += value;
      count++;
    }
  }

  if (count === 0) return null;
  return sum / count;
}

/**
 * MBO score table for performance goals (業績目標). Spec section 4-2.
 * Different from RATING_CODE_VALUES: MBO uses a 5-point scale (SS=5, D=0),
 * while the general 8-level scale uses 0-7 (SS=7, D=0).
 */
const MBO_SCORE: Partial<Record<RatingCode, number>> = {
  SS: 5,
  S: 4,
  A: 3,
  B: 2,
  C: 1,
  D: 0,
};

/**
 * MBO final rating thresholds on 0-100 scale. Spec section 4-3.
 * Ordered high-to-low for sequential lookup.
 */
const MBO_THRESHOLDS: ReadonlyArray<readonly [FinalRatingCode, number]> = [
  ['SS', 86],
  ['S', 70],
  ['A+', 64],
  ['A', 56],
  ['A-', 50],
  ['B', 34],
  ['C', 20],
  ['D', 0],
];

/**
 * Calculates the MBO overall rating for performance goals (業績目標).
 * Mirrors the backend SQL formula (spec sections 4-2, 4-3, 4-4):
 *   total = Σ (weight/5) × MBO_SCORE[rating]
 *   threshold: SS≥86, S≥70, A+≥64, A≥56, A-≥50, B≥34, C≥20, D<20
 *
 * @param items - Array of { rating, weight } objects
 * @returns The FinalRatingCode string, or '−' if no valid ratings
 */
export function calculateMboOverallRating(
  items: Array<{ rating?: RatingCode | null; weight: number }>
): string {
  let total = 0;
  let hasValid = false;

  for (const item of items) {
    if (!item.rating || item.weight <= 0) continue;
    const score = MBO_SCORE[item.rating];
    if (score === undefined) continue;
    total += (item.weight / 5) * score;
    hasValid = true;
  }

  if (!hasValid) return '−';

  for (const [rank, min] of MBO_THRESHOLDS) {
    if (total >= min) return rank;
  }
  return 'D';
}

/**
 * Returns Tailwind CSS classes for a rating badge based on the rating code.
 */
export function getRatingColor(rating: string | null): string {
  if (!rating) return 'bg-muted text-muted-foreground';
  switch (rating) {
    case 'SS':
    case 'S':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'A+':
    case 'A':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'A-':
      return 'bg-lime-100 text-lime-800 border-lime-200';
    case 'B':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'C':
    case 'D':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-muted text-muted-foreground';
  }
}
