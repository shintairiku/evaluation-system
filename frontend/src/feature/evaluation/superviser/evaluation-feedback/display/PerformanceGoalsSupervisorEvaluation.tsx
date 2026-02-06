"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { GoalResponse, SelfAssessment, SupervisorFeedback, RatingCode } from "@/api/types";
import { QUANTITATIVE_RATING_CODES, QUALITATIVE_RATING_CODES, RATING_CODE_VALUES } from "@/api/types/common";

// Display data structure for supervisor evaluation
export interface PerformanceGoalSupervisorData {
  id: string;
  goalId: string;
  selfAssessmentId: string;
  feedbackId?: string;
  type: "quantitative" | "qualitative";
  weight: number;
  specificGoal: string;
  achievementCriteria: string;
  methods: string;
  supervisorRatingCode?: RatingCode;
  supervisorComment: string;
}

interface PerformanceGoalsSupervisorEvaluationProps {
  goals?: PerformanceGoalSupervisorData[];
  overallRating?: string;
  isLoading?: boolean;
  onRatingChange?: (goalId: string, ratingCode: RatingCode) => void;
  onCommentChange?: (goalId: string, comment: string) => void;
}

// Transform API data to display format
export function transformPerformanceGoalsForSupervisor(
  goals: GoalResponse[],
  selfAssessments: SelfAssessment[],
  supervisorFeedbacks: SupervisorFeedback[]
): PerformanceGoalSupervisorData[] {
  // Create maps for quick lookup
  const assessmentMap = new Map(selfAssessments.map(sa => [sa.goalId, sa]));
  const feedbackMap = new Map(supervisorFeedbacks.map(fb => [fb.selfAssessmentId, fb]));

  return goals
    .filter(goal => goal.goalCategory === '業績目標' && goal.status === 'approved')
    .map(goal => {
      const assessment = assessmentMap.get(goal.id);
      const feedback = assessment ? feedbackMap.get(assessment.id) : undefined;

      return {
        id: goal.id,
        goalId: goal.id,
        selfAssessmentId: assessment?.id || '',
        feedbackId: feedback?.id,
        type: goal.performanceGoalType || 'qualitative',
        weight: goal.weight,
        specificGoal: goal.specificGoalText || goal.title || '',
        achievementCriteria: goal.achievementCriteriaText || '',
        methods: goal.meansMethodsText || '',
        supervisorRatingCode: feedback?.supervisorRatingCode,
        supervisorComment: feedback?.supervisorComment || '',
      };
    });
}

// Calculate overall rating based on weighted average
export function calculateSupervisorOverallRating(goals: PerformanceGoalSupervisorData[]): string {
  let totalWeight = 0;
  let weightedSum = 0;

  goals.forEach(goal => {
    if (goal.supervisorRatingCode && RATING_CODE_VALUES[goal.supervisorRatingCode] !== undefined) {
      weightedSum += RATING_CODE_VALUES[goal.supervisorRatingCode] * goal.weight;
      totalWeight += goal.weight;
    }
  });

  if (totalWeight === 0) return '−';

  const avgValue = weightedSum / totalWeight;

  if (avgValue >= 6.5) return 'SS';
  if (avgValue >= 5.5) return 'S';
  if (avgValue >= 3.5) return 'A';
  if (avgValue >= 1.5) return 'B';
  if (avgValue >= 0.5) return 'C';
  return 'D';
}

