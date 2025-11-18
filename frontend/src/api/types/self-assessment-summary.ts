import type { UUID } from './common';

export interface StageWeights {
  quantitative: number;
  qualitative: number;
  competency: number;
}

export interface SelfAssessmentDraftEntry {
  goalId: UUID;
  bucket: string;
  ratingCode?: string;
  comment?: string | null;
}

export interface SelfAssessmentGoalContext {
  id: UUID;
  goalCategory: string;
  periodId: UUID;
  status: string;
  weight?: number | null;
  targetData?: unknown;
}

export interface SelfAssessmentSummaryBucket {
  bucket: string;
  weight: number;
  avgScore: number;
  contribution: number;
}

export interface SelfAssessmentSummaryFlags {
  [key: string]: unknown;
  fail?: boolean;
}

export interface LevelAdjustmentPreview {
  rating?: string;
  delta?: number;
}

export interface SelfAssessmentSummary {
  stageWeights: StageWeights;
  perBucket: SelfAssessmentSummaryBucket[];
  weightedTotal: number;
  finalRating: string;
  flags: SelfAssessmentSummaryFlags;
  levelAdjustmentPreview?: LevelAdjustmentPreview | null;
  submittedAt?: string;
}

export interface ThresholdRow {
  ratingCode: string;
  minScore: number;
  note?: string | null;
}

export interface SelfAssessmentContext {
  goals: SelfAssessmentGoalContext[];
  draft?: SelfAssessmentDraftEntry[] | null;
  stageWeights: StageWeights;
  thresholds: ThresholdRow[];
  summary?: SelfAssessmentSummary | null;
}
