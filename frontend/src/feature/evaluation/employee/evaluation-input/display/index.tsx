"use client";

import { useState, useEffect, useCallback } from "react";
import PerformanceGoalsEvaluate from "./PerformanceGoalsEvaluate";
import CompetencyEvaluate from "./CompetencyEvaluate";
import CoreValueEvaluate from "./CoreValueEvaluate";
import SubmitButton from "../components/SubmitButton";
import { EvaluationPeriodSelector } from "@/components/evaluation/EvaluationPeriodSelector";
import { getCategorizedEvaluationPeriodsAction } from "@/api/server-actions/evaluation-periods";
import { getGoalsAction } from "@/api/server-actions/goals";
import { getSelfAssessmentsAction } from "@/api/server-actions/self-assessments";
import type { EvaluationPeriod, GoalResponse, SelfAssessment } from "@/api/types";

/**
 * Combined type for display: Goal with its SelfAssessment
 */
export interface GoalWithAssessment {
  goal: GoalResponse;
  selfAssessment: SelfAssessment | null;
}

export default function EmployeeEvaluationInputDisplay() {
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [currentPeriod, setCurrentPeriod] = useState<EvaluationPeriod | null>(null);
  const [allPeriods, setAllPeriods] = useState<EvaluationPeriod[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Data state for goals and self-assessments
  const [performanceGoals, setPerformanceGoals] = useState<GoalWithAssessment[]>([]);
  const [competencyGoals, setCompetencyGoals] = useState<GoalWithAssessment[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  /**
   * Fetch goals and self-assessments for the selected period
   */
  const fetchGoalsAndAssessments = useCallback(async (periodId: string) => {
    if (!periodId) return;

    setIsLoadingData(true);
    try {
      // Fetch approved goals and self-assessments in parallel
      const [goalsResult, assessmentsResult] = await Promise.all([
        getGoalsAction({ periodId, status: 'approved' }),
        getSelfAssessmentsAction({ periodId })
      ]);

      if (goalsResult.success && goalsResult.data) {
        const goals = goalsResult.data.items || [];
        const assessments = assessmentsResult.success && assessmentsResult.data
          ? assessmentsResult.data.items || []
          : [];

        // Create a map of goalId -> SelfAssessment for quick lookup
        const assessmentMap = new Map<string, SelfAssessment>();
        assessments.forEach(assessment => {
          assessmentMap.set(assessment.goalId, assessment);
        });

        // Separate goals by category and combine with their assessments
        const performance: GoalWithAssessment[] = [];
        const competency: GoalWithAssessment[] = [];

        goals.forEach(goal => {
          const combined: GoalWithAssessment = {
            goal,
            selfAssessment: assessmentMap.get(goal.id) || null
          };

          if (goal.goalCategory === '業績目標') {
            performance.push(combined);
          } else if (goal.goalCategory === 'コンピテンシー') {
            competency.push(combined);
          }
        });

        setPerformanceGoals(performance);
        setCompetencyGoals(competency);
      }
    } catch (error) {
      console.error('Failed to fetch goals and assessments:', error);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  // Fetch evaluation periods on mount
  useEffect(() => {
    const fetchPeriods = async () => {
      try {
        setIsLoading(true);
        const result = await getCategorizedEvaluationPeriodsAction();

        if (result.success && result.data) {
          const periods = result.data.all || [];
          setAllPeriods(periods);

          // Set current period (find the one with status 'active' or first one)
          const activePeriod = periods.find(p => p.status === 'active') || periods[0];
          if (activePeriod) {
            setCurrentPeriod(activePeriod);
            setSelectedPeriodId(activePeriod.id);
          }
        }
      } catch (error) {
        console.error('Failed to fetch evaluation periods:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPeriods();
  }, []);

  // Fetch goals and assessments when period changes
  useEffect(() => {
    if (selectedPeriodId) {
      fetchGoalsAndAssessments(selectedPeriodId);
    }
  }, [selectedPeriodId, fetchGoalsAndAssessments]);

  // Handle period change
  const handlePeriodChange = (periodId: string) => {
    setSelectedPeriodId(periodId);
  };

  /**
   * Callback to refresh data after assessment changes
   */
  const handleAssessmentUpdate = useCallback(() => {
    if (selectedPeriodId) {
      fetchGoalsAndAssessments(selectedPeriodId);
    }
  }, [selectedPeriodId, fetchGoalsAndAssessments]);

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">自己評価入力</h1>
            <p className="text-sm text-muted-foreground mt-1">
              業績目標とコンピテンシーの自己評価を入力してください（コアバリュー評価は期末のみ）
            </p>
          </div>
          <EvaluationPeriodSelector
            periods={allPeriods}
            selectedPeriodId={selectedPeriodId}
            currentPeriodId={currentPeriod?.id || null}
            onPeriodChange={handlePeriodChange}
            isLoading={isLoading}
          />
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <SubmitButton />
        </div>

        {/* Evaluation Forms */}
        <div className="space-y-6">
          <PerformanceGoalsEvaluate
            goalsWithAssessments={performanceGoals}
            isLoading={isLoadingData}
            onUpdate={handleAssessmentUpdate}
          />
          <CompetencyEvaluate
            goalsWithAssessments={competencyGoals}
            isLoading={isLoadingData}
          />
          <CoreValueEvaluate />
        </div>
      </div>
    </div>
  );
}
