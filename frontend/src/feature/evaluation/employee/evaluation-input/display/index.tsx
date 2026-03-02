"use client";

import { useState, useEffect, useCallback } from "react";
import PerformanceGoalsEvaluate from "./PerformanceGoalsEvaluate";
import CompetencyEvaluate from "./CompetencyEvaluate";
import CoreValueEvaluate from "./CoreValueEvaluate";
import SubmitButton from "../components/SubmitButton";
import { EvaluationPeriodSelector } from "@/components/evaluation/EvaluationPeriodSelector";
import { getCategorizedEvaluationPeriodsAction } from "@/api/server-actions/evaluation-periods";
import { fetchAndCategorizeGoals } from "./utils";
import type { EvaluationPeriod, GoalResponse, SelfAssessment, SupervisorFeedback, CoreValueDefinition, CoreValueEvaluation } from "@/api/types";
import { getCoreValueDefinitionsAction, getMyEvaluationAction } from "@/api/server-actions/core-values";

/**
 * Combined type for display: Goal with its SelfAssessment and SupervisorFeedback
 */
export interface GoalWithAssessment {
  goal: GoalResponse;
  selfAssessment: SelfAssessment | null;
  supervisorFeedback: SupervisorFeedback | null;
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

  // Core value state
  const [coreValueDefinitions, setCoreValueDefinitions] = useState<CoreValueDefinition[]>([]);
  const [coreValueEvaluation, setCoreValueEvaluation] = useState<CoreValueEvaluation | null>(null);

  /**
   * Fetch goals, self-assessments, and supervisor feedbacks for the selected period
   */
  const fetchGoalsAndAssessments = useCallback(async (periodId: string) => {
    if (!periodId) return;

    setIsLoadingData(true);
    try {
      const [goalsResult, definitionsResult, evaluationResult] = await Promise.all([
        fetchAndCategorizeGoals(periodId),
        getCoreValueDefinitionsAction(),
        getMyEvaluationAction(periodId),
      ]);

      setPerformanceGoals(goalsResult.performance);
      setCompetencyGoals(goalsResult.competency);

      if (definitionsResult.success && definitionsResult.data) {
        setCoreValueDefinitions(definitionsResult.data);
      }
      if (evaluationResult.success) {
        setCoreValueEvaluation(evaluationResult.data ?? null);
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

  /**
   * Silent refresh for SubmitButton - fetches data without showing loading state
   */
  const handleSilentRefresh = useCallback(async () => {
    if (!selectedPeriodId) return;

    try {
      const [goalsResult, evaluationResult] = await Promise.all([
        fetchAndCategorizeGoals(selectedPeriodId),
        getMyEvaluationAction(selectedPeriodId),
      ]);
      setPerformanceGoals(goalsResult.performance);
      setCompetencyGoals(goalsResult.competency);
      if (evaluationResult.success) {
        setCoreValueEvaluation(evaluationResult.data ?? null);
      }
    } catch (error) {
      console.error('Failed to refresh goals and assessments:', error);
    }
  }, [selectedPeriodId]);

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
          <SubmitButton
            performanceGoals={performanceGoals}
            competencyGoals={competencyGoals}
            coreValueEvaluation={coreValueEvaluation}
            coreValueDefinitionCount={coreValueDefinitions.length}
            onSubmitSuccess={handleAssessmentUpdate}
            onRefreshData={handleSilentRefresh}
            disabled={isLoadingData}
          />
        </div>

        {/* Evaluation Forms */}
        <div className="space-y-6">
          <PerformanceGoalsEvaluate
            goalsWithAssessments={performanceGoals}
            isLoading={isLoadingData}
          />
          <CompetencyEvaluate
            goalsWithAssessments={competencyGoals}
            isLoading={isLoadingData}
          />
          <CoreValueEvaluate
            definitions={coreValueDefinitions}
            evaluation={coreValueEvaluation}
            isLoading={isLoadingData}
          />
        </div>
      </div>
    </div>
  );
}
