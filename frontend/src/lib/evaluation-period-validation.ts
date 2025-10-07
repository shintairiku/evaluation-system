import { EvaluationPeriodFormData, PeriodType } from '@/api/types/evaluation-period';
import { isValidDateRange, isDeadlineValid, parseDateFromISO } from './evaluation-period-utils';

/**
 * Form validation utilities for evaluation period management
 */

export interface ValidationErrors {
  name?: string;
  period_type?: string;
  start_date?: string;
  end_date?: string;
  goal_submission_deadline?: string;
  evaluation_deadline?: string;
  description?: string;
}

/**
 * Validate evaluation period form data
 */
export const validateEvaluationPeriodForm = (
  data: EvaluationPeriodFormData
): ValidationErrors => {
  const errors: ValidationErrors = {};

  // Name validation
  if (!data.name || data.name.trim().length === 0) {
    errors.name = '期間名は必須です';
  } else if (data.name.trim().length > 100) {
    errors.name = '期間名は100文字以内で入力してください';
  } else if (data.name.trim().length < 2) {
    errors.name = '期間名は2文字以上で入力してください';
  }

  // Period type validation
  if (!data.period_type) {
    errors.period_type = '期間タイプを選択してください';
  } else if (!isValidPeriodType(data.period_type)) {
    errors.period_type = '有効な期間タイプを選択してください';
  }

  // Start date validation
  if (!data.start_date) {
    errors.start_date = '開始日は必須です';
  } else if (!isValidDateString(data.start_date)) {
    errors.start_date = '有効な開始日を入力してください';
  }

  // End date validation
  if (!data.end_date) {
    errors.end_date = '終了日は必須です';
  } else if (!isValidDateString(data.end_date)) {
    errors.end_date = '有効な終了日を入力してください';
  } else if (data.start_date && !isValidDateRange(data.start_date, data.end_date)) {
    errors.end_date = '終了日は開始日より後の日付を選択してください';
  }

  // Goal submission deadline validation
  if (!data.goal_submission_deadline) {
    errors.goal_submission_deadline = '目標提出期限は必須です';
  } else if (!isValidDateString(data.goal_submission_deadline)) {
    errors.goal_submission_deadline = '有効な目標提出期限を入力してください';
  } else if (
    data.start_date &&
    data.end_date &&
    !isDeadlineValid(data.goal_submission_deadline, data.start_date, data.end_date)
  ) {
    errors.goal_submission_deadline = '目標提出期限は期間内に設定してください';
  } else if (data.start_date && parseDateFromISO(data.goal_submission_deadline) < parseDateFromISO(data.start_date)) {
    errors.goal_submission_deadline = '目標提出期限は開始日以降に設定してください';
  }

  // Evaluation deadline validation
  if (!data.evaluation_deadline) {
    errors.evaluation_deadline = '評価期限は必須です';
  } else if (!isValidDateString(data.evaluation_deadline)) {
    errors.evaluation_deadline = '有効な評価期限を入力してください';
  } else if (data.end_date && parseDateFromISO(data.evaluation_deadline) < parseDateFromISO(data.end_date)) {
    errors.evaluation_deadline = '評価期限は終了日以降に設定してください';
  } else if (
    data.goal_submission_deadline &&
    parseDateFromISO(data.evaluation_deadline) < parseDateFromISO(data.goal_submission_deadline)
  ) {
    errors.evaluation_deadline = '評価期限は目標提出期限以降に設定してください';
  }

  // Description validation (optional)
  if (data.description && data.description.length > 500) {
    errors.description = '説明は500文字以内で入力してください';
  }

  return errors;
};

/**
 * Check if there are any validation errors
 */
export const hasValidationErrors = (errors: ValidationErrors): boolean => {
  return Object.keys(errors).length > 0;
};

/**
 * Get the first validation error message
 */
export const getFirstErrorMessage = (errors: ValidationErrors): string | null => {
  const firstKey = Object.keys(errors)[0];
  return firstKey ? errors[firstKey as keyof ValidationErrors] || null : null;
};

/**
 * Validate individual field
 */
