"use client";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Target, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { GoalResponse, SelfAssessment as APISelfAssessment, RatingCode, CompetencyRatingData } from "@/api/types";
import { QUALITATIVE_RATING_CODES, RATING_CODE_VALUES } from "@/api/types/common";

// Display data structure for competency action item
export interface CompetencyActionDisplayItem {
  id: string;
  description: string;
  rating?: RatingCode;
}

// Display data structure for a competency with its actions
export interface CompetencyDisplayData {
  competencyId: string;
  goalId: string;
  name: string;
  items: CompetencyActionDisplayItem[];
  comment: string;
  competencyRating?: string;
  isLastInGoal: boolean;
}

interface CompetencySelfAssessmentProps {
  competencies?: CompetencyDisplayData[];
  overallRating?: string;
  isLoading?: boolean;
}

// Helper function to transform API data to display format
export function transformCompetencyGoalsForDisplay(
  goals: GoalResponse[],
  selfAssessments: APISelfAssessment[]
): CompetencyDisplayData[] {
  // Create a map of goalId -> selfAssessment for quick lookup
  const assessmentMap = new Map(selfAssessments.map(sa => [sa.goalId, sa]));

  const competencyGoals = goals.filter(
    goal => goal.goalCategory === 'コンピテンシー' && goal.status === 'approved'
  );

  const result: CompetencyDisplayData[] = [];

  for (const goal of competencyGoals) {
    const assessment = assessmentMap.get(goal.id);
    const ratingData: CompetencyRatingData = assessment?.ratingData || {};

    // Get competency IDs and names from the goal
    const competencyIds = goal.competencyIds || [];
    const competencyNames = goal.competencyNames || {};
    const idealActionTexts = goal.idealActionTexts || {};
    const selectedIdealActions = goal.selectedIdealActions || {};

    for (let i = 0; i < competencyIds.length; i++) {
      const competencyId = competencyIds[i];
      const competencyName = competencyNames[competencyId] || `コンピテンシー`;
      const actionTexts = idealActionTexts[competencyId] || [];
      const selectedActions = selectedIdealActions[competencyId] || [];
      const competencyRatings = ratingData[competencyId] || {};

      // Build items from selected ideal actions
      const items: CompetencyActionDisplayItem[] = selectedActions.map((actionIndex) => {
        const actionIdxStr = actionIndex.toString();
        const actionIdxNum = parseInt(actionIndex, 10);
        return {
          id: `${competencyId}-${actionIndex}`,
          description: actionTexts[actionIdxNum] || `アクション ${parseInt(actionIndex) + 1}`,
          rating: competencyRatings[actionIdxStr] as RatingCode | undefined,
        };
      });

      // Calculate average rating for this competency
      const competencyRating = calculateAverageRating(items.map(i => i.rating).filter(Boolean) as RatingCode[]);

      result.push({
        competencyId,
        goalId: goal.id,
        name: competencyName,
        items,
        comment: assessment?.selfComment || '',
        competencyRating,
        isLastInGoal: i === competencyIds.length - 1,
      });
    }
  }

  return result;
}

// Calculate average rating from a list of competency ratings (5-level scale: SS, S, A, B, C)
function calculateAverageRating(ratings: RatingCode[]): string {
  if (ratings.length === 0) return '−';

  let sum = 0;
  let count = 0;

  for (const rating of ratings) {
    if (RATING_CODE_VALUES[rating] !== undefined) {
      sum += RATING_CODE_VALUES[rating];
      count++;
    }
  }

  if (count === 0) return '−';

  const avg = sum / count;

  // Map to rating code (5-level scale)
  if (avg >= 6.5) return 'SS';
  if (avg >= 5.5) return 'S';
  if (avg >= 3.5) return 'A';
  if (avg >= 1.5) return 'B';
  return 'C';
}

// Calculate overall competency rating
export function calculateCompetencyOverallRating(competencies: CompetencyDisplayData[]): string {
  const allRatings = competencies.flatMap(c =>
    c.items.map(i => i.rating).filter(Boolean) as RatingCode[]
  );
  return calculateAverageRating(allRatings);
}

