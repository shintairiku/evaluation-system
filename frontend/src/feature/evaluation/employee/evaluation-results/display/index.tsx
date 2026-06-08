"use client";

import { useState, useCallback, useMemo } from "react";
import { EvaluationPeriodSelector } from "@/components/evaluation/EvaluationPeriodSelector";
import { EmployeeInfoCard } from "@/components/evaluation/EmployeeInfoCard";
import { CoreValueScoreGrid } from "@/feature/evaluation/admin/peer-review-assignments/components/CoreValueScoreGrid";
import { OverallRatingSummary } from "@/feature/evaluation/admin/peer-review-assignments/components/OverallRatingSummary";
import { EvaluationCommentsSection } from "@/feature/evaluation/admin/peer-review-assignments/components/EvaluationCommentsSection";
import {
  transformPerformanceGoalsForDisplay,
  calculatePerformanceOverallRating,
} from "@/feature/evaluation/superviser/evaluation-feedback/display/PerformanceGoalsSelfAssessment";
import {
  transformPerformanceGoalsForSupervisor,
  calculateSupervisorOverallRating,
} from "@/feature/evaluation/superviser/evaluation-feedback/display/PerformanceGoalsSupervisorEvaluation";
import {
  transformCompetencyGoalsForDisplay,
  calculateCompetencyOverallRating,
} from "@/feature/evaluation/superviser/evaluation-feedback/display/CompetencySelfAssessment";
import {
  transformCompetencyGoalsForSupervisor,
  calculateCompetencySupervisorOverallRating,
} from "@/feature/evaluation/superviser/evaluation-feedback/display/CompetencySupervisorEvaluation";
import type { EvaluationPeriod, UserDetailResponse } from "@/api/types";
import { AlertCircle, Loader2, Heart } from "lucide-react";
import {
  UnifiedPerformanceSection,
  UnifiedCompetencySection,
} from "./UnifiedEvaluationSections";
import {
  fetchMyEvaluationData,
  mergePerformanceItems,
  mergeCompetencyItems,
  type MyEvaluationRawData,
} from "./utils";

const EMPTY_DATA: MyEvaluationRawData = {
  goals: [],
  selfAssessments: [],
  supervisorFeedbacks: [],
  coreValueDetail: null,
};

interface EvaluationResultsDisplayProps {
  initialUser: UserDetailResponse | null;
  initialPeriods: EvaluationPeriod[];
  initialPeriodId: string;
  initialData: MyEvaluationRawData | null;
}

