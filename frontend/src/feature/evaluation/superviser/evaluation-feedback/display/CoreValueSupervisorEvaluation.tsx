"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Users, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  CoreValueDefinition,
  CoreValueFeedback,
  CoreValueRatingCode,
} from "@/api/types";
import { useCoreValueFeedbackAutoSave } from "../hooks/useCoreValueFeedbackAutoSave";
import { CoreValueRatingLegend } from "@/feature/evaluation/shared/core-value/CoreValueRatingLegend";
import { CoreValueCard, CORE_VALUE_THEMES } from "@/feature/evaluation/shared/core-value/CoreValueCard";
import { CoreValueCommentSection } from "@/feature/evaluation/shared/core-value/CoreValueCommentSection";

interface CoreValueSupervisorEvaluationProps {
  definitions: CoreValueDefinition[];
  feedback: CoreValueFeedback | null;
  isLoading?: boolean;
}

export default function CoreValueSupervisorEvaluation({
  definitions,
  feedback,
  isLoading = false,
}: CoreValueSupervisorEvaluationProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Local state for scores and comment
  const [scores, setScores] = useState<Record<string, string>>(
    feedback?.scores ?? {}
  );
  const [comment, setComment] = useState<string>(feedback?.comment ?? "");

  // Sync local state when feedback prop changes (e.g. after initial load or subordinate switch)
  useEffect(() => {
    setScores(feedback?.scores ?? {});
    setComment(feedback?.comment ?? "");
  }, [feedback]);

  // Auto-save hook
  const { saveStatus, debouncedSave, save, isEditable } =
    useCoreValueFeedbackAutoSave({
      feedbackId: feedback?.id,
      initialScores: feedback?.scores,
      initialComment: feedback?.comment,
      initialStatus: feedback?.status,
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

  return (
    <Card className="shadow-xl border-0 bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-green-100 text-green-700">
            <Users className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold tracking-tight">
                  コアバリュー評価
                </CardTitle>
                <p className="text-xs text-gray-500 mt-1">
                  上長による評価入力
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Overall Rating Display */}
                <div className="flex items-center gap-2 px-3 py-1 rounded-md border border-gray-200 bg-white">
                  <span className="text-xs text-gray-500">総合評価</span>
                  <div className="text-xl font-bold text-gray-300">−</div>
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
          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !feedback && (
            <div className="text-center py-8 text-muted-foreground">
              <p>フィードバックはまだ作成されていません</p>
            </div>
          )}

          {!isLoading && feedback && (
            <>
              <CoreValueRatingLegend />

              {sortedDefinitions.map((definition) => (
                <CoreValueCard
                  key={definition.id}
                  definition={definition}
                  selectedRating={scores[definition.id]}
                  theme={CORE_VALUE_THEMES.supervisor}
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
                label="上長評価コメント"
                placeholder="上長としてのフィードバックを記入してください..."
                hintText="メモ（部下には表示されません）"
                saveStatusTheme="green"
                focusRingColor="focus:ring-green-200"
                showRequired
              />
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