export default function PerformanceGoalsSupervisorEvaluation({
  goals,
  overallRating,
  isLoading = false,
  onRatingChange,
  onCommentChange,
}: PerformanceGoalsSupervisorEvaluationProps) {
  const [localEvaluations, setLocalEvaluations] = useState<PerformanceGoalSupervisorData[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);

  // Sync local state with props
  useEffect(() => {
    if (goals) {
      setLocalEvaluations(goals);
    }
  }, [goals]);

  const displayGoals = localEvaluations;
  const displayOverallRating = overallRating || (displayGoals.length > 0 ? calculateSupervisorOverallRating(displayGoals) : '−');

  const handleRatingChange = useCallback((goalId: string, rating: RatingCode) => {
    setLocalEvaluations(prev => prev.map(item =>
      item.goalId === goalId ? { ...item, supervisorRatingCode: rating } : item
    ));
    onRatingChange?.(goalId, rating);
  }, [onRatingChange]);

  const handleCommentChange = useCallback((goalId: string, comment: string) => {
    setLocalEvaluations(prev => prev.map(item =>
      item.goalId === goalId ? { ...item, supervisorComment: comment } : item
    ));
    onCommentChange?.(goalId, comment);
  }, [onCommentChange]);

  const getRatingsForType = (type: "quantitative" | "qualitative"): RatingCode[] => {
    return type === "quantitative" ? QUANTITATIVE_RATING_CODES : QUALITATIVE_RATING_CODES;
  };

  return (
    <Card className="shadow-xl border-0 bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-green-100 text-green-700">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold tracking-tight">業績目標評価</CardTitle>
                <p className="text-xs text-gray-500 mt-1">上長による評価入力</p>
              </div>

              <div className="flex items-center gap-2">
                {/* Overall Rating Display */}
                <div className="flex items-center gap-2 px-3 py-1 rounded-md border border-gray-200 bg-white">
                  <span className="text-xs text-gray-500">総合評価</span>
                  <div className={`text-xl font-bold ${displayOverallRating !== '−' ? 'text-green-700' : 'text-gray-300'}`}>
                    {displayOverallRating}
                  </div>
                </div>

                {/* Expand/Collapse Button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-2 hover:bg-green-50"
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
        ) : displayGoals.map((evalItem) => {
          const availableRatings = getRatingsForType(evalItem.type);

          return (
            <div
              key={evalItem.id}
              className="bg-green-50 border border-green-200 rounded-2xl shadow-sm px-6 py-5 space-y-5"
            >
              {/* Goal Header */}
              <div className="flex items-center gap-3 mb-2">
                <div className="text-xl font-bold text-green-800 flex-1">{evalItem.specificGoal}</div>
                <Badge className="bg-green-600 text-white text-sm px-3 py-1">
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
                    <div className="text-xs text-gray-500 leading-relaxed space-y-0.5">
                      {evalItem.methods.split('\n').map((line: string, i: number) => (
                        <div key={i}>{line || '\u00A0'}</div>
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
                    <div className="text-xs text-gray-500 leading-relaxed space-y-0.5">
                      {evalItem.achievementCriteria.split('\n').map((line: string, i: number) => (
                        <div key={i}>{line || '\u00A0'}</div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 上長評価 Section with Radio Buttons */}
                <div>
                  <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                    上長評価 {!evalItem.supervisorRatingCode && <span className="text-red-500">*</span>}
                  </Label>

                  {/* Radio button style selectors */}
                  <div className="flex items-center gap-3 flex-wrap">
                    {availableRatings.map((rating) => {
                      const isSelected = evalItem.supervisorRatingCode === rating;
                      return (
                        <div
                          key={rating}
                          className="flex items-center gap-2 cursor-pointer"
                          onClick={() => handleRatingChange(evalItem.goalId, rating)}
                        >
                          <div className="w-6 h-6 rounded-full border-2 border-gray-400 flex items-center justify-center transition-all">
                            {isSelected && <div className="w-3 h-3 rounded-full bg-gray-800"></div>}
                          </div>
                          <span className="text-sm text-gray-700">{rating}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Comment Section */}
              <div className="mt-5">
                <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                  上長評価コメント {evalItem.supervisorComment.trim() === "" && <span className="text-red-500">*</span>}
                </Label>
                <Textarea
                  value={evalItem.supervisorComment}
                  onChange={(e) => handleCommentChange(evalItem.goalId, e.target.value)}
                  placeholder="上長としてのフィードバックを記入してください..."
                  className="mt-1 text-sm rounded-md border-gray-300 focus:ring-2 focus:ring-green-200 min-h-[100px]"
                  maxLength={5000}
                />
                <div className="flex justify-between items-center mt-1">
                  <p className="text-xs text-gray-400">具体的なフィードバックを記載してください</p>
                  <p className="text-xs text-gray-400">{evalItem.supervisorComment.length} / 5000</p>
                </div>
              </div>
            </div>
          );
        })}
        </CardContent>
      )}
    </Card>
  );
}
