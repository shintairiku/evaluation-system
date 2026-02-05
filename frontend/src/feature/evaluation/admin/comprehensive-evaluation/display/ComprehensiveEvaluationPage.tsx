"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Settings, Trash2, X } from "lucide-react";

import RolePermissionGuard from "@/components/auth/RolePermissionGuard";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { mockComprehensiveEvaluationRows, mockEvaluationPeriods } from "../mock";
import { applyComprehensiveEvaluationManualOverride, computeComprehensiveEvaluationRow } from "../logic";
import { useComprehensiveEvaluationManualOverrides } from "../hooks/useComprehensiveEvaluationManualOverrides";
import { useComprehensiveEvaluationSettings } from "../hooks/useComprehensiveEvaluationSettings";
import { EVALUATION_RANKS, type DemotionRuleCondition, type PromotionRuleCondition } from "../settings";
import type { ComprehensiveEvaluationRow, EmploymentType, EvaluationRank, ProcessingStatus } from "../types";

function formatNumber(value: number, digits = 2): string {
  return value.toFixed(digits);
}

function formatDelta(value: number | null): string {
  if (value === null) return "-";
  if (value === 0) return "0";
  return value > 0 ? `+${value}` : `${value}`;
}

const INTERMEDIATE_NUMBER_INPUTS = new Set(["", "-", ".", "-."]);

