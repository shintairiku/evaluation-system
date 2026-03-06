"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Users, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  CoreValueDefinition,
  CoreValueEvaluation,
  CoreValueFeedback,
  CoreValueRatingCode,
} from "@/api/types";
import { useCoreValueEvaluationAutoSave } from "../hooks/useCoreValueEvaluationAutoSave";
import { CoreValueFeedbackAlert } from "./components";
import { CoreValueRatingLegend } from "@/feature/evaluation/shared/core-value/CoreValueRatingLegend";
import { CoreValueCard, CORE_VALUE_THEMES } from "@/feature/evaluation/shared/core-value/CoreValueCard";
import { CoreValueCommentSection } from "@/feature/evaluation/shared/core-value/CoreValueCommentSection";
import { calculateCoreValueRatingAverage, scoreToFinalRating } from "@/utils/rating";

interface CoreValueEvaluateProps {
  definitions: CoreValueDefinition[];
  evaluation: CoreValueEvaluation | null;
  feedback?: CoreValueFeedback | null;
  isLoading?: boolean;
}

export default function CoreValueEvaluate({
  definitions,
  evaluation,
  feedback,
  isLoading = false,
}: CoreValueEvaluateProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Local state for scores and comment
  const [scores, setScores] = useState<Record<string, string>>(
    evaluation?.scores ?? {}
  );
  const [comment, setComment] = useState<string>(evaluation?.comment ?? "");

  // Sync local state when evaluation prop changes (async load / refresh)
  useEffect(() => {
    setScores(evaluation?.scores ?? {});
    setComment(evaluation?.comment ?? "");
  }, [evaluation]);

  // Auto-save hook
  const { saveStatus, debouncedSave, save, isEditable } =
    useCoreValueEvaluationAutoSave({
      evaluationId: evaluation?.id,
      initialScores: evaluation?.scores,
      initialComment: evaluation?.comment,
      initialStatus: evaluation?.status,
    });

  // Handle rating change (toggle - click again to deselect)
  const handleRatingChange = useCallback(
    (definitionId: string, rating: CoreValueRatingCode) => {
      if (!isEditable) return;
      const isDeselecting = scores[definitionId] === rating;
      const newScores = { ...scores };
      if (isDeselecting) {
        delete newScores[definitionId];
      } else {
        newScores[definitionId] = rating;
      }
      setScores(newScores);
      debouncedSave({ scores: newScores, comment });
    },
    [scores, comment, debouncedSave, isEditable]
  );

  // Handle comment change (debounced)
  const handleCommentChange = useCallback(
    (newComment: string) => {
      if (!isEditable) return;
      setComment(newComment);
      debouncedSave({ scores, comment: newComment });
    },
    [scores, debouncedSave, isEditable]
  );

  // Handle comment blur (immediate save)
  const handleCommentBlur = useCallback(() => {
    if (!isEditable) return;
    save({ scores, comment });
  }, [scores, comment, save, isEditable]);

  // Sort definitions by displayOrder
  const sortedDefinitions = [...definitions].sort(
    (a, b) => a.displayOrder - b.displayOrder
  );

  // Calculate overall rating (simple average of all 9 scores)
  const calculateOverallRating = (): string | null => {
    if (definitions.length === 0) return null;
    const allRated = definitions.every((d) => scores[d.id]);
    if (!allRated) return null;

    const ratings = definitions.map(
      (d) => scores[d.id] as CoreValueRatingCode
    );
    const avg = calculateCoreValueRatingAverage(ratings);
    if (avg === null) return null;
    return scoreToFinalRating(avg);
  };

  const overallRating = calculateOverallRating();
  const isSubmitted =
    evaluation?.status && evaluation.status !== "draft";

  return (
    <div className="max-w-3xl mx-auto py-6">
      <Card className="shadow-xl border-0 bg-white">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-purple-100 text-purple-700">
              <Users className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold tracking-tight">
                    コアバリュー評価
                  </CardTitle>
                  <p className="text-xs text-gray-500 mt-1">
                    各コアバリューの実践度を評価してください
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
                              isSubmitted && overallRating ? "text-purple-700" : "text-gray-300"
                            }`}
                          >
                            {isSubmitted ? (overallRating || "−") : "−"}
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p className="text-xs">
                          {isSubmitted
                            ? "提出済みのコアバリュー評価から算出された総合評価です。"
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
                    className="p-2 hover:bg-purple-50"
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
                <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                <span className="ml-2 text-sm text-gray-500">
                  読み込み中...
                </span>
              </div>
            )}

            {/* Empty state */}
            {!isLoading && definitions.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p>コアバリュー定義がありません。</p>
              </div>
            )}

            {!isLoading && definitions.length > 0 && (
              <>
                <CoreValueRatingLegend />

                {sortedDefinitions.map((definition) => (
                  <CoreValueCard
                    key={definition.id}
                    definition={definition}
                    selectedRating={scores[definition.id]}
                    theme={CORE_VALUE_THEMES.employee}
                    onRatingChange={handleRatingChange}
                    isEditable={isEditable}
                    showRequired
                  />
                ))}

                <CoreValueCommentSection
                  comment={comment}
                  onCommentChange={handleCommentChange}
                  onCommentBlur={handleCommentBlur}
                  isEditable={isEditable}
                  saveStatus={saveStatus}
                  label="自己評価コメント"
                  placeholder="コアバリューの実践について記入してください..."
                  hintText="具体的なエピソードや取り組みを記載してください"
                  showRequired
                />

                {/* Supervisor Feedback Section */}
                <CoreValueFeedbackAlert feedback={feedback ?? null} />
              </>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
