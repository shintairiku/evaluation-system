import { EVALUATION_RANKS, isRankAtLeast, isRankAtOrWorse, type ComprehensiveEvaluationSettings, type ComprehensiveEvaluationUserFlags, type ComprehensiveEvaluationDecision } from './settings';
import type { ComprehensiveEvaluationManualOverride } from './manualOverride';
import type { ComprehensiveEvaluationRow, EvaluationRank } from './types';

export function computeTotalScore(performanceScore: number | null, competencyScore: number | null): number | null {
  if (performanceScore === null || competencyScore === null) return null;
  return Number((performanceScore + competencyScore).toFixed(2));
}

export function getOverallEvaluationRank(
  totalScore: number,
  thresholds: Record<EvaluationRank, number>
): EvaluationRank | null {
  for (const rank of EVALUATION_RANKS) {
    const minScore = thresholds[rank];
    if (Number.isFinite(minScore) && totalScore >= minScore) {
      return rank;
    }
  }
  return null;
}

export function computeEffectiveUserFlags(
  row: ComprehensiveEvaluationRow,
  overrides: ComprehensiveEvaluationUserFlags | undefined
) {
  return {
    leaderInterviewCleared: overrides?.leaderInterviewCleared ?? row.leaderInterviewCleared ?? false,
    divisionHeadPresentationCleared: overrides?.divisionHeadPresentationCleared ?? row.divisionHeadPresentationCleared ?? false,
    ceoInterviewCleared: overrides?.ceoInterviewCleared ?? row.ceoInterviewCleared ?? false,
  };
}

function parseStageNumber(stage: string | null): number | null {
  if (!stage) return null;
  const match = stage.match(/stage\s*(\d+)/i) ?? stage.match(/stage(\d+)/i);
  if (!match?.[1]) return null;
  const num = Number(match[1]);
  return Number.isFinite(num) ? num : null;
}

export function computeNewStage(currentStage: string | null, stageDelta: number): string | null {
  if (!currentStage) return null;
  if (stageDelta === 0) return currentStage;
  const currentNumber = parseStageNumber(currentStage);
  if (currentNumber === null) return currentStage;
  const nextNumber = Math.max(1, currentNumber + stageDelta);
  return `STAGE${nextNumber}`;
}

export interface ComprehensiveEvaluationComputedRow {
  totalScore: number | null;
  overallRank: EvaluationRank | null;
  decision: ComprehensiveEvaluationDecision;
  stageDelta: number;
  levelDelta: number | null;
  newStage: string | null;
  newLevel: number | null;
  isPromotionCandidate: boolean;
  isDemotionCandidate: boolean;
}

export function applyComprehensiveEvaluationManualOverride(
  row: ComprehensiveEvaluationRow,
  base: ComprehensiveEvaluationComputedRow,
  settings: ComprehensiveEvaluationSettings,
  override: ComprehensiveEvaluationManualOverride | undefined
): ComprehensiveEvaluationComputedRow {
  if (!override) return base;

  const decision: ComprehensiveEvaluationDecision = override.decision;
  const stageDelta =
    typeof override.stageDelta === 'number'
      ? override.stageDelta
      : decision === '昇格'
        ? settings.promotion.stageDelta
        : decision === '降格'
          ? settings.demotion.stageDelta
          : 0;

  const levelDelta =
    row.employmentType === 'parttime'
      ? null
      : typeof override.levelDelta === 'number'
        ? override.levelDelta
        : base.levelDelta;

  const newStage = computeNewStage(row.currentStage, stageDelta);
  const newLevel = row.currentLevel !== null && levelDelta !== null ? row.currentLevel + levelDelta : null;

  return {
    ...base,
    decision,
    stageDelta,
    levelDelta,
    newStage,
    newLevel,
  };
}

export function computeComprehensiveEvaluationRow(
  row: ComprehensiveEvaluationRow,
  settings: ComprehensiveEvaluationSettings,
  userFlags: ComprehensiveEvaluationUserFlags | undefined
): ComprehensiveEvaluationComputedRow {
  const effectiveFlags = computeEffectiveUserFlags(row, userFlags);
  const totalScore = computeTotalScore(row.performanceScore, row.competencyScore);
  const baseOverallRank =
    totalScore !== null ? getOverallEvaluationRank(totalScore, settings.overallScoreThresholds) : null;
  const overallRank =
    settings.demotion.mboDOverrideEnabled && row.mboDRatingFlag === '1'
      ? 'D'
      : baseOverallRank;

  const meetsPromotionMinimums =
    overallRank !== null &&
    row.competencyFinalRank !== null &&
    row.coreValueFinalRank !== null &&
    isRankAtLeast(overallRank, settings.promotion.overallMinimumRank) &&
    isRankAtLeast(row.competencyFinalRank, settings.promotion.competencyMinimumRank) &&
    isRankAtLeast(row.coreValueFinalRank, settings.promotion.coreValueMinimumRank);

  const meetsPromotionChecks =
    (!settings.promotion.requireLeaderInterview || effectiveFlags.leaderInterviewCleared) &&
    (!settings.promotion.requireDivisionHeadPresentation || effectiveFlags.divisionHeadPresentationCleared) &&
    (!settings.promotion.requireCeoInterview || effectiveFlags.ceoInterviewCleared);

  const isPromotionCandidate = meetsPromotionMinimums && meetsPromotionChecks;
  const isDemotionCandidate = overallRank !== null && isRankAtOrWorse(overallRank, settings.demotion.yearlyThresholdRank);

  let decision: ComprehensiveEvaluationDecision = '対象外';
  if (isPromotionCandidate) decision = '昇格';
  else if (isDemotionCandidate) decision = '降格';

  const stageDelta =
    decision === '昇格' ? settings.promotion.stageDelta : decision === '降格' ? settings.demotion.stageDelta : 0;
  const levelDelta =
    row.employmentType === 'parttime' ? null : overallRank ? settings.levelDeltaByOverallRank[overallRank] : null;

  const newStage = computeNewStage(row.currentStage, stageDelta);
  const newLevel = row.currentLevel !== null && levelDelta !== null ? row.currentLevel + levelDelta : null;

  return {
    totalScore,
    overallRank,
    decision,
    stageDelta,
    levelDelta,
    newStage,
    newLevel,
    isPromotionCandidate,
    isDemotionCandidate,
  };
}