function parseNumericInput(value: string): number | null {
  const trimmed = value.trim();
  if (INTERMEDIATE_NUMBER_INPUTS.has(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildSearchText(row: ComprehensiveEvaluationRow): string {
  return [
    row.employeeCode,
    row.name,
    row.departmentName,
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
  const { hasRole } = useUserRoles();
  const canEditThresholds = hasRole("admin"); // TODO: eval_adminに変更
  const { settings, setSettings, resetSettings } = useComprehensiveEvaluationSettings();
  const { overridesByPeriodId } = useComprehensiveEvaluationManualOverrides();

  const evaluationRows = mockComprehensiveEvaluationRows;

  const [evaluationPeriodId, setEvaluationPeriodId] = useState<string>(
    mockEvaluationPeriods[0]?.id ?? "all"
  );
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [selectedEmploymentType, setSelectedEmploymentType] = useState<EmploymentType | "all">("all");
  const [selectedProcessingStatus, setSelectedProcessingStatus] = useState<ProcessingStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [levelDeltaInputs, setLevelDeltaInputs] = useState<Record<EvaluationRank, string>>(() =>
    EVALUATION_RANKS.reduce((acc, rank) => {
      acc[rank] = String(settings.levelDeltaByOverallRank[rank] ?? "");
      return acc;
    }, {} as Record<EvaluationRank, string>)
  );

  useEffect(() => {
    setLevelDeltaInputs(
      EVALUATION_RANKS.reduce((acc, rank) => {
        acc[rank] = String(settings.levelDeltaByOverallRank[rank] ?? "");
        return acc;
      }, {} as Record<EvaluationRank, string>)
    );
  }, [settings.levelDeltaByOverallRank]);

  const departments = useMemo(() => {
    const unique = new Set<string>();
    evaluationRows.forEach((row) => unique.add(row.departmentName));
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
    setEvaluationPeriodId(mockEvaluationPeriods[0]?.id ?? "all");
    setSelectedDepartment("all");
    setSelectedStage("all");
    setSelectedEmploymentType("all");
    setSelectedProcessingStatus("all");
    setSearchQuery("");
  };

  const addPromotionGroup = () => {
    setSettings((prev) => ({
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
    setSettings((prev) => ({
      ...prev,
      promotion: {
        ...prev.promotion,
        ruleGroups: prev.promotion.ruleGroups.filter((group) => group.id !== groupId),
      },
    }));
  };

  const addPromotionCondition = (groupId: string) => {
    setSettings((prev) => ({
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
    setSettings((prev) => ({
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
    setSettings((prev) => ({
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
    setSettings((prev) => ({
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
    setSettings((prev) => ({
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
    setSettings((prev) => ({
      ...prev,
      demotion: {
        ...prev.demotion,
        ruleGroups: prev.demotion.ruleGroups.filter((group) => group.id !== groupId),
      },
    }));
  };

  const addDemotionCondition = (groupId: string) => {
    setSettings((prev) => ({
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
    setSettings((prev) => ({
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
    setSettings((prev) => ({
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
    setSettings((prev) => ({
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

  return (
    <RolePermissionGuard
      requiredHierarchyLevel={1}
      deniedMessage="このページは管理者のみ閲覧できます"
    >
      <div className="container mx-auto space-y-6 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">総合評価</h1>
            <p className="text-sm text-muted-foreground">
              添付スプレッドシート相当の総合評価テーブル（モック表示）。昇格フラグは「正社員の新レベルが30以上」の場合に点灯します（ステージは自動更新しません）。昇格フラグ点灯行は、昇格フラグ対応ページでステージ変更と反映後レベルを手動確定してください。
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/admin-eval-list/candidates">昇格/降格フラグ対応</Link>
            </Button>
            {canEditThresholds && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    判定ルール設定
                  </Button>
                </DialogTrigger>
                <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>判定ルール設定（モック）</DialogTitle>
                    <DialogDescription>
                      `eval_admin`のみ編集できます。設定はブラウザ内（localStorage）に保存されます。
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
                          {settings.promotion.ruleGroups.map((group, groupIndex) => (
                            <div key={group.id} className="rounded-lg border p-4">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-medium">ORグループ {groupIndex + 1}</div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="flex items-center gap-2"
                                  onClick={() => removePromotionGroup(group.id)}
                                  disabled={settings.promotion.ruleGroups.length <= 1}
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
		                        {settings.demotion.ruleGroups.map((group, groupIndex) => (
		                          <div key={group.id} className="rounded-lg border p-4">
		                            <div className="flex items-center justify-between gap-2">
		                              <div className="text-sm font-medium">ORグループ {groupIndex + 1}</div>
		                              <Button
		                                type="button"
		                                variant="ghost"
		                                size="sm"
		                                className="flex items-center gap-2"
		                                onClick={() => removeDemotionGroup(group.id)}
		                                disabled={settings.demotion.ruleGroups.length <= 1}
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
                                  settings.levelDeltaByOverallRank[rank],
                                  (value) =>
                                    setLevelDeltaInputs((prev) => ({
                                      ...prev,
                                      [rank]: value,
                                    })),
                                  (next) =>
                                    setSettings((prev) => ({
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

                    <div className="flex justify-end">
	                      <Button variant="outline" onClick={resetSettings}>
	                        デフォルトに戻す
	                      </Button>
	                    </div>
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
              {mockEvaluationPeriods.map((period) => (
                <SelectItem key={period.id} value={period.id}>
                  {period.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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
              evaluationPeriodId === (mockEvaluationPeriods[0]?.id ?? "all") &&
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

        <div className="rounded-lg border">
          <div className="relative overflow-x-auto">
            <Table className="min-w-[1400px]">
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead colSpan={4} className="text-center font-semibold">
                    個人基本情報
                  </TableHead>
                  <TableHead colSpan={3} className="text-center font-semibold">
                    目標達成（定量+定性）
                  </TableHead>
                  <TableHead colSpan={3} className="text-center font-semibold">
                    コンピテンシー
                  </TableHead>
                  <TableHead colSpan={1} className="text-center font-semibold">
                    コアバリュー
                  </TableHead>
                  <TableHead colSpan={7} className="text-center font-semibold">
                    総合結果
                  </TableHead>
                </TableRow>
                <TableRow className="bg-muted/40">
                  <TableHead className="whitespace-nowrap">社員番号</TableHead>
                  <TableHead className="whitespace-nowrap">氏名</TableHead>
                  <TableHead className="whitespace-nowrap">部署</TableHead>
                  <TableHead className="whitespace-nowrap">雇用形態</TableHead>

                  <TableHead className="whitespace-nowrap">最終評価</TableHead>
                  <TableHead className="whitespace-nowrap">ウェイト（%）</TableHead>
                  <TableHead className="whitespace-nowrap">点数（点）</TableHead>

                  <TableHead className="whitespace-nowrap">最終評価</TableHead>
                  <TableHead className="whitespace-nowrap">ウェイト（%）</TableHead>
                  <TableHead className="whitespace-nowrap">点数（点）</TableHead>

                  <TableHead className="whitespace-nowrap">最終評価</TableHead>

                  <TableHead className="whitespace-nowrap">合計（点）</TableHead>
                  <TableHead className="whitespace-nowrap">総合評価</TableHead>
                  <TableHead className="whitespace-nowrap">昇格/降格フラグ</TableHead>
                  <TableHead className="whitespace-nowrap">レベル増減</TableHead>
                  <TableHead className="whitespace-nowrap">現在ステージ</TableHead>
                  <TableHead className="whitespace-nowrap">現在レベル</TableHead>
                  <TableHead className="whitespace-nowrap">新レベル</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={18} className="h-24 text-center text-sm text-muted-foreground">
                      表示できるデータがありません
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => {
                    const base = computeComprehensiveEvaluationRow(row, settings);
                    const override = overridesByPeriodId[row.evaluationPeriodId]?.[row.userId];
                    const computed = applyComprehensiveEvaluationManualOverride(row, base, override);
                    const isAlertLevel = computed.newLevel !== null && computed.newLevel >= 30;

                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.employeeCode}</TableCell>
                        <TableCell className="whitespace-nowrap">{row.name}</TableCell>
                        <TableCell className="whitespace-nowrap">{row.departmentName}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant={getEmploymentTypeBadgeVariant(row.employmentType)}>
                            {getEmploymentTypeLabel(row.employmentType)}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-center">{row.performanceFinalRank ?? "-"}</TableCell>
                        <TableCell className="text-center">{row.performanceWeightPercent ?? "-"}</TableCell>
                        <TableCell className="text-right">
                          {row.performanceScore !== null ? formatNumber(row.performanceScore) : "-"}
                        </TableCell>

                        <TableCell className="text-center">{row.competencyFinalRank ?? "-"}</TableCell>
                        <TableCell className="text-center">{row.competencyWeightPercent ?? "-"}</TableCell>
                        <TableCell className="text-right">
                          {row.competencyScore !== null ? formatNumber(row.competencyScore) : "-"}
                        </TableCell>

                        <TableCell className="text-center">{row.coreValueFinalRank ?? "-"}</TableCell>

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
                            {override && <Badge variant="secondary">特例</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {formatDelta(computed.levelDelta)}
                        </TableCell>
                        <TableCell className="text-center">{row.currentStage ?? "-"}</TableCell>
                        <TableCell className="text-center">{row.currentLevel ?? "-"}</TableCell>
                        <TableCell className={isAlertLevel ? "text-center font-semibold text-destructive" : "text-center"}>
                          {computed.newLevel ?? "-"}
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
    </RolePermissionGuard>
  );
}
