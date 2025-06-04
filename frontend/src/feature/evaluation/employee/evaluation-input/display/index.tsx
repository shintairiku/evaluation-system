"use client";

import PerformanceGoalsEvaluate from "./PerformanceGoalsEvaluate";
import CompetencyEvaluate from "./CompetencyEvaluate";
import CoreValueEvaluate from "./CoreValueEvaluate";
import SaveDraftButton from "../components/SaveDraft";
import SubmitButton from "../components/SubmitButton";
// ダミーデータ
const employeeStage = "中堅社員";
const performanceEvaluations = [
  {
    id: "perf-1",
    type: "quantitative",
    label: "売上目標を達成する",
    score: 80,
    comment: "目標達成に向けてよく頑張った"
  },
  {
    id: "perf-2",
    type: "qualitative",
    label: "顧客満足度向上",
    score: 90,
    comment: "顧客対応が丁寧で高評価"
  }
];
const competencyEvaluation = {
  name: "チームワーク・協調性",
  score: 85,
  comment: "チーム内での連携が良かった"
};
const coreValueEvaluation = {
  comment: "会社のコアバリューを意識した行動ができていた"
};

export default function EmployeeEvaluationInputDisplay() {
  return (
    <div>
      <div className="space-y-6">
        <PerformanceGoalsEvaluate />
        <CompetencyEvaluate />
        <CoreValueEvaluate />
        {/* Action Buttons */}
        <div className="flex justify-center space-x-4 pt-6">
          <SaveDraftButton />
          <SubmitButton />
        </div>
      </div>
    </div>
  );
}
