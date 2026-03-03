"use client";

import { useCallback, useState } from "react";

import {
  clearComprehensiveManualDecisionAction,
  upsertComprehensiveManualDecisionAction,
} from "@/api/server-actions/comprehensive-evaluation";

import type { ComprehensiveEvaluationManualOverride } from "../manualOverride";

export function useComprehensiveEvaluationManualOverrides() {
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const upsertOverride = useCallback(
    async (evaluationPeriodId: string, userId: string, override: ComprehensiveEvaluationManualOverride) => {
      setIsSaving(true);
      setError(null);

      const result = await upsertComprehensiveManualDecisionAction(userId, {
        periodId: evaluationPeriodId,
        decision: override.decision,
        stageAfter: override.stageAfter,
        levelAfter: override.levelAfter,
        reason: override.reason,
      });

      setIsSaving(false);

      if (!result.success) {
        setError(result.error ?? "手動確定の保存に失敗しました");
        return { success: false, error: result.error ?? "手動確定の保存に失敗しました" };
      }

      return { success: true as const };
    },
    [],
  );

  const clearOverride = useCallback(async (evaluationPeriodId: string, userId: string) => {
    setIsSaving(true);
    setError(null);

    const result = await clearComprehensiveManualDecisionAction(userId, evaluationPeriodId);

    setIsSaving(false);

    if (!result.success) {
      setError(result.error ?? "手動確定の解除に失敗しました");
      return { success: false, error: result.error ?? "手動確定の解除に失敗しました" };
    }

    return { success: true as const };
  }, []);

  return {
    upsertOverride,
    clearOverride,
    isSaving,
    error,
  };
}
