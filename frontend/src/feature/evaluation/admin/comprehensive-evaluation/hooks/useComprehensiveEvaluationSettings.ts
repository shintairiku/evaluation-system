"use client";

import { useEffect, useState } from "react";

import {
  EVALUATION_RANKS,
  type ComprehensiveEvaluationSettings,
  type PromotionRuleCondition,
  type PromotionRuleGroup,
} from "../settings";
import { mockDefaultComprehensiveEvaluationSettings } from "../mock";
import type { EvaluationRank } from "../types";

const STORAGE_KEY_V2 = "comprehensive-evaluation:settings:v2";
const STORAGE_KEY_V1 = "comprehensive-evaluation:settings:v1";

function isEvaluationRank(value: unknown): value is EvaluationRank {
  return typeof value === "string" && (EVALUATION_RANKS as string[]).includes(value);
}

const PROMOTION_RANK_FIELDS = new Set<PromotionRuleCondition["field"]>([
  "overallRank",
  "competencyFinalRank",
  "coreValueFinalRank",
]);

function isPromotionRuleCondition(value: unknown): value is PromotionRuleCondition {
  if (!value || typeof value !== "object") return false;
  const condition = value as PromotionRuleCondition;

  if (condition.type === "rank_at_least") {
    return (
      PROMOTION_RANK_FIELDS.has(condition.field) &&
      isEvaluationRank((condition as PromotionRuleCondition & { minimumRank?: unknown }).minimumRank)
    );
  }

  return false;
}

function parsePromotionRuleGroups(value: unknown): PromotionRuleGroup[] | null {
  if (!Array.isArray(value)) return null;

  const groups: PromotionRuleGroup[] = [];

  value.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const group = item as Partial<PromotionRuleGroup>;
    const id = typeof group.id === "string" && group.id.trim() ? group.id : `promotion-group-${index + 1}`;
    const rawConditions = Array.isArray(group.conditions) ? group.conditions : [];
    const conditions = rawConditions.filter(isPromotionRuleCondition);
    if (conditions.length === 0) return;
    groups.push({ id, conditions });
  });

  return groups.length > 0 ? groups : null;
}

