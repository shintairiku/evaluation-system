"use client";

import { useEffect, useState } from "react";

import type { ComprehensiveEvaluationManualOverride } from "../manualOverride";

const STORAGE_KEY = "comprehensive-evaluation:manual-overrides:v1";

type StoredOverrides = Record<string, Record<string, ComprehensiveEvaluationManualOverride | undefined> | undefined>;

function parseStoredOverrides(value: string | null): StoredOverrides {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as StoredOverrides;
  } catch {
    return {};
  }
}

function getInitialOverrides(): StoredOverrides {
  if (typeof window === "undefined") return {};
  return parseStoredOverrides(window.localStorage.getItem(STORAGE_KEY));
}

export function useComprehensiveEvaluationManualOverrides() {
  const [overridesByPeriodId, setOverridesByPeriodId] = useState<StoredOverrides>(() => getInitialOverrides());

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overridesByPeriodId));
  }, [overridesByPeriodId]);

  const upsertOverride = (evaluationPeriodId: string, userId: string, override: ComprehensiveEvaluationManualOverride) => {
    setOverridesByPeriodId((prev) => {
      const currentPeriod = prev[evaluationPeriodId] ?? {};
      return { ...prev, [evaluationPeriodId]: { ...currentPeriod, [userId]: override } };
    });
  };

  const clearOverride = (evaluationPeriodId: string, userId: string) => {
    setOverridesByPeriodId((prev) => {
      const currentPeriod = prev[evaluationPeriodId];
      if (!currentPeriod?.[userId]) return prev;
      const nextPeriod = { ...currentPeriod };
      delete nextPeriod[userId];
      return { ...prev, [evaluationPeriodId]: nextPeriod };
    });
  };

  return { overridesByPeriodId, upsertOverride, clearOverride };
}
