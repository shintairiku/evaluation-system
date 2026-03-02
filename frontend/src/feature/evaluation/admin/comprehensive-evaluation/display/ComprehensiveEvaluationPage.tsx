"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, Settings, ShieldX, Trash2, X } from "lucide-react";

import {
  finalizeComprehensiveEvaluationPeriodAction,
  getComprehensiveEvaluationListAction,
} from "@/api/server-actions/comprehensive-evaluation";
import type { ComprehensiveEvaluationRowResponse } from "@/api/types";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useOptionalCurrentUserContext } from "@/context/CurrentUserContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { mockDefaultComprehensiveEvaluationSettings } from "../mock";
import { useComprehensiveEvaluationSettings } from "../hooks/useComprehensiveEvaluationSettings";
import { EVALUATION_RANKS, type ComprehensiveEvaluationSettings, type DemotionRuleCondition, type PromotionRuleCondition } from "../settings";
import type { EmploymentType, EvaluationRank, ProcessingStatus } from "../types";

function formatNumber(value: number, digits = 2): string {
  return value.toFixed(digits);
}

const INTERMEDIATE_NUMBER_INPUTS = new Set(["", "-", ".", "-."]);
const COMPREHENSIVE_ROWS_PAGE_SIZE = 200;

function parseNumericInput(value: string): number | null {
  const trimmed = value.trim();
  if (INTERMEDIATE_NUMBER_INPUTS.has(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildLevelDeltaInputs(settings: ComprehensiveEvaluationSettings): Record<EvaluationRank, string> {
  return EVALUATION_RANKS.reduce((acc, rank) => {
    acc[rank] = String(settings.levelDeltaByOverallRank[rank] ?? "");
    return acc;
  }, {} as Record<EvaluationRank, string>);
}

function buildSearchText(row: ComprehensiveEvaluationRowResponse): string {
  return [
    row.employeeCode,
    row.name,
    row.departmentName ?? "",
    row.currentStage ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

function getEmploymentTypeLabel(value: EmploymentType): string {
  return value === "employee" ? "正社員" : "パート";
}

function getEmploymentTypeBadgeVariant(value: EmploymentType) {
  return value === "employee" ? "outline" : "secondary";
}

type PromotionConditionTarget = PromotionRuleCondition["field"];
type DemotionConditionTarget = DemotionRuleCondition["field"];

const PROMOTION_CONDITION_TARGETS: Array<{
  value: PromotionConditionTarget;
  label: string;
}> = [
  { value: "overallRank", label: "総合評価が◯以上" },
  { value: "competencyFinalRank", label: "コンピテンシー最終評価が◯以上" },
  { value: "coreValueFinalRank", label: "コアバリュー最終評価が◯以上" },
];

const DEMOTION_CONDITION_TARGETS: Array<{
  value: DemotionConditionTarget;
  label: string;
}> = [
  { value: "overallRank", label: "総合評価が◯以下" },
  { value: "competencyFinalRank", label: "コンピテンシー最終評価が◯以下" },
  { value: "coreValueFinalRank", label: "コアバリュー最終評価が◯以下" },
];

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createPromotionCondition(
  target: PromotionConditionTarget,
  fallbackRank: EvaluationRank = "A+"
): PromotionRuleCondition {
  return { type: "rank_at_least", field: target, minimumRank: fallbackRank };
}

function createDemotionCondition(
  target: DemotionConditionTarget,
  fallbackRank: EvaluationRank = "D"
): DemotionRuleCondition {
  return { type: "rank_at_or_worse", field: target, thresholdRank: fallbackRank };
}

export default function ComprehensiveEvaluationPage() {
  const { hasRole, isLoading: isRoleLoading, error: roleError, currentUser } = useUserRoles();
  const currentUserContext = useOptionalCurrentUserContext();
  const canAccessComprehensiveEvaluation = hasRole("admin") || hasRole("eval_admin");
  const canAccessCandidates = canAccessComprehensiveEvaluation;
  const isEvalAdmin = hasRole("eval_admin");
  const canEditThresholds = isEvalAdmin;

  const personalInfoColumns = 5;
  const performanceColumns = 2;
  const competencyColumns = 2;
  const coreValueColumns = 1;
  const overallColumns = 3;
  const totalColumns =
    personalInfoColumns +
    performanceColumns +
    competencyColumns +
    coreValueColumns +
    overallColumns;
  const { settings, saveSettings, isLoading: isSettingsLoading } = useComprehensiveEvaluationSettings();
  const [evaluationRows, setEvaluationRows] = useState<ComprehensiveEvaluationRowResponse[]>([]);
  const [isRowsLoading, setIsRowsLoading] = useState<boolean>(false);
  const [rowsError, setRowsError] = useState<string | null>(null);
  const latestRowsRequestId = useRef(0);

  const evaluationPeriods = useMemo(
    () =>
      (currentUserContext?.periods?.all ?? []).map((period) => ({
        id: period.id,
        label: period.name,
        status: period.status,
      })),
    [currentUserContext?.periods?.all],
  );
  const defaultPeriodId = currentUserContext?.currentPeriod?.id ?? evaluationPeriods[0]?.id ?? "all";

  const [settingsDialogOpen, setSettingsDialogOpen] = useState<boolean>(false);
  const [draftSettings, setDraftSettings] = useState<ComprehensiveEvaluationSettings>(settings);
  const [evaluationPeriodId, setEvaluationPeriodId] = useState<string>(defaultPeriodId);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [selectedEmploymentType, setSelectedEmploymentType] = useState<EmploymentType | "all">("all");
  const [selectedProcessingStatus, setSelectedProcessingStatus] = useState<ProcessingStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isFinalizeDialogOpen, setIsFinalizeDialogOpen] = useState<boolean>(false);
  const [isFinalizing, setIsFinalizing] = useState<boolean>(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [finalizeSuccess, setFinalizeSuccess] = useState<string | null>(null);
  const [levelDeltaInputs, setLevelDeltaInputs] = useState<Record<EvaluationRank, string>>(() =>
    buildLevelDeltaInputs(settings)
  );

  const selectedEvaluationPeriod = useMemo(
    () => evaluationPeriods.find((period) => period.id === evaluationPeriodId) ?? null,
    [evaluationPeriodId, evaluationPeriods],
  );
  const isSelectedPeriodCompleted = selectedEvaluationPeriod?.status === "completed";

  useEffect(() => {
    if (evaluationPeriodId !== "all") return;
    if (!defaultPeriodId || defaultPeriodId === "all") return;
    setEvaluationPeriodId(defaultPeriodId);
  }, [defaultPeriodId, evaluationPeriodId]);

  const loadRows = useCallback(async () => {
    const requestId = latestRowsRequestId.current + 1;
    latestRowsRequestId.current = requestId;

    if (!evaluationPeriodId || evaluationPeriodId === "all") {
      setRowsError(null);
      setIsRowsLoading(false);
      setEvaluationRows([]);
      return;
    }

    setIsRowsLoading(true);
    setRowsError(null);

    const firstPageResult = await getComprehensiveEvaluationListAction({
      periodId: evaluationPeriodId,
      page: 1,
      limit: COMPREHENSIVE_ROWS_PAGE_SIZE,
    });

    if (requestId !== latestRowsRequestId.current) return;

    if (!firstPageResult.success || !firstPageResult.data) {
      setEvaluationRows([]);
      setRowsError(firstPageResult.error ?? "総合評価データの取得に失敗しました");
      setIsRowsLoading(false);
      return;
    }

    let mergedRows = [...firstPageResult.data.rows];
    const totalPages = firstPageResult.data.meta.pages;

    if (totalPages > 1) {
      const remainingPageResults = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, index) =>
          getComprehensiveEvaluationListAction({
            periodId: evaluationPeriodId,
            page: index + 2,
            limit: COMPREHENSIVE_ROWS_PAGE_SIZE,
          })
        )
      );

      if (requestId !== latestRowsRequestId.current) return;

      const failedPageResult = remainingPageResults.find((result) => !result.success || !result.data);
      if (failedPageResult) {
        setEvaluationRows([]);
        setRowsError(failedPageResult.error ?? "総合評価データの取得に失敗しました");
        setIsRowsLoading(false);
        return;
      }

      mergedRows = [
        ...mergedRows,
        ...remainingPageResults.flatMap((result) => result.data?.rows ?? []),
      ];
    }

    if (requestId !== latestRowsRequestId.current) return;

    setEvaluationRows(mergedRows);
    setIsRowsLoading(false);
  }, [evaluationPeriodId]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    setDraftSettings(settings);
    setLevelDeltaInputs(buildLevelDeltaInputs(settings));
  }, [settings]);

  const handleSettingsDialogOpenChange = (nextOpen: boolean) => {
    setSettingsDialogOpen(nextOpen);
    if (!nextOpen) return;
    setDraftSettings(settings);
    setLevelDeltaInputs(buildLevelDeltaInputs(settings));
  };

  const resetDraftSettingsToDefault = () => {
    setDraftSettings(mockDefaultComprehensiveEvaluationSettings);
    setLevelDeltaInputs(buildLevelDeltaInputs(mockDefaultComprehensiveEvaluationSettings));
  };

  const departments = useMemo(() => {
    const unique = new Set<string>();
    evaluationRows.forEach((row) => {
      if (row.departmentName) unique.add(row.departmentName);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b, "ja"));
  }, [evaluationRows]);

  const stages = useMemo(() => {
    const unique = new Set<string>();
    evaluationRows.forEach((row) => {
      if (row.currentStage) unique.add(row.currentStage);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b, "ja"));
  }, [evaluationRows]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return evaluationRows.filter((row) => {
      if (evaluationPeriodId !== "all" && row.evaluationPeriodId !== evaluationPeriodId) return false;
      if (selectedDepartment !== "all" && row.departmentName !== selectedDepartment) return false;
      if (selectedStage !== "all" && row.currentStage !== selectedStage) return false;
      if (selectedEmploymentType !== "all" && row.employmentType !== selectedEmploymentType) return false;
      if (selectedProcessingStatus !== "all" && row.processingStatus !== selectedProcessingStatus) return false;

      if (!normalizedQuery) return true;
      return buildSearchText(row).includes(normalizedQuery);
    });
  }, [
    evaluationRows,
    evaluationPeriodId,
    searchQuery,
    selectedDepartment,
    selectedStage,
    selectedEmploymentType,
    selectedProcessingStatus,
  ]);

  const handleClearFilters = () => {
    setEvaluationPeriodId(defaultPeriodId);
    setSelectedDepartment("all");
    setSelectedStage("all");
    setSelectedEmploymentType("all");
    setSelectedProcessingStatus("all");
    setSearchQuery("");
  };

  const handleFinalizePeriod = async () => {
    if (!isEvalAdmin || !selectedEvaluationPeriod || isSelectedPeriodCompleted) return;

    setFinalizeError(null);
    setFinalizeSuccess(null);
    setIsFinalizing(true);

    const result = await finalizeComprehensiveEvaluationPeriodAction(selectedEvaluationPeriod.id);

    setIsFinalizing(false);

    if (!result.success || !result.data) {
      setFinalizeError(result.error ?? "評価期間の確定に失敗しました");
      return;
    }

    setFinalizeSuccess(
      `評価期間「${selectedEvaluationPeriod.label}」を確定しました。${result.data.updatedUserLevels}名のレベルを更新しました。`,
    );
    setIsFinalizeDialogOpen(false);
    await loadRows();
    currentUserContext?.refresh();
  };

  const handleSaveSettings = async () => {
    const normalizedInputs: Record<EvaluationRank, string> = { ...levelDeltaInputs };
    const normalizedLevelDeltaByOverallRank = { ...draftSettings.levelDeltaByOverallRank };

    EVALUATION_RANKS.forEach((rank) => {
      const parsed = parseNumericInput(levelDeltaInputs[rank]);
      if (parsed === null) {
        normalizedInputs[rank] = String(draftSettings.levelDeltaByOverallRank[rank] ?? "");
        return;
      }
      normalizedInputs[rank] = String(parsed);
      normalizedLevelDeltaByOverallRank[rank] = parsed;
    });

    const settingsToSave: ComprehensiveEvaluationSettings = {
      ...draftSettings,
      levelDeltaByOverallRank: normalizedLevelDeltaByOverallRank,
    };

    setLevelDeltaInputs(normalizedInputs);
    setDraftSettings(settingsToSave);
    const result = await saveSettings(settingsToSave);
    if (!result.success) return;
    setSettingsDialogOpen(false);
    await loadRows();
  };

  const addPromotionGroup = () => {
    setDraftSettings((prev) => ({
      ...prev,
      promotion: {
        ...prev.promotion,
        ruleGroups: [
          ...prev.promotion.ruleGroups,
          {
            id: createId("promotion-group"),
            conditions: [createPromotionCondition("overallRank")],
          },
        ],
      },
    }));
  };

  const removePromotionGroup = (groupId: string) => {
    setDraftSettings((prev) => ({
      ...prev,
      promotion: {
        ...prev.promotion,
        ruleGroups: prev.promotion.ruleGroups.filter((group) => group.id !== groupId),
      },
    }));
  };

  const addPromotionCondition = (groupId: string) => {
    setDraftSettings((prev) => ({
      ...prev,
      promotion: {
        ...prev.promotion,
        ruleGroups: prev.promotion.ruleGroups.map((group) => {
          if (group.id !== groupId) return group;
          return {
            ...group,
            conditions: [...group.conditions, createPromotionCondition("overallRank")],
          };
        }),
      },
    }));
  };

  const removePromotionCondition = (groupId: string, index: number) => {
    setDraftSettings((prev) => ({
      ...prev,
      promotion: {
        ...prev.promotion,
        ruleGroups: prev.promotion.ruleGroups.map((group) => {
          if (group.id !== groupId) return group;
          return {
            ...group,
            conditions: group.conditions.filter((_, i) => i !== index),
          };
        }),
      },
    }));
  };

  const updatePromotionConditionTarget = (groupId: string, index: number, target: PromotionConditionTarget) => {
    setDraftSettings((prev) => ({
      ...prev,
      promotion: {
        ...prev.promotion,
        ruleGroups: prev.promotion.ruleGroups.map((group) => {
          if (group.id !== groupId) return group;
          const existing = group.conditions[index];
          const fallbackRank = existing?.type === "rank_at_least" ? existing.minimumRank : "A+";

          return {
            ...group,
            conditions: group.conditions.map((condition, i) => {
              if (i !== index) return condition;
              return createPromotionCondition(target, fallbackRank);
            }),
          };
        }),
      },
    }));
  };

  const updatePromotionConditionMinimumRank = (groupId: string, index: number, minimumRank: EvaluationRank) => {
    setDraftSettings((prev) => ({
      ...prev,
      promotion: {
        ...prev.promotion,
        ruleGroups: prev.promotion.ruleGroups.map((group) => {
          if (group.id !== groupId) return group;
          return {
            ...group,
            conditions: group.conditions.map((condition, i) => {
              if (i !== index) return condition;
              if (condition.type !== "rank_at_least") return condition;
              return { ...condition, minimumRank };
            }),
          };
        }),
      },
    }));
  };

  const addDemotionGroup = () => {
    setDraftSettings((prev) => ({
      ...prev,
      demotion: {
        ...prev.demotion,
        ruleGroups: [
          ...prev.demotion.ruleGroups,
          {
            id: createId("demotion-group"),
            conditions: [createDemotionCondition("overallRank")],
          },
        ],
      },
    }));
  };

  const removeDemotionGroup = (groupId: string) => {
    setDraftSettings((prev) => ({
      ...prev,
      demotion: {
        ...prev.demotion,
        ruleGroups: prev.demotion.ruleGroups.filter((group) => group.id !== groupId),
      },
    }));
  };

  const addDemotionCondition = (groupId: string) => {
    setDraftSettings((prev) => ({
      ...prev,
      demotion: {
        ...prev.demotion,
        ruleGroups: prev.demotion.ruleGroups.map((group) => {
          if (group.id !== groupId) return group;
          return {
            ...group,
            conditions: [...group.conditions, createDemotionCondition("overallRank")],
          };
        }),
      },
    }));
  };

  const removeDemotionCondition = (groupId: string, index: number) => {
    setDraftSettings((prev) => ({
      ...prev,
      demotion: {
        ...prev.demotion,
        ruleGroups: prev.demotion.ruleGroups.map((group) => {
          if (group.id !== groupId) return group;
          return {
            ...group,
            conditions: group.conditions.filter((_, i) => i !== index),
          };
        }),
      },
    }));
  };

  const updateDemotionConditionTarget = (groupId: string, index: number, target: DemotionConditionTarget) => {
    setDraftSettings((prev) => ({
      ...prev,
      demotion: {
        ...prev.demotion,
        ruleGroups: prev.demotion.ruleGroups.map((group) => {
          if (group.id !== groupId) return group;
          const existing = group.conditions[index];
          const fallbackRank = existing?.type === "rank_at_or_worse" ? existing.thresholdRank : "D";

          return {
            ...group,
            conditions: group.conditions.map((condition, i) => {
              if (i !== index) return condition;
              return createDemotionCondition(target, fallbackRank);
            }),
          };
        }),
      },
    }));
  };

  const updateDemotionConditionThresholdRank = (groupId: string, index: number, thresholdRank: EvaluationRank) => {
    setDraftSettings((prev) => ({
      ...prev,
      demotion: {
        ...prev.demotion,
        ruleGroups: prev.demotion.ruleGroups.map((group) => {
          if (group.id !== groupId) return group;
          return {
            ...group,
            conditions: group.conditions.map((condition, i) => {
              if (i !== index) return condition;
              if (condition.type !== "rank_at_or_worse") return condition;
              return { ...condition, thresholdRank };
            }),
          };
        }),
      },
    }));
  };

  const commitNumericInput = (
    rawValue: string,
    fallback: number,
    setInput: (value: string) => void,
    onCommit: (value: number) => void
  ) => {
    const parsed = parseNumericInput(rawValue);
    if (parsed === null) {
      setInput(String(fallback));
      return;
    }
    setInput(String(parsed));
    if (parsed === fallback) return;
    onCommit(parsed);
  };

  const hasUnsavedSettingsChanges =
    draftSettings !== settings ||
    EVALUATION_RANKS.some(
      (rank) => levelDeltaInputs[rank] !== String(draftSettings.levelDeltaByOverallRank[rank] ?? "")
    );

  if (isRoleLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary" />
        <span className="ml-2 text-sm text-muted-foreground">権限確認中...</span>
      </div>
    );
  }

  if (roleError || !currentUser) {
    return (
      <Alert variant="destructive">
        <ShieldX className="h-4 w-4" />
        <AlertDescription>{roleError || "ユーザー情報の取得に失敗しました"}</AlertDescription>
      </Alert>
    );
  }

  if (!canAccessComprehensiveEvaluation) {
    return (
      <Alert variant="destructive">
        <ShieldX className="h-4 w-4" />
        <AlertDescription>このページはadminまたはeval_adminのみ閲覧できます</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">総合評価</h1>
            <p className="text-sm text-muted-foreground">
              総合評価テーブルをAPIデータで表示します。昇格フラグは「正社員の新レベルが30以上」の場合に点灯します（ステージは自動更新しません）。昇格フラグ点灯行は、昇格フラグ対応ページでステージ変更と反映後レベルを手動確定してください。
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isEvalAdmin && (
              <Dialog open={isFinalizeDialogOpen} onOpenChange={setIsFinalizeDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="destructive"
                    disabled={!selectedEvaluationPeriod || isSelectedPeriodCompleted || isFinalizing}
                  >
                    評価期間を確定
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>評価期間を確定しますか？</DialogTitle>
                    <DialogDescription>
                      確定後はこの評価期間のスコア編集ができなくなり、全ユーザーのレベルが「総合結果」に基づいて更新されます。
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2 text-sm">
                    <p>
                      対象期間: <span className="font-medium">{selectedEvaluationPeriod?.label ?? "-"}</span>
                    </p>
                    <p className="text-muted-foreground">
                      実行後は評価期間ステータスを <code>completed</code> に更新します。
                    </p>
                  </div>
                  <div className="mt-4 flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsFinalizeDialogOpen(false)}
                      disabled={isFinalizing}
                    >
                      キャンセル
                    </Button>
                    <Button type="button" variant="destructive" onClick={() => void handleFinalizePeriod()} disabled={isFinalizing}>
                      {isFinalizing ? "確定中..." : "確定する"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            {canAccessCandidates && (
              <Button asChild variant="outline">
                <Link href="/admin-eval-list/candidates">昇格/降格フラグ対応</Link>
              </Button>
            )}
            {canEditThresholds && (
              <Dialog open={settingsDialogOpen} onOpenChange={handleSettingsDialogOpenChange}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    判定ルール設定
                  </Button>
                </DialogTrigger>
                <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>判定ルール設定</DialogTitle>
                    <DialogDescription>
                      `eval_admin`のみ編集できます。変更は「保存」で反映され、バックエンドに保存されます。
                    </DialogDescription>
                  </DialogHeader>

                  <div className="flex-1 overflow-y-auto pr-2">
		                  <div className="space-y-8">
			                    <section className="space-y-4">
			                      <h3 className="text-sm font-semibold">昇格フラグ（AND/OR対応）</h3>
		                        <p className="text-sm text-muted-foreground">
		                          ORグループのいずれかを満たせば「昇格フラグ」として扱います（グループ内はAND）。
		                        </p>

                        <div className="space-y-4">
                          {draftSettings.promotion.ruleGroups.map((group, groupIndex) => (
                            <div key={group.id} className="rounded-lg border p-4">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-medium">ORグループ {groupIndex + 1}</div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="flex items-center gap-2"
                                  onClick={() => removePromotionGroup(group.id)}
                                  disabled={draftSettings.promotion.ruleGroups.length <= 1}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  削除
                                </Button>
                              </div>

                              <div className="mt-4 space-y-3">
                                {group.conditions.map((condition, index) => {
                                  const selectedTarget = condition.field;

                                  return (
                                    <div key={`${group.id}-${index}`} className="grid gap-2 md:grid-cols-12">
                                      <div className="md:col-span-7">
                                        <Label className="sr-only">条件</Label>
                                        <Select
                                          value={selectedTarget}
                                          onValueChange={(value) =>
                                            updatePromotionConditionTarget(group.id, index, value as PromotionConditionTarget)
                                          }
                                        >
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {PROMOTION_CONDITION_TARGETS.map((item) => (
                                              <SelectItem key={item.value} value={item.value}>
                                                {item.label}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>

                                      <div className="md:col-span-3">
                                        <Label className="sr-only">最低ランク</Label>
                                        <Select
                                          value={condition.minimumRank}
                                          onValueChange={(value) =>
                                            updatePromotionConditionMinimumRank(group.id, index, value as EvaluationRank)
                                          }
                                        >
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {EVALUATION_RANKS.map((rank) => (
                                              <SelectItem key={rank} value={rank}>
                                                {rank}以上
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>

                                      <div className="flex items-end md:col-span-2">
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="w-full"
                                          onClick={() => removePromotionCondition(group.id, index)}
                                          disabled={group.conditions.length <= 1}
                                        >
                                          削除
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              <div className="mt-4 flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="flex items-center gap-2"
                                  onClick={() => addPromotionCondition(group.id)}
                                >
                                  <Plus className="h-4 w-4" />
                                  条件を追加（AND）
                                </Button>
                              </div>
                            </div>
                          ))}

	                          <Button
	                            type="button"
	                            variant="outline"
	                            size="sm"
	                            className="flex items-center gap-2"
	                            onClick={addPromotionGroup}
	                          >
	                            <Plus className="h-4 w-4" />
	                            ORグループを追加
	                          </Button>
	                        </div>
	                    </section>
	
		                    <section className="space-y-4">
		                      <h3 className="text-sm font-semibold">降格フラグ（AND/OR対応）</h3>
		                      <p className="text-sm text-muted-foreground">
		                        ORグループのいずれかを満たせば「降格フラグ」として扱います（グループ内はAND）。
		                      </p>

		                      <div className="space-y-4">
		                        {draftSettings.demotion.ruleGroups.map((group, groupIndex) => (
		                          <div key={group.id} className="rounded-lg border p-4">
		                            <div className="flex items-center justify-between gap-2">
		                              <div className="text-sm font-medium">ORグループ {groupIndex + 1}</div>
		                              <Button
		                                type="button"
		                                variant="ghost"
		                                size="sm"
		                                className="flex items-center gap-2"
		                                onClick={() => removeDemotionGroup(group.id)}
		                                disabled={draftSettings.demotion.ruleGroups.length <= 1}
		                              >
		                                <Trash2 className="h-4 w-4" />
		                                削除
		                              </Button>
		                            </div>

		                            <div className="mt-4 space-y-3">
		                              {group.conditions.map((condition, index) => {
		                                const selectedTarget = condition.field;

		                                return (
		                                  <div key={`${group.id}-${index}`} className="grid gap-2 md:grid-cols-12">
		                                    <div className="md:col-span-7">
		                                      <Label className="sr-only">条件</Label>
		                                      <Select
		                                        value={selectedTarget}
		                                        onValueChange={(value) =>
		                                          updateDemotionConditionTarget(group.id, index, value as DemotionConditionTarget)
		                                        }
		                                      >
		                                        <SelectTrigger>
		                                          <SelectValue />
		                                        </SelectTrigger>
		                                        <SelectContent>
		                                          {DEMOTION_CONDITION_TARGETS.map((item) => (
		                                            <SelectItem key={item.value} value={item.value}>
		                                              {item.label}
		                                            </SelectItem>
		                                          ))}
		                                        </SelectContent>
		                                      </Select>
		                                    </div>

		                                    <div className="md:col-span-3">
		                                      <Label className="sr-only">しきい値ランク</Label>
		                                      <Select
		                                        value={condition.thresholdRank}
		                                        onValueChange={(value) =>
		                                          updateDemotionConditionThresholdRank(group.id, index, value as EvaluationRank)
		                                        }
		                                      >
		                                        <SelectTrigger>
		                                          <SelectValue />
		                                        </SelectTrigger>
		                                        <SelectContent>
		                                          {EVALUATION_RANKS.map((rank) => (
		                                            <SelectItem key={rank} value={rank}>
		                                              {rank}以下
		                                            </SelectItem>
		                                          ))}
		                                        </SelectContent>
		                                      </Select>
		                                    </div>

		                                    <div className="flex items-end md:col-span-2">
		                                      <Button
		                                        type="button"
		                                        variant="outline"
		                                        size="sm"
		                                        className="w-full"
		                                        onClick={() => removeDemotionCondition(group.id, index)}
		                                        disabled={group.conditions.length <= 1}
		                                      >
		                                        削除
		                                      </Button>
		                                    </div>
		                                  </div>
		                                );
		                              })}
		                            </div>

		                            <div className="mt-4 flex items-center gap-2">
		                              <Button
		                                type="button"
		                                variant="outline"
		                                size="sm"
		                                className="flex items-center gap-2"
		                                onClick={() => addDemotionCondition(group.id)}
		                              >
		                                <Plus className="h-4 w-4" />
		                                条件を追加（AND）
		                              </Button>
		                            </div>
		                          </div>
		                        ))}

		                        <Button
		                          type="button"
		                          variant="outline"
		                          size="sm"
		                          className="flex items-center gap-2"
		                          onClick={addDemotionGroup}
		                        >
		                          <Plus className="h-4 w-4" />
		                          ORグループを追加
		                        </Button>
		                      </div>
		                    </section>

                    <section className="space-y-4">
                      <h3 className="text-sm font-semibold">レベル増減（総合評価別）</h3>
                      <p className="text-sm text-muted-foreground">
                        総合評価（SS〜D）に応じてレベル増減を適用します。
                      </p>

                      <div className="grid gap-4 md:grid-cols-4">
                        {EVALUATION_RANKS.map((rank) => (
                          <div key={rank} className="space-y-2">
                            <Label>{rank}</Label>
                            <Input
                              type="number"
                              value={levelDeltaInputs[rank]}
                              onChange={(e) =>
                                setLevelDeltaInputs((prev) => ({
                                  ...prev,
                                  [rank]: e.target.value,
                                }))
                              }
                              onBlur={() =>
                                commitNumericInput(
                                  levelDeltaInputs[rank],
                                  draftSettings.levelDeltaByOverallRank[rank],
                                  (value) =>
                                    setLevelDeltaInputs((prev) => ({
                                      ...prev,
                                      [rank]: value,
                                    })),
                                  (next) =>
                                    setDraftSettings((prev) => ({
                                      ...prev,
                                      levelDeltaByOverallRank: {
                                        ...prev.levelDeltaByOverallRank,
                                        [rank]: next,
                                      },
                                    }))
                                )
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </section>

		                  </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t pt-4">
                    <Button type="button" variant="outline" onClick={resetDraftSettingsToDefault}>
                      デフォルトに戻す
                    </Button>

	                    <div className="flex items-center gap-2">
	                      <Button type="button" variant="outline" onClick={() => setSettingsDialogOpen(false)}>
	                        キャンセル
	                      </Button>
                      <Button
                        type="button"
                        onClick={() => void handleSaveSettings()}
                        disabled={!hasUnsavedSettingsChanges || isSettingsLoading}
                      >
                        保存
                      </Button>
                    </div>
	                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-card p-4">
          <Select value={evaluationPeriodId} onValueChange={setEvaluationPeriodId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="評価期間" />
            </SelectTrigger>
            <SelectContent>
              {evaluationPeriods.map((period) => (
                <SelectItem key={period.id} value={period.id}>
                  {period.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedEvaluationPeriod && (
            <Badge variant={isSelectedPeriodCompleted ? "secondary" : "outline"}>
              {isSelectedPeriodCompleted ? "確定済み" : "未確定"}
            </Badge>
          )}

          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="部署" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべての部署</SelectItem>
              {departments.map((department) => (
                <SelectItem key={department} value={department}>
                  {department}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedStage} onValueChange={setSelectedStage}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="ステージ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべてのステージ</SelectItem>
              {stages.map((stage) => (
                <SelectItem key={stage} value={stage}>
                  {stage}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedEmploymentType} onValueChange={(value) => setSelectedEmploymentType(value as EmploymentType | "all")}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="雇用形態" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべての雇用形態</SelectItem>
              <SelectItem value="employee">正社員</SelectItem>
              <SelectItem value="parttime">パート</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedProcessingStatus} onValueChange={(value) => setSelectedProcessingStatus(value as ProcessingStatus | "all")}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="処理状態" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="unprocessed">未処理</SelectItem>
              <SelectItem value="processed">処理済</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              placeholder="社員番号・氏名・部署・ステージで検索..."
              className="pl-10 pr-10"
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearchQuery("")}
                aria-label="検索クリア"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            onClick={handleClearFilters}
            disabled={
              evaluationPeriodId === defaultPeriodId &&
              selectedDepartment === "all" &&
              selectedStage === "all" &&
              selectedEmploymentType === "all" &&
              selectedProcessingStatus === "all" &&
              !searchQuery
            }
          >
            <X className="h-4 w-4" />
            クリア
          </Button>
        </div>

        {finalizeSuccess && (
          <Alert>
            <AlertDescription>{finalizeSuccess}</AlertDescription>
          </Alert>
        )}

        {finalizeError && (
          <Alert variant="destructive">
            <AlertDescription>{finalizeError}</AlertDescription>
          </Alert>
        )}

        <div className="rounded-lg border">
          <div className="relative overflow-x-auto">
            <Table className="min-w-[1400px]">
              <TableHeader>
                <TableRow className="bg-muted/40 [&>th]:text-center">
                  <TableHead colSpan={personalInfoColumns} className="font-semibold border-r">
                    個人基本情報
                  </TableHead>
                  <TableHead colSpan={performanceColumns} className="font-semibold border-r">
                    目標達成（定量+定性）
                  </TableHead>
                  <TableHead colSpan={competencyColumns} className="font-semibold border-r">
                    コンピテンシー
                  </TableHead>
                  <TableHead colSpan={coreValueColumns} className="font-semibold border-r">
                    コアバリュー
                  </TableHead>
                  <TableHead colSpan={overallColumns} className="font-semibold">
                    総合結果
                  </TableHead>
                </TableRow>
                <TableRow className="bg-muted/40">
                  <TableHead className="whitespace-nowrap">社員番号</TableHead>
                  <TableHead className="whitespace-nowrap">氏名</TableHead>
                  <TableHead className="whitespace-nowrap">部署</TableHead>
                  <TableHead className="whitespace-nowrap">雇用形態</TableHead>
                  <TableHead className="whitespace-nowrap border-r">現在ステージ</TableHead>

                  <TableHead className="whitespace-nowrap">最終評価</TableHead>
                  <TableHead className="whitespace-nowrap border-r">ウェイト（%）</TableHead>

                  <TableHead className="whitespace-nowrap">最終評価</TableHead>
                  <TableHead className="whitespace-nowrap border-r">ウェイト（%）</TableHead>

                  <TableHead className="whitespace-nowrap border-r">最終評価</TableHead>

                  <TableHead className="whitespace-nowrap">合計（点）</TableHead>
                  <TableHead className="whitespace-nowrap">総合評価</TableHead>
                  <TableHead className="whitespace-nowrap">昇格/降格フラグ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isRowsLoading ? (
                  <TableRow>
                    <TableCell colSpan={totalColumns} className="h-24 text-center text-sm text-muted-foreground">
                      読み込み中...
                    </TableCell>
                  </TableRow>
                ) : rowsError ? (
                  <TableRow>
                    <TableCell colSpan={totalColumns} className="h-24 text-center text-sm text-destructive">
                      {rowsError}
                    </TableCell>
                  </TableRow>
                ) : filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={totalColumns} className="h-24 text-center text-sm text-muted-foreground">
                      表示できるデータがありません
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => {
                    const computed = row.applied;
                    const manualDecision = row.manualDecision;

                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.employeeCode}</TableCell>
                        <TableCell className="whitespace-nowrap">{row.name}</TableCell>
                        <TableCell className="whitespace-nowrap">{row.departmentName ?? "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant={getEmploymentTypeBadgeVariant(row.employmentType)}>
                            {getEmploymentTypeLabel(row.employmentType)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center border-r">{row.currentStage ?? "-"}</TableCell>

                        <TableCell className="text-center">{row.performanceFinalRank ?? "-"}</TableCell>
                        <TableCell className="text-center border-r">{row.performanceWeightPercent ?? "-"}</TableCell>

                        <TableCell className="text-center">{row.competencyFinalRank ?? "-"}</TableCell>
                        <TableCell className="text-center border-r">{row.competencyWeightPercent ?? "-"}</TableCell>

                        <TableCell className="text-center border-r">{row.coreValueFinalRank ?? "-"}</TableCell>

                        <TableCell className="text-right">
                          {computed.totalScore !== null ? formatNumber(computed.totalScore) : "-"}
                        </TableCell>
                        <TableCell className="text-center">{computed.overallRank ?? "-"}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span>
                              {computed.promotionFlag && computed.demotionFlag
                                ? "昇格/降格"
                                : computed.promotionFlag
                                  ? "昇格"
                                  : computed.demotionFlag
                                    ? "降格"
                                    : "-"}
                            </span>
                            {manualDecision && <Badge variant="secondary">手動</Badge>}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
  );
}