function parseStoredSettingsV2(value: string | null): ComprehensiveEvaluationSettings | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<ComprehensiveEvaluationSettings>;
    if (!parsed || typeof parsed !== "object") return null;

    const promotion: Partial<ComprehensiveEvaluationSettings["promotion"]> = parsed.promotion ?? {};
    const demotion: Partial<ComprehensiveEvaluationSettings["demotion"]> = parsed.demotion ?? {};
    const overallScoreThresholds: Partial<ComprehensiveEvaluationSettings["overallScoreThresholds"]> =
      parsed.overallScoreThresholds ?? {};
    const levelDeltaByOverallRank: Partial<ComprehensiveEvaluationSettings["levelDeltaByOverallRank"]> =
      parsed.levelDeltaByOverallRank ?? {};
    const ruleGroups =
      parsePromotionRuleGroups((promotion as { ruleGroups?: unknown }).ruleGroups) ??
      mockDefaultComprehensiveEvaluationSettings.promotion.ruleGroups;

    return {
      promotion: {
        ruleGroups,
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

function parseStoredSettingsV1(value: string | null): ComprehensiveEvaluationSettings | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return null;

    const promotion = (parsed.promotion ?? {}) as Record<string, unknown>;
    const demotion = (parsed.demotion ?? {}) as Record<string, unknown>;
    const overallScoreThresholds = (parsed.overallScoreThresholds ?? {}) as Record<string, unknown>;
    const levelDeltaByOverallRank = (parsed.levelDeltaByOverallRank ?? {}) as Record<string, unknown>;

    const overallMinimumRank = isEvaluationRank(promotion.overallMinimumRank)
      ? (promotion.overallMinimumRank as EvaluationRank)
      : "A+";
    const competencyMinimumRank = isEvaluationRank(promotion.competencyMinimumRank)
      ? (promotion.competencyMinimumRank as EvaluationRank)
      : "A+";
    const coreValueMinimumRank = isEvaluationRank(promotion.coreValueMinimumRank)
      ? (promotion.coreValueMinimumRank as EvaluationRank)
      : "A+";

    const migratedConditions: PromotionRuleCondition[] = [
      { type: "rank_at_least", field: "overallRank", minimumRank: overallMinimumRank },
      { type: "rank_at_least", field: "competencyFinalRank", minimumRank: competencyMinimumRank },
      { type: "rank_at_least", field: "coreValueFinalRank", minimumRank: coreValueMinimumRank },
    ];

    return {
      promotion: {
        ruleGroups: [{ id: "promotion-group-migrated", conditions: migratedConditions }],
        stageDelta: typeof promotion.stageDelta === "number"
          ? (promotion.stageDelta as number)
          : mockDefaultComprehensiveEvaluationSettings.promotion.stageDelta,
      },
      demotion: {
        yearlyThresholdRank: isEvaluationRank(demotion.yearlyThresholdRank)
          ? (demotion.yearlyThresholdRank as EvaluationRank)
          : mockDefaultComprehensiveEvaluationSettings.demotion.yearlyThresholdRank,
        stageDelta: typeof demotion.stageDelta === "number"
          ? (demotion.stageDelta as number)
          : mockDefaultComprehensiveEvaluationSettings.demotion.stageDelta,
      },
      overallScoreThresholds: {
        SS: typeof overallScoreThresholds.SS === "number"
          ? (overallScoreThresholds.SS as number)
          : mockDefaultComprehensiveEvaluationSettings.overallScoreThresholds.SS,
        S: typeof overallScoreThresholds.S === "number"
          ? (overallScoreThresholds.S as number)
          : mockDefaultComprehensiveEvaluationSettings.overallScoreThresholds.S,
        'A+': typeof overallScoreThresholds['A+'] === "number"
          ? (overallScoreThresholds['A+'] as number)
          : mockDefaultComprehensiveEvaluationSettings.overallScoreThresholds['A+'],
        A: typeof overallScoreThresholds.A === "number"
          ? (overallScoreThresholds.A as number)
          : mockDefaultComprehensiveEvaluationSettings.overallScoreThresholds.A,
        'A-': typeof overallScoreThresholds['A-'] === "number"
          ? (overallScoreThresholds['A-'] as number)
          : mockDefaultComprehensiveEvaluationSettings.overallScoreThresholds['A-'],
        B: typeof overallScoreThresholds.B === "number"
          ? (overallScoreThresholds.B as number)
          : mockDefaultComprehensiveEvaluationSettings.overallScoreThresholds.B,
        C: typeof overallScoreThresholds.C === "number"
          ? (overallScoreThresholds.C as number)
          : mockDefaultComprehensiveEvaluationSettings.overallScoreThresholds.C,
        D: typeof overallScoreThresholds.D === "number"
          ? (overallScoreThresholds.D as number)
          : mockDefaultComprehensiveEvaluationSettings.overallScoreThresholds.D,
      },
      levelDeltaByOverallRank: {
        SS: typeof levelDeltaByOverallRank.SS === "number"
          ? (levelDeltaByOverallRank.SS as number)
          : mockDefaultComprehensiveEvaluationSettings.levelDeltaByOverallRank.SS,
        S: typeof levelDeltaByOverallRank.S === "number"
          ? (levelDeltaByOverallRank.S as number)
          : mockDefaultComprehensiveEvaluationSettings.levelDeltaByOverallRank.S,
        'A+': typeof levelDeltaByOverallRank['A+'] === "number"
          ? (levelDeltaByOverallRank['A+'] as number)
          : mockDefaultComprehensiveEvaluationSettings.levelDeltaByOverallRank['A+'],
        A: typeof levelDeltaByOverallRank.A === "number"
          ? (levelDeltaByOverallRank.A as number)
          : mockDefaultComprehensiveEvaluationSettings.levelDeltaByOverallRank.A,
        'A-': typeof levelDeltaByOverallRank['A-'] === "number"
          ? (levelDeltaByOverallRank['A-'] as number)
          : mockDefaultComprehensiveEvaluationSettings.levelDeltaByOverallRank['A-'],
        B: typeof levelDeltaByOverallRank.B === "number"
          ? (levelDeltaByOverallRank.B as number)
          : mockDefaultComprehensiveEvaluationSettings.levelDeltaByOverallRank.B,
        C: typeof levelDeltaByOverallRank.C === "number"
          ? (levelDeltaByOverallRank.C as number)
          : mockDefaultComprehensiveEvaluationSettings.levelDeltaByOverallRank.C,
        D: typeof levelDeltaByOverallRank.D === "number"
          ? (levelDeltaByOverallRank.D as number)
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
  const storedV2 = window.localStorage.getItem(STORAGE_KEY_V2);
  const parsedV2 = parseStoredSettingsV2(storedV2);
  if (parsedV2) return parsedV2;

  const storedV1 = window.localStorage.getItem(STORAGE_KEY_V1);
  return parseStoredSettingsV1(storedV1) ?? mockDefaultComprehensiveEvaluationSettings;
}

export function useComprehensiveEvaluationSettings() {
  const [settings, setSettings] = useState<ComprehensiveEvaluationSettings>(() => getInitialSettings());

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(settings));
  }, [settings]);

  const resetSettings = () => setSettings(mockDefaultComprehensiveEvaluationSettings);

  return { settings, setSettings, resetSettings };
}
