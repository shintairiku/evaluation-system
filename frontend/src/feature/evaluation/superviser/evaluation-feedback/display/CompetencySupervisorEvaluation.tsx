"use client";
import { useState, useCallback, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Target, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { GoalResponse, SelfAssessment, SupervisorFeedback, RatingCode, CompetencyRatingData, SupervisorFeedbackStatus } from "@/api/types";
import { COMPETENCY_RATING_CODES } from "@/api/types/common";
import { calculateAverageRatingCode, calculateRatingAverage, scoreToFinalRating } from "@/utils/rating";
import { useSupervisorFeedbackAutoSave, type SaveStatus } from "../hooks/useSupervisorFeedbackAutoSave";

// Display data structure for competency action item
export interface CompetencyActionSupervisorItem {
  id: string;
  actionIndex: string;
  description: string;
  rating?: RatingCode;
}

// Display data structure for a competency with its actions for supervisor
export interface CompetencySupervisorData {
  competencyId: string;
  goalId: string;
  goalWeight: number;
  goalSupervisorRating?: number;
  selfAssessmentId: string;
  feedbackId?: string;
  feedbackStatus?: SupervisorFeedbackStatus;
  name: string;
  items: CompetencyActionSupervisorItem[];
  supervisorComment: string;
  competencyRating?: string;
  // Local state for ratings
  ratingData: CompetencyRatingData;
  isLastInGoal: boolean;
  isFocused: boolean;
}

interface CompetencySupervisorEvaluationProps {
  competencies?: CompetencySupervisorData[];
  overallRating?: string;
  isLoading?: boolean;
}

// Transform API data to display format for supervisor
export function transformCompetencyGoalsForSupervisor(
  goals: GoalResponse[],
  selfAssessments: SelfAssessment[],
  supervisorFeedbacks: SupervisorFeedback[]
): CompetencySupervisorData[] {
  // Create maps for quick lookup
  const assessmentMap = new Map(selfAssessments.map(sa => [sa.goalId, sa]));
  const feedbackMap = new Map(supervisorFeedbacks.map(fb => [fb.selfAssessmentId, fb]));

  const competencyGoals = goals.filter(
    goal => goal.goalCategory === 'コンピテンシー' && goal.status === 'approved'
  );

  const result: CompetencySupervisorData[] = [];

  for (const goal of competencyGoals) {
    const assessment = assessmentMap.get(goal.id);
    const feedback = assessment ? feedbackMap.get(assessment.id) : undefined;

    // Use allStage* fields (all competencies from employee's stage) with fallback
    const competencyIds = goal.allStageCompetencyIds || goal.competencyIds || [];
    const competencyNames = goal.allStageCompetencyNames || goal.competencyNames || {};
    const allActionTexts = goal.allStageIdealActionTexts || {};
    const selectedIdealActions = goal.selectedIdealActions || {};

    // Use supervisor's rating data if exists, otherwise empty
    const supervisorRatingData: CompetencyRatingData = (feedback as unknown as { ratingData?: CompetencyRatingData })?.ratingData || {};

    for (let i = 0; i < competencyIds.length; i++) {
      const competencyId = competencyIds[i];
      const competencyName = competencyNames[competencyId] || `コンピテンシー`;
      const compActionTexts = allActionTexts[competencyId] || {};
      const actionIndexes = Object.keys(compActionTexts);
      const isFocused = competencyId in selectedIdealActions;
      const competencyRatings = supervisorRatingData[competencyId] || {};

      // Build items from all actions (dynamic keys per competency)
      const items: CompetencyActionSupervisorItem[] = actionIndexes.map((actionIdx) => ({
        id: `${competencyId}-${actionIdx}`,
        actionIndex: actionIdx,
        description: compActionTexts[actionIdx] || `アクション ${parseInt(actionIdx) + 1}`,
        rating: competencyRatings[actionIdx] as RatingCode | undefined,
      }));

      // Calculate average rating for this competency
      const competencyRating = calculateAverageRatingCode(items.map(i => i.rating).filter(Boolean) as RatingCode[]);

      result.push({
        competencyId,
        goalId: goal.id,
        goalWeight: goal.weight,
        goalSupervisorRating: feedback?.supervisorRating,
        selfAssessmentId: assessment?.id || '',
        feedbackId: feedback?.id,
        feedbackStatus: feedback?.status,
        name: competencyName,
        items,
        supervisorComment: feedback?.supervisorComment || '',
        competencyRating,
        ratingData: { [competencyId]: competencyRatings },
        isLastInGoal: i === competencyIds.length - 1,
        isFocused,
      });
    }
  }

  return result;
}

export function calculateCompetencySupervisorOverallRating(competencies: CompetencySupervisorData[]): string {
  const goals = new Map<string, { weight: number; goalScore?: number; ratings: RatingCode[] }>();

  for (const competency of competencies) {
    const existing = goals.get(competency.goalId);
    if (!existing) {
      goals.set(competency.goalId, {
        weight: competency.goalWeight || 0,
        goalScore:
          typeof competency.goalSupervisorRating === "number" && Number.isFinite(competency.goalSupervisorRating)
            ? competency.goalSupervisorRating
            : undefined,
        ratings: [],
      });
    } else if (existing.goalScore === undefined) {
      if (
        typeof competency.goalSupervisorRating === "number" &&
        Number.isFinite(competency.goalSupervisorRating)
      ) {
        existing.goalScore = competency.goalSupervisorRating;
      }
    }

    const goal = goals.get(competency.goalId);
    if (!goal) continue;
    const actionRatings = competency.ratingData[competency.competencyId];
    if (!actionRatings) continue;
    Object.values(actionRatings).forEach((rating) => {
      if (rating) {
        goal.ratings.push(rating as RatingCode);
      }
    });
  }

  let totalWeight = 0;
  let weightedSum = 0;
  for (const goal of goals.values()) {
    if (!goal.weight || goal.weight <= 0) continue;
    const goalScore = goal.goalScore ?? calculateRatingAverage(goal.ratings);
    if (goalScore === null || goalScore === undefined) continue;
    weightedSum += goalScore * goal.weight;
    totalWeight += goal.weight;
  }

  if (totalWeight === 0) return "−";
  return scoreToFinalRating(weightedSum / totalWeight);
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
 * Individual competency card component (ratings only, no comment)
 */
function CompetencyItemCard({
  competency,
  onRatingChange,
  isEditable,
}: {
  competency: CompetencySupervisorData;
  onRatingChange: (competencyId: string, actionIndex: string, rating: RatingCode | undefined) => void;
  isEditable: boolean;
}) {
  const [items, setItems] = useState(competency.items);
  const competencyRating = useMemo(
    () => calculateAverageRatingCode(items.map(i => i.rating).filter(Boolean) as RatingCode[]),
    [items]
  );

  useEffect(() => {
    setItems(competency.items);
  }, [competency.items]);

  // Handle rating change (toggle - click again to deselect)
  const handleRatingChange = useCallback((actionIndex: string, rating: RatingCode) => {
    if (!isEditable) return;
    // Find current item and check if clicking same rating
    const currentItem = items.find(item => item.actionIndex === actionIndex);
    const updatedRating = currentItem?.rating === rating ? undefined : rating;

    const newItems = items.map(item =>
      item.actionIndex === actionIndex ? { ...item, rating: updatedRating } : item
    );
    setItems(newItems);
    onRatingChange(competency.competencyId, actionIndex, updatedRating);
  }, [items, competency.competencyId, onRatingChange, isEditable]);

  return (
    <div className="bg-green-50 border border-green-200 rounded-2xl shadow-sm px-6 py-5 space-y-5">
      {/* Competency Header with Rating */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 flex-1 mr-3">
          <div className="text-xl font-bold text-green-800 break-words overflow-hidden">
            {competency.name}
          </div>
          {competency.isFocused && (
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700 border border-green-200 shrink-0">
              注力
            </span>
          )}
        </div>

        {/* Individual Competency Rating Display */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-md border border-gray-200 bg-white">
          <span className="text-xs text-gray-500">評価</span>
          <div className={`text-xl font-bold ${competencyRating !== '−' ? 'text-green-700' : 'text-gray-300'}`}>
            {competencyRating}
          </div>
        </div>
      </div>

      {/* Competency Items - Editable */}
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className="bg-white rounded-lg p-4 border border-gray-200 min-h-[90px]">
            <div className="flex flex-col gap-2">
              <p className="text-sm text-gray-700 break-words overflow-hidden whitespace-pre-wrap">{item.description}</p>

              {/* Rating Selector */}
              <div className="flex items-center gap-3 flex-wrap">
                {COMPETENCY_RATING_CODES.map((rating) => {
                  const isSelected = item.rating === rating;
                  return (
                    <div
                      key={rating}
                      className={`flex items-center gap-2 ${isEditable ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
                      onClick={() => isEditable && handleRatingChange(item.actionIndex, rating)}
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
        ))}
      </div>
    </div>
  );
}

/**
 * Goal group component - groups competencies and handles comment
 */
function CompetencyGoalGroup({
  competencies,
}: {
  competencies: CompetencySupervisorData[];
}) {
  const firstCompetency = competencies[0];
  const [comment, setComment] = useState<string>(firstCompetency?.supervisorComment || "");
  const [allRatingData, setAllRatingData] = useState<CompetencyRatingData>(() => {
    // Merge all rating data from competencies
    const merged: CompetencyRatingData = {};
    competencies.forEach(c => {
      Object.assign(merged, c.ratingData);
    });
    return merged;
  });

  // Auto-save hook
  const { saveStatus, debouncedSave, save, isEditable } = useSupervisorFeedbackAutoSave({
    feedbackId: firstCompetency?.feedbackId,
    initialComment: firstCompetency?.supervisorComment,
    initialRatingData: allRatingData,
    initialStatus: firstCompetency?.feedbackStatus,
  });

  // Handle rating change for any competency in the group (supports toggle/deselect)
  const handleRatingChange = useCallback((competencyId: string, actionIndex: string, rating: RatingCode | undefined) => {
    const currentCompetencyRatings = { ...(allRatingData[competencyId] || {}) };

    if (rating === undefined) {
      // Remove the rating if deselected
      delete currentCompetencyRatings[actionIndex];
    } else {
      currentCompetencyRatings[actionIndex] = rating;
    }

    const newRatingData: CompetencyRatingData = {
      ...allRatingData,
      [competencyId]: currentCompetencyRatings,
    };
    setAllRatingData(newRatingData);
    debouncedSave({ supervisorComment: comment, ratingData: newRatingData });
  }, [allRatingData, comment, debouncedSave]);

  // Handle comment change (debounced)
  const handleCommentChange = useCallback((newComment: string) => {
    if (!isEditable) return;
    setComment(newComment);
    debouncedSave({ supervisorComment: newComment, ratingData: allRatingData });
  }, [allRatingData, debouncedSave, isEditable]);

  // Handle comment blur (immediate save)
  const handleCommentBlur = useCallback(() => {
    if (!isEditable) return;
    save({ supervisorComment: comment, ratingData: allRatingData });
  }, [allRatingData, comment, save, isEditable]);

  return (
    <div className="space-y-5">
      {/* Competency cards */}
      {competencies.map((competency) => (
        <CompetencyItemCard
          key={competency.competencyId}
          competency={competency}
          onRatingChange={handleRatingChange}
          isEditable={isEditable}
        />
      ))}

      {/* Comment Section - outside the cards */}
      <div className="mt-6">
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
          <p className="text-xs text-gray-400">メモ（評価期間が終了するまで、メンバーには表示されません）</p>
          <p className="text-xs text-gray-400">{comment.length} / 5000</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Main component: Competency Supervisor Evaluation
 */
export default function CompetencySupervisorEvaluation({
  competencies,
  overallRating,
  isLoading = false,
}: CompetencySupervisorEvaluationProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const displayCompetencies = competencies || [];
  const displayOverallRating = overallRating || (displayCompetencies.length > 0 ? calculateCompetencySupervisorOverallRating(displayCompetencies) : '−');

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

        {/* Group competencies by goalId */}
        {(() => {
          const groupedByGoal = displayCompetencies.reduce((acc, comp) => {
            if (!acc[comp.goalId]) {
              acc[comp.goalId] = [];
            }
            acc[comp.goalId].push(comp);
            return acc;
          }, {} as Record<string, CompetencySupervisorData[]>);

          return Object.entries(groupedByGoal).map(([goalId, competencies]) => (
            <CompetencyGoalGroup
              key={goalId}
              competencies={competencies}
            />
          ));
        })()}
        </>
        )}
        </CardContent>
      )}
    </Card>
  );
}
