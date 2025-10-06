"use client";

import PerformanceGoalsEvaluate from "./PerformanceGoalsEvaluate";
import CompetencyEvaluate from "./CompetencyEvaluate";
import CoreValueEvaluate from "./CoreValueEvaluate";
import SaveDraftButton from "../components/SaveDraft";
import SubmitButton from "../components/SubmitButton";

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
