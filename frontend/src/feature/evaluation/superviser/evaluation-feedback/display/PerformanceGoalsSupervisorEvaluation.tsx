"use client";
import { useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { GoalResponse, SelfAssessment, SupervisorFeedback, RatingCode } from "@/api/types";
import { QUANTITATIVE_RATING_CODES, QUALITATIVE_RATING_CODES } from "@/api/types/common";
import { useSupervisorFeedbackAutoSave, type SaveStatus } from "../hooks/useSupervisorFeedbackAutoSave";

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

// NOTE: Overall rating is not shown during supervisor evaluation.
// Rating will only be displayed after all self-assessments are approved,
// and will be based on the subordinate's self-rating, not the supervisor's.
// This function is kept for backward compatibility but always returns '−'.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function calculateSupervisorOverallRating(goals: PerformanceGoalSupervisorData[]): string {
  // Always return '−' during evaluation - rating is shown after approval
  return '−';
}

/**
 * Save status indicator component
 */
function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;

  return (
    <>
      {status === "saving" && (
        <span className="text-xs text-green-500 flex items-center gap-1 animate-pulse">
          <Loader2 className="h-3 w-3 animate-spin" />
          保存中...
        </span>
      )}
      {status === "saved" && (
        <span className="text-xs text-green-600 flex items-center gap-1">
          ✓ 一時保存済み
        </span>
      )}
      {status === "error" && (
        <span className="text-xs text-red-500 flex items-center gap-1">
          ⚠ 保存失敗
        </span>
      )}
    </>
  );
}

/**
 * Individual goal card component with auto-save
 */
function PerformanceGoalSupervisorCard({
  goal,
}: {
  goal: PerformanceGoalSupervisorData;
}) {
  // Local state for form values
  const [ratingCode, setRatingCode] = useState<RatingCode | undefined>(
    goal.supervisorRatingCode
  );
  const [comment, setComment] = useState<string>(goal.supervisorComment || "");

  // Auto-save hook
  const { saveStatus, debouncedSave, save, isEditable } = useSupervisorFeedbackAutoSave({
    feedbackId: goal.feedbackId,
    initialRatingCode: goal.supervisorRatingCode,
    initialComment: goal.supervisorComment,
  });

  // Determine goal type
  const isQuantitative = goal.type === "quantitative";
  const availableRatings = isQuantitative ? QUANTITATIVE_RATING_CODES : QUALITATIVE_RATING_CODES;

  // Handle rating change (toggle - click again to deselect)
  const handleRatingChange = useCallback((newRating: RatingCode) => {
    if (!isEditable) return;
    // If clicking the same rating, deselect it (send undefined to clear in DB)
    const isDeselecting = ratingCode === newRating;
    const updatedRating = isDeselecting ? undefined : newRating;
    setRatingCode(updatedRating);
    debouncedSave({
      supervisorRatingCode: updatedRating,
      supervisorComment: comment
    });
  }, [ratingCode, comment, debouncedSave, isEditable]);

  // Handle comment change (debounced)
  const handleCommentChange = useCallback((newComment: string) => {
    if (!isEditable) return;
    setComment(newComment);
    debouncedSave({ supervisorRatingCode: ratingCode, supervisorComment: newComment });
  }, [ratingCode, debouncedSave, isEditable]);

  // Handle comment blur (immediate save)
  const handleCommentBlur = useCallback(() => {
    if (!isEditable) return;
    save({ supervisorRatingCode: ratingCode, supervisorComment: comment });
  }, [ratingCode, comment, save, isEditable]);

  return (
    <div className="bg-green-50 border border-green-200 rounded-2xl shadow-sm px-6 py-5 space-y-5">
      {/* Goal Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="text-xl font-bold text-green-800 flex-1 break-words overflow-hidden">{goal.specificGoal}</div>
        <Badge className="bg-green-600 text-white text-sm px-3 py-1">
          ウエイト {goal.weight}%
        </Badge>
        <span
          className="text-xs font-medium px-2 py-1 rounded-full"
          style={{
            background: isQuantitative ? "#2563eb22" : "#a21caf22",
            color: isQuantitative ? "#2563eb" : "#a21caf"
          }}
        >
          {isQuantitative ? "定量目標" : "定性目標"}
        </span>
      </div>

      {/* Goal Details */}
      <div className="flex flex-col gap-5 mb-2">
        {/* 手段・手法 Section */}
        {goal.methods && (
          <div>
            <Label className="text-sm font-semibold text-gray-700 mb-2 block">
              手段・手法
            </Label>
            <div className="text-xs text-gray-500 leading-relaxed space-y-0.5 break-words overflow-hidden">
              {goal.methods.split('\n').map((line: string, i: number) => (
                <div key={i} className="break-words">{line || '\u00A0'}</div>
              ))}
            </div>
          </div>
        )}

        {/* 達成基準 Section */}
        {goal.achievementCriteria && (
          <div>
            <Label className="text-sm font-semibold text-gray-700 mb-2 block">
              達成基準
            </Label>
            <div className="text-xs text-gray-500 leading-relaxed space-y-0.5 break-words overflow-hidden">
              {goal.achievementCriteria.split('\n').map((line: string, i: number) => (
                <div key={i} className="break-words">{line || '\u00A0'}</div>
              ))}
            </div>
          </div>
        )}

        {/* 上長評価 Section with Radio Buttons */}
        <div>
          <Label className="text-sm font-semibold text-gray-700 mb-2 block">
            上長評価
          </Label>

          {/* Radio button style selectors */}
          <div className="flex items-center gap-3 flex-wrap">
            {availableRatings.map((rating) => {
              const isSelected = ratingCode === rating;
              return (
                <div
                  key={rating}
                  className={`flex items-center gap-2 ${isEditable ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
                  onClick={() => isEditable && handleRatingChange(rating)}
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
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-semibold text-gray-700">
            上長評価コメント
          </Label>
          <SaveStatusIndicator status={saveStatus} />
        </div>
        <Textarea
          value={comment}
          onChange={(e) => handleCommentChange(e.target.value)}
          onBlur={handleCommentBlur}
          placeholder="上長としてのフィードバックを記入してください..."
          className="mt-1 text-sm rounded-md border-gray-300 focus:ring-2 focus:ring-green-200 min-h-[100px]"
          maxLength={5000}
          disabled={!isEditable}
        />
        <div className="flex justify-between items-center mt-1">
          <p className="text-xs text-gray-400">具体的なフィードバックを記載してください</p>
          <p className="text-xs text-gray-400">{comment.length} / 5000</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Main component: Performance Goals Supervisor Evaluation
 */
export default function PerformanceGoalsSupervisorEvaluation({
  goals,
  overallRating,
  isLoading = false,
}: PerformanceGoalsSupervisorEvaluationProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const displayGoals = goals || [];
  const displayOverallRating = overallRating || (displayGoals.length > 0 ? calculateSupervisorOverallRating(displayGoals) : '−');

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
        ) : (
          displayGoals.map((goal) => (
            <PerformanceGoalSupervisorCard
              key={goal.id}
              goal={goal}
            />
          ))
        )}
        </CardContent>
      )}
    </Card>
  );
}
