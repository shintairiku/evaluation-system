import { z } from 'zod';

/**
 * Japanese error messages for common validation scenarios
 */

// Common validation messages
export const VALIDATION_MESSAGES = {
  // Required field messages
  REQUIRED: 'この項目は必須です',
  REQUIRED_FIELD: (field: string) => `${field}は必須です`,
  
  // String validation messages
  MIN_LENGTH: (min: number) => `${min}文字以上入力してください`,
  MAX_LENGTH: (max: number) => `${max}文字以内で入力してください`,
  EXACT_LENGTH: (length: number) => `${length}文字で入力してください`,
  
  // Number validation messages
  MIN_VALUE: (min: number) => `${min}以上の値を入力してください`,
  MAX_VALUE: (max: number) => `${max}以下の値を入力してください`,
  POSITIVE_NUMBER: '正の数値を入力してください',
  INTEGER: '整数を入力してください',
  
  // Email validation
  INVALID_EMAIL: '有効なメールアドレスを入力してください',
  
  // UUID validation
  INVALID_UUID: '有効なUUIDを入力してください',
  
  // Date validation
  INVALID_DATE: '有効な日付を入力してください',
  FUTURE_DATE: '未来の日付を入力してください',
  PAST_DATE: '過去の日付を入力してください',
  
  // Selection validation
  INVALID_SELECTION: '有効な選択肢を選んでください',
  REQUIRED_SELECTION: '選択してください',
  MIN_SELECTIONS: (min: number) => `${min}個以上選択してください`,
  MAX_SELECTIONS: (max: number) => `${max}個以下で選択してください`,
  
  // Password validation
  WEAK_PASSWORD: 'パスワードが弱すぎます',
  PASSWORD_MISMATCH: 'パスワードが一致しません',
  
  // File validation
  INVALID_FILE_TYPE: '無効なファイル形式です',
  FILE_TOO_LARGE: (maxSize: string) => `ファイルサイズは${maxSize}以下にしてください`,
  
  // Custom business logic messages
  DUPLICATE_EMAIL: 'このメールアドレスは既に使用されています',
  DUPLICATE_EMPLOYEE_CODE: 'この社員番号は既に使用されています',
  WEIGHT_SUM_ERROR: '重みの合計は100%である必要があります',
  INSUFFICIENT_GOALS: '少なくとも1つの目標を設定してください',
  
  // Form submission messages
  SUBMISSION_ERROR: 'フォームの送信に失敗しました',
  VALIDATION_ERROR: '入力内容を確認してください',
  
  // Network/API messages
  NETWORK_ERROR: 'ネットワークエラーが発生しました',
  API_ERROR: 'サーバーエラーが発生しました',
  UNEXPECTED_ERROR: '予期しないエラーが発生しました',
} as const;

// User-specific validation messages
export const USER_VALIDATION_MESSAGES = {
  NAME_REQUIRED: '名前は必須です',
  EMAIL_REQUIRED: 'メールアドレスは必須です',
  EMPLOYEE_CODE_REQUIRED: '社員番号は必須です',
  DEPARTMENT_REQUIRED: '部署を選択してください',
  STAGE_REQUIRED: 'ステージを選択してください',
  ROLE_REQUIRED: '少なくとも1つの役職を選択してください',
  SUPERVISOR_INVALID: '有効な上司を選択してください',
} as const;

// Goal-specific validation messages
export const GOAL_VALIDATION_MESSAGES = {
  TITLE_REQUIRED: '目標タイトルは必須です',
  SPECIFIC_GOAL_REQUIRED: '具体的な目標は必須です',
  ACHIEVEMENT_CRITERIA_REQUIRED: '達成基準は必須です',
  METHOD_REQUIRED: '実行方法は必須です',
  WEIGHT_REQUIRED: '重みを設定してください',
  WEIGHT_MIN: '重みは1%以上である必要があります',
  WEIGHT_MAX: '重みは100%以下である必要があります',
  WEIGHT_SUM_INVALID: '重みの合計は100%である必要があります',
  COMPETENCY_REQUIRED: 'コンピテンシーを選択してください',
  ACTION_PLAN_REQUIRED: 'アクションプランは必須です',
  ACTION_PLAN_MIN_LENGTH: 'アクションプランは10文字以上で入力してください',
  ACTION_PLAN_MAX_LENGTH: 'アクションプランは1000文字以内で入力してください',
  CORE_VALUE_REQUIRED: 'コアバリューを選択してください',
  SPECIFIC_BEHAVIORS_REQUIRED: '具体的な行動は必須です',
  SPECIFIC_BEHAVIORS_MIN_LENGTH: '具体的な行動は10文字以上で入力してください',
  SPECIFIC_BEHAVIORS_MAX_LENGTH: '具体的な行動は500文字以内で入力してください',
} as const;

