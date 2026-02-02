import type { ComprehensiveEvaluationDecision } from "./settings";

export interface ComprehensiveEvaluationManualOverride {
  decision: ComprehensiveEvaluationDecision;
  stageDelta?: number;
  levelDelta?: number;
  reason: string;
  doubleCheckedBy: string;
  appliedAt: string;
}

