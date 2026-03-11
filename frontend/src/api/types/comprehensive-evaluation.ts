import type { UUID } from './common';

export type ComprehensiveEvaluationRank = 'SS' | 'S' | 'A+' | 'A' | 'A-' | 'B' | 'C' | 'D';
export type ComprehensiveEmploymentType = 'employee' | 'parttime';
export type ComprehensiveProcessingStatus = 'processed' | 'unprocessed';
export type ComprehensiveDecision = '昇格' | '降格' | '対象外';

export interface ComprehensivePromotionRuleCondition {
  type: 'rank_at_least';
  field: 'overallRank' | 'competencyFinalRank' | 'coreValueFinalRank';
  minimumRank: ComprehensiveEvaluationRank;
}

export interface ComprehensiveDemotionRuleCondition {
  type: 'rank_at_or_worse';
  field: 'overallRank' | 'competencyFinalRank' | 'coreValueFinalRank';
  thresholdRank: ComprehensiveEvaluationRank;
}

export interface ComprehensivePromotionRuleGroup {
  id: string;
  conditions: ComprehensivePromotionRuleCondition[];
}

export interface ComprehensiveDemotionRuleGroup {
  id: string;
  conditions: ComprehensiveDemotionRuleCondition[];
}

export interface ComprehensiveEvaluationSettingsPayload {
  promotion: {
    ruleGroups: ComprehensivePromotionRuleGroup[];
  };
  demotion: {
    ruleGroups: ComprehensiveDemotionRuleGroup[];
  };
  overallScoreThresholds: Record<ComprehensiveEvaluationRank, number>;
  levelDeltaByOverallRank: Record<ComprehensiveEvaluationRank, number>;
}

export type ComprehensiveEvaluationSettingsResponse = ComprehensiveEvaluationSettingsPayload;
export type ComprehensiveEvaluationSettingsRequest = ComprehensiveEvaluationSettingsPayload;

