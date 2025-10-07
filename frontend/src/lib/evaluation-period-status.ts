/**
 * Evaluation Period Status Mapping System
 *
 * This utility provides mapping between English backend status values
 * and Japanese display labels for evaluation periods. The backend uses
 * English values to match database constraints, while the frontend
 * displays Japanese labels for user experience.
 */

// Backend status values (English) - matching database constraints
export type EvaluationPeriodStatus = 'draft' | 'active' | 'completed' | 'cancelled';

// Display configuration for each status
export type StatusDisplay = {
  label: string;           // Japanese display label
  description: string;     // Japanese description
  variant: 'default' | 'secondary' | 'outline' | 'destructive'; // Badge variant
  color: string;          // Color identifier
};

// Status mapping configuration
const STATUS_DISPLAY_MAP: Record<EvaluationPeriodStatus, StatusDisplay> = {
  'draft': {
    label: '準備中',
    description: '開始前',
    variant: 'secondary',
    color: 'blue'
  },
  'active': {
    label: '実施中',
    description: '進行中',
    variant: 'default',
    color: 'green'
  },
  'completed': {
    label: '完了',
    description: '終了済み',
    variant: 'outline',
    color: 'gray'
  },
  'cancelled': {
    label: 'キャンセル済み',
    description: '中止',
    variant: 'destructive',
    color: 'red'
  }
} as const;

/**
 * Get display configuration for a given status
 */
export const getStatusDisplay = (status: string): StatusDisplay => {
  const normalizedStatus = status as EvaluationPeriodStatus;
  return STATUS_DISPLAY_MAP[normalizedStatus] || {
    label: status,
    description: '不明',
    variant: 'secondary',
    color: 'gray'
  };
};

/**
 * Get badge variant for a given status
 */
export const getStatusVariant = (status: string): StatusDisplay['variant'] => {
  return getStatusDisplay(status).variant;
};

/**
 * Get Japanese label for a given status
 */
export const getStatusLabel = (status: string): string => {
  return getStatusDisplay(status).label;
};

/**
 * Get status description in Japanese
 */
export const getStatusDescription = (status: string): string => {
  return getStatusDisplay(status).description;
};

/**
 * Get status color identifier
 */
export const getStatusColor = (status: string): string => {
  return getStatusDisplay(status).color;
};

/**
 * Check if a status value is valid
 */
export const isValidStatus = (status: string): status is EvaluationPeriodStatus => {
  return status in STATUS_DISPLAY_MAP;
};

/**
 * Get all available status values
 */
export const getAllStatuses = (): EvaluationPeriodStatus[] => {
  return Object.keys(STATUS_DISPLAY_MAP) as EvaluationPeriodStatus[];
};

/**
 * Get all status display configurations
 */
export const getAllStatusDisplays = (): Record<EvaluationPeriodStatus, StatusDisplay> => {
  return STATUS_DISPLAY_MAP;
};