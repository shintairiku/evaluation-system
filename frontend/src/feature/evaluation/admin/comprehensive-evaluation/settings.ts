import type { EvaluationRank } from './types';

export const EVALUATION_RANKS: EvaluationRank[] = ['SS', 'S', 'A+', 'A', 'A-', 'B', 'C', 'D'];

const RANK_VALUE: Record<EvaluationRank, number> = {
  SS: 1,
  S: 2,
  'A+': 3,
  A: 4,
  'A-': 5,
  B: 6,
  C: 7,
  D: 8,
};

export function getRankValue(rank: EvaluationRank): number {
  return RANK_VALUE[rank];
}

export function isRankAtLeast(rank: EvaluationRank, minimumRank: EvaluationRank): boolean {
  return getRankValue(rank) <= getRankValue(minimumRank);
}

export function isRankAtOrWorse(rank: EvaluationRank, thresholdRank: EvaluationRank): boolean {
  return getRankValue(rank) >= getRankValue(thresholdRank);
}

export type ComprehensiveEvaluationDecision = '昇格' | '降格' | '対象外';

export type PromotionRuleCondition =
  | {
      type: 'rank_at_least';
      field: 'overallRank' | 'competencyFinalRank' | 'coreValueFinalRank';
      minimumRank: EvaluationRank;
    };

export interface PromotionRuleGroup {
  id: string;
  conditions: PromotionRuleCondition[];
}

export interface PromotionRuleSettings {
  ruleGroups: PromotionRuleGroup[];
}

export type DemotionRuleCondition =
  | {
      type: 'rank_at_or_worse';
      field: 'overallRank' | 'competencyFinalRank' | 'coreValueFinalRank';
      thresholdRank: EvaluationRank;
    };

export interface DemotionRuleGroup {
  id: string;
  conditions: DemotionRuleCondition[];
}

export interface DemotionRuleSettings {
  ruleGroups: DemotionRuleGroup[];
}

export interface ComprehensiveEvaluationSettings {
  promotion: PromotionRuleSettings;
  demotion: DemotionRuleSettings;
  overallScoreThresholds: Record<EvaluationRank, number>;
  levelDeltaByOverallRank: Record<EvaluationRank, number>;
}

export interface ComprehensiveEvaluationUserFlags {
  leaderInterviewCleared?: boolean;
  divisionHeadPresentationCleared?: boolean;
  ceoInterviewCleared?: boolean;
}
