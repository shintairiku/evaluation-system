'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { EvaluationPeriodSelector } from '@/components/evaluation/EvaluationPeriodSelector';
import { getCategorizedEvaluationPeriodsAction } from '@/api/server-actions/evaluation-periods';
import { getMyReviewsAction } from '@/api/server-actions/peer-reviews';
import { getCoreValueDefinitionsAction } from '@/api/server-actions/core-values';
import type { EvaluationPeriod, PeerReviewEvaluation, CoreValueDefinition } from '@/api/types';
import PeerReviewEvaluationForm from './PeerReviewEvaluationForm';
import PeerReviewSubmitButton from '../components/PeerReviewSubmitButton';

export default function PeerReviewPage() {
  // Period state
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [currentPeriod, setCurrentPeriod] = useState<EvaluationPeriod | null>(null);
  const [allPeriods, setAllPeriods] = useState<EvaluationPeriod[]>([]);
  const [isLoadingPeriods, setIsLoadingPeriods] = useState(true);

  // Data state
  const [evaluations, setEvaluations] = useState<PeerReviewEvaluation[]>([]);
  const [definitions, setDefinitions] = useState<CoreValueDefinition[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Accordion state (one card expanded at a time)
  const [expandedEvalId, setExpandedEvalId] = useState<string | null>(null);

  // Fetch evaluation periods on mount
  useEffect(() => {
    const fetchPeriods = async () => {
      try {
        setIsLoadingPeriods(true);
        const result = await getCategorizedEvaluationPeriodsAction();

        if (result.success && result.data) {
          const periods = result.data.all || [];
          setAllPeriods(periods);

          const activePeriod = periods.find(p => p.status === 'active') || periods[0];
          if (activePeriod) {
            setCurrentPeriod(activePeriod);
            setSelectedPeriodId(activePeriod.id);
          }
        }
      } catch (error) {
        console.error('Failed to fetch evaluation periods:', error);
      } finally {
        setIsLoadingPeriods(false);
      }
    };

    fetchPeriods();
  }, []);

  // Fetch reviews and definitions when period changes
  const fetchData = useCallback(async (periodId: string) => {
    if (!periodId) return;

    setIsLoadingData(true);
    try {
      const [reviewsResult, definitionsResult] = await Promise.all([
        getMyReviewsAction(periodId),
        getCoreValueDefinitionsAction(),
      ]);

      if (reviewsResult.success && reviewsResult.data) {
        setEvaluations(reviewsResult.data);
      } else {
        setEvaluations([]);
      }

      if (definitionsResult.success && definitionsResult.data) {
        setDefinitions(definitionsResult.data);
      }
    } catch (error) {
      console.error('Failed to fetch peer reviews:', error);
      setEvaluations([]);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPeriodId) {
      fetchData(selectedPeriodId);
    }
  }, [selectedPeriodId, fetchData]);

  // Handle period change
  const handlePeriodChange = (periodId: string) => {
    setSelectedPeriodId(periodId);
    setExpandedEvalId(null);
  };

  // Handle submit success — refetch data
  const handleSubmitSuccess = useCallback(() => {
    if (selectedPeriodId) {
      fetchData(selectedPeriodId);
    }
  }, [selectedPeriodId, fetchData]);

  // Silent refresh for submit button — refetch without loading state
  const handleSilentRefresh = useCallback(async () => {
    if (!selectedPeriodId) return;
    try {
      const [reviewsResult, definitionsResult] = await Promise.all([
        getMyReviewsAction(selectedPeriodId),
        getCoreValueDefinitionsAction(),
      ]);
      if (reviewsResult.success && reviewsResult.data) {
        setEvaluations(reviewsResult.data);
      }
      if (definitionsResult.success && definitionsResult.data) {
        setDefinitions(definitionsResult.data);
      }
    } catch (error) {
      console.error('Failed to refresh peer reviews:', error);
    }
  }, [selectedPeriodId]);

  // Toggle accordion
  const handleToggle = (evalId: string) => {
    setExpandedEvalId((prev) => (prev === evalId ? null : evalId));
  };

  // Stats
  const submittedCount = evaluations.filter(e => e.status === 'submitted').length;
  const totalCount = evaluations.length;

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">同僚評価</h1>
            <p className="text-sm text-muted-foreground mt-1">
              割り当てられた同僚のコアバリュー評価を行ってください
            </p>
          </div>
          <EvaluationPeriodSelector
            periods={allPeriods}
            selectedPeriodId={selectedPeriodId}
            currentPeriodId={currentPeriod?.id || null}
            onPeriodChange={handlePeriodChange}
            isLoading={isLoadingPeriods}
          />
        </div>

        {/* Stats + Submit Button */}
        {totalCount > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              評価対象: {totalCount}名（提出済み: {submittedCount}名）
            </p>
            <PeerReviewSubmitButton
              evaluations={evaluations}
              definitions={definitions}
              onSubmitSuccess={handleSubmitSuccess}
              onRefreshData={handleSilentRefresh}
              disabled={isLoadingData}
            />
          </div>
        )}

        {/* Loading */}
        {isLoadingData && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">読み込み中...</span>
          </div>
        )}

        {/* Empty state */}
        {!isLoadingData && evaluations.length === 0 && selectedPeriodId && (
          <div className="text-center py-12 text-muted-foreground">
            <p>この期間に割り当てられた同僚評価はありません。</p>
          </div>
        )}

        {/* Expandable cards */}
        {!isLoadingData && evaluations.length > 0 && (
          <div className="max-w-3xl mx-auto space-y-4">
            {evaluations.map((evaluation) => (
              <PeerReviewEvaluationForm
                key={evaluation.id}
                evaluation={evaluation}
                definitions={definitions}
                isExpanded={expandedEvalId === evaluation.id}
                onToggle={() => handleToggle(evaluation.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
