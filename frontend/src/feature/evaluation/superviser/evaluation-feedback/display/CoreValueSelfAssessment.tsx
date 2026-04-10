"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Users, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  CoreValueDefinition,
  CoreValueEvaluation,
  CoreValueRatingCode,
} from "@/api/types";
import { CoreValueRatingLegend } from "@/feature/evaluation/shared/core-value/CoreValueRatingLegend";
import { CoreValueCard, CORE_VALUE_THEMES } from "@/feature/evaluation/shared/core-value/CoreValueCard";
import { calculateCoreValueRatingAverage, scoreToFinalRating } from "@/utils/rating";

interface CoreValueSelfAssessmentProps {
  definitions: CoreValueDefinition[];
  evaluation: CoreValueEvaluation | null;
  isLoading?: boolean;
}

export default function CoreValueSelfAssessment({
  definitions,
  evaluation,
  isLoading = false,
}: CoreValueSelfAssessmentProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const scores = evaluation?.scores ?? {};
  const comment = evaluation?.comment ?? "";

  // Sort definitions by displayOrder
  const sortedDefinitions = [...definitions].sort(
    (a, b) => a.displayOrder - b.displayOrder
  );

  // Calculate overall rating from employee's scores
  const calculateOverallRating = (): string => {
    if (definitions.length === 0 || !evaluation?.scores) return "−";
    const allRated = definitions.every((d) => evaluation.scores?.[d.id]);
    if (!allRated) return "−";

    const ratings = definitions.map(
      (d) => evaluation.scores![d.id] as CoreValueRatingCode
    );
    const avg = calculateCoreValueRatingAverage(ratings);
    if (avg === null) return "−";
    return scoreToFinalRating(avg);
  };

  const displayOverallRating = calculateOverallRating();

  return (
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
                  部下の自己評価（読み取り専用）
                </p>
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
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !evaluation && (
            <div className="text-center py-8 text-muted-foreground">
              <p>自己評価はまだありません</p>
            </div>
          )}

          {!isLoading && evaluation && (
            <>
              <CoreValueRatingLegend />

              {sortedDefinitions.map((definition) => (
                <CoreValueCard
                  key={definition.id}
                  definition={definition}
                  selectedRating={scores[definition.id]}
                  theme={CORE_VALUE_THEMES.employee}
                  showUnratedBadge
                />
              ))}

              {/* Comment (read-only) */}
              <div className="mt-6">
                <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                  自己評価コメント
                </Label>
                <div className="mt-1 text-sm text-gray-700 bg-white rounded-md border border-gray-300 p-3 h-[200px] overflow-y-auto whitespace-pre-wrap">
                  {comment.trim() || <span className="text-gray-400">コメントなし</span>}
                </div>
                <div className="flex justify-start items-center mt-1">
                  <p className="text-xs text-gray-400">部下による自己評価コメント</p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
