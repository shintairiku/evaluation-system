"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
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
} from "@/api/types/common";
import { calculateWeightedRatingAverage, scoreToFinalRating } from "@/utils/rating";
import { useSelfAssessmentAutoSave } from "../hooks/useSelfAssessmentAutoSave";
import { SaveStatusIndicator } from "@/feature/evaluation/shared/SaveStatusIndicator";
import { SupervisorFeedbackAlert } from "./components";

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

    const items = goalsWithAssessments.map((item) => ({
      rating: item.selfAssessment?.selfRatingCode as RatingCode | undefined,
      weight: item.goal.weight || 0,
    }));

    const avg = calculateWeightedRatingAverage(items);
    if (avg === null) return null;

    return scoreToFinalRating(avg);
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
