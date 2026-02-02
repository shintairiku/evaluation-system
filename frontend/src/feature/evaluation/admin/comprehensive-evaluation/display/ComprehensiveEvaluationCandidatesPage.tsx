"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import RolePermissionGuard from "@/components/auth/RolePermissionGuard";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

import { applyComprehensiveEvaluationManualOverride, computeComprehensiveEvaluationRow, computeEffectiveUserFlags, type ComprehensiveEvaluationComputedRow } from "../logic";
import { useComprehensiveEvaluationManualOverrides } from "../hooks/useComprehensiveEvaluationManualOverrides";
import { useComprehensiveEvaluationSettings } from "../hooks/useComprehensiveEvaluationSettings";
import { useComprehensiveEvaluationUserFlags } from "../hooks/useComprehensiveEvaluationUserFlags";
import type { ComprehensiveEvaluationManualOverride } from "../manualOverride";
import { mockComprehensiveEvaluationRows, mockEvaluationPeriods } from "../mock";
import type { ComprehensiveEvaluationDecision, ComprehensiveEvaluationSettings } from "../settings";
import type { ComprehensiveEvaluationRow, EmploymentType } from "../types";

type CandidateFilter = "all" | "promotion" | "demotion";

type ManualOverrideDraft = {
  decision: ComprehensiveEvaluationDecision;
  stageDelta: string;
  levelDelta: string;
  reason: string;
  doubleCheckedBy: string;
  confirmed: boolean;
};

const DECISIONS: ComprehensiveEvaluationDecision[] = ["昇格", "降格", "対象外"];

function buildSearchText(row: ComprehensiveEvaluationRow): string {
  return [row.employeeCode, row.name, row.departmentName, row.currentStage ?? ""].join(" ").toLowerCase();
}

function getEmploymentTypeLabel(value: EmploymentType): string {
  return value === "employee" ? "正社員" : "パート";
}

function getEmploymentTypeBadgeVariant(value: EmploymentType) {
  return value === "employee" ? "outline" : "secondary";
}

function formatNumber(value: number, digits = 2): string {
  return value.toFixed(digits);
}

function formatDelta(value: number | null): string {
  if (value === null) return "-";
  if (value === 0) return "0";
  return value > 0 ? `+${value}` : `${value}`;
}

function formatMboDFlag(value: ComprehensiveEvaluationRow["mboDRatingFlag"]): string {
  return value === "1" ? "1" : "-";
}

function getDecisionBadgeVariant(decision: "昇格" | "降格" | "対象外") {
  if (decision === "昇格") return "default";
  if (decision === "降格") return "destructive";
  return "outline";
}

function getDefaultStageDelta(decision: ComprehensiveEvaluationDecision, settings: ComprehensiveEvaluationSettings): number {
  if (decision === "昇格") return settings.promotion.stageDelta;
  if (decision === "降格") return settings.demotion.stageDelta;
  return 0;
}