export default function EvaluationResultsDisplay({
  initialUser,
  initialPeriods,
  initialPeriodId,
  initialData,
}: EvaluationResultsDisplayProps) {
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(initialPeriodId);
  const [data, setData] = useState<MyEvaluationRawData>(initialData ?? EMPTY_DATA);
  const [isLoading, setIsLoading] = useState(false);

  const currentUser = initialUser;
  const allPeriods = initialPeriods;

  // The active (進行中) period, used only to flag "current" in the selector.
  const currentPeriodId = useMemo(
    () => allPeriods.find((p) => p.status === "active")?.id ?? null,
    [allPeriods],
  );

  const selectedPeriod = useMemo(
    () => allPeriods.find((p) => p.id === selectedPeriodId) ?? null,
    [allPeriods, selectedPeriodId],
  );

  // Results are only revealed once the evaluation period is finalized (完了).
  const isPeriodFinalized = selectedPeriod?.status === "completed";

  const handlePeriodChange = useCallback(
    async (periodId: string) => {
      setSelectedPeriodId(periodId);

      const period = allPeriods.find((p) => p.id === periodId);
      if (!currentUser?.id || period?.status !== "completed") {
        setData(EMPTY_DATA);
        return;
      }

      try {
        setIsLoading(true);
        const result = await fetchMyEvaluationData(periodId, currentUser.id);
        setData(result);
      } catch (error) {
        console.error("Error fetching evaluation results:", error);
        setData(EMPTY_DATA);
      } finally {
        setIsLoading(false);
      }
    },
    [allPeriods, currentUser?.id],
  );

  // Self-assessment display data
  const performanceGoals = useMemo(
    () => transformPerformanceGoalsForDisplay(data.goals, data.selfAssessments),
    [data.goals, data.selfAssessments],
  );
  const competencyData = useMemo(
    () => transformCompetencyGoalsForDisplay(data.goals, data.selfAssessments),
    [data.goals, data.selfAssessments],
  );

  // Supervisor feedback — keep the raw transform results so the overall ratings
  // use the EXACT same functions as the evaluation-feedback page.
  const supervisorPerformance = useMemo(
    () =>
      transformPerformanceGoalsForSupervisor(
        data.goals,
        data.selfAssessments,
        data.supervisorFeedbacks,
      ),
    [data.goals, data.selfAssessments, data.supervisorFeedbacks],
  );
  const supervisorCompetency = useMemo(
    () =>
      transformCompetencyGoalsForSupervisor(
        data.goals,
        data.selfAssessments,
        data.supervisorFeedbacks,
      ),
    [data.goals, data.selfAssessments, data.supervisorFeedbacks],
  );

  // Unified per-item display data (self + supervisor merged)
  const unifiedPerformance = useMemo(
    () => mergePerformanceItems(performanceGoals, supervisorPerformance),
    [performanceGoals, supervisorPerformance],
  );
  const unifiedCompetency = useMemo(
    () => mergeCompetencyItems(competencyData, supervisorCompetency),
    [competencyData, supervisorCompetency],
  );

  // Overall ratings — identical functions to evaluation-feedback:
  // self uses the *Display calculators, supervisor uses the *Supervisor calculators.
  const performanceOverallRating = useMemo(
    () =>
      performanceGoals.length > 0
        ? calculatePerformanceOverallRating(performanceGoals)
        : "−",
    [performanceGoals],
  );
  const competencyOverallRating = useMemo(
    () =>
      competencyData.length > 0 ? calculateCompetencyOverallRating(competencyData) : "−",
    [competencyData],
  );
  const supervisorPerformanceOverallRating = useMemo(
    () =>
      supervisorPerformance.length > 0
        ? calculateSupervisorOverallRating(supervisorPerformance)
        : "−",
    [supervisorPerformance],
  );
  const supervisorCompetencyOverallRating = useMemo(
    () =>
      supervisorCompetency.length > 0
        ? calculateCompetencySupervisorOverallRating(supervisorCompetency)
        : "−",
    [supervisorCompetency],
  );

  const coreValueDetail = data.coreValueDetail;

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">評価結果一覧</h1>
            <p className="text-sm text-muted-foreground mt-1">
              確定した評価期間の自己評価・上長評価・同僚評価の結果を確認できます
            </p>
          </div>
          <div className="shrink-0 flex flex-col gap-3 min-w-[336px]">
            <EvaluationPeriodSelector
              periods={allPeriods}
              selectedPeriodId={selectedPeriodId}
              currentPeriodId={currentPeriodId}
              onPeriodChange={handlePeriodChange}
              isLoading={false}
            />
          </div>
        </div>

        {/* Employee Info */}
        {currentUser && <EmployeeInfoCard employee={currentUser} />}

        {/* Not finalized notice */}
        {!isPeriodFinalized ? (
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">結果はまだ表示できません</p>
                <p className="text-sm text-amber-700 mt-1">
                  評価結果は評価期間が確定（完了）してから表示されます。確定済みの評価期間を選択してください。
                </p>
              </div>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Performance Goals (unified self + supervisor) */}
            <UnifiedPerformanceSection
              items={unifiedPerformance}
              selfOverall={performanceOverallRating}
              supervisorOverall={supervisorPerformanceOverallRating}
            />

            {/* Competency (unified self + supervisor) */}
            <UnifiedCompetencySection
              items={unifiedCompetency}
              selfOverall={competencyOverallRating}
              supervisorOverall={supervisorCompetencyOverallRating}
            />

            {/* Core Value Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-rose-100 text-rose-700">
                  <Heart className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold">コアバリュー評価</h2>
              </div>
              {coreValueDetail ? (
                <div className="space-y-6">
                  <CoreValueScoreGrid coreValues={coreValueDetail.coreValues} />
                  <OverallRatingSummary
                    selfAvgRating={coreValueDetail.selfAvgRating}
                    peer1AvgRating={coreValueDetail.peer1AvgRating}
                    peer2AvgRating={coreValueDetail.peer2AvgRating}
                    supervisorAvgRating={coreValueDetail.supervisorAvgRating}
                    overallRating={coreValueDetail.overallRating}
                  />
                  <EvaluationCommentsSection comments={coreValueDetail.comments} />
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground border rounded-lg">
                  <p>コアバリュー評価がありません</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
