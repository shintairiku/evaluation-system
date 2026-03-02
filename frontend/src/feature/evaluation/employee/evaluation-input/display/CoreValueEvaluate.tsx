"use client";

import { useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Users, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, MessageSquare } from "lucide-react";
import type {
  CoreValueDefinition,
  CoreValueEvaluation,
  CoreValueRatingCode,
} from "@/api/types";
import { CORE_VALUE_RATING_CODES } from "@/api/types/core-value";
import { useCoreValueEvaluationAutoSave } from "../hooks/useCoreValueEvaluationAutoSave";
import { SaveStatusIndicator } from "./components";
import { calculateCoreValueRatingAverage, scoreToFinalRating } from "@/utils/rating";

interface CoreValueEvaluateProps {
  definitions: CoreValueDefinition[];
  evaluation: CoreValueEvaluation | null;
  returnComment?: string | null;
  isLoading?: boolean;
}

export default function CoreValueEvaluate({
  definitions,
  evaluation,
  returnComment,
  isLoading = false,
}: CoreValueEvaluateProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Local state for scores and comment
  const [scores, setScores] = useState<Record<string, string>>(
    evaluation?.scores ?? {}
  );
  const [comment, setComment] = useState<string>(evaluation?.comment ?? "");

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
                {/* Rating Criteria Legend */}
                <div className="sticky top-4 z-10 bg-white pb-4 pt-10 -mt-8 border-b border-gray-200 mb-2">
                  <div className="text-xs text-gray-500 space-y-0.5">
                    <div className="py-1 px-2">
                      <span className="font-semibold">SS</span>
                      <span className="mx-1">：</span>
                      <span>全スタッフの上位３%以内に位置する。全社へ影響を与える卓越したレベル。</span>
                    </div>
                    <div className="py-1 px-2">
                      <span className="font-semibold">S</span>
                      <span className="mx-1">：</span>
                      <span>上位10%以内の望ましい行動レベルで、拠点を超えた影響を及ぼしている。</span>
                    </div>
                    <div className="py-1 px-2">
                      <span className="font-semibold">A+</span>
                      <span className="mx-1">：</span>
                      <span>上位20%以内の良好な行動レベルで、部門を超えた影響を持っている。</span>
                    </div>
                    <div className="py-1 px-2">
                      <span className="font-semibold">A</span>
                      <span className="mx-1">：</span>
                      <span>上位30%以内であり、部門内でのポジティブな影響が見られる。</span>
                    </div>
                    <div className="py-1 px-2">
                      <span className="font-semibold">A-</span>
                      <span className="mx-1">：</span>
                      <span>30％〜70%のレンジに位置し、個人レベルでの成果は認められる。自身からの積極的な影響に期待。</span>
                    </div>
                    <div className="py-1 px-2">
                      <span className="font-semibold">B</span>
                      <span className="mx-1">：</span>
                      <span>下位30%のレベルで、他人からの影響を受けている状態。</span>
                    </div>
                    <div className="py-1 px-2">
                      <span className="font-semibold">C</span>
                      <span className="mx-1">：</span>
                      <span>下位10%以下に位置し、他人へのマイナスの影響を与えることがあるなど、早急な改善が必要。</span>
                    </div>
                  </div>
                </div>

                {/* Return comment alert */}
                {returnComment && (
                  <Alert
                    variant="default"
                    className="border-red-200 bg-red-50"
                  >
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="ml-2">
                      <div className="space-y-2">
                        <p className="font-semibold text-red-900 flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" />
                          上司からのフィードバック（差し戻し）
                        </p>
                        <div className="bg-white p-3 rounded border border-red-200">
                          <p className="text-sm text-gray-800 whitespace-pre-wrap">
                            {returnComment}
                          </p>
                        </div>
                        <p className="text-sm text-red-700 font-medium">
                          修正して再度提出してください。
                        </p>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Core value definition cards */}
                {sortedDefinitions.map((definition) => (
                  <div
                    key={definition.id}
                    className="bg-slate-50 border border-slate-200 rounded-2xl shadow-sm px-6 py-5 space-y-4 transition hover:shadow-md"
                  >
                    {/* Definition Header */}
                    <div>
                      <div className="text-lg font-bold text-purple-800">
                        {definition.name}
                      </div>
                      {definition.description && (
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                          {definition.description}
                        </p>
                      )}
                    </div>

                    {/* Rating Section */}
                    <div>
                      <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                        評価{" "}
                        {!scores[definition.id] && (
                          <span className="text-red-500">*</span>
                        )}
                      </Label>

                      <div className="flex items-center gap-3 flex-wrap">
                        {CORE_VALUE_RATING_CODES.map((rating) => {
                          const isSelected =
                            scores[definition.id] === rating;
                          return (
                            <div
                              key={rating}
                              className={`flex items-center gap-2 ${
                                isEditable
                                  ? "cursor-pointer"
                                  : "cursor-not-allowed opacity-60"
                              }`}
                              onClick={() =>
                                isEditable &&
                                handleRatingChange(definition.id, rating)
                              }
                            >
                              <div className="w-6 h-6 rounded-full border-2 border-gray-400 flex items-center justify-center transition-all">
                                {isSelected && (
                                  <div className="w-3 h-3 rounded-full bg-gray-800"></div>
                                )}
                              </div>
                              <span className="text-sm text-gray-700">
                                {rating}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Comment Section */}
                <div className="mt-5">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-semibold text-gray-700">
                      自己評価コメント
                    </Label>
                    <SaveStatusIndicator status={saveStatus} />
                  </div>
                  <Textarea
                    value={comment}
                    onChange={(e) => handleCommentChange(e.target.value)}
                    onBlur={handleCommentBlur}
                    placeholder="コアバリューの実践について記入してください..."
                    className="mt-1 text-sm rounded-md border-gray-300 focus:ring-2 focus:ring-purple-200 min-h-[100px]"
                    maxLength={5000}
                    disabled={!isEditable}
                  />
                  <div className="flex justify-between items-center mt-1">
                    <p className="text-xs text-gray-400">
                      具体的なエピソードや取り組みを記載してください
                    </p>
                    <p className="text-xs text-gray-400">
                      {comment.length} / 5000
                    </p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
