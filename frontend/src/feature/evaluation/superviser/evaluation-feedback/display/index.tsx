"use client";

import { useState, useEffect } from "react";
import { EvaluationPeriodSelector } from "@/components/evaluation/EvaluationPeriodSelector";
import { EmployeeInfoCard } from "@/components/evaluation/EmployeeInfoCard";
import { getCategorizedEvaluationPeriodsAction } from "@/api/server-actions/evaluation-periods";
import { getSubordinatesAction, getCurrentUserAction } from "@/api/server-actions/users";
import { getSelfAssessmentsAction } from "@/api/server-actions/self-assessments";
import type {
  EvaluationPeriod,
  UserDetailResponse,
} from "@/api/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { User, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import PerformanceGoalsSelfAssessment from "./PerformanceGoalsSelfAssessment";
import PerformanceGoalsSupervisorEvaluation from "./PerformanceGoalsSupervisorEvaluation";
import CompetencySelfAssessment from "./CompetencySelfAssessment";
import CompetencySupervisorEvaluation from "./CompetencySupervisorEvaluation";
import CoreValueSelfAssessment from "./CoreValueSelfAssessment";
import CoreValueSupervisorEvaluation from "./CoreValueSupervisorEvaluation";

// Subordinate with submission status
interface SubordinateWithStatus extends UserDetailResponse {
  allAssessmentsSubmitted: boolean;
  submittedCount: number;
  totalCount: number;
}

export default function EvaluationFeedbackDisplay() {
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [currentPeriod, setCurrentPeriod] = useState<EvaluationPeriod | null>(null);
  const [allPeriods, setAllPeriods] = useState<EvaluationPeriod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSubordinates, setIsLoadingSubordinates] = useState(false);

  const [currentUser, setCurrentUser] = useState<UserDetailResponse | null>(null);
  const [subordinates, setSubordinates] = useState<SubordinateWithStatus[]>([]);
  const [selectedSubordinateId, setSelectedSubordinateId] = useState<string>("");

  // Fetch current user on mount
  useEffect(() => {
    const fetchCurrentUser = async () => {
      const result = await getCurrentUserAction();
      if (result.success && result.data) {
        setCurrentUser(result.data);
      }
    };
    fetchCurrentUser();
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

          // Set current period
          const activePeriod = periods.find(p => p.status === 'active') || periods[0];
          if (activePeriod) {
            setCurrentPeriod(activePeriod);
            setSelectedPeriodId(activePeriod.id);
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchPeriods();
  }, []);

  // Fetch subordinates when current user is available
  useEffect(() => {
    const fetchSubordinates = async () => {
      if (!currentUser?.id || !selectedPeriodId) return;

      try {
        setIsLoadingSubordinates(true);
        const result = await getSubordinatesAction(currentUser.id);

        if (result.success && result.data?.items) {
          // For each subordinate, check their assessment submission status
          const subordinatesWithStatus = await Promise.all(
            result.data.items.map(async (subordinate) => {
              // Fetch self-assessments for this subordinate
              const assessmentsResult = await getSelfAssessmentsAction({
                periodId: selectedPeriodId,
                userId: subordinate.id,
              });

              const assessments = assessmentsResult.data?.items || [];
              const submittedCount = assessments.filter(
                a => a.status === 'submitted' || a.status === 'approved'
              ).length;
              const totalCount = assessments.length;

              return {
                ...subordinate,
                allAssessmentsSubmitted: totalCount > 0 && submittedCount === totalCount,
                submittedCount,
                totalCount,
              };
            })
          );

          setSubordinates(subordinatesWithStatus);

          // Auto-select first subordinate if none selected
          if (!selectedSubordinateId && subordinatesWithStatus.length > 0) {
            setSelectedSubordinateId(subordinatesWithStatus[0].id);
          }
        }
      } finally {
        setIsLoadingSubordinates(false);
      }
    };

    fetchSubordinates();
  }, [currentUser?.id, selectedPeriodId, selectedSubordinateId]);

  // Handle period change
  const handlePeriodChange = (periodId: string) => {
    setSelectedPeriodId(periodId);
  };

  // Handle subordinate change
  const handleSubordinateChange = (subordinateId: string) => {
    setSelectedSubordinateId(subordinateId);
  };

  const selectedSubordinate = subordinates.find(s => s.id === selectedSubordinateId);

  // Check if subordinate has submitted all self-assessments
  const canEvaluate = selectedSubordinate?.allAssessmentsSubmitted ?? false;

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">評価フィードバック入力</h1>
            <p className="text-sm text-muted-foreground mt-1">
              部下の自己評価を確認し、上長としてのフィードバックを入力してください
            </p>
          </div>
          <div className="shrink-0 flex flex-col gap-3 min-w-[336px]">
            <EvaluationPeriodSelector
              periods={allPeriods}
              selectedPeriodId={selectedPeriodId}
              currentPeriodId={currentPeriod?.id || null}
              onPeriodChange={handlePeriodChange}
              isLoading={isLoading}
            />

            {/* Subordinate Selector */}
            <div className="flex items-center gap-2 w-full">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium shrink-0">部下:</span>
              {isLoadingSubordinates ? (
                <div className="flex-1 flex items-center justify-center py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : subordinates.length === 0 ? (
                <span className="text-sm text-muted-foreground">部下がいません</span>
              ) : (
                <Select value={selectedSubordinateId} onValueChange={handleSubordinateChange}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="部下を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {subordinates.map((subordinate) => (
                      <SelectItem key={subordinate.id} value={subordinate.id}>
                        <div className="flex items-center justify-between w-full gap-3">
                          <span>{subordinate.name}</span>
                          {subordinate.totalCount > 0 ? (
                            subordinate.allAssessmentsSubmitted ? (
                              <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                提出済み
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-orange-600 font-medium">
                                <AlertCircle className="w-3.5 h-3.5" />
                                {subordinate.submittedCount}/{subordinate.totalCount}
                              </span>
                            )
                          ) : (
                            <span className="text-xs text-muted-foreground">目標なし</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </div>

        {/* Subordinate Info */}
        {selectedSubordinate && <EmployeeInfoCard employee={selectedSubordinate} />}

        {/* Warning if subordinate hasn't submitted all assessments */}
        {selectedSubordinate && !canEvaluate && selectedSubordinate.totalCount > 0 && (
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">自己評価が未提出です</p>
                <p className="text-sm text-amber-700 mt-1">
                  {selectedSubordinate.name}さんは{selectedSubordinate.totalCount}件中{selectedSubordinate.submittedCount}件の自己評価を提出しています。
                  すべての自己評価が提出されるまでお待ちください。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end">
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            disabled={!canEvaluate}
          >
            最終提出
          </Button>
        </div>

        {/* Headers Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <h2 className="text-lg font-bold text-blue-700">
            {selectedSubordinate?.name || '部下'}の自己評価
          </h2>
          <h2 className="text-lg font-bold text-green-700">上長評価</h2>
        </div>

        {/* Performance Goals Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:items-start">
          <PerformanceGoalsSelfAssessment />
          <PerformanceGoalsSupervisorEvaluation />
        </div>

        {/* Competency Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:items-start">
          <CompetencySelfAssessment />
          <CompetencySupervisorEvaluation />
        </div>

        {/* Core Value Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:items-start">
          <CoreValueSelfAssessment />
          <CoreValueSupervisorEvaluation />
        </div>
      </div>
    </div>
  );
}
