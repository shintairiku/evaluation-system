"use client";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { GoalResponse, SelfAssessment as APISelfAssessment, RatingCode } from "@/api/types";
import { calculateWeightedAverageRatingCode } from "@/utils/rating";

// Display data structure for a performance goal with its self-assessment
export interface PerformanceGoalDisplayData {
  id: string;
  type: "quantitative" | "qualitative";
  weight: number;
  specificGoal: string;
  achievementCriteria: string;
  methods: string;
  ratingCode?: RatingCode;
  comment: string;
}

interface PerformanceGoalsSelfAssessmentProps {
  goals?: PerformanceGoalDisplayData[];
  overallRating?: string;
  isLoading?: boolean;
}

// Helper function to transform API data to display format
export function transformPerformanceGoalsForDisplay(
  goals: GoalResponse[],
  selfAssessments: APISelfAssessment[]
): PerformanceGoalDisplayData[] {
  // Create a map of goalId -> selfAssessment for quick lookup
  const assessmentMap = new Map(selfAssessments.map(sa => [sa.goalId, sa]));

  return goals
    .filter(goal => goal.goalCategory === '業績目標' && goal.status === 'approved')
    .map(goal => {
      const assessment = assessmentMap.get(goal.id);
      return {
        id: goal.id,
        type: goal.performanceGoalType || 'qualitative',
        weight: goal.weight,
        specificGoal: goal.specificGoalText || goal.title || '',
        achievementCriteria: goal.achievementCriteriaText || '',
        methods: goal.meansMethodsText || '',
        ratingCode: assessment?.selfRatingCode,
        comment: assessment?.selfComment || '',
      };
    });
}

// Calculate overall rating based on weighted average (8-level scale)
export function calculatePerformanceOverallRating(goals: PerformanceGoalDisplayData[]): string {
  return calculateWeightedAverageRatingCode(
    goals.map(goal => ({ rating: goal.ratingCode, weight: goal.weight }))
  );
}

export default function PerformanceGoalsSelfAssessment({
  goals,
  overallRating,
  isLoading = false,
}: PerformanceGoalsSelfAssessmentProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Use provided goals or show empty state
  const displayGoals = goals || [];
  const displayOverallRating = overallRating || (displayGoals.length > 0 ? calculatePerformanceOverallRating(displayGoals) : '−');

  return (
    <Card className="shadow-xl border-0 bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-blue-100 text-blue-700">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold tracking-tight">業績目標評価</CardTitle>
                <p className="text-xs text-gray-500 mt-1">自己評価（参照のみ）</p>
              </div>

              <div className="flex items-center gap-2">
                {/* Overall Rating Display */}
                <div className="flex items-center gap-2 px-3 py-1 rounded-md border border-gray-200 bg-white">
                  <span className="text-xs text-gray-500">総合評価</span>
                  <div className="text-xl font-bold text-blue-700">
                    {displayOverallRating}
                  </div>
                </div>

                {/* Expand/Collapse Button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-2 hover:bg-blue-50"
                >
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-600" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-600" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-6 pt-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : displayGoals.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>業績目標がありません</p>
          </div>
        ) : displayGoals.map((evalItem) => (
          <div
            key={evalItem.id}
            className="bg-slate-50 border border-slate-200 rounded-2xl shadow-sm px-6 py-5 space-y-5"
          >
            {/* Goal Header */}
            <div className="flex items-center gap-3 mb-2">
              <div className="text-xl font-bold text-blue-800 flex-1 break-words overflow-hidden whitespace-pre-wrap">{evalItem.specificGoal}</div>
              <Badge className="bg-blue-600 text-white text-sm px-3 py-1">
                ウエイト {evalItem.weight}%
              </Badge>
              <span
                className="text-xs font-medium px-2 py-1 rounded-full"
                style={{
                  background: evalItem.type === "quantitative" ? "#2563eb22" : "#a21caf22",
                  color: evalItem.type === "quantitative" ? "#2563eb" : "#a21caf"
                }}
              >
                {evalItem.type === "quantitative" ? "定量目標" : "定性目標"}
              </span>
            </div>

            {/* Goal Details */}
            <div className="flex flex-col gap-5 mb-2">
              {/* 手段・手法 Section */}
              {evalItem.methods && (
                <div>
                  <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                    手段・手法
                  </Label>
                  <div className="text-xs text-gray-500 leading-relaxed space-y-0.5 break-words overflow-hidden">
                    {evalItem.methods.split('\n').map((line: string, i: number) => (
                      <div key={i} className="break-words">{line || '\u00A0'}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* 達成基準 Section */}
              {evalItem.achievementCriteria && (
                <div>
                  <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                    達成基準
                  </Label>
                  <div className="text-xs text-gray-500 leading-relaxed space-y-0.5 break-words overflow-hidden">
                    {evalItem.achievementCriteria.split('\n').map((line: string, i: number) => (
                      <div key={i} className="break-words">{line || '\u00A0'}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* 自己評価 Section - Display only */}
              <div>
                <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                  自己評価
                </Label>
                <div className="flex items-center gap-2">
                  <div className="text-base font-bold text-blue-700">
                    {evalItem.ratingCode || '−'}
                  </div>
                </div>
              </div>
            </div>

            {/* Comment Section - Read only */}
            <div className="mt-5">
              <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                自己評価コメント
              </Label>
              <div className="mt-1 text-sm text-gray-700 bg-white rounded-md border border-gray-300 p-3 max-h-[200px] overflow-y-auto whitespace-pre-wrap">
                {evalItem.comment || <span className="text-gray-400">コメントなし</span>}
              </div>
              <div className="flex justify-start items-center mt-1">
                <p className="text-xs text-gray-400">部下による自己評価コメント</p>
              </div>
            </div>
          </div>
        ))}
        </CardContent>
      )}
    </Card>
  );
}
