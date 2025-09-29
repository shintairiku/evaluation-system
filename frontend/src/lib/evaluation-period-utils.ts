import { PeriodType, EvaluationPeriodStatus } from '@/api/types/evaluation-period';

/**
 * Utility functions for evaluation period management
 */

/**
 * Calculate end date based on start date and period type
 */
export const calculateEndDate = (startDate: Date, periodType: PeriodType): Date => {
  const start = new Date(startDate);

  switch (periodType) {
    case '半期':
      return addMonths(start, 6);
    case '月次':
      return addMonths(start, 1);
    case '四半期':
      return addMonths(start, 3);
    case '年次':
      return addYears(start, 1);
    case 'その他':
      return start; // No automatic calculation
    default:
      return start;
  }
};

/**
 * Add months to a date
 */
export const addMonths = (date: Date, months: number): Date => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);

  // Handle month overflow (e.g., Jan 31 + 1 month should be Feb 28/29, not Mar 3)
  if (result.getDate() !== date.getDate()) {
    result.setDate(0); // Set to last day of previous month
  }

  return result;
};

/**
 * Add years to a date
 */
export const addYears = (date: Date, years: number): Date => {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);

  // Handle leap year overflow (Feb 29 + 1 year in non-leap year)
  if (result.getDate() !== date.getDate()) {
    result.setDate(0); // Set to last day of previous month
  }

  return result;
};

/**
 * Format date to ISO date string (YYYY-MM-DD)
 */
export const formatDateToISO = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

/**
 * Parse ISO date string to Date object
 */
export const parseDateFromISO = (dateString: string): Date => {
  return new Date(dateString + 'T00:00:00');
};

/**
 * Calculate evaluation period status based on dates and current time
 */
export const calculatePeriodStatus = (
  startDate: string,
  endDate: string,
  currentDate?: Date
): EvaluationPeriodStatus => {
  const now = currentDate || new Date();
  const start = parseDateFromISO(startDate);
  const end = parseDateFromISO(endDate);

  if (now < start) {
    return 'draft';
  } else if (now >= start && now <= end) {
    return 'active';
  } else {
    return 'completed';
  }
};

/**
 * Get status label in Japanese
 */
export const getStatusLabel = (status: EvaluationPeriodStatus): string => {
  switch (status) {
    case 'draft':
      return '下書き';
    case 'active':
      return '実施中';
    case 'completed':
      return '完了';
    case 'cancelled':
      return 'キャンセル';
    default:
      return '不明';
  }
};

/**
 * Get status color for visual indicators
 */
export const getStatusColor = (status: EvaluationPeriodStatus): string => {
  switch (status) {
    case 'draft':
      return 'text-gray-600 bg-gray-100';
    case 'active':
      return 'text-green-700 bg-green-100';
    case 'completed':
      return 'text-blue-700 bg-blue-100';
    case 'cancelled':
      return 'text-red-700 bg-red-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
};

/**
 * Validate that end date is after start date
 */
export const isValidDateRange = (startDate: string, endDate: string): boolean => {
  const start = parseDateFromISO(startDate);
  const end = parseDateFromISO(endDate);
  return end > start;
};

/**
 * Validate that deadline is within the period range
 */
export const isDeadlineValid = (
  deadline: string,
  startDate: string,
  endDate: string
): boolean => {
  const deadlineDate = parseDateFromISO(deadline);
  const start = parseDateFromISO(startDate);
  const end = parseDateFromISO(endDate);

  return deadlineDate >= start && deadlineDate <= end;
};

/**
 * Calculate days remaining until period end
 */
export const getDaysRemaining = (endDate: string, currentDate?: Date): number => {
  const now = currentDate || new Date();
  const end = parseDateFromISO(endDate);
  const timeDiff = end.getTime() - now.getTime();
  return Math.ceil(timeDiff / (1000 * 3600 * 24));
};

/**
 * Check if date is today
 */
export const isToday = (dateString: string): boolean => {
  const date = parseDateFromISO(dateString);
  const today = new Date();

  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
};

/**
 * Format date for display (Japanese format)
 * Supports both ISO date strings and datetime objects/timestamps
 */
export const formatDateForDisplay = (dateInput: string | Date | null | undefined): string => {
  if (!dateInput) {
    return '未設定';
  }

  try {
    let date: Date;

    if (typeof dateInput === 'string') {
      // Check if it's a full ISO datetime string (contains T)
      if (dateInput.includes('T')) {
        // Handle full ISO datetime string
        date = new Date(dateInput);
      } else {
        // Handle simple date string (YYYY-MM-DD)
        date = parseDateFromISO(dateInput);
      }
    } else if (dateInput instanceof Date) {
      // Handle Date object
      date = dateInput;
    } else {
      // Handle timestamp or other formats
      date = new Date(dateInput);
    }

    if (isNaN(date.getTime())) {
      return '無効な日付';
    }

    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (error) {
    console.error('formatDateForDisplay error:', error);
    return '無効な日付';
  }
};

/**
 * Format date range for display
 */
export const formatDateRangeForDisplay = (startDate: string | Date | null | undefined, endDate: string | Date | null | undefined): string => {
  return `${formatDateForDisplay(startDate)} ～ ${formatDateForDisplay(endDate)}`;
};