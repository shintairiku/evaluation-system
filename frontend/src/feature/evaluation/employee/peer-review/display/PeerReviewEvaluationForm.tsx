'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Users, ChevronDown, ChevronUp } from 'lucide-react';
import type { CoreValueDefinition, PeerReviewEvaluation, CoreValueRatingCode } from '@/api/types';
import { usePeerReviewAutoSave } from '../hooks/usePeerReviewAutoSave';
import { CoreValueRatingLegend } from '@/feature/evaluation/shared/core-value/CoreValueRatingLegend';
import { CoreValueCard, CORE_VALUE_THEMES } from '@/feature/evaluation/shared/core-value/CoreValueCard';
import { CoreValueCommentSection } from '@/feature/evaluation/shared/core-value/CoreValueCommentSection';
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
            label="コメント"
            placeholder="評価対象者の行動や成果について記入してください..."
            hintText="具体的なエピソードや行動を記載してください"
            showRequired
          />
        </CardContent>
      )}
    </Card>
  );
}