export interface ComprehensiveRulesetTemplateResponse {
  id: UUID;
  name: string;
  settings: ComprehensiveEvaluationSettingsPayload;
  isDefaultTemplate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ComprehensiveRulesetAssignmentResponse {
  id?: UUID;
  periodId: UUID;
  departmentId: UUID | null;
  departmentName?: string | null;
  stageId: UUID | null;
  stageName?: string | null;
  settings: ComprehensiveEvaluationSettingsPayload;
  sourceRulesetId: UUID | null;
  sourceRulesetNameSnapshot: string | null;
  inheritsDefault: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ComprehensiveEvaluationSettingsWorkspaceResponse {
  locked: boolean;
  templates: ComprehensiveRulesetTemplateResponse[];
  defaultAssignment: ComprehensiveRulesetAssignmentResponse;
  departmentAssignments: ComprehensiveRulesetAssignmentResponse[];
  stageAssignments: ComprehensiveRulesetAssignmentResponse[];
}

export interface GetComprehensiveEvaluationSettingsWorkspaceParams {
  periodId: UUID;
}

export interface UpdateComprehensiveDefaultAssignmentRequest {
  periodId: UUID;
  settings: ComprehensiveEvaluationSettingsPayload;
  sourceRulesetId?: UUID;
}

export interface UpdateComprehensiveDepartmentAssignmentRequest {
  periodId: UUID;
  inheritDefault?: boolean;
  settings?: ComprehensiveEvaluationSettingsPayload;
  sourceRulesetId?: UUID;
}

export type UpdateComprehensiveStageAssignmentRequest = UpdateComprehensiveDepartmentAssignmentRequest;

export interface UpsertComprehensiveRulesetRequest {
  name: string;
  settings: ComprehensiveEvaluationSettingsPayload;
  isDefaultTemplate?: boolean;
}

export interface ComprehensiveEvaluationComputedState {
  totalScore: number | null;
  overallRank: ComprehensiveEvaluationRank | null;
  decision: ComprehensiveDecision;
  promotionFlag: boolean;
  demotionFlag: boolean;
  stageDelta: number;
  levelDelta: number | null;
  newStage: string | null;
  newLevel: number | null;
  isPromotionCandidate: boolean;
  isDemotionCandidate: boolean;
}

export interface ComprehensiveManualDecision {
  periodId: UUID;
  decision: ComprehensiveDecision;
  stageAfter: string | null;
  levelAfter: number | null;
  reason: string;
  doubleCheckedBy: string | null;
  appliedByUserId: UUID;
  appliedAt: string;
}

export interface ComprehensiveEvaluationRowResponse {
  id: string;
  userId: UUID;
  evaluationPeriodId: UUID;

  employeeCode: string;
  name: string;
  departmentName: string | null;
  employmentType: ComprehensiveEmploymentType;
  processingStatus: ComprehensiveProcessingStatus;

  performanceFinalRank: ComprehensiveEvaluationRank | null;
  performanceWeightPercent: number | null;
  performanceScore: number | null;

  competencyFinalRank: ComprehensiveEvaluationRank | null;
  competencyWeightPercent: number | null;
  competencyScore: number | null;

  coreValueFinalRank: ComprehensiveEvaluationRank | null;

  leaderInterviewCleared: boolean | null;
  divisionHeadPresentationCleared: boolean | null;
  ceoInterviewCleared: boolean | null;

  currentStage: string | null;
  currentLevel: number | null;

  auto: ComprehensiveEvaluationComputedState;
  applied: ComprehensiveEvaluationComputedState;
  manualDecision: ComprehensiveManualDecision | null;
}

export interface ComprehensiveEvaluationListMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ComprehensiveEvaluationListResponse {
  rows: ComprehensiveEvaluationRowResponse[];
  meta: ComprehensiveEvaluationListMeta;
}

export type ComprehensiveEvaluationExportColumn =
  | 'employeeCode'
  | 'name'
  | 'departmentName'
  | 'employmentType'
  | 'currentStage'
  | 'currentLevel'
  | 'performanceFinalRank'
  | 'performanceWeightPercent'
  | 'competencyFinalRank'
  | 'competencyWeightPercent'
  | 'coreValueFinalRank'
  | 'totalScore'
  | 'overallRank'
  | 'newLevel'
  | 'promotionDemotionFlag'
  | 'processingStatus';

export interface GetComprehensiveEvaluationListParams {
  periodId: UUID;
  departmentId?: UUID;
  stageId?: UUID;
  employmentType?: ComprehensiveEmploymentType;
  search?: string;
  processingStatus?: ComprehensiveProcessingStatus;
  candidateView?: boolean;
  page?: number;
  limit?: number;
}

export interface ExportComprehensiveEvaluationRequest {
  periodId: UUID;
  departmentId?: UUID;
  stageId?: UUID;
  departmentName?: string;
  stageName?: string;
  employmentType?: ComprehensiveEmploymentType;
  search?: string;
  processingStatus?: ComprehensiveProcessingStatus;
  columns: ComprehensiveEvaluationExportColumn[];
}

export interface FinalizeComprehensiveEvaluationRequest {
  periodId: UUID;
}

export interface FinalizeComprehensiveEvaluationResponse {
  periodId: UUID;
  previousStatus: 'draft' | 'active' | 'completed' | 'cancelled';
  currentStatus: 'draft' | 'active' | 'completed' | 'cancelled';
  totalUsers: number;
  updatedUserLevels: number;
}

export interface ProcessComprehensiveEvaluationUserRequest {
  periodId: UUID;
  userId: UUID;
}

export interface ProcessComprehensiveEvaluationUserResponse {
  periodId: UUID;
  userId: UUID;
  processingStatus: ComprehensiveProcessingStatus;
  updatedLevel: boolean;
  updatedStage: boolean;
}

export interface UpsertComprehensiveManualDecisionRequest {
  periodId: UUID;
  decision: ComprehensiveDecision;
  stageAfter?: string;
  levelAfter?: number;
  reason: string;
}

export interface ComprehensiveManualDecisionHistoryEntry {
  id: UUID;
  periodId: UUID;
  periodName: string | null;
  userId: UUID;
  employeeCode: string | null;
  userName: string | null;
  operation: 'UPSERT' | 'CLEAR';
  decision: ComprehensiveDecision | null;
  stageAfter: string | null;
  levelAfter: number | null;
  reason: string | null;
  doubleCheckedBy: string | null;
  appliedByUserId: UUID | null;
  appliedByUserName: string | null;
  appliedAt: string | null;
  changedAt: string;
}

export interface ComprehensiveManualDecisionHistoryResponse {
  items: ComprehensiveManualDecisionHistoryEntry[];
  meta: ComprehensiveEvaluationListMeta;
}

export interface GetComprehensiveManualDecisionHistoryParams {
  periodId?: UUID;
  page?: number;
  limit?: number;
}