/**
 * Custom error map for Zod with Japanese messages
 */
export const japaneseErrorMap: z.ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.expected === 'string') {
        return { message: VALIDATION_MESSAGES.REQUIRED };
      }
      if (issue.expected === 'number') {
        return { message: '数値を入力してください' };
      }
      if (issue.expected === 'boolean') {
        return { message: 'true または false を選択してください' };
      }
      return { message: `${issue.expected}型である必要があります` };

    case z.ZodIssueCode.invalid_literal:
      return { message: `"${issue.expected}" である必要があります` };

    case z.ZodIssueCode.unrecognized_keys:
      return { message: `無効なキー: ${issue.keys.join(', ')}` };

    case z.ZodIssueCode.invalid_union:
      return { message: '無効な入力です' };

    case z.ZodIssueCode.invalid_union_discriminator:
      return { message: `無効な判別子の値。期待値: ${issue.options.join(', ')}` };

    case z.ZodIssueCode.invalid_enum_value:
      return { message: `無効な選択肢。選択肢: ${issue.options.join(', ')}` };

    case z.ZodIssueCode.invalid_arguments:
      return { message: '無効な関数の引数です' };

    case z.ZodIssueCode.invalid_return_type:
      return { message: '無効な関数の戻り値です' };

    case z.ZodIssueCode.invalid_date:
      return { message: VALIDATION_MESSAGES.INVALID_DATE };

    case z.ZodIssueCode.invalid_string:
      if (issue.validation === 'email') {
        return { message: VALIDATION_MESSAGES.INVALID_EMAIL };
      }
      if (issue.validation === 'uuid') {
        return { message: VALIDATION_MESSAGES.INVALID_UUID };
      }
      if (issue.validation === 'url') {
        return { message: '有効なURLを入力してください' };
      }
      if (issue.validation === 'regex') {
        return { message: '無効な形式です' };
      }
      return { message: '無効な文字列形式です' };

    case z.ZodIssueCode.too_small:
      if (issue.type === 'array') {
        return { message: VALIDATION_MESSAGES.MIN_SELECTIONS(issue.minimum as number) };
      }
      if (issue.type === 'string') {
        return { message: VALIDATION_MESSAGES.MIN_LENGTH(issue.minimum as number) };
      }
      if (issue.type === 'number') {
        return { message: VALIDATION_MESSAGES.MIN_VALUE(issue.minimum as number) };
      }
      if (issue.type === 'date') {
        return { message: '日付が古すぎます' };
      }
      return { message: `最小値は ${issue.minimum} です` };

    case z.ZodIssueCode.too_big:
      if (issue.type === 'array') {
        return { message: VALIDATION_MESSAGES.MAX_SELECTIONS(issue.maximum as number) };
      }
      if (issue.type === 'string') {
        return { message: VALIDATION_MESSAGES.MAX_LENGTH(issue.maximum as number) };
      }
      if (issue.type === 'number') {
        return { message: VALIDATION_MESSAGES.MAX_VALUE(issue.maximum as number) };
      }
      if (issue.type === 'date') {
        return { message: '日付が新しすぎます' };
      }
      return { message: `最大値は ${issue.maximum} です` };

    case z.ZodIssueCode.custom:
      return { message: issue.message || VALIDATION_MESSAGES.VALIDATION_ERROR };

    case z.ZodIssueCode.invalid_intersection_types:
      return { message: '交差型が一致しません' };

    case z.ZodIssueCode.not_multiple_of:
      return { message: `${issue.multipleOf} の倍数である必要があります` };

    case z.ZodIssueCode.not_finite:
      return { message: '有限の数値である必要があります' };

    default:
      return { message: ctx.defaultError };
  }
};

/**
 * Set Japanese error messages as default for Zod
 */
export const setJapaneseErrorMap = () => {
  z.setErrorMap(japaneseErrorMap);
};

/**
 * Helper function to create Zod schema with Japanese error messages
 */
export const createLocalizedSchema = <T extends z.ZodRawShape>(shape: T) => {
  return z.object(shape);
};

/**
 * Utility to get localized error message for specific validation
 */
export const getLocalizedErrorMessage = (
  fieldName: string,
  validationType: keyof typeof VALIDATION_MESSAGES,
  ...args: number[]
): string => {
  const message = VALIDATION_MESSAGES[validationType];
  if (typeof message === 'function') {
    return message(...args);
  }
  return message;
};