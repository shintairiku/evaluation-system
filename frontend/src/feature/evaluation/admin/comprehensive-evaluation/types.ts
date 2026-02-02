export type EvaluationRank = 'SS' | 'S' | 'A+' | 'A' | 'A-' | 'B' | 'C' | 'D';

export type EmploymentType = 'employee' | 'parttime';

export type ProcessingStatus = 'unprocessed' | 'processed';

export interface ComprehensiveEvaluationRow {
  id: string;
  userId: string;
  evaluationPeriodId: string;

  employeeCode: string;
  name: string;
  departmentName: string;
  employmentType: EmploymentType;
  processingStatus: ProcessingStatus;

  performanceFinalRank: EvaluationRank | null;
  performanceWeightPercent: number | null;
  performanceScore: number | null;

  competencyFinalRank: EvaluationRank | null;
  competencyWeightPercent: number | null;
  competencyScore: number | null;

  coreValueFinalRank: EvaluationRank | null;

  mboDRatingFlag: '0' | '1' | null;

  leaderInterviewCleared: boolean | null;
  divisionHeadPresentationCleared: boolean | null;
  ceoInterviewCleared: boolean | null;

  currentStage: string | null;
  currentLevel: number | null;
}

export interface EvaluationPeriodOption {
  id: string;
  label: string;
}
