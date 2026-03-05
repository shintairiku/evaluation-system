"use client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Target, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState, useCallback } from "react";
import type { GoalWithAssessment } from "./index";
import type { RatingCode, CompetencyRatingData } from "@/api/types";
import { calculateRatingAverage, scoreToFinalRating } from "@/utils/rating";
import { useSelfAssessmentAutoSave } from "../hooks/useSelfAssessmentAutoSave";
import { SaveStatusIndicator } from "@/feature/evaluation/shared/SaveStatusIndicator";
import { SupervisorFeedbackAlert } from "./components";

interface CompetencyEvaluateProps {
  goalsWithAssessments?: GoalWithAssessment[];
  isLoading?: boolean;
}

/**
 * Competency rating codes (5-level scale for input)
 */
const COMPETENCY_RATING_CODES: RatingCode[] = ['SS', 'S', 'A', 'B', 'C'];

/**
 * Individual competency goal card with auto-save
 */
function CompetencyGoalCard({
  goalWithAssessment,
}: {
  goalWithAssessment: GoalWithAssessment;
}) {
  const { goal, selfAssessment } = goalWithAssessment;

  // Get competency data from goal
  // Use allStage* fields (all competencies from employee's stage) with fallback to focused-only fields
  const competencyIds = goal.allStageCompetencyIds || goal.competencyIds || [];
  const competencyNames = goal.allStageCompetencyNames || goal.competencyNames || {};
  const allActionTexts = goal.allStageIdealActionTexts || {};
  const selectedIdealActions = goal.selectedIdealActions || {};

  // Local state for form values
  const [ratingData, setRatingData] = useState<CompetencyRatingData>(
    (selfAssessment?.ratingData as CompetencyRatingData) || {}
  );
  const [comment, setComment] = useState<string>(selfAssessment?.selfComment || "");

  // Auto-save hook (no parent notification to avoid reload flicker)
  const { saveStatus, debouncedSave, save, isEditable } = useSelfAssessmentAutoSave({
    assessmentId: selfAssessment?.id,
    initialRatingData: selfAssessment?.ratingData as CompetencyRatingData | undefined,
    initialComment: selfAssessment?.selfComment,
    initialStatus: selfAssessment?.status,
  });

  // Handle action rating change
  const handleActionRatingChange = useCallback(
    (competencyId: string, actionIndex: string, rating: RatingCode) => {
      if (!isEditable) return;

      const newRatingData: CompetencyRatingData = {
        ...ratingData,
        [competencyId]: {
          ...(ratingData[competencyId] || {}),
          [actionIndex]: rating,
        },
      };
      setRatingData(newRatingData);
      debouncedSave({ ratingData: newRatingData, selfComment: comment });
    },
    [ratingData, comment, debouncedSave, isEditable]
  );

  // Handle comment change (debounced)
  const handleCommentChange = useCallback(
    (newComment: string) => {
      if (!isEditable) return;
      setComment(newComment);
      debouncedSave({ ratingData, selfComment: newComment });
    },
    [ratingData, debouncedSave, isEditable]
  );

  // Handle comment blur (immediate save)
  const handleCommentBlur = useCallback(() => {
    if (!isEditable || !comment.trim()) return;
    save({ ratingData, selfComment: comment });
  }, [ratingData, comment, save, isEditable]);

  // Calculate competency rating (average of rated actions)
  const calculateCompetencyRating = (competencyId: string): string | null => {
    const actionRatings = ratingData[competencyId];
    if (!actionRatings) return null;

    // Collect all ratings that have been filled in (partial ratings allowed)
    const ratings = Object.values(actionRatings).filter(Boolean) as RatingCode[];
    if (ratings.length === 0) return null;

    const avg = calculateRatingAverage(ratings);
    if (avg === null) return null;

    return scoreToFinalRating(avg);
  };

  return (
    <>
      {/* Each competency as a separate card */}
      {competencyIds.map((competencyId) => {
        const competencyName = competencyNames[competencyId] || "コンピテンシー";
        // Get action indexes and texts from allStageIdealActionTexts (dynamic keys per competency)
        const compActionTexts = allActionTexts[competencyId] || {};
        const actionIndexes = Object.keys(compActionTexts);
        const isFocused = competencyId in selectedIdealActions;
        const competencyRating = calculateCompetencyRating(competencyId);

        return (
          <div
            key={competencyId}
            className="bg-slate-50 border border-slate-200 rounded-2xl shadow-sm px-6 py-5 space-y-5 transition hover:shadow-md"
          >
            {/* Competency Name Display with Rating - Grade only shows after submission */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="text-xl font-bold text-green-800">{competencyName}</div>
                {isFocused && (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700 border border-green-200">
                    注力
                  </span>
                )}
              </div>

              {/* Rating Display - Label always visible, grade only after submission */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 px-3 py-1 rounded-md border border-gray-200 bg-white cursor-help transition-colors hover:bg-gray-50">
                      <span className="text-xs text-gray-500">評価</span>
                      <div
                        className={`text-xl font-bold ${
                          selfAssessment?.status !== 'draft' && competencyRating
                            ? "text-green-700"
                            : "text-gray-300"
                        }`}
                      >
                        {selfAssessment?.status !== 'draft'
                          ? (competencyRating || "−")
                          : "−"}
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="text-xs">
                      {selfAssessment?.status !== 'draft'
                        ? `提出済みの${competencyName}評価から算出された評価です。`
                        : "※提出後に評価が表示されます。"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Ideal Action Items */}
            <div className="space-y-6">
              {actionIndexes.map((actionIdx) => {
                const actionText = compActionTexts[actionIdx];
                const currentRating = ratingData[competencyId]?.[actionIdx];
                const isFocusedAction = selectedIdealActions[competencyId]?.includes(actionIdx);

                // Skip if no action text
                if (!actionText) return null;

                return (
                  <div key={`${competencyId}-${actionIdx}`}>
                    {/* Action Description */}
                    <div className={`text-sm mb-3 ${isFocusedAction ? 'text-gray-800 font-medium pl-3 border-l-2 border-green-500' : 'text-gray-600'}`}>
                      {actionText}
                      {isEditable && !currentRating && <span className="text-red-500"> *</span>}
                    </div>

                    {/* Rating Buttons for this action */}
                    <div className="flex items-center gap-3 flex-wrap">
                      {COMPETENCY_RATING_CODES.map((rating) => {
                        const isSelected = currentRating === rating;
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
                              handleActionRatingChange(competencyId, actionIdx, rating)
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
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Comment Section - One comment for all competencies in this goal */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-semibold text-gray-700">
            自己評価コメント{" "}
            {!comment.trim() && <span className="text-red-500">*</span>}
          </Label>
          <SaveStatusIndicator status={saveStatus} />
        </div>
        <Textarea
          value={comment}
          onChange={(e) => handleCommentChange(e.target.value)}
          onBlur={handleCommentBlur}
          placeholder="各コンピテンシーの発揮状況や具体的なエピソードについて記入してください..."
          className="mt-1 text-sm rounded-md border-gray-300 bg-white focus:ring-2 focus:ring-green-200 min-h-[100px]"
          maxLength={5000}
          disabled={!isEditable}
        />
        <div className="flex justify-between items-center mt-1">
          <p className="text-xs text-gray-400">
            具体的な成果や改善点を記載してください
          </p>
          <p className="text-xs text-gray-400">{comment.length} / 5000</p>
        </div>
      </div>

      {/* Supervisor Feedback Section */}
      <div className="mt-6">
        <SupervisorFeedbackAlert goalWithAssessment={goalWithAssessment} />
      </div>
    </>
  );
}

/**
 * Rating criteria legend component (original structure preserved)
 */
function RatingCriteriaLegend() {
  return (
    <div className="sticky top-4 z-10 bg-white pb-4 pt-10 -mt-8 border-b border-gray-200 mb-2">
      <div className="grid grid-cols-2 gap-4">
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
  );
}

/**
 * Main component: Competency Goals Evaluate
 */
export default function CompetencyEvaluate({
  goalsWithAssessments = [],
  isLoading = false,
}: CompetencyEvaluateProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const hasCompetencyGoals = goalsWithAssessments.length > 0;

  // Calculate overall rating based on all competency goals
  const calculateOverallRating = (): string | null => {
    if (goalsWithAssessments.length === 0) return null;

    // Check if all goals have comments (ratings can be partial)
    const allHaveComments = goalsWithAssessments.every((item) =>
      item.selfAssessment?.selfComment?.trim()
    );
    if (!allHaveComments) return null;

    // Calculate weighted average across all goals
    let totalWeightedScore = 0;
    let totalWeight = 0;

    goalsWithAssessments.forEach((item) => {
      const weight = item.goal.weight || 0;
      const goalRatingData = item.selfAssessment?.ratingData as CompetencyRatingData;
      if (!goalRatingData) return;

      // Collect all filled ratings across all competencies
      const allRatings: RatingCode[] = [];
      const compIds = item.goal.allStageCompetencyIds || item.goal.competencyIds || [];
      compIds.forEach((compId) => {
        const actionRatings = goalRatingData[compId];
        if (!actionRatings) return;
        Object.values(actionRatings).forEach((rating) => {
          if (rating) allRatings.push(rating as RatingCode);
        });
      });

      const goalAvg = calculateRatingAverage(allRatings);
      if (goalAvg !== null) {
        totalWeightedScore += goalAvg * weight;
        totalWeight += weight;
      }
    });

    if (totalWeight === 0) return null;

    const avgScore = totalWeightedScore / totalWeight;
    return scoreToFinalRating(avgScore);
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
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-green-100 text-green-700">
              <Target className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold tracking-tight">コンピテンシー評価</CardTitle>
                  <p className="text-xs text-gray-500 mt-1">各コンピテンシーごとに自己評価を入力してください</p>
                </div>

                {/* Overall Rating Display - Grade only shows after submission */}
                <div className="flex items-center gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2 px-3 py-1 rounded-md border border-gray-200 bg-white cursor-help transition-colors hover:bg-gray-50">
                          <span className="text-xs text-gray-500">総合評価</span>
                          <div className={`text-xl font-bold ${
                            allSubmitted && overallRating ? 'text-green-700' : 'text-gray-300'
                          }`}>
                            {allSubmitted ? (overallRating || '−') : '−'}
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p className="text-xs">
                          {allSubmitted
                            ? "提出済みのコンピテンシー評価から算出された総合評価です。"
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
                <Loader2 className="h-6 w-6 animate-spin text-green-500" />
                <span className="ml-2 text-sm text-gray-500">読み込み中...</span>
              </div>
            )}

            {/* Empty state - no competency goals */}
            {!isLoading && !hasCompetencyGoals && (
              <div className="text-center py-8 text-gray-500">
                <p>承認済みのコンピテンシー目標がありません。</p>
                <p className="text-sm mt-1">
                  目標が承認されると、ここに自己評価フォームが表示されます。
                </p>
              </div>
            )}

            {/* Content when competency goals exist */}
            {!isLoading && hasCompetencyGoals && (
              <>
                {/* Rating Criteria Legend */}
                <RatingCriteriaLegend />

                {/* Competency Goal Cards */}
                {goalsWithAssessments.map((item) => (
                  <CompetencyGoalCard
                    key={item.goal.id}
                    goalWithAssessment={item}
                  />
                ))}
              </>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