export const validateField = (
  fieldName: keyof EvaluationPeriodFormData,
  value: string,
  formData?: Partial<EvaluationPeriodFormData>
): string | null => {
  const data = { ...formData, [fieldName]: value } as EvaluationPeriodFormData;
  const errors = validateEvaluationPeriodForm(data);
  return errors[fieldName] || null;
};

/**
 * Check if period type is valid
 */
export const isValidPeriodType = (periodType: string): periodType is PeriodType => {
  return ['半期', '月次', '四半期', '年次', 'その他'].includes(periodType);
};

/**
 * Check if date string is valid
 */
export const isValidDateString = (dateString: string): boolean => {
  if (!dateString) return false;

  // Check YYYY-MM-DD format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) return false;

  // Check if date is actually valid
  const date = new Date(dateString + 'T00:00:00');
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return false;
  }

  // Check if the parsed date matches the input (handles invalid dates like Feb 30)
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const reconstructedDate = `${year}-${month}-${day}`;

  return reconstructedDate === dateString;
};

/**
 * Validate date overlap (for server-side validation)
 */
export const validateDateOverlap = (
  startDate: string,
  endDate: string,
  existingPeriods: Array<{ start_date: string; end_date: string; id?: string }>,
  excludeId?: string
): string | null => {
  const newStart = parseDateFromISO(startDate);
  const newEnd = parseDateFromISO(endDate);

  for (const period of existingPeriods) {
    // Skip the period being edited
    if (excludeId && period.id === excludeId) continue;

    const existingStart = parseDateFromISO(period.start_date);
    const existingEnd = parseDateFromISO(period.end_date);

    // Check for overlap
    if (
      (newStart >= existingStart && newStart <= existingEnd) ||
      (newEnd >= existingStart && newEnd <= existingEnd) ||
      (newStart <= existingStart && newEnd >= existingEnd)
    ) {
      return '期間が既存の評価期間と重複しています';
    }
  }

  return null;
};

/**
 * Sanitize form data
 */
export const sanitizeFormData = (data: EvaluationPeriodFormData): EvaluationPeriodFormData => {
  return {
    ...data,
    name: data.name?.trim() || '',
    description: data.description?.trim() || undefined
  };
};

/**
 * Convert form data to API format
 */
export const convertToApiFormat = (data: EvaluationPeriodFormData): EvaluationPeriodFormData => {
  return sanitizeFormData(data);
};

/**
 * Validate business rules
 */
export const validateBusinessRules = (data: EvaluationPeriodFormData): ValidationErrors => {
  const errors: ValidationErrors = {};

  // Business rule: Goal submission deadline should be reasonable (at least 7 days after start)
  if (data.start_date && data.goal_submission_deadline) {
    const start = parseDateFromISO(data.start_date);
    const goalDeadline = parseDateFromISO(data.goal_submission_deadline);
    const minDays = 1;
    const diffDays = (goalDeadline.getTime() - start.getTime()) / (1000 * 3600 * 24);

    if (diffDays < minDays) {
      errors.goal_submission_deadline = `目標提出期限は開始日から少なくとも${minDays}日後に設定してください`;
    }
  }

  // Business rule: Evaluation deadline should be reasonable (at least 3 days after end)
  if (data.end_date && data.evaluation_deadline) {
    const end = parseDateFromISO(data.end_date);
    const evalDeadline = parseDateFromISO(data.evaluation_deadline);
    const minDays = 1;
    const diffDays = (evalDeadline.getTime() - end.getTime()) / (1000 * 3600 * 24);

    if (diffDays < minDays) {
      errors.evaluation_deadline = `評価期限は終了日から少なくとも${minDays}日後に設定してください`;
    }
  }

  // Business rule: Period should not be too short
  if (data.start_date && data.end_date) {
    const start = parseDateFromISO(data.start_date);
    const end = parseDateFromISO(data.end_date);
    const minDays = data.period_type === '月次' ? 28 : 90;
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 3600 * 24);

    if (diffDays < minDays) {
      errors.end_date = `${data.period_type === '月次' ? '月次' : '期間'}評価は少なくとも${minDays}日間必要です`;
    }
  }

  return errors;
};