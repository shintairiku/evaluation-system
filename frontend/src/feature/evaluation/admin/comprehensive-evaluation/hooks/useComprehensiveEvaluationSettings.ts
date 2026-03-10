"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getDepartmentsAction } from "@/api/server-actions/departments";
import { getStagesAction } from "@/api/server-actions/stages";
import {
  createComprehensiveEvaluationRulesetAction,
  deleteComprehensiveEvaluationRulesetAction,
  getComprehensiveEvaluationSettingsWorkspaceAction,
  updateComprehensiveEvaluationDefaultAssignmentAction,
  updateComprehensiveEvaluationDepartmentAssignmentAction,
  updateComprehensiveEvaluationStageAssignmentAction,
  updateComprehensiveEvaluationRulesetAction,
} from "@/api/server-actions/comprehensive-evaluation";
import type {
  ComprehensiveEvaluationSettingsPayload,
  ComprehensiveEvaluationSettingsWorkspaceResponse,
  Department,
  Stage,
  UUID,
} from "@/api/types";

import {
  type ComprehensiveEvaluationSettings,
  type DemotionRuleGroup,
  type PromotionRuleGroup,
} from "../settings";
import { mockDefaultComprehensiveEvaluationSettings } from "../mock";

export interface ComprehensiveRulesetTemplate {
  id: UUID;
  name: string;
  settings: ComprehensiveEvaluationSettings;
  isDefaultTemplate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ComprehensiveRulesetAssignment {
  id?: UUID;
  periodId: UUID;
  departmentId: UUID | null;
  departmentName?: string | null;
  stageId: UUID | null;
  stageName?: string | null;
  settings: ComprehensiveEvaluationSettings;
  sourceRulesetId: UUID | null;
  sourceRulesetNameSnapshot: string | null;
  inheritsDefault: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ComprehensiveEvaluationSettingsWorkspace {
  locked: boolean;
  templates: ComprehensiveRulesetTemplate[];
  defaultAssignment: ComprehensiveRulesetAssignment;
  departmentAssignments: ComprehensiveRulesetAssignment[];
  stageAssignments: ComprehensiveRulesetAssignment[];
}

function normalizePromotionGroups(
  groups: ComprehensiveEvaluationSettingsPayload["promotion"]["ruleGroups"] | undefined,
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
  groups: ComprehensiveEvaluationSettingsPayload["demotion"]["ruleGroups"] | undefined,
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
  settings: ComprehensiveEvaluationSettingsPayload | undefined,
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

export function toApiSettings(settings: ComprehensiveEvaluationSettings): ComprehensiveEvaluationSettingsPayload {
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

function normalizeTemplateName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function fromApiAssignment(
  assignment: ComprehensiveEvaluationSettingsWorkspaceResponse["defaultAssignment"],
): ComprehensiveRulesetAssignment {
  return {
    id: assignment.id,
    periodId: assignment.periodId,
    departmentId: assignment.departmentId ?? null,
    departmentName: assignment.departmentName ?? null,
    stageId: assignment.stageId ?? null,
    stageName: assignment.stageName ?? null,
    settings: fromApiSettings(assignment.settings),
    sourceRulesetId: assignment.sourceRulesetId ?? null,
    sourceRulesetNameSnapshot: assignment.sourceRulesetNameSnapshot ?? null,
    inheritsDefault: assignment.inheritsDefault,
    createdAt: assignment.createdAt ?? null,
    updatedAt: assignment.updatedAt ?? null,
  };
}

function fromApiWorkspace(
  workspace: ComprehensiveEvaluationSettingsWorkspaceResponse,
): ComprehensiveEvaluationSettingsWorkspace {
  return {
    locked: workspace.locked,
    templates: workspace.templates.map((template) => ({
      id: template.id,
      name: template.name,
      settings: fromApiSettings(template.settings),
      isDefaultTemplate: template.isDefaultTemplate,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    })),
    defaultAssignment: fromApiAssignment(workspace.defaultAssignment),
    departmentAssignments: workspace.departmentAssignments.map((assignment) => fromApiAssignment(assignment)),
    stageAssignments: workspace.stageAssignments.map((assignment) => fromApiAssignment(assignment)),
  };
}

export function useComprehensiveEvaluationSettings(periodId: UUID | null) {
  const [workspace, setWorkspace] = useState<ComprehensiveEvaluationSettingsWorkspace | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const latestReloadRequestId = useRef(0);

  const reloadSettings = useCallback(async () => {
    const requestId = latestReloadRequestId.current + 1;
    latestReloadRequestId.current = requestId;

    if (!periodId || periodId === "all") {
      setWorkspace(null);
      setDepartments([]);
      setStages([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const [workspaceResult, departmentsResult, stagesResult] = await Promise.all([
      getComprehensiveEvaluationSettingsWorkspaceAction({ periodId }),
      getDepartmentsAction(),
      getStagesAction(),
    ]);

    if (requestId !== latestReloadRequestId.current) {
      return;
    }

    if (!workspaceResult.success || !workspaceResult.data) {
      setWorkspace(null);
      setDepartments([]);
      setStages([]);
      setError(workspaceResult.error ?? "設定ワークスペースの読み込みに失敗しました");
      setIsLoading(false);
      return;
    }

    setWorkspace(fromApiWorkspace(workspaceResult.data));
    setDepartments(departmentsResult.success && departmentsResult.data ? departmentsResult.data : []);
    setStages(stagesResult.success && stagesResult.data ? stagesResult.data : []);
    if (!departmentsResult.success) {
      setError(departmentsResult.error ?? "部署一覧の読み込みに失敗しました");
    } else if (!stagesResult.success) {
      setError(stagesResult.error ?? "ステージ一覧の読み込みに失敗しました");
    }
    setIsLoading(false);
  }, [periodId]);

  useEffect(() => {
    void reloadSettings();
  }, [reloadSettings]);

  const updateDefaultAssignment = useCallback(async (
    settings: ComprehensiveEvaluationSettings,
    sourceRulesetId?: UUID | null,
  ) => {
    if (!periodId || periodId === "all") {
      return { success: false as const, error: "評価期間を選択してください" };
    }

    setIsSaving(true);
    setError(null);

    const result = await updateComprehensiveEvaluationDefaultAssignmentAction({
      periodId,
      settings: toApiSettings(settings),
      sourceRulesetId: sourceRulesetId ?? undefined,
    });

    setIsSaving(false);

    if (!result.success) {
      setError(result.error ?? "デフォルト設定の保存に失敗しました");
      return { success: false as const, error: result.error ?? "デフォルト設定の保存に失敗しました" };
    }

    await reloadSettings();
    return { success: true as const };
  }, [periodId, reloadSettings]);

  const updateDepartmentAssignment = useCallback(async (
    departmentId: UUID,
    payload: {
      inheritDefault?: boolean;
      settings?: ComprehensiveEvaluationSettings;
      sourceRulesetId?: UUID | null;
    },
  ) => {
    if (!periodId || periodId === "all") {
      return { success: false as const, error: "評価期間を選択してください" };
    }

    setIsSaving(true);
    setError(null);

    const result = await updateComprehensiveEvaluationDepartmentAssignmentAction(departmentId, {
      periodId,
      inheritDefault: payload.inheritDefault,
      settings: payload.settings ? toApiSettings(payload.settings) : undefined,
      sourceRulesetId: payload.sourceRulesetId ?? undefined,
    });

    setIsSaving(false);

    if (!result.success) {
      setError(result.error ?? "部門別設定の保存に失敗しました");
      return { success: false as const, error: result.error ?? "部門別設定の保存に失敗しました" };
    }

    await reloadSettings();
    return { success: true as const };
  }, [periodId, reloadSettings]);

  const updateStageAssignment = useCallback(async (
    stageId: UUID,
    payload: {
      inheritDefault?: boolean;
      settings?: ComprehensiveEvaluationSettings;
      sourceRulesetId?: UUID | null;
    },
  ) => {
    if (!periodId || periodId === "all") {
      return { success: false as const, error: "評価期間を選択してください" };
    }

    setIsSaving(true);
    setError(null);

    const result = await updateComprehensiveEvaluationStageAssignmentAction(stageId, {
      periodId,
      inheritDefault: payload.inheritDefault,
      settings: payload.settings ? toApiSettings(payload.settings) : undefined,
      sourceRulesetId: payload.sourceRulesetId ?? undefined,
    });

    setIsSaving(false);

    if (!result.success) {
      setError(result.error ?? "ステージ別設定の保存に失敗しました");
      return { success: false as const, error: result.error ?? "ステージ別設定の保存に失敗しました" };
    }

    await reloadSettings();
    return { success: true as const };
  }, [periodId, reloadSettings]);

  const createRuleset = useCallback(async (
    name: string,
    settings: ComprehensiveEvaluationSettings,
    isDefaultTemplate = false,
  ) => {
    const normalizedName = name.trim();
    if (!normalizedName) {
      setError("テンプレート名を入力してください");
      return { success: false as const, error: "テンプレート名を入力してください" };
    }

    const existingTemplate = workspace?.templates.find(
      (template) => normalizeTemplateName(template.name) === normalizeTemplateName(normalizedName),
    );
    if (existingTemplate) {
      setError("同じテンプレート名が既にあります。別の名前を指定してください");
      return {
        success: false as const,
        error: "同じテンプレート名が既にあります。別の名前を指定してください",
      };
    }

    setIsSaving(true);
    setError(null);

    const result = await createComprehensiveEvaluationRulesetAction({
      name: normalizedName,
      settings: toApiSettings(settings),
      isDefaultTemplate,
    });

    setIsSaving(false);

    if (!result.success || !result.data) {
      setError(result.error ?? "テンプレートの作成に失敗しました");
      return { success: false as const, error: result.error ?? "テンプレートの作成に失敗しました" };
    }

    await reloadSettings();
    return { success: true as const, data: result.data.id };
  }, [reloadSettings, workspace?.templates]);

  const updateRuleset = useCallback(async (
    rulesetId: UUID,
    name: string,
    settings: ComprehensiveEvaluationSettings,
    isDefaultTemplate = false,
  ) => {
    const normalizedName = name.trim();
    if (!normalizedName) {
      setError("テンプレート名を入力してください");
      return { success: false as const, error: "テンプレート名を入力してください" };
    }

    const existingTemplate = workspace?.templates.find(
      (template) =>
        template.id !== rulesetId &&
        normalizeTemplateName(template.name) === normalizeTemplateName(normalizedName),
    );
    if (existingTemplate) {
      setError("同じテンプレート名が既にあります。別の名前を指定してください");
      return {
        success: false as const,
        error: "同じテンプレート名が既にあります。別の名前を指定してください",
      };
    }

    setIsSaving(true);
    setError(null);

    const result = await updateComprehensiveEvaluationRulesetAction(rulesetId, {
      name: normalizedName,
      settings: toApiSettings(settings),
      isDefaultTemplate,
    });

    setIsSaving(false);

    if (!result.success || !result.data) {
      setError(result.error ?? "テンプレートの更新に失敗しました");
      return { success: false as const, error: result.error ?? "テンプレートの更新に失敗しました" };
    }

    await reloadSettings();
    return { success: true as const };
  }, [reloadSettings, workspace?.templates]);

  const deleteRuleset = useCallback(async (rulesetId: UUID) => {
    setIsSaving(true);
    setError(null);

    const result = await deleteComprehensiveEvaluationRulesetAction(rulesetId);

    setIsSaving(false);

    if (!result.success) {
      setError(result.error ?? "テンプレートの削除に失敗しました");
      return { success: false as const, error: result.error ?? "テンプレートの削除に失敗しました" };
    }

    await reloadSettings();
    return { success: true as const };
  }, [reloadSettings]);

  return {
    workspace,
    departments,
    stages,
    isLoading,
    isSaving,
    error,
    reloadSettings,
    updateDefaultAssignment,
    updateDepartmentAssignment,
    updateStageAssignment,
    createRuleset,
    updateRuleset,
    deleteRuleset,
  };
}
