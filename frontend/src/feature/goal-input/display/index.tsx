'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

// Lightweight debug logger that is no-op in production
const debugLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== 'production') console.debug(...args);
};
import { StepIndicator } from '@/components/ui/step-indicator';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { PerformanceGoalsStep } from './PerformanceGoalsStep';
import { CompetencyGoalsStep } from './CompetencyGoalsStep';
import { ConfirmationStep } from './ConfirmationStep';
import { EvaluationPeriodSelector } from '@/components/display/EvaluationPeriodSelector';
import { useGoalData } from '@/hooks/useGoalData';
import { usePeriodSelection } from '@/hooks/usePeriodSelection';
import { useGoalAutoSave } from '@/hooks/useGoalAutoSave';
import { useUserRoles } from '@/hooks/useUserRoles';
import type { StageWeightBudget } from '../types';
import { DEFAULT_STAGE_WEIGHT_BUDGET, getDefaultAchievementCriteria } from '../types';
// useLoading removed - using simpler approach
import type { EvaluationPeriod } from '@/api/types';

const steps = [
  { id: 1, title: '業績目標入力' },
  { id: 2, title: 'コンピテンシー目標入力' },
  { id: 3, title: '確認&提出' },
];

export default function GoalInputPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const loadedGoalsKeyRef = useRef<string | null>(null);
  const autoSaveActivationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Note: goalLoading removed as we're using simpler approach
  
  // Goal data management
  const {
    goalData,
    updatePerformanceGoals,
    updateCompetencyGoals,
    loadGoalsFromServer,
    resetGoalData,
    replaceGoalWithServerData,
    goalTracking,
  } = useGoalData();
  
  const { currentUser, isLoading: isUserLoading } = useUserRoles();

  // Period selection and goal loading
  const {
    selectedPeriod,
    isLoadingExistingGoals,
    isAutoSaveReady,
    isGoalFetching,
    hasBlockingGoals,
    blockingMessage,
    loadedGoals,
    handlePeriodSelected,
    activateAutoSave,
    clearPeriodSelection,
  } = usePeriodSelection(currentUser?.id);

  const stageBudgets: StageWeightBudget = currentUser?.goalWeightBudget
    ? {
        quantitative: Number(currentUser.goalWeightBudget.quantitative ?? DEFAULT_STAGE_WEIGHT_BUDGET.quantitative),
        qualitative: Number(currentUser.goalWeightBudget.qualitative ?? DEFAULT_STAGE_WEIGHT_BUDGET.qualitative),
        competency: Number(currentUser.goalWeightBudget.competency ?? DEFAULT_STAGE_WEIGHT_BUDGET.competency),
        stageName: currentUser.stage?.name,
      }
    : currentUser?.stage
      ? {
          quantitative: Number(currentUser.stage.quantitativeWeight ?? DEFAULT_STAGE_WEIGHT_BUDGET.quantitative),
          qualitative: Number(currentUser.stage.qualitativeWeight ?? DEFAULT_STAGE_WEIGHT_BUDGET.qualitative),
          competency: Number(currentUser.stage.competencyWeight ?? DEFAULT_STAGE_WEIGHT_BUDGET.competency),
          stageName: currentUser.stage.name,
        }
      : DEFAULT_STAGE_WEIGHT_BUDGET;

  // Load existing goals into form when they're fetched - ensure it runs only once per period/goals set
  useEffect(() => {
    // Only proceed when loading has fully completed and we do have goals to inject
    if (!loadedGoals || isLoadingExistingGoals || isGoalFetching) {
      return;
    }

    // Build a stable key from period + goal IDs to avoid repeated injections
    const perfIds = loadedGoals.performanceGoals.map(g => g.id).sort().join(',');
    const compIds = loadedGoals.competencyGoals.map(g => g.id).sort().join(',');
    const periodId = selectedPeriod?.id ?? 'none';
    const currentKey = `${periodId}|${perfIds}|${compIds}`;

    if (loadedGoalsKeyRef.current === currentKey) {
      return; // already injected for this set
    }

    loadedGoalsKeyRef.current = currentKey;

    debugLog('🚀 LOADING ALL GOALS INTO FORM FIELDS NOW!', loadedGoals);
    loadGoalsFromServer(loadedGoals.performanceGoals, loadedGoals.competencyGoals);

    // Delay auto-save activation to ensure state settles; also clean up any prior timeout
    if (autoSaveActivationTimeoutRef.current) {
      clearTimeout(autoSaveActivationTimeoutRef.current);
    }
    autoSaveActivationTimeoutRef.current = setTimeout(() => {
      debugLog('🚀 Auto-save activation delayed - now ready!');
      activateAutoSave();
    }, 800);

    return () => {
      if (autoSaveActivationTimeoutRef.current) {
        clearTimeout(autoSaveActivationTimeoutRef.current);
        autoSaveActivationTimeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedGoals, isLoadingExistingGoals, isGoalFetching, selectedPeriod?.id]);

  // When there are no loaded goals and loading has finished, ensure the form has a single initial row
  useEffect(() => {
    if (isLoadingExistingGoals || isGoalFetching) {
      return;
    }

    // Only when there is no server data and the current form is empty, create an initial goal row
    const noServerGoals = !loadedGoals || (loadedGoals.performanceGoals.length === 0 && loadedGoals.competencyGoals.length === 0);
    const formIsEmpty = goalData.performanceGoals.length === 0;
    if (noServerGoals && formIsEmpty) {
      const initialGoal = {
        id: Date.now().toString(),
        type: 'quantitative' as const,
        title: '',
        specificGoal: '',
        achievementCriteria: getDefaultAchievementCriteria('quantitative'),
        method: '',
        weight: 50,
      };
      updatePerformanceGoals([initialGoal]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingExistingGoals, isGoalFetching, loadedGoals]);
  // Note: loadGoalsFromServer and activateAutoSave removed from deps to prevent infinite re-renders
  // These functions are stable within the scope of this effect

  // Auto-save functionality - will only be active when period is selected
  const { isAutoSaving } = useGoalAutoSave({
    goalData,
    selectedPeriod,
    isLoadingExistingGoals,
    isAutoSaveReady,
    goalTracking,
    onGoalReplaceWithServerData: replaceGoalWithServerData,
    stageBudgets,
  });

  // Wrapper for period selection that includes data loading
  const handlePeriodSelection = (period: EvaluationPeriod) => {
    handlePeriodSelected(period, resetGoalData);
  };

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

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <PerformanceGoalsStep
            goals={goalData.performanceGoals}
            onGoalsChange={updatePerformanceGoals}
            goalTracking={goalTracking}
            periodId={selectedPeriod?.id}
            onNext={handleNext}
            stageBudgets={stageBudgets}
            isAutoSaving={isAutoSaving}
          />
        );
      case 2:
        return (
          <CompetencyGoalsStep
            goals={goalData.competencyGoals}
            onGoalsChange={updateCompetencyGoals}
            goalTracking={goalTracking}
            periodId={selectedPeriod?.id}
            onNext={handleNext}
            onPrevious={handlePrevious}
            stageBudgets={stageBudgets}
            userStageId={currentUser?.stage?.id}
          />
        );
      case 3:
        return (
          <ConfirmationStep
            performanceGoals={goalData.performanceGoals}
            competencyGoals={goalData.competencyGoals}
            periodId={selectedPeriod?.id}
            currentUserId={currentUser?.id}
            onPrevious={handlePrevious}
            stageBudgets={stageBudgets}
          />
        );
      default:
        return null;
    }
  };

  // Show period selector first
  if (isUserLoading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">ユーザー情報を読み込み中...</div>
    );
  }

  if (!currentUser?.stage) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>ステージ未設定</AlertTitle>
          <AlertDescription>
            ゴールを作成する前にステージを設定してください。管理者にお問い合わせください。
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!selectedPeriod) {
    return (
      <div className="p-6">
        <EvaluationPeriodSelector onPeriodSelected={handlePeriodSelection} />
      </div>
    );
  }

  // Show loading state during goal fetching
  if (isGoalFetching) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">目標データを読み込み中...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show goal input form after period is selected
  return (
    <div className="p-6">
      {/* Show selected period info */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-blue-900">
              選択中の評価期間: {selectedPeriod.name}
            </h2>
            <p className="text-sm text-blue-700">
              {new Date(selectedPeriod.start_date).toLocaleDateString('ja-JP')} 〜 {new Date(selectedPeriod.end_date).toLocaleDateString('ja-JP')}
            </p>
          </div>
          <button
            onClick={clearPeriodSelection}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            期間を変更
          </button>
        </div>
      </div>

      {/* TASK-04: Show blocking alert when submitted/approved goals exist */}
      {hasBlockingGoals && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>新しい目標を作成できません</AlertTitle>
          <AlertDescription>
            {blockingMessage}
            <Link href="/goal-list" className="underline ml-2 font-medium hover:text-red-900">
              目標一覧ページで確認してください
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Only show steps and form when NOT blocked */}
      {!hasBlockingGoals && (
        <>
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
        </>
      )}
    </div>
  );
}
