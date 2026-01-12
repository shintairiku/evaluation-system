"use client";

import { useState, useEffect } from "react";
import { EvaluationPeriodSelector } from "@/components/evaluation/EvaluationPeriodSelector";
import { getCategorizedEvaluationPeriodsAction } from "@/api/server-actions/evaluation-periods";
import type { EvaluationPeriod } from "@/api/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import PerformanceGoalsSelfAssessment from "./PerformanceGoalsSelfAssessment";
import PerformanceGoalsSupervisorEvaluation from "./PerformanceGoalsSupervisorEvaluation";
import CompetencySelfAssessment from "./CompetencySelfAssessment";
import CompetencySupervisorEvaluation from "./CompetencySupervisorEvaluation";
import CoreValueSelfAssessment from "./CoreValueSelfAssessment";
import CoreValueSupervisorEvaluation from "./CoreValueSupervisorEvaluation";

// Mock subordinates data
const mockSubordinates = [
  { id: "emp1", name: "山田 麻衣", department: "営業部", position: "主任" },
  { id: "emp2", name: "佐藤 太郎", department: "企画部", position: "係長" },
  { id: "emp3", name: "鈴木 花子", department: "開発部", position: "一般" },
];

export default function EvaluationFeedbackDisplay() {
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [currentPeriod, setCurrentPeriod] = useState<EvaluationPeriod | null>(null);
  const [allPeriods, setAllPeriods] = useState<EvaluationPeriod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSubordinateId, setSelectedSubordinateId] = useState<string>(mockSubordinates[0].id);

  // Fetch evaluation periods on mount
  useEffect(() => {
    const fetchPeriods = async () => {
      try {
        setIsLoading(true);
        const result = await getCategorizedEvaluationPeriodsAction();

        if (result.success && result.data) {
          const periods = result.data.all || [];
          setAllPeriods(periods);

          // Set current period
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

  // Handle subordinate change
  const handleSubordinateChange = (subordinateId: string) => {
    setSelectedSubordinateId(subordinateId);
  };

  const selectedSubordinate = mockSubordinates.find(s => s.id === selectedSubordinateId);

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">評価フィードバック入力</h1>
            <p className="text-sm text-muted-foreground mt-1">
              部下の自己評価を確認し、上長としてのフィードバックを入力してください
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <EvaluationPeriodSelector
              periods={allPeriods}
              selectedPeriodId={selectedPeriodId}
              currentPeriodId={currentPeriod?.id || null}
              onPeriodChange={handlePeriodChange}
              isLoading={isLoading}
            />

            {/* Subordinate Selector */}
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">部下:</span>
              <Select value={selectedSubordinateId} onValueChange={handleSubordinateChange}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {mockSubordinates.map((subordinate) => (
                    <SelectItem key={subordinate.id} value={subordinate.id}>
                      {subordinate.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Subordinate Info */}
        <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="p-2 rounded-full bg-blue-100 text-blue-700">
            <User className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg font-bold text-blue-900">{selectedSubordinate?.name}</div>
            <div className="text-xs text-blue-700">
              {selectedSubordinate?.position} / {selectedSubordinate?.department}
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">
            最終提出
          </Button>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Self Assessment (Read-only) */}
          <div className="space-y-6">
            <div className="sticky top-4">
              <h2 className="text-lg font-bold mb-4 text-blue-700">
                {selectedSubordinate?.name}の自己評価
              </h2>
              <div className="space-y-6">
                <PerformanceGoalsSelfAssessment />
                <CompetencySelfAssessment />
                <CoreValueSelfAssessment />
              </div>
            </div>
          </div>

          {/* Right Column: Supervisor Evaluation (Editable) */}
          <div className="space-y-6">
            <div className="sticky top-4">
              <h2 className="text-lg font-bold mb-4 text-green-700">上長評価</h2>
              <div className="space-y-6">
                <PerformanceGoalsSupervisorEvaluation />
                <CompetencySupervisorEvaluation />
                <CoreValueSupervisorEvaluation />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
