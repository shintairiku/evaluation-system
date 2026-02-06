"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TrendingUp, ChevronDown, ChevronUp, Loader2, CheckCircle, MessageSquare } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState, useCallback } from "react";
import type { GoalWithAssessment } from "./index";
import type { RatingCode, PerformanceGoalType } from "@/api/types";
import {
  QUANTITATIVE_RATING_CODES,
  QUALITATIVE_RATING_CODES,
  RATING_CODE_VALUES,
} from "@/api/types/common";
import { useSelfAssessmentAutoSave, type SaveStatus } from "../hooks/useSelfAssessmentAutoSave";

interface PerformanceGoalsEvaluateProps {
  goalsWithAssessments: GoalWithAssessment[];
  isLoading?: boolean;
}

/**
 * Individual goal card component with auto-save
 */
function PerformanceGoalCard({
  goalWithAssessment,
}: {
  goalWithAssessment: GoalWithAssessment;
}) {
  const { goal, selfAssessment } = goalWithAssessment;

  // Local state for form values
  const [ratingCode, setRatingCode] = useState<RatingCode | undefined>(
    selfAssessment?.selfRatingCode as RatingCode | undefined
  );
  const [comment, setComment] = useState<string>(selfAssessment?.selfComment || "");

  // Auto-save hook (no parent notification to avoid reload flicker)
  const { saveStatus, debouncedSave, save, isEditable } = useSelfAssessmentAutoSave({
    assessmentId: selfAssessment?.id,
    initialRatingCode: selfAssessment?.selfRatingCode as RatingCode | undefined,
    initialComment: selfAssessment?.selfComment,
    initialStatus: selfAssessment?.status,
  });

  // Determine goal type
  const goalType: PerformanceGoalType = goal.performanceGoalType || "qualitative";
  const isQuantitative = goalType === "quantitative";
  const availableRatings = isQuantitative ? QUANTITATIVE_RATING_CODES : QUALITATIVE_RATING_CODES;

  // Handle rating change
  const handleRatingChange = useCallback((newRating: RatingCode) => {
    if (!isEditable) return;
    setRatingCode(newRating);
    debouncedSave({ selfRatingCode: newRating, selfComment: comment });
  }, [comment, debouncedSave, isEditable]);

  // Handle comment change (debounced)
  const handleCommentChange = useCallback((newComment: string) => {
    if (!isEditable) return;
    setComment(newComment);
    debouncedSave({ selfRatingCode: ratingCode, selfComment: newComment });
  }, [ratingCode, debouncedSave, isEditable]);

  // Handle comment blur (immediate save)
  const handleCommentBlur = useCallback(() => {
    if (!isEditable || !comment.trim()) return;
    save({ selfRatingCode: ratingCode, selfComment: comment });
  }, [ratingCode, comment, save, isEditable]);

  // Get display values
  const title = goal.title || goal.specificGoalText || "目標";
  const methods = goal.meansMethodsText || "";
  const achievementCriteria = goal.achievementCriteriaText || "";
  const weight = goal.weight || 0;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl shadow-sm px-6 py-5 space-y-5 transition hover:shadow-md">
      {/* Goal Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="text-xl font-bold text-blue-800 flex-1">{title}</div>
        <Badge className="bg-blue-600 text-white text-sm px-3 py-1">
          ウエイト {weight}%
        </Badge>
        <span
          className="text-xs font-medium px-2 py-1 rounded-full"
          style={{
            background: isQuantitative ? "#2563eb22" : "#a21caf22",
            color: isQuantitative ? "#2563eb" : "#a21caf",
          }}
        >
          {isQuantitative ? "定量目標" : "定性目標"}
        </span>
      </div>

      {/* Goal Details */}
      <div className="flex flex-col gap-5 mb-2">
        {/* 手段・手法 Section */}
        {methods && (
          <div>
            <Label className="text-sm font-semibold text-gray-700 mb-2 block">
              手段・手法
            </Label>
            <div className="text-xs text-gray-500 leading-relaxed space-y-0.5 break-words overflow-hidden">
              {methods.split("\n").map((line, i) => (
                <div key={i} className="break-words">{line || "\u00A0"}</div>
              ))}
            </div>
          </div>
        )}

        {/* 達成基準 Section */}
        {achievementCriteria && (
          <div>
            <Label className="text-sm font-semibold text-gray-700 mb-2 block">
              達成基準
            </Label>
            <div className="text-xs text-gray-500 leading-relaxed space-y-0.5 break-words overflow-hidden">
              {achievementCriteria.split("\n").map((line, i) => (
                <div key={i} className="break-words">{line || "\u00A0"}</div>
              ))}
            </div>
          </div>
        )}

        {/* 評価 Section with Radio Buttons */}
        <div>
          <Label className="text-sm font-semibold text-gray-700 mb-2 block">
            評価 {!ratingCode && <span className="text-red-500">*</span>}
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
            自己評価コメント {!comment.trim() && <span className="text-red-500">*</span>}
          </Label>
          <SaveStatusIndicator status={saveStatus} />
        </div>
        <Textarea
          value={comment}
          onChange={(e) => handleCommentChange(e.target.value)}
          onBlur={handleCommentBlur}
          placeholder="目標の達成状況や具体的な成果について記入してください..."
          className="mt-1 text-sm rounded-md border-gray-300 focus:ring-2 focus:ring-blue-200 min-h-[100px]"
          maxLength={5000}
          disabled={!isEditable}
        />
        <div className="flex justify-between items-center mt-1">
          <p className="text-xs text-gray-400">具体的な成果や改善点を記載してください</p>
          <p className="text-xs text-gray-400">{comment.length} / 5000</p>
        </div>
      </div>

      {/* Supervisor Feedback Section */}
      <SupervisorFeedbackAlert goalWithAssessment={goalWithAssessment} />
    </div>
  );
}

