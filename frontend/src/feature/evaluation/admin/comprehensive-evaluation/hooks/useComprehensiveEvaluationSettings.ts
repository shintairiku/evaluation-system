"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getComprehensiveEvaluationSettingsAction,
  updateComprehensiveEvaluationSettingsAction,
} from "@/api/server-actions/comprehensive-evaluation";
import type {
  ComprehensiveEvaluationSettingsRequest,
  ComprehensiveEvaluationSettingsResponse,
} from "@/api/types";

import {
  type ComprehensiveEvaluationSettings,
  type DemotionRuleGroup,
  type PromotionRuleGroup,
} from "../settings";
import { mockDefaultComprehensiveEvaluationSettings } from "../mock";

function normalizePromotionGroups(
  groups: ComprehensiveEvaluationSettingsResponse["promotion"]["ruleGroups"] | undefined,
): PromotionRuleGroup[] {
  if (!groups || groups.length === 0) {
    return mockDefaultComprehensiveEvaluationSettings.promotion.ruleGroups;
  }

  return groups.map((group, index) => ({
    id: group.id || `promotion-group-${index + 1}`,
    conditions: group.conditions.map((condition) => ({
      type: "rank_at_least",
      field: condition.field,
      minimumRank: condition.minimumRank,
    })),
  }));
}

function normalizeDemotionGroups(
  groups: ComprehensiveEvaluationSettingsResponse["demotion"]["ruleGroups"] | undefined,
): DemotionRuleGroup[] {
  if (!groups || groups.length === 0) {
    return mockDefaultComprehensiveEvaluationSettings.demotion.ruleGroups;
  }

  return groups.map((group, index) => ({
    id: group.id || `demotion-group-${index + 1}`,
    conditions: group.conditions.map((condition) => ({
      type: "rank_at_or_worse",
      field: condition.field,
      thresholdRank: condition.thresholdRank,
    })),
  }));
}

function fromApiSettings(
  settings: ComprehensiveEvaluationSettingsResponse | undefined,
): ComprehensiveEvaluationSettings {
  if (!settings) {
    return mockDefaultComprehensiveEvaluationSettings;
  }

  return {
    promotion: {
      ruleGroups: normalizePromotionGroups(settings.promotion?.ruleGroups),
    },
    demotion: {
      ruleGroups: normalizeDemotionGroups(settings.demotion?.ruleGroups),
    },
    overallScoreThresholds:
      settings.overallScoreThresholds ?? mockDefaultComprehensiveEvaluationSettings.overallScoreThresholds,
    levelDeltaByOverallRank:
      settings.levelDeltaByOverallRank ?? mockDefaultComprehensiveEvaluationSettings.levelDeltaByOverallRank,
  };
}

function toApiSettings(settings: ComprehensiveEvaluationSettings): ComprehensiveEvaluationSettingsRequest {
  return {
    promotion: {
      ruleGroups: settings.promotion.ruleGroups.map((group) => ({
        id: group.id,
        conditions: group.conditions.map((condition) => ({
          type: "rank_at_least",
          field: condition.field,
          minimumRank: condition.minimumRank,
        })),
      })),
    },
    demotion: {
      ruleGroups: settings.demotion.ruleGroups.map((group) => ({
        id: group.id,
        conditions: group.conditions.map((condition) => ({
          type: "rank_at_or_worse",
          field: condition.field,
          thresholdRank: condition.thresholdRank,
        })),
      })),
    },
    overallScoreThresholds: settings.overallScoreThresholds,
    levelDeltaByOverallRank: settings.levelDeltaByOverallRank,
  };
}

export function useComprehensiveEvaluationSettings() {
  const [settings, setSettingsState] = useState<ComprehensiveEvaluationSettings>(
    mockDefaultComprehensiveEvaluationSettings,
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const reloadSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const result = await getComprehensiveEvaluationSettingsAction();
    if (!result.success || !result.data) {
      setSettingsState(mockDefaultComprehensiveEvaluationSettings);
      setError(result.error ?? "設定の読み込みに失敗しました");
      setIsLoading(false);
      return;
    }

    setSettingsState(fromApiSettings(result.data));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void reloadSettings();
  }, [reloadSettings]);

  const saveSettings = useCallback(async (nextSettings: ComprehensiveEvaluationSettings) => {
    setIsSaving(true);
    setError(null);

    const result = await updateComprehensiveEvaluationSettingsAction(toApiSettings(nextSettings));
    if (!result.success || !result.data) {
      setError(result.error ?? "設定の保存に失敗しました");
      setIsSaving(false);
      return { success: false, error: result.error ?? "設定の保存に失敗しました" };
    }

    setSettingsState(fromApiSettings(result.data));
    setIsSaving(false);
    return { success: true as const };
  }, []);

  const setSettings = useCallback((nextSettings: ComprehensiveEvaluationSettings) => {
    setSettingsState(nextSettings);
  }, []);

  const resetSettings = useCallback(() => {
    setSettingsState(mockDefaultComprehensiveEvaluationSettings);
  }, []);

  return {
    settings,
    setSettings,
    saveSettings,
    resetSettings,
    reloadSettings,
    isLoading,
    isSaving,
    error,
  };
}
