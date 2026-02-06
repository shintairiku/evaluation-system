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

import { applyComprehensiveEvaluationManualOverride, computeComprehensiveEvaluationRow, type ComprehensiveEvaluationComputedRow } from "../logic";
import { useComprehensiveEvaluationManualOverrides } from "../hooks/useComprehensiveEvaluationManualOverrides";
import { useComprehensiveEvaluationSettings } from "../hooks/useComprehensiveEvaluationSettings";
import type { ComprehensiveEvaluationManualOverride } from "../manualOverride";
import { mockComprehensiveEvaluationRows, mockEvaluationPeriods } from "../mock";
import type { ComprehensiveEvaluationDecision } from "../settings";
import type { ComprehensiveEvaluationRow, EmploymentType } from "../types";

type CandidateFilter =
  | "all"
  | "flagged"
  | "promotion_flag"
  | "demotion_flag"
  | "promotion_confirmed"
  | "demotion_confirmed";

type ManualOverrideDraft = {
  decision: ComprehensiveEvaluationDecision;
  stageAfter: string;
  levelAfter: string;
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

function getDecisionBadgeVariant(decision: "昇格" | "降格" | "対象外") {
  if (decision === "昇格") return "default";
  if (decision === "降格") return "destructive";
  return "outline";
}

export default function ComprehensiveEvaluationCandidatesPage() {
  const { hasRole } = useUserRoles();
  const canEdit = hasRole("admin"); // TODO: eval_adminに変更
  const { settings } = useComprehensiveEvaluationSettings();
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
	      const base = computeComprehensiveEvaluationRow(row, settings);
	      const override = overridesByPeriodId[row.evaluationPeriodId]?.[row.userId];
	      const applied = applyComprehensiveEvaluationManualOverride(row, base, override);
	      return { row, base, applied, override };
	    });
	  }, [filteredRows, overridesByPeriodId, settings]);

  const selectedItem = useMemo(() => {
    if (!overrideRowId) return null;
    return computedRows.find((item) => item.row.id === overrideRowId) ?? null;
  }, [computedRows, overrideRowId]);

  const requiresStageAfter = overrideDraft ? overrideDraft.decision !== "対象外" : false;
  const requiresLevelAfter =
    requiresStageAfter && selectedItem?.row.employmentType === "employee";

  const openOverrideDialog = (
    row: ComprehensiveEvaluationRow,
    base: ComprehensiveEvaluationComputedRow,
    override: ComprehensiveEvaluationManualOverride | undefined
  ) => {
    setOverrideRowId(row.id);
    const defaultDecision = override?.decision ?? (base.promotionFlag ? "昇格" : base.demotionFlag ? "降格" : base.decision);
    setOverrideDraft({
      decision: defaultDecision,
      stageAfter: typeof override?.stageAfter === "string" ? override.stageAfter : "",
      levelAfter: typeof override?.levelAfter === "number" ? String(override.levelAfter) : "",
      reason: override?.reason ?? "",
      doubleCheckedBy: override?.doubleCheckedBy ?? "",
      confirmed: false,
    });
  };

  const counts = useMemo(() => {
    const promotionFlag = computedRows.filter((item) => item.applied.promotionFlag).length;
    const demotionFlag = computedRows.filter((item) => item.applied.demotionFlag).length;
    const flagged = computedRows.filter((item) => item.applied.promotionFlag || item.applied.demotionFlag).length;
    const promotionConfirmed = computedRows.filter((item) => item.override?.decision === "昇格").length;
    const demotionConfirmed = computedRows.filter((item) => item.override?.decision === "降格").length;
    return { flagged, promotionFlag, demotionFlag, promotionConfirmed, demotionConfirmed };
  }, [computedRows]);

  const visibleRows = useMemo(() => {
    return computedRows.filter((item) => {
      const isFlagged = item.applied.promotionFlag || item.applied.demotionFlag;

      if (candidateOnly && !isFlagged) return false;
      if (candidateFilter === "flagged" && !isFlagged) return false;
      if (candidateFilter === "promotion_flag" && !item.applied.promotionFlag) return false;
      if (candidateFilter === "demotion_flag" && !item.applied.demotionFlag) return false;
      if (candidateFilter === "promotion_confirmed" && item.override?.decision !== "昇格") return false;
      if (candidateFilter === "demotion_confirmed" && item.override?.decision !== "降格") return false;
      return true;
    });
  }, [candidateFilter, candidateOnly, computedRows]);

  const closeOverrideDialog = () => {
    setOverrideRowId(null);
    setOverrideDraft(null);
  };

  const handleApplyOverride = () => {
    if (!canEdit || !selectedItem || !overrideDraft) return;

    const requiresStageAfter = overrideDraft.decision !== "対象外";
    const requiresLevelAfter = requiresStageAfter && selectedItem.row.employmentType === "employee";

    const stageAfter = overrideDraft.stageAfter.trim();
    const stageAfterValid = !requiresStageAfter || stageAfter !== "";

    const levelAfterInput = overrideDraft.levelAfter.trim();
    const levelAfterValue = levelAfterInput === "" ? undefined : Number(levelAfterInput);
    const levelAfterValid =
      !requiresLevelAfter ||
      (levelAfterInput !== "" &&
        Number.isFinite(levelAfterValue) &&
        Number.isInteger(levelAfterValue) &&
        (levelAfterValue as number) >= 1 &&
        (levelAfterValue as number) <= 30);

    if (!stageAfterValid || !levelAfterValid) return;
    if (!overrideDraft.reason.trim()) return;
    if (!overrideDraft.doubleCheckedBy.trim()) return;
    if (!overrideDraft.confirmed) return;

    upsertOverride(selectedItem.row.evaluationPeriodId, selectedItem.row.userId, {
      decision: overrideDraft.decision,
      stageAfter: requiresStageAfter ? stageAfter : undefined,
      levelAfter:
        requiresLevelAfter && typeof levelAfterValue === "number" ? (levelAfterValue as number) : undefined,
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
            <h1 className="text-2xl font-bold">昇格/降格フラグ対応</h1>
            <p className="text-sm text-muted-foreground">
              昇格フラグ（正社員の新レベルが30以上）または降格フラグ（総合評価がD）が点灯した行を起点に、`eval_admin`がステージ変更（アップ/ダウン）と反映後レベル（正社員のみ）を手動で確定します（理由・ダブルチェック必須 / モックではブラウザ保存）。
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/admin-eval-list">総合評価テーブルへ</Link>
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">フラグ点灯 {counts.flagged}</Badge>
          <Badge variant="outline">昇格フラグ {counts.promotionFlag}</Badge>
          <Badge variant="outline">降格フラグ {counts.demotionFlag}</Badge>
          <Badge variant="outline">昇格確定 {counts.promotionConfirmed}</Badge>
          <Badge variant="outline">降格確定 {counts.demotionConfirmed}</Badge>
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
              <SelectItem value="flagged">フラグ点灯</SelectItem>
              <SelectItem value="promotion_flag">昇格フラグ</SelectItem>
              <SelectItem value="demotion_flag">降格フラグ</SelectItem>
              <SelectItem value="promotion_confirmed">昇格確定</SelectItem>
              <SelectItem value="demotion_confirmed">降格確定</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 rounded-md border px-3 py-2">
            <span className="text-sm text-muted-foreground">フラグのみ</span>
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
            <Table className="min-w-[1400px]">
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="whitespace-nowrap">社員番号</TableHead>
                  <TableHead className="whitespace-nowrap">氏名</TableHead>
                  <TableHead className="whitespace-nowrap">部署</TableHead>
                  <TableHead className="whitespace-nowrap text-center">雇用形態</TableHead>
                  <TableHead className="whitespace-nowrap text-center">総合評価</TableHead>
                  <TableHead className="whitespace-nowrap text-center">コンピテンシー</TableHead>
                  <TableHead className="whitespace-nowrap text-center">コアバリュー</TableHead>
                  <TableHead className="whitespace-nowrap text-center">判定</TableHead>
                  <TableHead className="whitespace-nowrap text-center">現在ステージ</TableHead>
                  <TableHead className="whitespace-nowrap text-center">反映後ステージ</TableHead>
                  <TableHead className="whitespace-nowrap text-center">現在レベル</TableHead>
                  <TableHead className="whitespace-nowrap text-center">レベル増減</TableHead>
                  <TableHead className="whitespace-nowrap text-center">反映後レベル</TableHead>
                  <TableHead className="whitespace-nowrap text-right">合計（点）</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} className="h-24 text-center text-sm text-muted-foreground">
                      表示できるデータがありません
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleRows.map(({ row, base, override }) => {
                    const isAlertLevel = base.newLevel !== null && base.newLevel >= 31;
                    const showsPromotionFlag = base.promotionFlag;
                    const showsDemotionFlag = base.demotionFlag;
                    const confirmedStageAfter = override?.stageAfter;
                    const confirmedLevelAfter = override?.levelAfter;

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

                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            {override ? (
                              <>
                                <Badge variant={getDecisionBadgeVariant(override.decision)}>
                                  {override.decision}
                                </Badge>
                                <Badge variant="secondary">確定</Badge>
                              </>
                            ) : (
                              <Badge variant="outline">未確定</Badge>
                            )}
                            {canEdit && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2"
                                onClick={() => openOverrideDialog(row, base, override)}
                              >
                                編集（確定）
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{row.currentStage ?? "-"}</TableCell>
                        <TableCell className="text-center">
                          <div className="font-medium">{confirmedStageAfter ?? "-"}</div>
                          {showsPromotionFlag && (
                            <div className="mt-1 text-xs font-semibold text-primary">昇格フラグ</div>
                          )}
                          {showsDemotionFlag && (
                            <div className="mt-1 text-xs font-semibold text-destructive">降格フラグ</div>
                          )}
                        </TableCell>
                        <TableCell className="text-center">{row.currentLevel ?? "-"}</TableCell>
                        <TableCell className="text-center">
                          <div className="font-medium">{formatDelta(base.levelDelta)}</div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="font-medium">
                            {row.employmentType === "employee"
                              ? (typeof confirmedLevelAfter === "number" ? confirmedLevelAfter : "-")
                              : "-"}
                          </div>
                          {row.employmentType === "employee" && (
                            <div className={isAlertLevel ? "mt-1 text-xs text-destructive" : "mt-1 text-xs text-muted-foreground"}>
                              算出: {base.newLevel ?? "-"}
                            </div>
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
          <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>特例反映（手動で判定/反映後ステージ/反映後レベルを確定）</DialogTitle>
              <DialogDescription>
                ルールに該当しない場合でも、理由とダブルチェック情報を残して手動で反映できます（モックではブラウザ保存）。
              </DialogDescription>
            </DialogHeader>

            {!selectedItem || !overrideDraft ? (
              <div className="text-sm text-muted-foreground">対象データが見つかりません</div>
            ) : (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto pr-2">
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
                          const requiresStageAfter = overrideDraft.decision !== "対象外";
                          const requiresLevelAfter =
                            requiresStageAfter && selectedItem.row.employmentType === "employee";

                          const stageAfterInput = overrideDraft.stageAfter.trim();
                          const stageAfterOverride =
                            requiresStageAfter && stageAfterInput !== "" ? stageAfterInput : undefined;

                          const levelAfterInput = overrideDraft.levelAfter.trim();
                          const levelAfterValue = levelAfterInput === "" ? undefined : Number(levelAfterInput);
                          const levelAfterOverride =
                            requiresLevelAfter &&
                            levelAfterInput !== "" &&
                            Number.isFinite(levelAfterValue) &&
                            Number.isInteger(levelAfterValue)
                              ? (levelAfterValue as number)
                              : undefined;

                          const preview = applyComprehensiveEvaluationManualOverride(selectedItem.row, selectedItem.base, {
                            decision: overrideDraft.decision,
                            stageAfter: stageAfterOverride,
                            levelAfter: levelAfterOverride,
                            reason: overrideDraft.reason,
                            doubleCheckedBy: overrideDraft.doubleCheckedBy,
                            appliedAt: selectedItem.override?.appliedAt ?? new Date().toISOString(),
                          });

                          return (
                            <>
                              <div className="text-sm">判定: {preview.decision}</div>
                              <div className="text-sm">反映後ステージ: {preview.newStage ?? "-"}</div>
                              <div className="text-sm">レベル増減: {formatDelta(preview.levelDelta)}</div>
                              <div className="text-sm">反映後レベル: {preview.newLevel ?? "-"}</div>
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
                          onValueChange={(value) =>
                            setOverrideDraft((prev) => {
                              if (!prev) return prev;
                              const decision = value as ComprehensiveEvaluationDecision;
                              return {
                                ...prev,
                                decision,
                                stageAfter: decision === "対象外" ? "" : prev.stageAfter,
                                levelAfter: decision === "対象外" ? "" : prev.levelAfter,
                              };
                            })
                          }
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
                      </div>

                      <div className="space-y-2">
                        <Label>反映後ステージ{requiresStageAfter ? "（必須）" : ""}</Label>
                        <Select
                          value={overrideDraft.stageAfter || "unset"}
                          onValueChange={(value) =>
                            setOverrideDraft((prev) => (prev ? { ...prev, stageAfter: value === "unset" ? "" : value } : prev))
                          }
                          disabled={!canEdit || !requiresStageAfter}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="反映後ステージ" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unset">未指定</SelectItem>
                            {stages.map((stage) => (
                              <SelectItem key={stage} value={stage}>
                                {stage}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {requiresStageAfter && overrideDraft.stageAfter.trim() === "" && (
                          <div className="text-xs text-destructive">反映後ステージを選択してください</div>
                        )}
                        {!requiresStageAfter && (
                          <div className="text-xs text-muted-foreground">判定が対象外のため入力不要です</div>
                        )}
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label>
                          反映後レベル（正社員のみ{requiresLevelAfter ? "・必須" : ""}）
                        </Label>
                        <Input
                          inputMode="numeric"
                          placeholder="例: 10"
                          value={overrideDraft.levelAfter}
                          onChange={(e) => setOverrideDraft((prev) => (prev ? { ...prev, levelAfter: e.target.value } : prev))}
                          disabled={!canEdit || !requiresLevelAfter}
                        />
                        {selectedItem.row.employmentType === "parttime" && (
                          <div className="text-xs text-muted-foreground">パートはレベル概念がないため未適用です</div>
                        )}
                        {requiresLevelAfter && overrideDraft.levelAfter.trim() === "" && (
                          <div className="text-xs text-destructive">反映後レベルを入力してください</div>
                        )}
                        {overrideDraft.levelAfter.trim() !== "" &&
                          !(Number.isFinite(Number(overrideDraft.levelAfter)) && Number.isInteger(Number(overrideDraft.levelAfter))) && (
                            <div className="text-xs text-destructive">整数で入力してください</div>
                          )}
                        {overrideDraft.levelAfter.trim() !== "" &&
                          Number.isFinite(Number(overrideDraft.levelAfter)) &&
                          Number.isInteger(Number(overrideDraft.levelAfter)) &&
                          (Number(overrideDraft.levelAfter) < 1 || Number(overrideDraft.levelAfter) > 30) && (
                            <div className="text-xs text-destructive">1〜30の範囲で入力してください</div>
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
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 border-t pt-4">
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
                        (requiresStageAfter && overrideDraft.stageAfter.trim() === "") ||
                        (requiresLevelAfter &&
                          (overrideDraft.levelAfter.trim() === "" ||
                            !Number.isFinite(Number(overrideDraft.levelAfter)) ||
                            !Number.isInteger(Number(overrideDraft.levelAfter)) ||
                            Number(overrideDraft.levelAfter) < 1 ||
                            Number(overrideDraft.levelAfter) > 30))
                      }
                    >
                      反映
                    </Button>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </RolePermissionGuard>
  );
}
