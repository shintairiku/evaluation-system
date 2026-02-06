import type { ComprehensiveEvaluationDecision } from "./settings";

export interface ComprehensiveEvaluationManualOverride {
  decision: ComprehensiveEvaluationDecision;
  stageAfter?: string;
  levelAfter?: number;
  reason: string;
  doubleCheckedBy: string;
  appliedAt: string;
}
