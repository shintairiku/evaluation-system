import { EVALUATION_RANKS, type ComprehensiveEvaluationSettings, type ComprehensiveEvaluationUserFlags, type ComprehensiveEvaluationDecision } from './settings';
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
  promotionFlag: boolean;
  demotionFlag: boolean;
  stageDelta: number;
  levelDelta: number | null;
  newStage: string | null;
  newLevel: number | null;
  isPromotionCandidate: boolean;
  isDemotionCandidate: boolean;
}

function computePromotionFlag(row: ComprehensiveEvaluationRow, computedNewLevel: number | null): boolean {
  if (row.employmentType !== 'employee') return false;
  if (computedNewLevel === null) return false;
  return computedNewLevel >= 30;
}

function computeDemotionFlag(overallRank: EvaluationRank | null): boolean {
  return overallRank === 'D';
}

export function applyComprehensiveEvaluationManualOverride(
  row: ComprehensiveEvaluationRow,
  base: ComprehensiveEvaluationComputedRow,
  override: ComprehensiveEvaluationManualOverride | undefined
): ComprehensiveEvaluationComputedRow {
  if (!override) return base;

  const decision: ComprehensiveEvaluationDecision = override.decision;
  const shouldApplyStageLevel = decision !== '対象外';
  const stageAfter =
    shouldApplyStageLevel && typeof override.stageAfter === 'string' && override.stageAfter.trim() !== ''
      ? override.stageAfter.trim()
      : undefined;
  const newStage = stageAfter ?? base.newStage;

  const stageDelta = (() => {
    if (!newStage || !row.currentStage) return 0;
    const currentNumber = parseStageNumber(row.currentStage);
    const nextNumber = parseStageNumber(newStage);
    if (currentNumber === null || nextNumber === null) return 0;
    return nextNumber - currentNumber;
  })();

  const levelAfter =
    shouldApplyStageLevel && row.employmentType !== 'parttime' && typeof override.levelAfter === 'number'
      ? override.levelAfter
      : undefined;
  const newLevel = typeof levelAfter === 'number' ? levelAfter : base.newLevel;
  const levelDelta = row.currentLevel !== null && newLevel !== null ? newLevel - row.currentLevel : null;

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
  settings: ComprehensiveEvaluationSettings
): ComprehensiveEvaluationComputedRow {
  const totalScore = computeTotalScore(row.performanceScore, row.competencyScore);
  const baseOverallRank =
    totalScore !== null ? getOverallEvaluationRank(totalScore, settings.overallScoreThresholds) : null;
  const overallRank = baseOverallRank;

  const isPromotionCandidate = false;
  const isDemotionCandidate = false;
  const decision: ComprehensiveEvaluationDecision = '対象外';
  const stageDelta = 0;
  const levelDelta =
    row.employmentType === 'parttime' ? null : overallRank ? settings.levelDeltaByOverallRank[overallRank] : null;

  const newStage = computeNewStage(row.currentStage, stageDelta);
  const newLevel = row.currentLevel !== null && levelDelta !== null ? row.currentLevel + levelDelta : null;
  const promotionFlag = computePromotionFlag(row, newLevel);
  const demotionFlag = computeDemotionFlag(overallRank);

  return {
    totalScore,
    overallRank,
    decision,
    promotionFlag,
    demotionFlag,
    stageDelta,
    levelDelta,
    newStage,
    newLevel,
    isPromotionCandidate,
    isDemotionCandidate,
  };
}
