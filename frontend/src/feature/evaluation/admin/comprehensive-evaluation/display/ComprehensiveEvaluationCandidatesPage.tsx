"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import RolePermissionGuard from "@/components/auth/RolePermissionGuard";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { computeComprehensiveEvaluationRow, computeEffectiveUserFlags } from "../logic";
import { useComprehensiveEvaluationSettings } from "../hooks/useComprehensiveEvaluationSettings";
import { useComprehensiveEvaluationUserFlags } from "../hooks/useComprehensiveEvaluationUserFlags";
import { mockComprehensiveEvaluationRows, mockEvaluationPeriods } from "../mock";
import type { ComprehensiveEvaluationRow } from "../types";

type CandidateFilter = "all" | "promotion" | "demotion";

function buildSearchText(row: ComprehensiveEvaluationRow): string {
  return [row.employeeCode, row.name, row.departmentName, row.currentStage ?? ""].join(" ").toLowerCase();
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
  const canEdit = hasRole("eval_admin");
  const { settings } = useComprehensiveEvaluationSettings();
  const { flagsByUserId, updateUserFlags, resetUserFlags } = useComprehensiveEvaluationUserFlags();

  const [evaluationPeriodId, setEvaluationPeriodId] = useState<string>(mockEvaluationPeriods[0]?.id ?? "all");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [candidateOnly, setCandidateOnly] = useState<boolean>(true);
  const [candidateFilter, setCandidateFilter] = useState<CandidateFilter>("all");

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

      if (!normalizedQuery) return true;
      return buildSearchText(row).includes(normalizedQuery);
    });
  }, [evaluationPeriodId, searchQuery, selectedDepartment, selectedStage]);

  const computedRows = useMemo(() => {
    return filteredRows.map((row) => {
      const computed = computeComprehensiveEvaluationRow(row, settings, flagsByUserId[row.userId]);
      const effectiveFlags = computeEffectiveUserFlags(row, flagsByUserId[row.userId]);
      return { row, computed, effectiveFlags };
    });
  }, [filteredRows, flagsByUserId, settings]);

  const counts = useMemo(() => {
    const promotion = computedRows.filter((item) => item.computed.decision === "昇格").length;
    const demotion = computedRows.filter((item) => item.computed.decision === "降格").length;
    return { promotion, demotion };
  }, [computedRows]);

  const visibleRows = useMemo(() => {
    return computedRows.filter((item) => {
      if (candidateOnly && item.computed.decision === "対象外") return false;
      if (candidateFilter === "promotion" && item.computed.decision !== "昇格") return false;
      if (candidateFilter === "demotion" && item.computed.decision !== "降格") return false;
      return true;
    });
  }, [candidateFilter, candidateOnly, computedRows]);

  const handleClearFilters = () => {
    setEvaluationPeriodId(mockEvaluationPeriods[0]?.id ?? "all");
    setSelectedDepartment("all");
    setSelectedStage("all");
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
              ルールに基づく候補者一覧（モック）。面談/プレゼン/CEO面談のクリア状況は`eval_admin`が更新できます。
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/admin-eval-list">総合評価テーブルへ</Link>
            </Button>
            {canEdit && (
              <Button variant="outline" onClick={resetUserFlags}>
                面談フラグをリセット
              </Button>
            )}
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
                  <TableHead className="whitespace-nowrap text-center">総合評価</TableHead>
                  <TableHead className="whitespace-nowrap text-center">コンピテンシー</TableHead>
                  <TableHead className="whitespace-nowrap text-center">クレド</TableHead>
                  <TableHead className="whitespace-nowrap text-center">MBO D</TableHead>
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
                    <TableCell colSpan={17} className="h-24 text-center text-sm text-muted-foreground">
                      表示できるデータがありません
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleRows.map(({ row, computed, effectiveFlags }) => {
                    const isAlertLevel = computed.newLevel !== null && computed.newLevel >= 31;

                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.employeeCode}</TableCell>
                        <TableCell className="whitespace-nowrap">{row.name}</TableCell>
                        <TableCell className="whitespace-nowrap">{row.departmentName}</TableCell>
                        <TableCell className="text-center">{computed.overallRank ?? "-"}</TableCell>
                        <TableCell className="text-center">{row.competencyFinalRank ?? "-"}</TableCell>
                        <TableCell className="text-center">{row.coreValueFinalRank ?? "-"}</TableCell>
                        <TableCell className="text-center">{row.mboDRatingFlag ?? "-"}</TableCell>

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
                          <Badge variant={getDecisionBadgeVariant(computed.decision)}>
                            {computed.decision}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">{row.currentStage ?? "-"}</TableCell>
                        <TableCell className="text-center">{computed.newStage ?? "-"}</TableCell>
                        <TableCell className="text-center">{row.currentLevel ?? "-"}</TableCell>
                        <TableCell className="text-center">{formatDelta(computed.levelDelta)}</TableCell>
                        <TableCell className={isAlertLevel ? "text-center font-semibold text-destructive" : "text-center"}>
                          {computed.newLevel ?? "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {computed.totalScore !== null ? formatNumber(computed.totalScore) : "-"}
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
