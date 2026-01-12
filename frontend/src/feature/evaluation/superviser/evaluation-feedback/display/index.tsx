"use client";

import { useState, useEffect } from "react";
import { EvaluationPeriodSelector } from "@/components/evaluation/EvaluationPeriodSelector";
import { EmployeeInfoCard } from "@/components/evaluation/EmployeeInfoCard";
import { getCategorizedEvaluationPeriodsAction } from "@/api/server-actions/evaluation-periods";
import type { EvaluationPeriod, UserDetailResponse } from "@/api/types";
import { UserStatus } from "@/api/types";
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

// Mock subordinates data with feedback submission status
interface SubordinateWithStatus extends UserDetailResponse {
  feedbackSubmitted: boolean;
}

const mockSubordinates: SubordinateWithStatus[] = [
  {
    id: "emp1",
    clerk_user_id: "clerk_emp1",
    name: "山田 麻衣",
    email: "yamada.mai@example.com",
    employee_code: "EMP001",
    status: UserStatus.ACTIVE,
    job_title: "主任",
    department: {
      id: "dept1",
      name: "営業部",
    },
    roles: [
      {
        id: "role1",
        name: "employee",
        description: "一般社員",
        hierarchy_order: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    feedbackSubmitted: false, // 未提出
  },
  {
    id: "emp2",
    clerk_user_id: "clerk_emp2",
    name: "佐藤 太郎",
    email: "sato.taro@example.com",
    employee_code: "EMP002",
    status: UserStatus.ACTIVE,
    job_title: "係長",
    department: {
      id: "dept2",
      name: "企画部",
    },
    roles: [
      {
        id: "role1",
        name: "employee",
        description: "一般社員",
        hierarchy_order: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    feedbackSubmitted: true, // 提出済み
  },
  {
    id: "emp3",
    clerk_user_id: "clerk_emp3",
    name: "鈴木 花子",
    email: "suzuki.hanako@example.com",
    employee_code: "EMP003",
    status: UserStatus.ACTIVE,
    job_title: "一般",
    department: {
      id: "dept3",
      name: "開発部",
    },
    roles: [
      {
        id: "role1",
        name: "employee",
        description: "一般社員",
        hierarchy_order: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    feedbackSubmitted: true, // 提出済み
  },
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
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">評価フィードバック入力</h1>
            <p className="text-sm text-muted-foreground mt-1">
              部下の自己評価を確認し、上長としてのフィードバックを入力してください
            </p>
          </div>
          <div className="shrink-0">
            <EvaluationPeriodSelector
              periods={allPeriods}
              selectedPeriodId={selectedPeriodId}
              currentPeriodId={currentPeriod?.id || null}
              onPeriodChange={handlePeriodChange}
              isLoading={isLoading}
            />
          </div>
        </div>

        {/* Subordinate Info */}
        {selectedSubordinate && <EmployeeInfoCard employee={selectedSubordinate} />}

        {/* Subordinate Selector and Submit Button */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">部下:</span>
            <Select value={selectedSubordinateId} onValueChange={handleSubordinateChange}>
              <SelectTrigger className="w-[320px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {mockSubordinates.map((subordinate) => (
                  <SelectItem key={subordinate.id} value={subordinate.id}>
                    <div className="flex items-center justify-between w-full gap-3">
                      <span>{subordinate.name}</span>
                      {subordinate.feedbackSubmitted ? (
                        <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          提出済み
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-orange-600 font-medium">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                          未提出
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