export default function CompetencySelfAssessment({
  competencies,
  overallRating,
  isLoading = false,
}: CompetencySelfAssessmentProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Use provided data or show empty state
  const displayCompetencies = competencies || [];
  const displayOverallRating = overallRating || (displayCompetencies.length > 0 ? calculateCompetencyOverallRating(displayCompetencies) : '−');

  return (
    <Card className="shadow-xl border-0 bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-green-100 text-green-700">
            <Target className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold tracking-tight">コンピテンシー評価</CardTitle>
                <p className="text-xs text-gray-500 mt-1">自己評価（参照のみ）</p>
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
        ) : displayCompetencies.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>コンピテンシー目標がありません</p>
          </div>
        ) : (
          <>
            {/* Rating Criteria Descriptions - Two Column Layout with Sticky Position */}
            <div className="sticky top-4 z-10 bg-white pb-4 pt-10 -mt-8 border-b border-gray-200 mb-2">
              <div className="grid grid-cols-[auto_1fr] gap-16">
                {/* Left Column: Rating descriptions */}
                <div className="text-xs text-gray-500 space-y-0.5">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-help hover:bg-gray-50 py-1 px-2 rounded transition-colors">
                        <span className="font-semibold">SS</span>
                        <span className="mx-1">：</span>
                        <span>全社でも圧倒的なレベルで体現できている</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={10} className="max-w-sm">
                      <p className="text-xs">社内でもごく少数のレベルに達しており、あらゆる状況下で圧倒的に高い水準でスキルを発揮し、全社から高い信頼を得ると共に大きな影響力を与えている。</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-help hover:bg-gray-50 py-1 px-2 rounded transition-colors">
                        <span className="font-semibold">S</span>
                        <span className="mx-1">：</span>
                        <span>全社的な模範人材として常に体現できている</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={10} className="max-w-sm">
                      <p className="text-xs">高いレベルで一貫してスキルを発揮しており、他者の模範として難易度の高い場面でも安定して体現できている。</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-help hover:bg-gray-50 py-1 px-2 rounded transition-colors">
                        <span className="font-semibold">A+</span>
                        <span className="mx-1">：</span>
                        <span>周囲の手本となっている</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={10} className="max-w-sm">
                      <p className="text-xs">チーム内外から信頼されるレベルの安定したスキルを常に発揮しており、手本となる場面が多いと周囲からも認識されている。</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-help hover:bg-gray-50 py-1 px-2 rounded transition-colors">
                        <span className="font-semibold">A</span>
                        <span className="mx-1">：</span>
                        <span>十分に身についている</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={10} className="max-w-sm">
                      <p className="text-xs">どのような場面や状況においても自立してスキルを実践できており、常に安定して日常業務の中で発揮できている。</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-help hover:bg-gray-50 py-1 px-2 rounded transition-colors">
                        <span className="font-semibold">A-</span>
                        <span className="mx-1">：</span>
                        <span>おおむね身についている</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={10} className="max-w-sm">
                      <p className="text-xs">おおむねスキルは身についているが、場面や状況によって再現性にばらつきがあり、安定性に一部課題が見られる。</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-help hover:bg-gray-50 py-1 px-2 rounded transition-colors">
                        <span className="font-semibold">B</span>
                        <span className="mx-1">：</span>
                        <span>もうひと頑張り</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={10} className="max-w-sm">
                      <p className="text-xs">スキルの基礎的な行動や姿勢は一部に見られるが、実務においてまだ安定して発揮されておらず、意識的な取り組みやフィードバックを通じた成長が求められる状態。</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-help hover:bg-gray-50 py-1 px-2 rounded transition-colors">
                        <span className="font-semibold">C</span>
                        <span className="mx-1">：</span>
                        <span>不十分</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={10} className="max-w-sm">
                      <p className="text-xs">スキルの発揮が不十分であり、職務やチームへの影響が懸念される状態。本人の自覚と明確な改善行動が求められる。</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

                {/* Right Column: Empty space for tooltips */}
                <div></div>
              </div>
            </div>

            {/* Group competencies by goalId and render with comment outside cards */}
            {(() => {
              // Group competencies by goalId
              const groupedByGoal = displayCompetencies.reduce((acc, comp) => {
                if (!acc[comp.goalId]) {
                  acc[comp.goalId] = [];
                }
                acc[comp.goalId].push(comp);
                return acc;
              }, {} as Record<string, CompetencyDisplayData[]>);

              return Object.entries(groupedByGoal).map(([goalId, competencies]) => (
                <div key={goalId} className="space-y-5">
                  {/* Competency cards */}
                  {competencies.map((competency) => (
                    <div key={competency.competencyId} className="bg-slate-50 border border-slate-200 rounded-2xl shadow-sm px-6 py-5 space-y-5">
                      {/* Competency Header with Rating */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="text-xl font-bold text-green-800 break-words overflow-hidden flex-1 mr-3">
                          {competency.name}
                        </div>

                        {/* Individual Competency Rating Display */}
                        <div className="flex items-center gap-2 px-3 py-1 rounded-md border border-gray-200 bg-white">
                          <span className="text-xs text-gray-500">評価</span>
                          <div className="text-xl font-bold text-blue-700">
                            {competency.competencyRating || '−'}
                          </div>
                        </div>
                      </div>

                      {/* Competency Items - Read only */}
                      <div className="space-y-4">
                        {competency.items.map((item) => (
                          <div key={item.id} className="bg-white rounded-lg p-4 border border-gray-200 min-h-[90px]">
                            <div className="flex flex-col gap-2">
                              <p className="text-sm text-gray-700 break-words overflow-hidden">{item.description}</p>

                              {/* Rating Display - Read only with visual feedback */}
                              <div className="flex items-center gap-3 flex-wrap">
                                {QUALITATIVE_RATING_CODES.map((rating) => {
                                  const isSelected = item.rating === rating;
                                  return (
                                    <div
                                      key={rating}
                                      className="flex items-center gap-2"
                                    >
                                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                        isSelected
                                          ? 'border-blue-600 bg-blue-50'
                                          : 'border-gray-300'
                                      }`}>
                                        {isSelected && <div className="w-3 h-3 rounded-full bg-blue-600"></div>}
                                      </div>
                                      <span className={`text-sm ${
                                        isSelected
                                          ? 'text-blue-700 font-semibold'
                                          : 'text-gray-400'
                                      }`}>{rating}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Comment Section - Read only, outside the cards */}
                  <div className="mt-6">
                    <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                      自己評価コメント
                    </Label>
                    <div className="mt-1 text-sm text-gray-700 bg-white rounded-md border border-gray-300 p-3 min-h-[100px]">
                      {competencies[0]?.comment || <span className="text-gray-400">コメントなし</span>}
                    </div>
                    <div className="flex justify-start items-center mt-1">
                      <p className="text-xs text-gray-400">部下による自己評価コメント</p>
                    </div>
                  </div>
                </div>
              ));
            })()}
          </>
        )}
        </CardContent>
      )}
    </Card>
  );
}
