/**
 * Self-Assessment Constants
 * Centralized configuration for self-assessment feature
 */

/**
 * Rating options for self-assessment evaluation
 * Used in dropdown selectors for employee rating selection
 */
export const SELF_ASSESSMENT_RATING_OPTIONS = [
  { value: 'SS', label: 'SS - 卓越 (Outstanding)' },
  { value: 'S', label: 'S - 優秀 (Excellent)' },
  { value: 'A+', label: 'A+ - 非常に良好 (Very Good)' },
  { value: 'A', label: 'A - 良好 (Good)' },
  { value: 'A-', label: 'A- - 良 (Above Average)' },
  { value: 'B', label: 'B - 普通 (Average)' },
  { value: 'C', label: 'C - 要改善 (Needs Improvement)' },
  { value: 'D', label: 'D - 不十分 (Insufficient)' },
] as const;

/**
 * Bucket labels for different evaluation categories
 * Maps bucket keys to Japanese display labels
 */
export const BUCKET_LABELS = {
  quantitative: '定量目標',
  qualitative: '定性目標',
  competency: 'コンピテンシー',
  performance: '目標達成(定量＋定性)',
} as const;

/**
 * UI-related constants for self-assessment
 */
export const SELF_ASSESSMENT_UI = {
  /**
   * Auto-save debounce delay in milliseconds
   * Waits this duration after last user input before triggering save
   */
  AUTO_SAVE_DELAY: 2000,

  /**
   * Duration to show "saved" indicator in milliseconds
   * Success indicator disappears after this duration
   */
  SAVED_INDICATOR_DURATION: 3000,
} as const;

/**
 * UI-related constants for supervisor review
 */
export const SUPERVISOR_REVIEW_UI = {
  /**
   * Auto-save debounce delay for supervisor comments
   * Shorter delay for more responsive supervisor experience
   */
  AUTO_SAVE_DEBOUNCE_MS: 1500,

  /**
   * Duration to show save status indicator
   */
  SAVE_INDICATOR_DURATION_MS: 3000,
} as const;

/**
 * User-facing messages for self-assessment
 */
export const SELF_ASSESSMENT_MESSAGES = {
  SUCCESS: {
    SUBMIT: '自己評価が正常に提出されました',
    SUBMIT_DESCRIPTION: '上司による審査をお待ちください。',
    SAVE_DRAFT: '下書きが保存されました',
  },
  ERROR: {
    LOAD_CONTEXT: '自己評価データの取得に失敗しました',
    SAVE_DRAFT: '下書き保存に失敗しました',
    SUBMIT: '提出に失敗しました',
  },
  LOADING: {
    CONTEXT: '自己評価データの取得中...',
  },
} as const;

/**
 * User-facing messages for supervisor review
 */
export const SUPERVISOR_REVIEW_MESSAGES = {
  SUCCESS: {
    APPROVE: '自己評価を承認しました',
    APPROVE_DESCRIPTION: '承認が完了し、従業員に通知されました。',
    REJECT: '自己評価を差し戻しました',
    REJECT_DESCRIPTION: '従業員に修正依頼が送信されました。',
  },
  ERROR: {
    UPDATE_FAILED: '更新に失敗しました',
    OPERATION_FAILED: '操作に失敗しました',
    COMMENT_REQUIRED: 'コメントが必要です',
    COMMENT_REQUIRED_DESCRIPTION: '差し戻しの際は、少なくとも1つのバケットにコメントを入力してください。',
  },
} as const;
