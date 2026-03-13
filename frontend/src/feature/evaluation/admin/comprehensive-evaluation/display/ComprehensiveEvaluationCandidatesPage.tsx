"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";

import {
  getComprehensiveEvaluationListAction,
  getComprehensiveEvaluationStageOptionsAction,
} from "@/api/server-actions/comprehensive-evaluation";
import type { ComprehensiveEvaluationRowResponse } from "@/api/types";
import RolePermissionGuard from "@/components/auth/RolePermissionGuard";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useOptionalCurrentUserContext } from "@/context/CurrentUserContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

import { applyComprehensiveEvaluationManualOverride, type ComprehensiveEvaluationComputedRow } from "../logic";
import { useComprehensiveEvaluationManualOverrides } from "../hooks/useComprehensiveEvaluationManualOverrides";
import type { ComprehensiveEvaluationManualOverride } from "../manualOverride";
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
};

const DECISIONS: ComprehensiveEvaluationDecision[] = ["昇格", "降格", "対象外"];
const COMPREHENSIVE_ROWS_PAGE_SIZE = 200;

function buildSearchText(row: ComprehensiveEvaluationRowResponse): string {
  return [row.employeeCode, row.name, row.departmentName ?? "", row.currentStage ?? ""].join(" ").toLowerCase();
}

function getEmploymentTypeLabel(value: EmploymentType): string {
  return value === "employee" ? "正社員" : "パート";
}

function getEmploymentTypeBadgeVariant(value: EmploymentType) {
  return value === "employee" ? "outline" : "secondary";
}

function getDecisionBadgeVariant(decision: "昇格" | "降格" | "対象外") {
  if (decision === "昇格") return "default";
  if (decision === "降格") return "destructive";
  return "outline";
}

function getEvaluationPeriodStatusLabel(status: string | undefined): string {
  if (status === "draft") return "下書き";
  if (status === "active") return "進行中";
  if (status === "completed") return "入力終了";
  if (status === "cancelled") return "キャンセル";
  return "-";
}

function toLogicRow(row: ComprehensiveEvaluationRowResponse): ComprehensiveEvaluationRow {
  return {
    id: row.id,
    userId: row.userId,
    evaluationPeriodId: row.evaluationPeriodId,
    employeeCode: row.employeeCode,
    name: row.name,
    departmentName: row.departmentName ?? "",
    employmentType: row.employmentType,
    processingStatus: row.processingStatus,
    performanceFinalRank: row.performanceFinalRank,
    performanceWeightPercent: row.performanceWeightPercent,
    performanceScore: row.performanceScore,
    competencyFinalRank: row.competencyFinalRank,
    competencyWeightPercent: row.competencyWeightPercent,
    competencyScore: row.competencyScore,
    coreValueFinalRank: row.coreValueFinalRank,
    leaderInterviewCleared: row.leaderInterviewCleared,
    divisionHeadPresentationCleared: row.divisionHeadPresentationCleared,
    ceoInterviewCleared: row.ceoInterviewCleared,
    currentStage: row.currentStage,
    currentLevel: row.currentLevel,
  };
}

function toManualOverride(
  manualDecision: ComprehensiveEvaluationRowResponse["manualDecision"],
): ComprehensiveEvaluationManualOverride | undefined {
  if (!manualDecision) return undefined;

  return {
    decision: manualDecision.decision,
    stageAfter: manualDecision.stageAfter ?? undefined,
    levelAfter: manualDecision.levelAfter ?? undefined,
    reason: manualDecision.reason,
    appliedAt: manualDecision.appliedAt,
  };
}

