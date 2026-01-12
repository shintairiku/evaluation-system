"use client";

import { useState, useEffect } from "react";
import PerformanceGoalsEvaluate from "./PerformanceGoalsEvaluate";
import CompetencyEvaluate from "./CompetencyEvaluate";
import CoreValueEvaluate from "./CoreValueEvaluate";
import SubmitButton from "../components/SubmitButton";
import { EvaluationPeriodSelector } from "@/components/evaluation/EvaluationPeriodSelector";
import { getCategorizedEvaluationPeriodsAction } from "@/api/server-actions/evaluation-periods";
import type { EvaluationPeriod } from "@/api/types";

export default function EmployeeEvaluationInputDisplay() {
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [currentPeriod, setCurrentPeriod] = useState<EvaluationPeriod | null>(null);
  const [allPeriods, setAllPeriods] = useState<EvaluationPeriod[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  // Handle period change
  const handlePeriodChange = (periodId: string) => {
    setSelectedPeriodId(periodId);
  };

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">自己評価入力</h1>
            <p className="text-sm text-muted-foreground mt-1">
              業績目標とコンピテンシーの自己評価を入力してください
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
          <PerformanceGoalsEvaluate />
          <CompetencyEvaluate />
          <CoreValueEvaluate />
        </div>
      </div>
    </div>
  );
}