export default function ComprehensiveEvaluationCandidatesPage() {
  const { hasRole } = useUserRoles();
  const canEdit = hasRole("admin"); // TODO: eval_adminに変更
  const { settings } = useComprehensiveEvaluationSettings();
  const { flagsByUserId, updateUserFlags } = useComprehensiveEvaluationUserFlags();
  const { overridesByPeriodId, upsertOverride, clearOverride } = useComprehensiveEvaluationManualOverrides();

  const [evaluationPeriodId, setEvaluationPeriodId] = useState<string>(mockEvaluationPeriods[0]?.id ?? "all");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [selectedEmploymentType, setSelectedEmploymentType] = useState<EmploymentType | "all">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [candidateOnly, setCandidateOnly] = useState<boolean>(true);
  const [candidateFilter, setCandidateFilter] = useState<CandidateFilter>("all");
  const [overrideRowId, setOverrideRowId] = useState<string | null>(null);
  const [overrideDraft, setOverrideDraft] = useState<ManualOverrideDraft | null>(null);

  const departments = useMemo(() => {
    const unique = new Set<string>();
    mockComprehensiveEvaluationRows.forEach((row) => unique.add(row.departmentName));
    return Array.from(unique).sort((a, b) => a.localeCompare(b, "ja"));
  }, []);

  const stages = useMemo(() => {
    const unique = new Set<string>();
    mockComprehensiveEvaluationRows.forEach((row) => {
      if (row.currentStage) unique.add(row.currentStage);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b, "ja"));
  }, []);

  const filteredRows = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return mockComprehensiveEvaluationRows.filter((row) => {
      if (evaluationPeriodId !== "all" && row.evaluationPeriodId !== evaluationPeriodId) return false;
      if (selectedDepartment !== "all" && row.departmentName !== selectedDepartment) return false;
      if (selectedStage !== "all" && row.currentStage !== selectedStage) return false;
      if (selectedEmploymentType !== "all" && row.employmentType !== selectedEmploymentType) return false;

      if (!normalizedQuery) return true;
      return buildSearchText(row).includes(normalizedQuery);
    });
  }, [evaluationPeriodId, searchQuery, selectedDepartment, selectedStage, selectedEmploymentType]);

  const computedRows = useMemo(() => {
    return filteredRows.map((row) => {
      const base = computeComprehensiveEvaluationRow(row, settings, flagsByUserId[row.userId]);
      const override = overridesByPeriodId[row.evaluationPeriodId]?.[row.userId];
      const applied = applyComprehensiveEvaluationManualOverride(row, base, settings, override);
      const effectiveFlags = computeEffectiveUserFlags(row, flagsByUserId[row.userId]);
      return { row, base, applied, override, effectiveFlags };
    });
  }, [filteredRows, flagsByUserId, overridesByPeriodId, settings]);

  const selectedItem = useMemo(() => {
    if (!overrideRowId) return null;
    return computedRows.find((item) => item.row.id === overrideRowId) ?? null;
  }, [computedRows, overrideRowId]);

  const openOverrideDialog = (
    row: ComprehensiveEvaluationRow,
    base: ComprehensiveEvaluationComputedRow,
    override: ComprehensiveEvaluationManualOverride | undefined
  ) => {
    setOverrideRowId(row.id);
    setOverrideDraft({
      decision: override?.decision ?? base.decision,
      stageDelta: typeof override?.stageDelta === "number" ? String(override.stageDelta) : "",
      levelDelta: typeof override?.levelDelta === "number" ? String(override.levelDelta) : "",
      reason: override?.reason ?? "",
      doubleCheckedBy: override?.doubleCheckedBy ?? "",
      confirmed: false,
    });
  };

  const counts = useMemo(() => {
    const promotion = computedRows.filter((item) => item.applied.decision === "昇格").length;
    const demotion = computedRows.filter((item) => item.applied.decision === "降格").length;
    return { promotion, demotion };
  }, [computedRows]);

  const visibleRows = useMemo(() => {
    return computedRows.filter((item) => {
      if (candidateOnly && item.applied.decision === "対象外") return false;
      if (candidateFilter === "promotion" && item.applied.decision !== "昇格") return false;
      if (candidateFilter === "demotion" && item.applied.decision !== "降格") return false;
      return true;
    });
  }, [candidateFilter, candidateOnly, computedRows]);

  const closeOverrideDialog = () => {
    setOverrideRowId(null);
    setOverrideDraft(null);
  };

  const handleApplyOverride = () => {
    if (!canEdit || !selectedItem || !overrideDraft) return;

    const stageDeltaInput = overrideDraft.stageDelta.trim();
    const stageDeltaValue = stageDeltaInput === "" ? undefined : Number(stageDeltaInput);
    const stageDeltaValid =
      stageDeltaInput === "" || (Number.isFinite(stageDeltaValue) && Number.isInteger(stageDeltaValue));

    const levelDeltaInput = overrideDraft.levelDelta.trim();
    const levelDeltaValue = levelDeltaInput === "" ? undefined : Number(levelDeltaInput);
    const levelDeltaValid =
      levelDeltaInput === "" || (Number.isFinite(levelDeltaValue) && Number.isInteger(levelDeltaValue));

    if (!stageDeltaValid || !levelDeltaValid) return;
    if (!overrideDraft.reason.trim()) return;
    if (!overrideDraft.doubleCheckedBy.trim()) return;
    if (!overrideDraft.confirmed) return;

    upsertOverride(selectedItem.row.evaluationPeriodId, selectedItem.row.userId, {
      decision: overrideDraft.decision,
      stageDelta: stageDeltaInput === "" ? undefined : (stageDeltaValue as number),
      levelDelta:
        selectedItem.row.employmentType === "parttime" || levelDeltaInput === ""
          ? undefined
          : (levelDeltaValue as number),
      reason: overrideDraft.reason.trim(),
      doubleCheckedBy: overrideDraft.doubleCheckedBy.trim(),
      appliedAt: new Date().toISOString(),
    });

    closeOverrideDialog();
  };

  const handleClearOverride = () => {
    if (!canEdit || !selectedItem) return;
    clearOverride(selectedItem.row.evaluationPeriodId, selectedItem.row.userId);
    closeOverrideDialog();
  };

  const handleClearFilters = () => {
    setEvaluationPeriodId(mockEvaluationPeriods[0]?.id ?? "all");
    setSelectedDepartment("all");
    setSelectedStage("all");
    setSelectedEmploymentType("all");
    setSearchQuery("");
    setCandidateOnly(true);
    setCandidateFilter("all");
  };

  return (
    <RolePermissionGuard requiredHierarchyLevel={1} deniedMessage="このページは管理者のみ閲覧できます">
      <div className="container mx-auto space-y-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">昇格/降格 判定</h1>
            <p className="text-sm text-muted-foreground">
              ルールに基づく候補者一覧（モック）。`eval_admin`は面談フラグの更新と、特例による判定/ステージ/レベルの上書き（理由・ダブルチェック必須）ができます。
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/admin-eval-list">総合評価テーブルへ</Link>
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">昇格候補 {counts.promotion}</Badge>
          <Badge variant="outline">降格候補 {counts.demotion}</Badge>
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

          <Select value={candidateFilter} onValueChange={(value) => setCandidateFilter(value as CandidateFilter)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="表示" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="promotion">昇格候補</SelectItem>
              <SelectItem value="demotion">降格候補</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 rounded-md border px-3 py-2">
            <span className="text-sm text-muted-foreground">候補者のみ</span>
            <Switch checked={candidateOnly} onCheckedChange={setCandidateOnly} />
          </div>

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
              candidateFilter === "all" &&
              candidateOnly &&
              !searchQuery
            }
          >
            <X className="h-4 w-4" />
            クリア
          </Button>
        </div>

        <div className="rounded-lg border">
          <div className="relative overflow-x-auto">
            <Table className="min-w-[1700px]">
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="whitespace-nowrap">社員番号</TableHead>
                  <TableHead className="whitespace-nowrap">氏名</TableHead>
                  <TableHead className="whitespace-nowrap">部署</TableHead>
                  <TableHead className="whitespace-nowrap text-center">雇用形態</TableHead>
                  <TableHead className="whitespace-nowrap text-center">総合評価</TableHead>
                  <TableHead className="whitespace-nowrap text-center">コンピテンシー</TableHead>
                  <TableHead className="whitespace-nowrap text-center">クレド</TableHead>
                  <TableHead className="whitespace-nowrap text-center">MBO Dフラグ</TableHead>
                  <TableHead className="whitespace-nowrap text-center">リーダー面談</TableHead>
                  <TableHead className="whitespace-nowrap text-center">事業部長プレゼン</TableHead>
                  <TableHead className="whitespace-nowrap text-center">CEO面談</TableHead>
                  <TableHead className="whitespace-nowrap text-center">判定</TableHead>
                  <TableHead className="whitespace-nowrap text-center">現在ステージ</TableHead>
                  <TableHead className="whitespace-nowrap text-center">新ステージ</TableHead>
                  <TableHead className="whitespace-nowrap text-center">現在レベル</TableHead>
                  <TableHead className="whitespace-nowrap text-center">レベル増減</TableHead>
                  <TableHead className="whitespace-nowrap text-center">新レベル</TableHead>
                  <TableHead className="whitespace-nowrap text-right">合計（点）</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={18} className="h-24 text-center text-sm text-muted-foreground">
                      表示できるデータがありません
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleRows.map(({ row, base, applied, override, effectiveFlags }) => {
                    const isAlertLevel = applied.newLevel !== null && applied.newLevel >= 31;
                    const stageChangedByOverride = !!override && applied.newStage !== base.newStage;
                    const levelDeltaChangedByOverride = !!override && applied.levelDelta !== base.levelDelta;
                    const levelChangedByOverride = !!override && applied.newLevel !== base.newLevel;
                    const decisionChangedByOverride = !!override && applied.decision !== base.decision;

                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.employeeCode}</TableCell>
                        <TableCell className="whitespace-nowrap">{row.name}</TableCell>
                        <TableCell className="whitespace-nowrap">{row.departmentName}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={getEmploymentTypeBadgeVariant(row.employmentType)}>
                            {getEmploymentTypeLabel(row.employmentType)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">{base.overallRank ?? "-"}</TableCell>
                        <TableCell className="text-center">{row.competencyFinalRank ?? "-"}</TableCell>
                        <TableCell className="text-center">{row.coreValueFinalRank ?? "-"}</TableCell>
                        <TableCell className="text-center">{formatMboDFlag(row.mboDRatingFlag)}</TableCell>

                        <TableCell className="text-center">
                          <Checkbox
                            checked={effectiveFlags.leaderInterviewCleared}
                            disabled={!canEdit}
                            onCheckedChange={(checked) =>
                              updateUserFlags(row.userId, { leaderInterviewCleared: checked === true })
                            }
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={effectiveFlags.divisionHeadPresentationCleared}
                            disabled={!canEdit}
                            onCheckedChange={(checked) =>
                              updateUserFlags(row.userId, { divisionHeadPresentationCleared: checked === true })
                            }
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={effectiveFlags.ceoInterviewCleared}
                            disabled={!canEdit}
                            onCheckedChange={(checked) =>
                              updateUserFlags(row.userId, { ceoInterviewCleared: checked === true })
                            }
                          />
                        </TableCell>

                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Badge variant={getDecisionBadgeVariant(applied.decision)}>
                              {applied.decision}
                            </Badge>
                            {override && <Badge variant="secondary">特例</Badge>}
                            {canEdit && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2"
                                onClick={() => openOverrideDialog(row, base, override)}
                              >
                                編集
                              </Button>
                            )}
                          </div>
                          {decisionChangedByOverride && (
                            <div className="mt-1 text-xs text-muted-foreground">自動: {base.decision}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-center">{row.currentStage ?? "-"}</TableCell>
                        <TableCell className="text-center">
                          <div className="font-medium">{applied.newStage ?? "-"}</div>
                          {stageChangedByOverride && (
                            <div className="mt-1 text-xs text-muted-foreground">自動: {base.newStage ?? "-"}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-center">{row.currentLevel ?? "-"}</TableCell>
                        <TableCell className="text-center">
                          <div className="font-medium">{formatDelta(applied.levelDelta)}</div>
                          {levelDeltaChangedByOverride && (
                            <div className="mt-1 text-xs text-muted-foreground">自動: {formatDelta(base.levelDelta)}</div>
                          )}
                        </TableCell>
                        <TableCell className={isAlertLevel ? "text-center font-semibold text-destructive" : "text-center"}>
                          <div className="font-medium">{applied.newLevel ?? "-"}</div>
                          {levelChangedByOverride && (
                            <div className="mt-1 text-xs text-muted-foreground">自動: {base.newLevel ?? "-"}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {base.totalScore !== null ? formatNumber(base.totalScore) : "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <Dialog open={overrideRowId !== null} onOpenChange={(open) => !open && closeOverrideDialog()}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>特例反映（手動で判定/ステージ/レベルを確定）</DialogTitle>
              <DialogDescription>
                ルールに該当しない場合でも、理由とダブルチェック情報を残して手動で反映できます（モックではブラウザ保存）。
              </DialogDescription>
            </DialogHeader>

            {!selectedItem || !overrideDraft ? (
              <div className="text-sm text-muted-foreground">対象データが見つかりません</div>
            ) : (
              <div className="space-y-5">
                <div className="space-y-1">
                  <div className="text-sm font-medium">
                    {selectedItem.row.employeeCode} {selectedItem.row.name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {selectedItem.row.departmentName} / {selectedItem.row.currentStage ?? "-"}
                  </div>
                </div>

                <Separator />

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2 rounded-md border p-3">
                    <div className="text-sm font-semibold">自動判定</div>
                    <div className="text-sm">判定: {selectedItem.base.decision}</div>
                    <div className="text-sm">新ステージ: {selectedItem.base.newStage ?? "-"}</div>
                    <div className="text-sm">レベル増減: {formatDelta(selectedItem.base.levelDelta)}</div>
                    <div className="text-sm">新レベル: {selectedItem.base.newLevel ?? "-"}</div>
                  </div>

                  <div className="space-y-2 rounded-md border p-3">
                    <div className="text-sm font-semibold">特例プレビュー</div>
                    {(() => {
                      const stageDeltaInput = overrideDraft.stageDelta.trim();
                      const stageDeltaValue = stageDeltaInput === "" ? undefined : Number(stageDeltaInput);
                      const stageDeltaValid =
                        stageDeltaInput === "" || (Number.isFinite(stageDeltaValue) && Number.isInteger(stageDeltaValue));
                      const stageDeltaOverride =
                        stageDeltaValid && stageDeltaInput !== "" ? (stageDeltaValue as number) : undefined;

                      const levelDeltaInput = overrideDraft.levelDelta.trim();
                      const levelDeltaValue = levelDeltaInput === "" ? undefined : Number(levelDeltaInput);
                      const levelDeltaValid =
                        levelDeltaInput === "" || (Number.isFinite(levelDeltaValue) && Number.isInteger(levelDeltaValue));
                      const levelDeltaOverride =
                        levelDeltaValid && levelDeltaInput !== "" ? (levelDeltaValue as number) : undefined;

                      const preview = applyComprehensiveEvaluationManualOverride(selectedItem.row, selectedItem.base, settings, {
                        decision: overrideDraft.decision,
                        stageDelta: stageDeltaOverride,
                        levelDelta: selectedItem.row.employmentType === "parttime" ? undefined : levelDeltaOverride,
                        reason: overrideDraft.reason,
                        doubleCheckedBy: overrideDraft.doubleCheckedBy,
                        appliedAt: selectedItem.override?.appliedAt ?? new Date().toISOString(),
                      });

                      return (
                        <>
                          <div className="text-sm">判定: {preview.decision}</div>
                          <div className="text-sm">新ステージ: {preview.newStage ?? "-"}</div>
                          <div className="text-sm">レベル増減: {formatDelta(preview.levelDelta)}</div>
                          <div className="text-sm">新レベル: {preview.newLevel ?? "-"}</div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>判定（特例）</Label>
                    <Select
                      value={overrideDraft.decision}
                      onValueChange={(value) => setOverrideDraft((prev) => (prev ? { ...prev, decision: value as ComprehensiveEvaluationDecision } : prev))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DECISIONS.map((decision) => (
                          <SelectItem key={decision} value={decision}>
                            {decision}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="text-xs text-muted-foreground">
                      ステージ増減のデフォルト: {getDefaultStageDelta(overrideDraft.decision, settings)}（手動入力があれば優先）
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>ステージ増減（任意）</Label>
                    <Input
                      inputMode="numeric"
                      placeholder={`${getDefaultStageDelta(overrideDraft.decision, settings)}`}
                      value={overrideDraft.stageDelta}
                      onChange={(e) => setOverrideDraft((prev) => (prev ? { ...prev, stageDelta: e.target.value } : prev))}
                      disabled={!canEdit}
                    />
                    {overrideDraft.stageDelta.trim() !== "" &&
                      !(Number.isFinite(Number(overrideDraft.stageDelta)) && Number.isInteger(Number(overrideDraft.stageDelta))) && (
                        <div className="text-xs text-destructive">整数で入力してください</div>
                      )}
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>レベル増減（任意・正社員のみ）</Label>
                    <Input
                      inputMode="numeric"
                      placeholder="例: 0 / +5 / -3"
                      value={overrideDraft.levelDelta}
                      onChange={(e) => setOverrideDraft((prev) => (prev ? { ...prev, levelDelta: e.target.value } : prev))}
                      disabled={!canEdit || selectedItem.row.employmentType === "parttime"}
                    />
                    {selectedItem.row.employmentType === "parttime" && (
                      <div className="text-xs text-muted-foreground">パートはレベル概念がないため未適用です</div>
                    )}
                    {overrideDraft.levelDelta.trim() !== "" &&
                      !(Number.isFinite(Number(overrideDraft.levelDelta)) && Number.isInteger(Number(overrideDraft.levelDelta))) && (
                        <div className="text-xs text-destructive">整数で入力してください</div>
                      )}
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>特例理由（必須）</Label>
                    <Textarea
                      value={overrideDraft.reason}
                      onChange={(e) => setOverrideDraft((prev) => (prev ? { ...prev, reason: e.target.value } : prev))}
                      placeholder="例: 組織改編に伴う役割変更のため、ルール外でステージ変更を実施"
                      disabled={!canEdit}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>ダブルチェック者（必須）</Label>
                    <Input
                      value={overrideDraft.doubleCheckedBy}
                      onChange={(e) => setOverrideDraft((prev) => (prev ? { ...prev, doubleCheckedBy: e.target.value } : prev))}
                      placeholder="確認者氏名（例: 人事 太郎）"
                      disabled={!canEdit}
                    />
                    <Label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={overrideDraft.confirmed}
                        disabled={!canEdit}
                        onCheckedChange={(checked) => setOverrideDraft((prev) => (prev ? { ...prev, confirmed: checked === true } : prev))}
                      />
                      入力内容をダブルチェックしたうえで反映します
                    </Label>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <Button variant="outline" onClick={closeOverrideDialog}>
                    キャンセル
                  </Button>
                  <div className="flex items-center gap-2">
                    {selectedItem.override && (
                      <Button variant="outline" onClick={handleClearOverride} disabled={!canEdit}>
                        特例を解除
                      </Button>
                    )}
                    <Button
                      onClick={handleApplyOverride}
                      disabled={
                        !canEdit ||
                        !overrideDraft.confirmed ||
                        !overrideDraft.reason.trim() ||
                        !overrideDraft.doubleCheckedBy.trim() ||
                        (overrideDraft.stageDelta.trim() !== "" &&
                          !(Number.isFinite(Number(overrideDraft.stageDelta)) && Number.isInteger(Number(overrideDraft.stageDelta)))) ||
                        (overrideDraft.levelDelta.trim() !== "" &&
                          !(Number.isFinite(Number(overrideDraft.levelDelta)) && Number.isInteger(Number(overrideDraft.levelDelta))))
                      }
                    >
                      反映
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </RolePermissionGuard>
  );
}
