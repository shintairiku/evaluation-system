"use client";

import { useEffect, useState } from "react";

import {
  EVALUATION_RANKS,
  type ComprehensiveEvaluationSettings,
} from "../settings";
import { mockDefaultComprehensiveEvaluationSettings } from "../mock";
import type { EvaluationRank } from "../types";

const STORAGE_KEY = "comprehensive-evaluation:settings:v1";

function isEvaluationRank(value: unknown): value is EvaluationRank {
  return typeof value === "string" && (EVALUATION_RANKS as string[]).includes(value);
}

function parseStoredSettings(value: string | null): ComprehensiveEvaluationSettings | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<ComprehensiveEvaluationSettings>;
    if (!parsed || typeof parsed !== "object") return null;

    const promotion = parsed.promotion ?? {};
    const demotion = parsed.demotion ?? {};
    const overallScoreThresholds = parsed.overallScoreThresholds ?? {};
    const levelDeltaByOverallRank = parsed.levelDeltaByOverallRank ?? {};

    return {
      promotion: {
        overallMinimumRank: isEvaluationRank(promotion.overallMinimumRank)
          ? promotion.overallMinimumRank
          : mockDefaultComprehensiveEvaluationSettings.promotion.overallMinimumRank,
        competencyMinimumRank: isEvaluationRank(promotion.competencyMinimumRank)
          ? promotion.competencyMinimumRank
          : mockDefaultComprehensiveEvaluationSettings.promotion.competencyMinimumRank,
        coreValueMinimumRank: isEvaluationRank(promotion.coreValueMinimumRank)
          ? promotion.coreValueMinimumRank
          : mockDefaultComprehensiveEvaluationSettings.promotion.coreValueMinimumRank,
        requireLeaderInterview: typeof promotion.requireLeaderInterview === "boolean"
          ? promotion.requireLeaderInterview
          : mockDefaultComprehensiveEvaluationSettings.promotion.requireLeaderInterview,
        requireDivisionHeadPresentation: typeof promotion.requireDivisionHeadPresentation === "boolean"
          ? promotion.requireDivisionHeadPresentation
          : mockDefaultComprehensiveEvaluationSettings.promotion.requireDivisionHeadPresentation,
        requireCeoInterview: typeof promotion.requireCeoInterview === "boolean"
          ? promotion.requireCeoInterview
          : mockDefaultComprehensiveEvaluationSettings.promotion.requireCeoInterview,
        stageDelta: typeof promotion.stageDelta === "number"
          ? promotion.stageDelta
          : mockDefaultComprehensiveEvaluationSettings.promotion.stageDelta,
      },
      demotion: {
        yearlyThresholdRank: isEvaluationRank(demotion.yearlyThresholdRank)
          ? demotion.yearlyThresholdRank
          : mockDefaultComprehensiveEvaluationSettings.demotion.yearlyThresholdRank,
        stageDelta: typeof demotion.stageDelta === "number"
          ? demotion.stageDelta
          : mockDefaultComprehensiveEvaluationSettings.demotion.stageDelta,
        mboDOverrideEnabled: typeof demotion.mboDOverrideEnabled === "boolean"
          ? demotion.mboDOverrideEnabled
          : mockDefaultComprehensiveEvaluationSettings.demotion.mboDOverrideEnabled,
      },
      overallScoreThresholds: {
        SS: typeof overallScoreThresholds.SS === "number"
          ? overallScoreThresholds.SS
          : mockDefaultComprehensiveEvaluationSettings.overallScoreThresholds.SS,
        S: typeof overallScoreThresholds.S === "number"
          ? overallScoreThresholds.S
          : mockDefaultComprehensiveEvaluationSettings.overallScoreThresholds.S,
        'A+': typeof overallScoreThresholds['A+'] === "number"
          ? overallScoreThresholds['A+']
          : mockDefaultComprehensiveEvaluationSettings.overallScoreThresholds['A+'],
        A: typeof overallScoreThresholds.A === "number"
          ? overallScoreThresholds.A
          : mockDefaultComprehensiveEvaluationSettings.overallScoreThresholds.A,
        'A-': typeof overallScoreThresholds['A-'] === "number"
          ? overallScoreThresholds['A-']
          : mockDefaultComprehensiveEvaluationSettings.overallScoreThresholds['A-'],
        B: typeof overallScoreThresholds.B === "number"
          ? overallScoreThresholds.B
          : mockDefaultComprehensiveEvaluationSettings.overallScoreThresholds.B,
        C: typeof overallScoreThresholds.C === "number"
          ? overallScoreThresholds.C
          : mockDefaultComprehensiveEvaluationSettings.overallScoreThresholds.C,
        D: typeof overallScoreThresholds.D === "number"
          ? overallScoreThresholds.D
          : mockDefaultComprehensiveEvaluationSettings.overallScoreThresholds.D,
      },
      levelDeltaByOverallRank: {
        SS: typeof levelDeltaByOverallRank.SS === "number"
          ? levelDeltaByOverallRank.SS
          : mockDefaultComprehensiveEvaluationSettings.levelDeltaByOverallRank.SS,
        S: typeof levelDeltaByOverallRank.S === "number"
          ? levelDeltaByOverallRank.S
          : mockDefaultComprehensiveEvaluationSettings.levelDeltaByOverallRank.S,
        'A+': typeof levelDeltaByOverallRank['A+'] === "number"
          ? levelDeltaByOverallRank['A+']
          : mockDefaultComprehensiveEvaluationSettings.levelDeltaByOverallRank['A+'],
        A: typeof levelDeltaByOverallRank.A === "number"
          ? levelDeltaByOverallRank.A
          : mockDefaultComprehensiveEvaluationSettings.levelDeltaByOverallRank.A,
        'A-': typeof levelDeltaByOverallRank['A-'] === "number"
          ? levelDeltaByOverallRank['A-']
          : mockDefaultComprehensiveEvaluationSettings.levelDeltaByOverallRank['A-'],
        B: typeof levelDeltaByOverallRank.B === "number"
          ? levelDeltaByOverallRank.B
          : mockDefaultComprehensiveEvaluationSettings.levelDeltaByOverallRank.B,
        C: typeof levelDeltaByOverallRank.C === "number"
          ? levelDeltaByOverallRank.C
          : mockDefaultComprehensiveEvaluationSettings.levelDeltaByOverallRank.C,
        D: typeof levelDeltaByOverallRank.D === "number"
          ? levelDeltaByOverallRank.D
          : mockDefaultComprehensiveEvaluationSettings.levelDeltaByOverallRank.D,
      },
    };
  } catch {
    return null;
  }
}

function getInitialSettings(): ComprehensiveEvaluationSettings {
  if (typeof window === "undefined") {
    return mockDefaultComprehensiveEvaluationSettings;
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return parseStoredSettings(stored) ?? mockDefaultComprehensiveEvaluationSettings;
}

export function useComprehensiveEvaluationSettings() {
  const [settings, setSettings] = useState<ComprehensiveEvaluationSettings>(() => getInitialSettings());

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const resetSettings = () => setSettings(mockDefaultComprehensiveEvaluationSettings);

  return { settings, setSettings, resetSettings };
}
