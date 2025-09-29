'use client';

import React, { useState } from 'react';
import type { EvaluationPeriodManagementViewProps, CalendarViewMode } from './types';
import EvaluationPeriodManagementHeader from './components/EvaluationPeriodManagementHeader';
import EvaluationPeriodListView from './components/EvaluationPeriodListView';
import EvaluationPeriodCalendarView from './components/EvaluationPeriodCalendarView';
import CreateEditPeriodModal from './components/CreateEditPeriodModal';
import DeleteConfirmationModal from './components/DeleteConfirmationModal';
import GoalStatisticsSidePanel from './components/GoalStatisticsSidePanel';

export default function EvaluationPeriodManagementView({
  periods,
  view,
  onViewChange,
  onCreatePeriod,
  onEditPeriod,
  onDeletePeriod,
  onViewGoalStats,
  isLoading,
  modalState,
  sidePanelState,
  goalStats,
  onFormSubmit,
  onDeleteConfirm,
  onCloseModal,
  onCloseSidePanel
}: EvaluationPeriodManagementViewProps) {
  const [calendarViewMode, setCalendarViewMode] = useState<CalendarViewMode>('month');
  return (
    <div className="space-y-6">
      {/* Header with view controls and create button */}
      <EvaluationPeriodManagementHeader
        view={view}
        onViewChange={onViewChange}
        onCreatePeriod={onCreatePeriod}
      />

      {/* Main content area */}
      <div className="min-h-[600px]">
        {view === 'list' ? (
          <EvaluationPeriodListView
            categorizedPeriods={periods}
            onEditPeriod={onEditPeriod}
            onDeletePeriod={onDeletePeriod}
            onViewGoalStats={onViewGoalStats}
          />
        ) : (
          <EvaluationPeriodCalendarView
            periods={periods.all}
            viewMode={calendarViewMode}
            onPeriodClick={onEditPeriod}
            onDateClick={(date) => {
              // Future: Create period with selected date
              console.log('Date clicked:', date);
            }}
            onViewModeChange={setCalendarViewMode}
          />
        )}
      </div>

      {/* Modals */}
      <CreateEditPeriodModal
        isOpen={modalState.createEdit.isOpen}
        onClose={() => onCloseModal('createEdit')}
        period={modalState.createEdit.period}
        onSubmit={onFormSubmit}
        isSubmitting={isLoading}
      />

      {modalState.delete.period && (
        <DeleteConfirmationModal
          isOpen={modalState.delete.isOpen}
          onClose={() => onCloseModal('delete')}
          period={modalState.delete.period}
          onConfirm={onDeleteConfirm}
          isDeleting={isLoading}
        />
      )}

      {/* Side Panels */}
      {sidePanelState.goalStats.period && (
        <GoalStatisticsSidePanel
          isOpen={sidePanelState.goalStats.isOpen}
          onClose={() => onCloseSidePanel('goalStats')}
          period={sidePanelState.goalStats.period}
          goalStats={goalStats}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}