/**
 * Save status indicator component
 */
function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;

  return (
    <>
      {status === "saving" && (
        <span className="text-xs text-blue-500 flex items-center gap-1 animate-pulse">
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
 * Supervisor feedback alert component
 * Displays feedback from supervisor when status is 'submitted'
 */
function SupervisorFeedbackAlert({ goalWithAssessment }: { goalWithAssessment: GoalWithAssessment }) {
  const { supervisorFeedback } = goalWithAssessment;

  // Only show if feedback exists
  if (!supervisorFeedback) {
    return null;
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const feedbackDate = supervisorFeedback.reviewedAt || supervisorFeedback.submittedAt || supervisorFeedback.updatedAt;

  return (
    <Alert variant="default" className="border-green-200 bg-green-50">
      <CheckCircle className="h-4 w-4 text-green-600" />
      <AlertDescription className="ml-2">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-green-900 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              上司からのフィードバック
            </p>
            <div className="flex items-center gap-3">
              {supervisorFeedback.supervisorRatingCode && (
                <Badge className="bg-green-600 text-white text-xs">
                  評価: {supervisorFeedback.supervisorRatingCode}
                </Badge>
              )}
              {feedbackDate && (
                <p className="text-sm text-green-800">
                  {formatDate(feedbackDate)}
                </p>
              )}
            </div>
          </div>
          {supervisorFeedback.supervisorComment && (
            <div className="bg-white p-3 rounded border border-green-200">
              <p className="text-sm text-gray-800 whitespace-pre-wrap">
                {supervisorFeedback.supervisorComment}
              </p>
            </div>
          )}
          {!supervisorFeedback.supervisorComment && (
            <p className="text-sm text-green-700 italic">
              コメントはありません
            </p>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Main component: Performance Goals Evaluate
 */
export default function PerformanceGoalsEvaluate({
  goalsWithAssessments,
  isLoading = false,
}: PerformanceGoalsEvaluateProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Calculate overall rating based on weighted average
  const calculateOverallRating = (): string | null => {
    if (goalsWithAssessments.length === 0) return null;

    const allCompleted = goalsWithAssessments.every(
      (item) =>
        item.selfAssessment?.selfRatingCode &&
        item.selfAssessment?.selfComment?.trim()
    );

    if (!allCompleted) return null;

    let totalWeightedScore = 0;
    let totalWeight = 0;

    goalsWithAssessments.forEach((item) => {
      const ratingCode = item.selfAssessment?.selfRatingCode as RatingCode | undefined;
      if (ratingCode && item.goal.weight) {
        const value = RATING_CODE_VALUES[ratingCode];
        totalWeightedScore += value * item.goal.weight;
        totalWeight += item.goal.weight;
      }
    });

    const averageScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;

    // Map average score to rating code
    if (averageScore >= 6.5) return "SS";
    if (averageScore >= 5.5) return "S";
    if (averageScore >= 3.5) return "A";
    if (averageScore >= 1.5) return "B";
    if (averageScore >= 0.5) return "C";
    return "D";
  };

  const overallRating = calculateOverallRating();

  // Check if all assessments are submitted (not draft)
  const allSubmitted = goalsWithAssessments.length > 0 &&
    goalsWithAssessments.every((item) =>
      item.selfAssessment?.status && item.selfAssessment.status !== 'draft'
    );

  return (
    <div className="max-w-3xl mx-auto py-6">
      <Card className="shadow-xl border-0 bg-white">
        <CardHeader className="pb-3">
          {/* First Row: Icon, Title, Overall Rating, and Expand Button */}
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-blue-100 text-blue-700">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold tracking-tight">
                    業績目標評価
                  </CardTitle>
                  <p className="text-xs text-gray-500 mt-1">
                    各目標ごとに自己評価を入力してください
                  </p>
                </div>

                {/* Overall Rating Display - Grade only shows after submission */}
                <div className="flex items-center gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2 px-3 py-1 rounded-md border border-gray-200 bg-white cursor-help transition-colors hover:bg-gray-50">
                          <span className="text-xs text-gray-500">総合評価</span>
                          <div
                            className={`text-xl font-bold ${
                              allSubmitted && overallRating ? "text-blue-700" : "text-gray-300"
                            }`}
                          >
                            {allSubmitted ? (overallRating || "−") : "−"}
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p className="text-xs">
                          {allSubmitted
                            ? "提出済みの業績目標評価から算出された総合評価です。"
                            : "※提出後に総合評価が表示されます。"}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

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
            {/* Loading state */}
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                <span className="ml-2 text-sm text-gray-500">読み込み中...</span>
              </div>
            )}

            {/* Empty state */}
            {!isLoading && goalsWithAssessments.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p>承認済みの業績目標がありません。</p>
                <p className="text-sm mt-1">
                  目標が承認されると、ここに自己評価フォームが表示されます。
                </p>
              </div>
            )}

            {/* Goal cards */}
            {!isLoading &&
              goalsWithAssessments.map((item) => (
                <PerformanceGoalCard
                  key={item.goal.id}
                  goalWithAssessment={item}
                />
              ))}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
