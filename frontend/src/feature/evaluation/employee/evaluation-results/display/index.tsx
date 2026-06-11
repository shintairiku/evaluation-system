"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { EvaluationPeriodSelector } from "@/components/evaluation/EvaluationPeriodSelector";
import { EmployeeInfoCard } from "@/components/evaluation/EmployeeInfoCard";
import { getRatingColor } from "@/utils/rating";
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
import { AlertCircle, Loader2 } from "lucide-react";
import {
  UnifiedPerformanceSection,
  UnifiedCompetencySection,
  CoreValueSection,
} from "./UnifiedEvaluationSections";
import {
  fetchMyEvaluationData,
  mergePerformanceItems,
  mergeCompetencyItems,
  type MyEvaluationRawData,
} from "./utils";
import { getMyComprehensiveEvaluationAction } from "@/api/server-actions/comprehensive-evaluation";
import type { ComprehensiveEvaluationRank } from "@/api/types";

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
  initialComprehensiveRank: ComprehensiveEvaluationRank | null;
}

export default function EvaluationResultsDisplay({
  initialUser,
  initialPeriods,
  initialPeriodId,
  initialData,
  initialComprehensiveRank,
}: EvaluationResultsDisplayProps) {
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(initialPeriodId);
  const [data, setData] = useState<MyEvaluationRawData>(initialData ?? EMPTY_DATA);
  const [isLoading, setIsLoading] = useState(false);

  // Comprehensive rank is fetched independently so its heavier query never blocks
  // the main sections.
  const [comprehensiveRank, setComprehensiveRank] =
    useState<ComprehensiveEvaluationRank | null>(initialComprehensiveRank);
  const [comprehensiveLoading, setComprehensiveLoading] = useState(false);

  const currentUser = initialUser;
  const allPeriods = initialPeriods;

  // Latest-request-wins guard: rapid period switches can resolve out of order
  // (responses are several seconds). Only the most recently requested period
  // is allowed to commit its results.
  const latestRequestRef = useRef<string>(initialPeriodId);

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
    (periodId: string) => {
      setSelectedPeriodId(periodId);
      latestRequestRef.current = periodId;

      const period = allPeriods.find((p) => p.id === periodId);
      if (!currentUser?.id || period?.status !== "completed") {
        setData(EMPTY_DATA);
        setComprehensiveRank(null);
        return;
      }
      const userId = currentUser.id;
      // Only commit a response if this period is still the latest requested.
      const isStale = () => latestRequestRef.current !== periodId;

      // Main sections — drives the page spinner.
      setIsLoading(true);
      fetchMyEvaluationData(periodId, userId)
        .then((result) => {
          if (isStale()) return;
          setData(result);
        })
        .catch((error) => {
          if (isStale()) return;
          console.error("Error fetching evaluation results:", error);
          setData(EMPTY_DATA);
        })
        .finally(() => {
          if (!isStale()) setIsLoading(false);
        });

      // Comprehensive rank — independent, so it never blocks the sections above.
      setComprehensiveLoading(true);
      getMyComprehensiveEvaluationAction(periodId)
        .then((r) => {
          if (isStale()) return;
          setComprehensiveRank(r.success && r.data ? r.data.overallRank : null);
        })
        .catch(() => {
          if (!isStale()) setComprehensiveRank(null);
        })
        .finally(() => {
          if (!isStale()) setComprehensiveLoading(false);
        });
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

  // Overall ratings — identical functions to evaluation-feedback (self uses the
  // *Display calculators, supervisor uses the *Supervisor calculators). All of
  // these already return "−" for empty input.
  const performanceOverallRating = useMemo(
    () => calculatePerformanceOverallRating(performanceGoals),
    [performanceGoals],
  );
  const competencyOverallRating = useMemo(
    () => calculateCompetencyOverallRating(competencyData),
    [competencyData],
  );
  const supervisorPerformanceOverallRating = useMemo(
    () => calculateSupervisorOverallRating(supervisorPerformance),
    [supervisorPerformance],
  );
  const supervisorCompetencyOverallRating = useMemo(
    () => calculateCompetencySupervisorOverallRating(supervisorCompetency),
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
            {/* Overall comprehensive evaluation (総合評価) — grade only */}
            <div className="rounded-2xl border bg-gradient-to-r from-slate-50 to-white p-6 flex items-center justify-between shadow-sm">
              <div>
                <h2 className="text-lg font-bold">総合評価</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  この評価期間の総合評価です
                </p>
              </div>
              <div className="flex items-center gap-3">
                {comprehensiveLoading ? (
                  <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
                ) : (
                  <div
                    className={`flex items-center justify-center min-w-[3rem] px-4 py-1.5 rounded-xl border text-2xl font-bold tabular-nums ${getRatingColor(
                      comprehensiveRank,
                    )}`}
                  >
                    {comprehensiveRank ?? "−"}
                  </div>
                )}
              </div>
            </div>

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

            {/* Core Value Section (single card) */}
            <CoreValueSection detail={coreValueDetail} />
          </>
        )}
      </div>
    </div>
  );
}
