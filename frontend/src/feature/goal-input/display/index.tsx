'use client';

import { useState } from 'react';
import { StepIndicator } from '@/components/ui/step-indicator';
import { PerformanceGoalsStep } from './PerformanceGoalsStep';
import { CompetencyGoalsStep } from './CompetencyGoalsStep';
import { ConfirmationStep } from './ConfirmationStep';

const steps = [
  { id: 1, title: '業績目標入力' },
  { id: 2, title: 'コンピテンシー目標入力' },
  { id: 3, title: '確認&提出' },
];

export default function GoalInputPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [goalData, setGoalData] = useState({
    performanceGoals: [],
    competencyGoals: [],
  });

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handlePerformanceGoalsChange = (goals: any[]) => {
    setGoalData(prev => ({
      
      ...prev,
      performanceGoals: goals
    }));
  };

  const handleCompetencyGoalsChange = (goals: any[]) => {
    setGoalData(prev => ({
      ...prev,
      competencyGoals: goals
    }));
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <PerformanceGoalsStep
            goals={goalData.performanceGoals}
            onGoalsChange={handlePerformanceGoalsChange}
            onNext={handleNext}
          />
        );
      case 2:
        return (
          <CompetencyGoalsStep
            goals={goalData.competencyGoals}
            onGoalsChange={handleCompetencyGoalsChange}
            onNext={handleNext}
            onPrevious={handlePrevious}
          />
        );
      case 3:
        return (
          <ConfirmationStep
            performanceGoals={goalData.performanceGoals}
            competencyGoals={goalData.competencyGoals}
            onPrevious={handlePrevious}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <StepIndicator
          steps={steps}
          currentStep={currentStep}
          className="mb-8"
        />
      </div>

      <div>
        {renderCurrentStep()}
      </div>
    </div>
  );
}