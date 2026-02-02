"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, Settings, X } from "lucide-react";

import RolePermissionGuard from "@/components/auth/RolePermissionGuard";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { mockComprehensiveEvaluationRows, mockEvaluationPeriods } from "../mock";
import { applyComprehensiveEvaluationManualOverride, computeComprehensiveEvaluationRow } from "../logic";
import { useComprehensiveEvaluationManualOverrides } from "../hooks/useComprehensiveEvaluationManualOverrides";
import { useComprehensiveEvaluationSettings } from "../hooks/useComprehensiveEvaluationSettings";
import { useComprehensiveEvaluationUserFlags } from "../hooks/useComprehensiveEvaluationUserFlags";
import { EVALUATION_RANKS } from "../settings";
import type { ComprehensiveEvaluationRow, EmploymentType, EvaluationRank, ProcessingStatus } from "../types";

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

export default function ComprehensiveEvaluationPage() {
  const { hasRole } = useUserRoles();
  const canEditThresholds = hasRole("admin"); // TODO: eval_adminに変更
  const { settings, setSettings, resetSettings } = useComprehensiveEvaluationSettings();
  const { flagsByUserId } = useComprehensiveEvaluationUserFlags();
  const { overridesByPeriodId } = useComprehensiveEvaluationManualOverrides();

  const [evaluationPeriodId, setEvaluationPeriodId] = useState<string>(
    mockEvaluationPeriods[0]?.id ?? "all"
  );
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [selectedEmploymentType, setSelectedEmploymentType] = useState<EmploymentType | "all">("all");
  const [selectedProcessingStatus, setSelectedProcessingStatus] = useState<ProcessingStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

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
      if (selectedProcessingStatus !== "all" && row.processingStatus !== selectedProcessingStatus) return false;

      if (!normalizedQuery) return true;
      return buildSearchText(row).includes(normalizedQuery);
    });
  }, [evaluationPeriodId, searchQuery, selectedDepartment, selectedStage, selectedEmploymentType, selectedProcessingStatus]);

  const handleClearFilters = () => {
    setEvaluationPeriodId(mockEvaluationPeriods[0]?.id ?? "all");
    setSelectedDepartment("all");
    setSelectedStage("all");
    setSelectedEmploymentType("all");
    setSelectedProcessingStatus("all");
    setSearchQuery("");
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
              添付スプレッドシート相当の総合評価テーブル（モック表示）
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/admin-eval-list/candidates">昇格/降格候補</Link>
            </Button>
            {canEditThresholds && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    判定ルール設定
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>判定ルール設定（モック）</DialogTitle>
                    <DialogDescription>
                      `eval_admin`のみ編集できます。設定はブラウザ内（localStorage）に保存されます。
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-8">
                    <section className="space-y-4">
                      <h3 className="text-sm font-semibold">昇格条件（該当ステージからステージアップ）</h3>

                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label>総合評価（最低ランク）</Label>
                          <Select
                            value={settings.promotion.overallMinimumRank}
                            onValueChange={(value) =>
                              setSettings((prev) => ({
                                ...prev,
                                promotion: { ...prev.promotion, overallMinimumRank: value as EvaluationRank },
                              }))
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

                        <div className="space-y-2">
                          <Label>コンピテンシー（最低ランク）</Label>
                          <Select
                            value={settings.promotion.competencyMinimumRank}
                            onValueChange={(value) =>
                              setSettings((prev) => ({
                                ...prev,
                                promotion: { ...prev.promotion, competencyMinimumRank: value as EvaluationRank },
                              }))
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

                        <div className="space-y-2">
                          <Label>クレド（最低ランク）</Label>
                          <Select
                            value={settings.promotion.coreValueMinimumRank}
                            onValueChange={(value) =>
                              setSettings((prev) => ({
                                ...prev,
                                promotion: { ...prev.promotion, coreValueMinimumRank: value as EvaluationRank },
                              }))
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
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        <Label className="flex items-center justify-between rounded-md border px-3 py-2">
                          リーダー面談クリア
                          <Switch
                            checked={settings.promotion.requireLeaderInterview}
                            onCheckedChange={(checked) =>
                              setSettings((prev) => ({
                                ...prev,
                                promotion: { ...prev.promotion, requireLeaderInterview: checked },
                              }))
                            }
                          />
                        </Label>

                        <Label className="flex items-center justify-between rounded-md border px-3 py-2">
                          事業部長プレゼンクリア
                          <Switch
                            checked={settings.promotion.requireDivisionHeadPresentation}
                            onCheckedChange={(checked) =>
                              setSettings((prev) => ({
                                ...prev,
                                promotion: { ...prev.promotion, requireDivisionHeadPresentation: checked },
                              }))
                            }
                          />
                        </Label>

                        <Label className="flex items-center justify-between rounded-md border px-3 py-2">
                          CEO面談クリア
                          <Switch
                            checked={settings.promotion.requireCeoInterview}
                            onCheckedChange={(checked) =>
                              setSettings((prev) => ({
                                ...prev,
                                promotion: { ...prev.promotion, requireCeoInterview: checked },
                              }))
                            }
                          />
                        </Label>
                      </div>

                      <div className="grid gap-4 md:grid-cols-1">
                        <div className="space-y-2">
                          <Label>ステージ増減（昇格）</Label>
                          <Input
                            type="number"
                            value={settings.promotion.stageDelta}
                            onChange={(e) => {
                              const next = Number(e.target.value);
                              if (!Number.isFinite(next)) return;
                              setSettings((prev) => ({
                                ...prev,
                                promotion: { ...prev.promotion, stageDelta: next },
                              }));
                            }}
                          />
                        </div>
                      </div>
                    </section>

                    <section className="space-y-4">
                      <h3 className="text-sm font-semibold">降格基準（該当ステージからステージダウン）</h3>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2 md:col-span-1">
                          <Label>年間総合評価（降格しきい値）</Label>
                          <Select
                            value={settings.demotion.yearlyThresholdRank}
                            onValueChange={(value) =>
                              setSettings((prev) => ({
                                ...prev,
                                demotion: { ...prev.demotion, yearlyThresholdRank: value as EvaluationRank },
                              }))
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

                        <div className="space-y-2">
                          <Label>ステージ増減（降格）</Label>
                          <Input
                            type="number"
                            value={settings.demotion.stageDelta}
                            onChange={(e) => {
                              const next = Number(e.target.value);
                              if (!Number.isFinite(next)) return;
                              setSettings((prev) => ({
                                ...prev,
                                demotion: { ...prev.demotion, stageDelta: next },
                              }));
                            }}
                          />
                        </div>
                      </div>

                      <Label className="flex items-center justify-between rounded-md border px-3 py-2">
                        同一年度の上期・下期MBOが両方Dの場合は総合評価をDで上書き（MBO Dフラグ）
                        <Switch
                          checked={settings.demotion.mboDOverrideEnabled}
                          onCheckedChange={(checked) =>
                            setSettings((prev) => ({
                              ...prev,
                              demotion: { ...prev.demotion, mboDOverrideEnabled: checked },
                            }))
                          }
                        />
                      </Label>
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
                              value={settings.levelDeltaByOverallRank[rank]}
                              onChange={(e) => {
                                const next = Number(e.target.value);
                                if (!Number.isFinite(next)) return;
                                setSettings((prev) => ({
                                  ...prev,
                                  levelDeltaByOverallRank: {
                                    ...prev.levelDeltaByOverallRank,
                                    [rank]: next,
                                  },
                                }));
                              }}
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
                  <TableHead colSpan={8} className="text-center font-semibold">
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
                  <TableHead className="whitespace-nowrap">MBO D評価フラグ</TableHead>
                  <TableHead className="whitespace-nowrap">昇格フラグ</TableHead>
                  <TableHead className="whitespace-nowrap">レベル増減</TableHead>
                  <TableHead className="whitespace-nowrap">現在ステージ</TableHead>
                  <TableHead className="whitespace-nowrap">現在レベル</TableHead>
                  <TableHead className="whitespace-nowrap">新レベル</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={19} className="h-24 text-center text-sm text-muted-foreground">
                      表示できるデータがありません
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => {
                    const base = computeComprehensiveEvaluationRow(
                      row,
                      settings,
                      flagsByUserId[row.userId]
                    );
                    const override = overridesByPeriodId[row.evaluationPeriodId]?.[row.userId];
                    const computed = applyComprehensiveEvaluationManualOverride(row, base, settings, override);
                    const isAlertLevel = computed.newLevel !== null && computed.newLevel >= 31;

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
                        <TableCell className="text-center">{formatMboDFlag(row.mboDRatingFlag)}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span>{computed.decision}</span>
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
