'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Users, ChevronDown, ChevronUp } from 'lucide-react';
import type { CoreValueDefinition, PeerReviewEvaluation, CoreValueRatingCode } from '@/api/types';
import { CORE_VALUE_RATING_CODES } from '@/api/types/core-value';
import { usePeerReviewAutoSave } from '../hooks/usePeerReviewAutoSave';
import { SaveStatusIndicator } from '@/feature/evaluation/employee/evaluation-input/display/components';
import { PeerReviewStatusBadge } from '../components/PeerReviewStatusBadge';

interface PeerReviewEvaluationFormProps {
  evaluation: PeerReviewEvaluation;
  definitions: CoreValueDefinition[];
  isExpanded: boolean;
  onToggle: () => void;
}

export default function PeerReviewEvaluationForm({
  evaluation,
  definitions,
  isExpanded,
  onToggle,
}: PeerReviewEvaluationFormProps) {
  const [scores, setScores] = useState<Record<string, string>>(
    evaluation.scores ?? {}
  );
  const [comment, setComment] = useState<string>(evaluation.comment ?? '');

  // Sync local state when evaluation prop changes
  useEffect(() => {
    setScores(evaluation.scores ?? {});
    setComment(evaluation.comment ?? '');
  }, [evaluation]);

  // Auto-save hook
  const { saveStatus, debouncedSave, save, isEditable } =
    usePeerReviewAutoSave({
      evaluationId: evaluation.id,
      initialScores: evaluation.scores,
      initialComment: evaluation.comment,
      initialStatus: evaluation.status,
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

  const hasComment = comment.trim().length > 0;

  const revieweeName = evaluation.revieweeName ?? '不明';

  return (
    <Card className="shadow-xl border-0 bg-white">
      <CardHeader className="pb-3 cursor-pointer" onClick={onToggle}>
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-purple-100 text-purple-700">
            <Users className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {revieweeName.slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-lg font-bold tracking-tight">
                    {revieweeName}さんの評価
                  </CardTitle>
                  <p className="text-xs text-gray-500 mt-1">
                    各コアバリューの実践度を評価してください
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <PeerReviewStatusBadge evaluation={evaluation} />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle();
                  }}
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
          {/* Rating Criteria Legend */}
          <div className="sticky top-4 z-10 bg-white pb-4 pt-10 -mt-8 border-b border-gray-200 mb-2">
            <div className="text-xs text-gray-500 space-y-0.5">
              <div className="py-1 px-2">
                <span className="font-semibold">SS</span>
                <span className="mx-1">:</span>
                <span>全スタッフの上位３%以内に位置する。全社へ影響を与える卓越したレベル。</span>
              </div>
              <div className="py-1 px-2">
                <span className="font-semibold">S</span>
                <span className="mx-1">:</span>
                <span>上位10%以内の望ましい行動レベルで、拠点を超えた影響を及ぼしている。</span>
              </div>
              <div className="py-1 px-2">
                <span className="font-semibold">A+</span>
                <span className="mx-1">:</span>
                <span>上位20%以内の良好な行動レベルで、部門を超えた影響を持っている。</span>
              </div>
              <div className="py-1 px-2">
                <span className="font-semibold">A</span>
                <span className="mx-1">:</span>
                <span>上位30%以内であり、部門内でのポジティブな影響が見られる。</span>
              </div>
              <div className="py-1 px-2">
                <span className="font-semibold">A-</span>
                <span className="mx-1">:</span>
                <span>30％〜70%のレンジに位置し、個人レベルでの成果は認められる。自身からの積極的な影響に期待。</span>
              </div>
              <div className="py-1 px-2">
                <span className="font-semibold">B</span>
                <span className="mx-1">:</span>
                <span>下位30%のレベルで、他人からの影響を受けている状態。</span>
              </div>
              <div className="py-1 px-2">
                <span className="font-semibold">C</span>
                <span className="mx-1">:</span>
                <span>下位10%以下に位置し、他人へのマイナスの影響を与えることがあるなど、早急な改善が必要。</span>
              </div>
            </div>
          </div>

          {/* Core Value Definition Cards */}
          {sortedDefinitions.map((definition) => (
            <div
              key={definition.id}
              className="bg-slate-50 border border-slate-200 rounded-2xl shadow-sm px-6 py-5 space-y-4 transition hover:shadow-md"
            >
              <div>
                <div className="text-lg font-bold text-purple-800">
                  {definition.name}
                  {!scores[definition.id] && isEditable && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </div>
                {definition.description && (
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    {definition.description}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  {CORE_VALUE_RATING_CODES.map((rating) => {
                    const isSelected = scores[definition.id] === rating;
                    return (
                      <div
                        key={rating}
                        className={`flex items-center gap-2 ${
                          isEditable
                            ? 'cursor-pointer'
                            : 'cursor-not-allowed opacity-60'
                        }`}
                        onClick={() =>
                          isEditable && handleRatingChange(definition.id, rating)
                        }
                      >
                        <div className="w-6 h-6 rounded-full border-2 border-gray-400 flex items-center justify-center transition-all">
                          {isSelected && (
                            <div className="w-3 h-3 rounded-full bg-gray-800"></div>
                          )}
                        </div>
                        <span className="text-sm text-gray-700">{rating}</span>
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
                コメント {isEditable && !hasComment && <span className="text-red-500">*</span>}
              </Label>
              <SaveStatusIndicator status={saveStatus} />
            </div>
            <Textarea
              value={comment}
              onChange={(e) => handleCommentChange(e.target.value)}
              onBlur={handleCommentBlur}
              placeholder="評価対象者の行動や成果について記入してください..."
              className="mt-1 text-sm rounded-md border-gray-300 focus:ring-2 focus:ring-purple-200 min-h-[100px]"
              maxLength={5000}
              disabled={!isEditable}
            />
            <div className="flex justify-between items-center mt-1">
              <p className="text-xs text-gray-400">
                具体的なエピソードや行動を記載してください
              </p>
              <p className="text-xs text-gray-400">
                {comment.length} / 5000
              </p>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
