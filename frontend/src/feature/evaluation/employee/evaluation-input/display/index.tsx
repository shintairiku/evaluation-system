"use client";

import { useState, useEffect, useCallback } from "react";
import PerformanceGoalsEvaluate from "./PerformanceGoalsEvaluate";
import CompetencyEvaluate from "./CompetencyEvaluate";
import CoreValueEvaluate from "./CoreValueEvaluate";
import SubmitButton from "../components/SubmitButton";
import { EvaluationPeriodSelector } from "@/components/evaluation/EvaluationPeriodSelector";
import { fetchAndCategorizeGoals } from "./utils";
import type { EvaluationPeriod, GoalResponse, SelfAssessment, SupervisorFeedback, CoreValueDefinition, CoreValueEvaluation, CoreValueFeedback } from "@/api/types";
import { getCoreValueDefinitionsAction, getMyEvaluationAction, getMyFeedbackAction } from "@/api/server-actions/core-values";

/**
 * Combined type for display: Goal with its SelfAssessment and SupervisorFeedback
 */
export interface GoalWithAssessment {
  goal: GoalResponse;
  selfAssessment: SelfAssessment | null;
  supervisorFeedback: SupervisorFeedback | null;
}

interface EmployeeEvaluationInputDisplayProps {
  initialPeriods: EvaluationPeriod[];
  initialPeriodId: string;
}

export default function EmployeeEvaluationInputDisplay({
  initialPeriods,
  initialPeriodId,
}: EmployeeEvaluationInputDisplayProps) {
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(initialPeriodId);
  const currentPeriod = initialPeriods.find(p => p.status === 'active') || initialPeriods[0] || null;
  const [allPeriods] = useState<EvaluationPeriod[]>(initialPeriods);

  // Data state for goals and self-assessments
  const [performanceGoals, setPerformanceGoals] = useState<GoalWithAssessment[]>([]);
  const [competencyGoals, setCompetencyGoals] = useState<GoalWithAssessment[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Core value state
  const [coreValueDefinitions, setCoreValueDefinitions] = useState<CoreValueDefinition[]>([]);
  const [coreValueEvaluation, setCoreValueEvaluation] = useState<CoreValueEvaluation | null>(null);
  const [coreValueFeedback, setCoreValueFeedback] = useState<CoreValueFeedback | null>(null);

  /**
   * Fetch goals, self-assessments, and supervisor feedbacks for the selected period
   */
  const fetchGoalsAndAssessments = useCallback(async (periodId: string) => {
    if (!periodId) return;

    setIsLoadingData(true);
    try {
      const [goalsResult, definitionsResult, evaluationResult, feedbackResult] = await Promise.all([
        fetchAndCategorizeGoals(periodId),
        getCoreValueDefinitionsAction(),
        getMyEvaluationAction(periodId),
        getMyFeedbackAction(periodId),
      ]);

      setPerformanceGoals(goalsResult.performance);
      setCompetencyGoals(goalsResult.competency);

      if (definitionsResult.success && definitionsResult.data) {
        setCoreValueDefinitions(definitionsResult.data);
      }
      if (evaluationResult.success) {
        setCoreValueEvaluation(evaluationResult.data ?? null);
      }
      if (feedbackResult.success) {
        setCoreValueFeedback(feedbackResult.data ?? null);
      }
    } catch (error) {
      console.error('Failed to fetch goals and assessments:', error);
    } finally {
      setIsLoadingData(false);
    }
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
      const [goalsResult, evaluationResult, feedbackResult] = await Promise.all([
        fetchAndCategorizeGoals(selectedPeriodId),
        getMyEvaluationAction(selectedPeriodId),
        getMyFeedbackAction(selectedPeriodId),
      ]);
      setPerformanceGoals(goalsResult.performance);
      setCompetencyGoals(goalsResult.competency);
      if (evaluationResult.success) {
        setCoreValueEvaluation(evaluationResult.data ?? null);
      }
      if (feedbackResult.success) {
        setCoreValueFeedback(feedbackResult.data ?? null);
      }
    } catch (error) {
      console.error('Failed to refresh goals and assessments:', error);
    }
  }, [selectedPeriodId]);

  const selectedPeriod = allPeriods.find((period) => period.id === selectedPeriodId) || null;
  const isPeriodEditable =
    selectedPeriod?.status !== "completed" && selectedPeriod?.status !== "cancelled";

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
            isLoading={false}
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
            isPeriodEditable={isPeriodEditable}
            disabled={isLoadingData}
          />
        </div>

        {!isPeriodEditable && selectedPeriod && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            この評価期間（{selectedPeriod.name}）は{selectedPeriod.status === "completed" ? "完了" : "キャンセル済み"}
            のため、自己評価は編集できません。
          </div>
        )}

        {/* Evaluation Forms */}
        <div className="space-y-6">
          <PerformanceGoalsEvaluate
            goalsWithAssessments={performanceGoals}
            isLoading={isLoadingData}
            isPeriodEditable={isPeriodEditable}
          />
          <CompetencyEvaluate
            goalsWithAssessments={competencyGoals}
            isLoading={isLoadingData}
            isPeriodEditable={isPeriodEditable}
          />
          <CoreValueEvaluate
            definitions={coreValueDefinitions}
            evaluation={coreValueEvaluation}
            feedback={coreValueFeedback}
            isLoading={isLoadingData}
          />
        </div>
      </div>
    </div>
  );
}
