import type {
  EvaluationPeriod,
  CategorizedEvaluationPeriods,
  GoalStatistics,
  EvaluationPeriodFormData
} from '@/api/types/evaluation-period';

/**
 * Component prop types for evaluation period management feature
 */

export interface EvaluationPeriodManagementContainerProps {
  initialPeriods: CategorizedEvaluationPeriods;
  initialView: ViewType;
}

export interface EvaluationPeriodManagementViewProps {
  periods: CategorizedEvaluationPeriods;
  view: ViewType;
  onViewChange: (view: ViewType) => void;
  onCreatePeriod: () => void;
  onEditPeriod: (period: EvaluationPeriod) => void;
  onDeletePeriod: (period: EvaluationPeriod) => void;
  onViewGoalStats: (period: EvaluationPeriod) => void;
  isLoading?: boolean;
  modalState: ModalState;
  sidePanelState: SidePanelState;
  goalStats?: GoalStatistics;
  onFormSubmit: (data: EvaluationPeriodFormData) => Promise<void>;
  onDeleteConfirm: () => Promise<void>;
  onCloseModal: (modalType: keyof ModalState) => void;
  onCloseSidePanel: (panelType: keyof SidePanelState) => void;
}

export interface EvaluationPeriodListViewProps {
  categorizedPeriods: CategorizedEvaluationPeriods;
  onEditPeriod: (period: EvaluationPeriod) => void;
  onDeletePeriod: (period: EvaluationPeriod) => void;
  onViewGoalStats: (period: EvaluationPeriod) => void;
}

export interface EvaluationPeriodCalendarViewProps {
  periods: EvaluationPeriod[];
  viewMode?: CalendarViewMode;
  onPeriodClick: (period: EvaluationPeriod) => void;
  onDateClick: (date: Date) => void;
  onViewModeChange?: (mode: CalendarViewMode) => void;
}

export interface PeriodCardProps {
  period: EvaluationPeriod;
  onEdit: (period: EvaluationPeriod) => void;
  onDelete: (period: EvaluationPeriod) => void;
  onViewGoalStats: (period: EvaluationPeriod) => void;
}

export interface CreateEditPeriodModalProps {
  isOpen: boolean;
  onClose: () => void;
  period?: EvaluationPeriod; // undefined for create mode
  onSubmit: (data: EvaluationPeriodFormData) => Promise<void>;
  isSubmitting?: boolean;
}

export interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  period: EvaluationPeriod;
  onConfirm: () => Promise<void>;
  isDeleting?: boolean;
}

export interface GoalStatisticsSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  period: EvaluationPeriod;
  goalStats?: GoalStatistics;
  isLoading?: boolean;
}

export interface EvaluationPeriodManagementHeaderProps {
  view: ViewType;
  onViewChange: (view: ViewType) => void;
  onCreatePeriod: () => void;
}

export interface UserActivityTableProps {
  goalStats: GoalStatistics;
  onUserClick?: (userId: string) => void;
}

// Modal and panel states
export type ModalState = {
  createEdit: {
    isOpen: boolean;
    period?: EvaluationPeriod;
  };
  delete: {
    isOpen: boolean;
    period?: EvaluationPeriod;
  };
};

export type SidePanelState = {
  goalStats: {
    isOpen: boolean;
    period?: EvaluationPeriod;
  };
};

// View types
export type ViewType = 'calendar' | 'calendar-3month' | 'calendar-year' | 'list';
export type CalendarViewMode = 'month' | '3month' | 'year';