export default function ComprehensiveEvaluationCandidatesPage() {
  const { hasRole } = useUserRoles();
  const currentUserContext = useOptionalCurrentUserContext();
  const canAccessCandidates = hasRole("eval_admin");
  const canEditRole = canAccessCandidates;
  const { upsertOverride, clearOverride, isSaving, error: actionError } = useComprehensiveEvaluationManualOverrides();

  const [rows, setRows] = useState<ComprehensiveEvaluationRowResponse[]>([]);
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

  const [evaluationPeriodId, setEvaluationPeriodId] = useState<string>(defaultPeriodId);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [selectedEmploymentType, setSelectedEmploymentType] = useState<EmploymentType | "all">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [candidateOnly, setCandidateOnly] = useState<boolean>(true);
  const [candidateFilter, setCandidateFilter] = useState<CandidateFilter>("all");
  const [overrideRowId, setOverrideRowId] = useState<string | null>(null);
  const [overrideDraft, setOverrideDraft] = useState<ManualOverrideDraft | null>(null);
  const [stageOptionsFromApi, setStageOptionsFromApi] = useState<string[]>([]);
  const [stageOptionsError, setStageOptionsError] = useState<string | null>(null);

  const selectedEvaluationPeriod = useMemo(
    () => evaluationPeriods.find((period) => period.id === evaluationPeriodId) ?? null,
    [evaluationPeriodId, evaluationPeriods],
  );
  const isSelectedPeriodCancelled = selectedEvaluationPeriod?.status === "cancelled";
  const canEdit = canEditRole && !isSelectedPeriodCancelled;

  useEffect(() => {
    if (evaluationPeriodId !== "all") return;
    if (!defaultPeriodId || defaultPeriodId === "all") return;
    setEvaluationPeriodId(defaultPeriodId);
  }, [defaultPeriodId, evaluationPeriodId]);

  useEffect(() => {
    if (!canAccessCandidates) {
      setStageOptionsFromApi([]);
      setStageOptionsError(null);
      return;
    }

    let isActive = true;

    const loadStages = async () => {
      const result = await getComprehensiveEvaluationStageOptionsAction();
      if (!isActive) return;
      if (!result.success || !result.data) {
        setStageOptionsFromApi([]);
        setStageOptionsError(result.error ?? "ステージ一覧の取得に失敗しました");
        return;
      }
      setStageOptionsError(null);

      const seen = new Set<string>();
      const names: string[] = [];
      result.data.forEach((stageName) => {
        const name = stageName?.trim();
        if (!name || seen.has(name)) return;
        seen.add(name);
        names.push(name);
      });

      setStageOptionsFromApi(names);
    };

    void loadStages();

    return () => {
      isActive = false;
    };
  }, [canAccessCandidates]);

  const loadRows = useCallback(async () => {
    if (!canAccessCandidates) {
      setRows([]);
      setRowsError(null);
      setIsRowsLoading(false);
      return;
    }

    const requestId = latestRowsRequestId.current + 1;
    latestRowsRequestId.current = requestId;

    if (!evaluationPeriodId || evaluationPeriodId === "all") {
      setRows([]);
      setRowsError(null);
      setIsRowsLoading(false);
      return;
    }

    setIsRowsLoading(true);
    setRowsError(null);

    const firstPageResult = await getComprehensiveEvaluationListAction({
      periodId: evaluationPeriodId,
      candidateView: true,
      page: 1,
      limit: COMPREHENSIVE_ROWS_PAGE_SIZE,
    });

    if (requestId !== latestRowsRequestId.current) return;

    if (!firstPageResult.success || !firstPageResult.data) {
      setRows([]);
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
            candidateView: true,
            page: index + 2,
            limit: COMPREHENSIVE_ROWS_PAGE_SIZE,
          }),
        ),
      );

      if (requestId !== latestRowsRequestId.current) return;

      const failedPageResult = remainingPageResults.find((result) => !result.success || !result.data);
      if (failedPageResult) {
        setRows([]);
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

    setRows(mergedRows);
    setIsRowsLoading(false);
  }, [canAccessCandidates, evaluationPeriodId]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const departments = useMemo(() => {
    const unique = new Set<string>();
    rows.forEach((row) => {
      if (row.departmentName) unique.add(row.departmentName);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b, "ja"));
  }, [rows]);

  const stagesFromRows = useMemo(() => {
    const unique = new Set<string>();
    rows.forEach((row) => {
      if (row.currentStage) unique.add(row.currentStage);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b, "ja"));
  }, [rows]);

  const stagesForOverride = useMemo(() => {
    if (stageOptionsFromApi.length === 0) return [];

    const merged = [...stageOptionsFromApi];
    const seen = new Set(merged);
    stagesFromRows.forEach((stage) => {
      if (seen.has(stage)) return;
      seen.add(stage);
      merged.push(stage);
    });

    return merged;
  }, [stageOptionsFromApi, stagesFromRows]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return rows.filter((row) => {
      if (evaluationPeriodId !== "all" && row.evaluationPeriodId !== evaluationPeriodId) return false;
      if (selectedDepartment !== "all" && row.departmentName !== selectedDepartment) return false;
      if (selectedStage !== "all" && row.currentStage !== selectedStage) return false;
      if (selectedEmploymentType !== "all" && row.employmentType !== selectedEmploymentType) return false;

      if (!normalizedQuery) return true;
      return buildSearchText(row).includes(normalizedQuery);
    });
  }, [evaluationPeriodId, rows, searchQuery, selectedDepartment, selectedStage, selectedEmploymentType]);

  const computedRows = useMemo(() => {
    return filteredRows.map((row) => {
      const logicRow = toLogicRow(row);
      const base = row.auto as ComprehensiveEvaluationComputedRow;
      const applied = row.applied as ComprehensiveEvaluationComputedRow;
      const override = toManualOverride(row.manualDecision);
      return { row, logicRow, base, applied, override };
    });
  }, [filteredRows]);

  const selectedItem = useMemo(() => {
    if (!overrideRowId) return null;
    return computedRows.find((item) => item.row.id === overrideRowId) ?? null;
  }, [computedRows, overrideRowId]);

  const requiresStageAfter = overrideDraft ? overrideDraft.decision !== "対象外" : false;
  const allowsLevelAfter =
    overrideDraft && selectedItem
      ? overrideDraft.decision !== "対象外" && selectedItem.row.employmentType === "employee"
      : false;
  const isSelectedItemProcessed = selectedItem?.row.processingStatus === "processed";
  const canEditSelectedItem = canEdit && Boolean(isSelectedItemProcessed);

  const openOverrideDialog = (
    row: ComprehensiveEvaluationRowResponse,
    base: ComprehensiveEvaluationComputedRow,
    override: ComprehensiveEvaluationManualOverride | undefined,
  ) => {
    setOverrideRowId(row.id);
    const defaultDecision =
      override?.decision ?? (base.promotionFlag ? "昇格" : base.demotionFlag ? "降格" : base.decision);
    const defaultLevelAfter =
      defaultDecision !== "対象外" && row.employmentType === "employee"
        ? typeof override?.levelAfter === "number"
          ? String(override.levelAfter)
          : typeof row.currentLevel === "number"
            ? String(row.currentLevel)
            : ""
        : "";

    setOverrideDraft({
      decision: defaultDecision,
      stageAfter: typeof override?.stageAfter === "string" ? override.stageAfter : "",
      levelAfter: defaultLevelAfter,
      reason: override?.reason ?? "",
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

  const handleApplyOverride = async () => {
    if (!canEditSelectedItem || !selectedItem || !overrideDraft) return;

    const localRequiresStageAfter = overrideDraft.decision !== "対象外";
    const localAllowsLevelAfter = localRequiresStageAfter && selectedItem.row.employmentType === "employee";

    const stageAfter = overrideDraft.stageAfter.trim();
    const stageAfterValid = !localRequiresStageAfter || stageAfter !== "";

    const levelAfterInput = overrideDraft.levelAfter.trim();
    const levelAfterValue = levelAfterInput === "" ? undefined : Number(levelAfterInput);
    const levelAfterValid =
      levelAfterInput === "" ||
      (Number.isFinite(levelAfterValue) &&
        Number.isInteger(levelAfterValue) &&
        (levelAfterValue as number) >= 1 &&
        (levelAfterValue as number) <= 30);

    const reason = overrideDraft.reason.trim();

    if (!stageAfterValid || !levelAfterValid || !reason) return;

    const result = await upsertOverride(selectedItem.row.evaluationPeriodId, selectedItem.row.userId, {
      decision: overrideDraft.decision,
      stageAfter: localRequiresStageAfter ? stageAfter : undefined,
      levelAfter: localAllowsLevelAfter && typeof levelAfterValue === "number" ? levelAfterValue : undefined,
      reason,
      appliedAt: new Date().toISOString(),
    });

    if (!result.success) return;

    await loadRows();
    closeOverrideDialog();
  };

  const handleClearOverride = async () => {
    if (!canEditSelectedItem || !selectedItem) return;

    const result = await clearOverride(selectedItem.row.evaluationPeriodId, selectedItem.row.userId);
    if (!result.success) return;

    await loadRows();
    closeOverrideDialog();
  };

  const handleClearFilters = () => {
    setEvaluationPeriodId(defaultPeriodId);
    setSelectedDepartment("all");
    setSelectedStage("all");
    setSelectedEmploymentType("all");
    setSearchQuery("");
    setCandidateOnly(true);
    setCandidateFilter("all");
  };

  return (
    <RolePermissionGuard
      allowedRoles={["eval_admin"]}
      deniedMessage="このページはeval_adminのみ閲覧できます"
    >
      <div className="container mx-auto space-y-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">昇格/降格フラグ対応</h1>
            <p className="text-sm text-muted-foreground">
              昇格フラグ（正社員かつ昇格判別ルールを満たす）または降格フラグ（降格判別ルールを満たす）が点灯した行を起点に、`eval_admin`が判定・反映後ステージ・反映後レベルを個別に判断します。
            </p>
            {isSelectedPeriodCancelled && (
              <p className="text-sm text-destructive">
                この評価期間はキャンセル済みのため、個別判断の編集はできません。
              </p>
            )}
            {!isSelectedPeriodCancelled && (
              <p className="text-sm text-muted-foreground">
                「処理済」のユーザーのみ個別判断を編集できます。未処理ユーザーは
                <Link href="/admin-eval-list" className="mx-1 underline">
                  /admin-eval-list
                </Link>
                で先に「処理する」を実行してください。
              </p>
            )}
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
          <Badge variant="outline">昇格判断済み {counts.promotionConfirmed}</Badge>
          <Badge variant="outline">降格判断済み {counts.demotionConfirmed}</Badge>
        </div>

        <div className="rounded-lg border bg-muted/20 p-4 text-sm">
          <div className="font-semibold">操作手順（eval_admin）</div>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>`/admin-eval-list` で対象ユーザーを「処理する」して処理済にする</li>
            <li>この画面で「個別判断する」を押す</li>
            <li>判定・反映後ステージ・理由を入力して保存する</li>
          </ol>
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
            <Badge variant={selectedEvaluationPeriod.status === "cancelled" ? "destructive" : "outline"}>
              {getEvaluationPeriodStatusLabel(selectedEvaluationPeriod.status)}
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
              {stagesFromRows.map((stage) => (
                <SelectItem key={stage} value={stage}>
                  {stage}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={selectedEmploymentType}
            onValueChange={(value) => setSelectedEmploymentType(value as EmploymentType | "all")}
          >
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
              <SelectItem value="promotion_confirmed">昇格判断済み</SelectItem>
              <SelectItem value="demotion_confirmed">降格判断済み</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 rounded-md border px-3 py-2">
            <span className="text-sm text-muted-foreground">フラグのみ</span>
            <Switch checked={candidateOnly} onCheckedChange={setCandidateOnly} />
          </div>

          <div className="relative min-w-[260px] flex-1">
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {isRowsLoading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="h-24 text-center text-sm text-muted-foreground">
                      読み込み中...
                    </TableCell>
                  </TableRow>
                ) : rowsError ? (
                  <TableRow>
                    <TableCell colSpan={11} className="h-24 text-center text-sm text-destructive">
                      {rowsError}
                    </TableCell>
                  </TableRow>
                ) : visibleRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="h-24 text-center text-sm text-muted-foreground">
                      表示できるデータがありません
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleRows.map(({ row, base, override }) => {
                    const showsPromotionFlag = base.promotionFlag;
                    const showsDemotionFlag = base.demotionFlag;
                    const confirmedStageAfter = override?.stageAfter;
                    const isRowProcessed = row.processingStatus === "processed";
                    const canEditRow = canEdit && isRowProcessed;
                    const editDisabledReason = isSelectedPeriodCancelled
                      ? "評価期間がキャンセル済みのため編集できません"
                      : "評価スコアが未処理のため編集できません";

                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.employeeCode}</TableCell>
                        <TableCell className="whitespace-nowrap">{row.name}</TableCell>
                        <TableCell className="whitespace-nowrap">{row.departmentName ?? "-"}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={getEmploymentTypeBadgeVariant(row.employmentType)}>
                            {getEmploymentTypeLabel(row.employmentType)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">{base.overallRank ?? "-"}</TableCell>
                        <TableCell className="text-center">{row.competencyFinalRank ?? "-"}</TableCell>
                        <TableCell className="text-center">{row.coreValueFinalRank ?? "-"}</TableCell>

                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-2">
                            <div className="flex items-center justify-center gap-2">
                              {override ? (
                                <>
                                  <Badge variant={getDecisionBadgeVariant(override.decision)}>{override.decision}</Badge>
                                  <Badge variant="secondary">判断済み</Badge>
                                </>
                              ) : (
                                <Badge variant="outline">未判断</Badge>
                              )}
                              <Badge variant={isRowProcessed ? "secondary" : "outline"}>
                                {isRowProcessed ? "処理済" : "未処理"}
                              </Badge>
                            </div>
                            {canEditRole && (
                              <Button
                                size="sm"
                                variant={canEditRow ? "default" : "outline"}
                                className="h-8 px-3"
                                onClick={() => canEditRow && openOverrideDialog(row, base, override)}
                                disabled={!canEditRow}
                                title={!canEditRow ? editDisabledReason : undefined}
                              >
                                {canEditRow ? "個別判断する" : "評価処理後に操作可能"}
                              </Button>
                            )}
                            {!canEditRow && !isSelectedPeriodCancelled && (
                              <div className="text-xs text-muted-foreground">
                                `/admin-eval-list` で先に「処理する」を実行してください
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{row.currentStage ?? "-"}</TableCell>
                        <TableCell className="text-center">
                          <div className="font-medium">{confirmedStageAfter ?? "-"}</div>
                          {showsPromotionFlag && <div className="mt-1 text-xs font-semibold text-primary">昇格フラグ</div>}
                          {showsDemotionFlag && <div className="mt-1 text-xs font-semibold text-destructive">降格フラグ</div>}
                        </TableCell>
                        <TableCell className="text-center">{row.currentLevel ?? "-"}</TableCell>
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
              <DialogTitle>個別判断（判定/反映後ステージ/反映後レベルを設定）</DialogTitle>
              <DialogDescription>
                ルールに該当しない場合でも、理由を記録して個別に判断できます。
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
                        {selectedItem.row.departmentName ?? "-"} / {selectedItem.row.currentStage ?? "-"}
                      </div>
                      {!isSelectedItemProcessed && !isSelectedPeriodCancelled && (
                        <div className="text-xs text-muted-foreground">
                          このユーザーは評価スコアが未処理のため編集できません。先に
                          <Link href="/admin-eval-list" className="mx-1 underline">
                            /admin-eval-list
                          </Link>
                          で「処理する」を実行してください。
                        </div>
                      )}
                      {isSelectedPeriodCancelled && (
                        <div className="text-xs text-destructive">評価期間がキャンセル済みのため編集できません。</div>
                      )}
                    </div>

                    <Separator />

                    <div className="space-y-2 rounded-md border p-3">
                      <div className="text-sm font-semibold">個別判断プレビュー</div>
                      {(() => {
                        const localRequiresStageAfter = overrideDraft.decision !== "対象外";

                        const stageAfterInput = overrideDraft.stageAfter.trim();
                        const stageAfterOverride =
                          localRequiresStageAfter && stageAfterInput !== "" ? stageAfterInput : undefined;

                        const levelAfterInput = overrideDraft.levelAfter.trim();
                        const levelAfterValue = levelAfterInput === "" ? undefined : Number(levelAfterInput);
                        const levelAfterOverride =
                          localRequiresStageAfter &&
                          selectedItem.row.employmentType === "employee" &&
                          levelAfterInput !== "" &&
                          Number.isFinite(levelAfterValue) &&
                          Number.isInteger(levelAfterValue)
                            ? (levelAfterValue as number)
                            : undefined;

                        const preview = applyComprehensiveEvaluationManualOverride(selectedItem.logicRow, selectedItem.base, {
                          decision: overrideDraft.decision,
                          stageAfter: stageAfterOverride,
                          levelAfter: levelAfterOverride,
                          reason: overrideDraft.reason,
                          appliedAt: selectedItem.override?.appliedAt ?? new Date().toISOString(),
                        });

                        return (
                          <>
                            <div className="text-sm">判定: {preview.decision}</div>
                            <div className="text-sm">反映後ステージ: {preview.newStage ?? "-"}</div>
                            <div className="text-sm">反映後レベル: {preview.newLevel ?? "-"}</div>
                          </>
                        );
                      })()}
                    </div>

                    <Separator />

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>判定（手動）</Label>
                        <Select
                          value={overrideDraft.decision}
                          onValueChange={(value) =>
                            setOverrideDraft((prev) => {
                              if (!prev) return prev;
                              const decision = value as ComprehensiveEvaluationDecision;
                              const levelAfter =
                                decision === "対象外"
                                  ? ""
                                  : prev.levelAfter !== ""
                                    ? prev.levelAfter
                                    : selectedItem?.row.employmentType === "employee" &&
                                        typeof selectedItem.row.currentLevel === "number"
                                      ? String(selectedItem.row.currentLevel)
                                      : "";
                              return {
                                ...prev,
                                decision,
                                stageAfter: decision === "対象外" ? "" : prev.stageAfter,
                                levelAfter,
                              };
                            })
                          }
                        >
                          <SelectTrigger disabled={!canEditSelectedItem}>
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
                          disabled={!canEditSelectedItem || !requiresStageAfter || stageOptionsFromApi.length === 0}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="反映後ステージ" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unset">未指定</SelectItem>
                            {stagesForOverride.map((stage) => (
                              <SelectItem key={stage} value={stage}>
                                {stage}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {requiresStageAfter && overrideDraft.stageAfter.trim() === "" && (
                          <div className="text-xs text-destructive">反映後ステージを選択してください</div>
                        )}
                        {requiresStageAfter && stageOptionsFromApi.length === 0 && stageOptionsError && (
                          <div className="text-xs text-destructive">{stageOptionsError}</div>
                        )}
                        {!requiresStageAfter && (
                          <div className="text-xs text-muted-foreground">判定が対象外のため入力不要です</div>
                        )}
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label>反映後レベル（正社員のみ）</Label>
                        <Input
                          inputMode="numeric"
                          placeholder="例: 10"
                          value={overrideDraft.levelAfter}
                          onChange={(e) =>
                            setOverrideDraft((prev) => (prev ? { ...prev, levelAfter: e.target.value } : prev))
                          }
                          disabled={!canEditSelectedItem || !allowsLevelAfter}
                        />
                        {selectedItem.row.employmentType === "parttime" && (
                          <div className="text-xs text-muted-foreground">パートはレベル概念がないため未適用です</div>
                        )}
                        {allowsLevelAfter && overrideDraft.levelAfter.trim() === "" && (
                          <div className="text-xs text-muted-foreground">未入力の場合は現在レベルを使用します</div>
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
                        <Label>理由（必須）</Label>
                        <Textarea
                          value={overrideDraft.reason}
                          onChange={(e) =>
                            setOverrideDraft((prev) => (prev ? { ...prev, reason: e.target.value } : prev))
                          }
                          placeholder="例: 組織改編に伴う役割変更のため、ルール外でステージ変更を実施"
                          disabled={!canEditSelectedItem}
                        />
                        {overrideDraft.reason.trim() === "" && (
                          <div className="text-xs text-destructive">理由を入力してください</div>
                        )}
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
                      <Button
                        variant="outline"
                        onClick={() => void handleClearOverride()}
                        disabled={!canEditSelectedItem || isSaving}
                      >
                        個別判断を解除
                      </Button>
                    )}
                    <Button
                      onClick={() => void handleApplyOverride()}
                      disabled={
                        !canEditSelectedItem ||
                        isSaving ||
                        (requiresStageAfter && overrideDraft.stageAfter.trim() === "") ||
                        (allowsLevelAfter &&
                          overrideDraft.levelAfter.trim() !== "" &&
                          (!Number.isFinite(Number(overrideDraft.levelAfter)) ||
                            !Number.isInteger(Number(overrideDraft.levelAfter)) ||
                            Number(overrideDraft.levelAfter) < 1 ||
                            Number(overrideDraft.levelAfter) > 30)) ||
                        overrideDraft.reason.trim() === ""
                      }
                    >
                      保存する
                    </Button>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {actionError && <div className="text-sm text-destructive">{actionError}</div>}
      </div>
    </RolePermissionGuard>
  );
}
