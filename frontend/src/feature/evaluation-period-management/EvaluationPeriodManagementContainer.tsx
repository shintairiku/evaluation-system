'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type {
  EvaluationPeriod,
  CategorizedEvaluationPeriods,
  EvaluationPeriodFormData,
  GoalStatistics
} from '@/api/types/evaluation-period';
import type {
  EvaluationPeriodManagementContainerProps,
  ModalState,
  SidePanelState,
  ViewType
} from './types';
import {
  createEvaluationPeriodAction,
  updateEvaluationPeriodAction,
  deleteEvaluationPeriodAction,
  getEvaluationPeriodGoalStatisticsAction
} from '@/api/server-actions/evaluation-periods';
import EvaluationPeriodManagementView from './EvaluationPeriodManagementView';

export default function EvaluationPeriodManagementContainer({
  initialPeriods,
  initialView
}: EvaluationPeriodManagementContainerProps) {
  const router = useRouter();

  // State management
  const [periods, setPeriods] = useState<CategorizedEvaluationPeriods>(initialPeriods);
  const [view, setView] = useState<ViewType>(initialView);
  const [isLoading, setIsLoading] = useState(false);
  const [goalStats, setGoalStats] = useState<GoalStatistics | undefined>();

  // Keep client state in sync with server-refreshed props
  useEffect(() => {
    setPeriods(initialPeriods);
  }, [initialPeriods]);

  // Modal states
  const [modalState, setModalState] = useState<ModalState>({
    createEdit: { isOpen: false },
    delete: { isOpen: false }
  });

  // Side panel states
  const [sidePanelState, setSidePanelState] = useState<SidePanelState>({
    goalStats: { isOpen: false }
  });

  // Update URL when view changes
  const handleViewChange = useCallback((newView: ViewType) => {
    setView(newView);
    router.push(`/evaluation-period-management?view=${newView}`, { scroll: false });
  }, [router]);

  // Handle create period
  const handleCreatePeriod = useCallback(() => {
    setModalState(prev => ({
      ...prev,
      createEdit: { isOpen: true }
    }));
  }, []);

  // Handle edit period
  const handleEditPeriod = useCallback((period: EvaluationPeriod) => {
    setModalState(prev => ({
      ...prev,
      createEdit: { isOpen: true, period }
    }));
  }, []);

  // Handle delete period confirmation
  const handleDeletePeriod = useCallback((period: EvaluationPeriod) => {
    if (period.status !== 'draft') {
      toast.error('削除できるのは「下書き」の評価期間のみです');
      return;
    }

    setModalState(prev => ({
      ...prev,
      delete: { isOpen: true, period }
    }));
  }, []);

  // Handle view goal statistics
  const handleViewGoalStats = useCallback(async (period: EvaluationPeriod) => {
    setSidePanelState(prev => ({
      ...prev,
      goalStats: { isOpen: true, period }
    }));

    setIsLoading(true);
    try {
      const result = await getEvaluationPeriodGoalStatisticsAction(period.id);
      if (result.success && result.data) {
        setGoalStats(result.data);
      } else {
        toast.error(result.error || '目標統計の取得に失敗しました');
      }
    } catch {
      toast.error('目標統計の取得中にエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle create/edit form submission
  const handleFormSubmit = useCallback(async (data: EvaluationPeriodFormData) => {
    setIsLoading(true);
    try {
      let result;

      if (modalState.createEdit.period) {
        // Update existing period
        result = await updateEvaluationPeriodAction(modalState.createEdit.period.id, data);
        if (result.success) {
          toast.success('評価期間を更新しました');
        }
      } else {
        // Create new period
        result = await createEvaluationPeriodAction(data);
        if (result.success) {
          toast.success('評価期間を作成しました');
        }
      }

      if (!result.success) {
        toast.error(result.error || '評価期間の保存に失敗しました');
        return;
      }

      // Close modal and refresh data
      setModalState(prev => ({ ...prev, createEdit: { isOpen: false } }));
      router.refresh(); // Refresh server component data

    } catch {
      toast.error('評価期間の保存中にエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  }, [modalState.createEdit.period, router]);

  // Handle delete confirmation
  const handleDeleteConfirm = useCallback(async () => {
    if (!modalState.delete.period) return;

    setIsLoading(true);
    try {
      const result = await deleteEvaluationPeriodAction(modalState.delete.period.id);

      if (result.success) {
        toast.success('評価期間を削除しました');
        setModalState(prev => ({ ...prev, delete: { isOpen: false } }));
        router.refresh(); // Refresh server component data
      } else {
        toast.error(result.error || '評価期間の削除に失敗しました');
      }
    } catch {
      toast.error('評価期間の削除中にエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  }, [modalState.delete.period, router]);

  // Close modals
  const handleCloseModal = useCallback((modalType: keyof ModalState) => {
    setModalState(prev => ({
      ...prev,
      [modalType]: { isOpen: false }
    }));
  }, []);

  // Close side panels
  const handleCloseSidePanel = useCallback((panelType: keyof SidePanelState) => {
    setSidePanelState(prev => ({
      ...prev,
      [panelType]: { isOpen: false }
    }));

    if (panelType === 'goalStats') {
      setGoalStats(undefined);
    }
  }, []);

  return (
    <EvaluationPeriodManagementView
      periods={periods}
      view={view}
      onViewChange={handleViewChange}
      onCreatePeriod={handleCreatePeriod}
      onEditPeriod={handleEditPeriod}
      onDeletePeriod={handleDeletePeriod}
      onViewGoalStats={handleViewGoalStats}
      isLoading={isLoading}
      modalState={modalState}
      sidePanelState={sidePanelState}
      goalStats={goalStats}
      onFormSubmit={handleFormSubmit}
      onDeleteConfirm={handleDeleteConfirm}
      onCloseModal={handleCloseModal}
      onCloseSidePanel={handleCloseSidePanel}
    />
  );
}
