"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { TrendingUp, Target, Heart, Loader2 } from "lucide-react";
import { RatingBadge } from "@/components/evaluation/RatingBadge";
import { CoreValueScoreGrid } from "@/feature/evaluation/admin/peer-review-assignments/components/CoreValueScoreGrid";
import { OverallRatingSummary } from "@/feature/evaluation/admin/peer-review-assignments/components/OverallRatingSummary";
import { EvaluationCommentsSection } from "@/feature/evaluation/admin/peer-review-assignments/components/EvaluationCommentsSection";
import type { EvaluationDetailResponse } from "@/api/types";
import type { UnifiedPerformanceItem, UnifiedCompetencyItem } from "./utils";

/** Section header showing the title and both overall ratings (自己 / 上長). */
function SectionHeader({
  icon,
  iconClassName,
  title,
  selfOverall,
  supervisorOverall,
}: {
  icon: React.ReactNode;
  iconClassName: string;
  title: string;
  selfOverall: string;
  supervisorOverall: string;
}) {
  return (
    <CardHeader className="pb-3">
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-full ${iconClassName}`}>{icon}</div>
        <div className="flex-1 flex items-center justify-between">
          <CardTitle className="text-lg font-bold tracking-tight">{title}</CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-md border border-blue-200 bg-blue-50">
              <span className="text-xs text-blue-600">総合評価 自己</span>
              <span className="text-lg font-bold text-blue-700">{selfOverall}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-md border border-green-200 bg-green-50">
              <span className="text-xs text-green-600">上長</span>
              <span className="text-lg font-bold text-green-700">{supervisorOverall}</span>
            </div>
          </div>
        </div>
      </div>
    </CardHeader>
  );
}

/** Two-column comment block: 自己 (blue) | 上長 (green). */
function DualComment({
  selfComment,
  supervisorComment,
}: {
  selfComment: string;
  supervisorComment: string;
}) {
  const box = (label: string, color: string, value: string) => (
    <div>
      <Label className={`text-xs font-semibold ${color} mb-1 block`}>{label}</Label>
      <div className="text-sm text-gray-700 bg-white rounded-md border border-gray-300 p-3 min-h-[80px] whitespace-pre-wrap">
        {value || <span className="text-gray-400">コメントなし</span>}
      </div>
    </div>
  );
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {box("自己評価コメント", "text-blue-700", selfComment)}
      {box("上長評価コメント", "text-green-700", supervisorComment)}
    </div>
  );
}

/** Inline 自己 / 上長 rating pair. */
function DualRating({
  selfRating,
  supervisorRating,
}: {
  selfRating?: string | null;
  supervisorRating?: string | null;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-blue-600 font-medium">自己</span>
        <RatingBadge rating={selfRating ?? null} />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-green-600 font-medium">上長</span>
        <RatingBadge rating={supervisorRating ?? null} />
      </div>
    </div>
  );
}

function MultilineDetail({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <Label className="text-sm font-semibold text-gray-700 mb-1 block">{label}</Label>
      <div className="text-xs text-gray-500 leading-relaxed whitespace-pre-wrap break-words">
        {value}
      </div>
    </div>
  );
}

export function UnifiedPerformanceSection({
  items,
  selfOverall,
  supervisorOverall,
  isLoading = false,
}: {
  items: UnifiedPerformanceItem[];
  selfOverall: string;
  supervisorOverall: string;
  isLoading?: boolean;
}) {
  return (
    <Card className="shadow-xl border-0 bg-white">
      <SectionHeader
        icon={<TrendingUp className="w-6 h-6" />}
        iconClassName="bg-blue-100 text-blue-700"
        title="業績目標評価"
        selfOverall={selfOverall}
        supervisorOverall={supervisorOverall}
      />
      <CardContent className="space-y-6 pt-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>業績目標がありません</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.goalId}
              className="bg-slate-50 border border-slate-200 rounded-2xl shadow-sm px-6 py-5 space-y-4"
            >
              {/* Goal header (shown once) */}
              <div className="flex items-center gap-3">
                <div className="text-xl font-bold text-slate-800 flex-1 break-words whitespace-pre-wrap">
                  {item.specificGoal}
                </div>
                <Badge className="bg-blue-600 text-white text-sm px-3 py-1">
                  ウエイト {item.weight}%
                </Badge>
                <span
                  className="text-xs font-medium px-2 py-1 rounded-full"
                  style={{
                    background: item.type === "quantitative" ? "#2563eb22" : "#a21caf22",
                    color: item.type === "quantitative" ? "#2563eb" : "#a21caf",
                  }}
                >
                  {item.type === "quantitative" ? "定量目標" : "定性目標"}
                </span>
              </div>

              {/* Goal details (shown once) */}
              <div className="flex flex-col gap-3">
                <MultilineDetail label="手段・手法" value={item.methods} />
                <MultilineDetail label="達成基準" value={item.achievementCriteria} />
              </div>

              {/* Unified ratings */}
              <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                <DualRating
                  selfRating={item.selfRating}
                  supervisorRating={item.supervisorRating}
                />
                <DualComment
                  selfComment={item.selfComment}
                  supervisorComment={item.supervisorComment}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function UnifiedCompetencySection({
  items,
  selfOverall,
  supervisorOverall,
  isLoading = false,
}: {
  items: UnifiedCompetencyItem[];
  selfOverall: string;
  supervisorOverall: string;
  isLoading?: boolean;
}) {
  // Group competencies by goal so the goal-level comment renders once per goal.
  const byGoal = items.reduce<Record<string, UnifiedCompetencyItem[]>>((acc, c) => {
    (acc[c.goalId] ??= []).push(c);
    return acc;
  }, {});

  return (
    <Card className="shadow-xl border-0 bg-white">
      <SectionHeader
        icon={<Target className="w-6 h-6" />}
        iconClassName="bg-green-100 text-green-700"
        title="コンピテンシー評価"
        selfOverall={selfOverall}
        supervisorOverall={supervisorOverall}
      />
      <CardContent className="space-y-6 pt-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>コンピテンシー目標がありません</p>
          </div>
        ) : (
          Object.entries(byGoal).map(([goalId, comps]) => (
            <div key={goalId} className="space-y-4">
              {comps.map((comp) => (
                <div
                  key={comp.competencyId}
                  className="bg-slate-50 border border-slate-200 rounded-2xl shadow-sm px-6 py-5 space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="text-lg font-bold text-slate-800 break-words">
                        {comp.name}
                      </div>
                      {comp.isFocused && (
                        <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700 border border-green-200 shrink-0">
                          注力
                        </span>
                      )}
                    </div>
                    {/* 大項目 aggregate result (self / supervisor) */}
                    <div className="shrink-0 flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1">
                      <span className="text-xs text-gray-500">結果</span>
                      <DualRating
                        selfRating={comp.selfRating}
                        supervisorRating={comp.supervisorRating}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    {comp.actions.map((a) => (
                      <div
                        key={a.id}
                        className="bg-white rounded-lg p-4 border border-gray-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <p className="text-sm text-gray-700 break-words whitespace-pre-wrap flex-1">
                          {a.description}
                        </p>
                        <DualRating
                          selfRating={a.selfRating}
                          supervisorRating={a.supervisorRating}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Goal-level comments (once per goal) */}
              <DualComment
                selfComment={comps[0]?.selfComment ?? ""}
                supervisorComment={comps[0]?.supervisorComment ?? ""}
              />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function CoreValueSection({
  detail,
  isLoading = false,
}: {
  detail: EvaluationDetailResponse | null;
  isLoading?: boolean;
}) {
  return (
    <Card className="shadow-xl border-0 bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-rose-100 text-rose-700">
            <Heart className="w-6 h-6" />
          </div>
          <div className="flex-1 flex items-center justify-between">
            <CardTitle className="text-lg font-bold tracking-tight">コアバリュー評価</CardTitle>
            {detail && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-md border border-rose-200 bg-rose-50">
                <span className="text-xs text-rose-600">総合平均</span>
                <span className="text-lg font-bold text-rose-700">
                  {detail.overallRating ?? "−"}
                </span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !detail ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>コアバリュー評価がありません</p>
          </div>
        ) : (
          <>
            <CoreValueScoreGrid coreValues={detail.coreValues} />
            <OverallRatingSummary
              selfAvgRating={detail.selfAvgRating}
              peer1AvgRating={detail.peer1AvgRating}
              peer2AvgRating={detail.peer2AvgRating}
              supervisorAvgRating={detail.supervisorAvgRating}
              overallRating={detail.overallRating}
            />
            <EvaluationCommentsSection comments={detail.comments} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
