/**
 * Competency Management Constants
 * Centralized configuration for consistent behavior and easy maintenance
 */

// =============================================================================
// UI CONSTANTS
// =============================================================================

export const COMPETENCY_CONSTANTS = {
  // Modal configuration
  MODAL: {
    MAX_WIDTH: 'sm:max-w-[600px]',
    MAX_HEIGHT: 'max-h-[80vh]',
    OVERFLOW: 'overflow-y-auto',
  },

  // Form validation
  VALIDATION: {
    MIN_NAME_LENGTH: 1,
    MAX_NAME_LENGTH: 100,
    MAX_DESCRIPTION_LENGTH: 500,
  },

  // Pagination
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 100,
  },

  // Grid layout
  GRID: {
    COLUMNS: {
      BASE: 'grid-cols-1',
      MD: 'md:grid-cols-2',
      LG: 'lg:grid-cols-3',
    },
    GAP: 'gap-4',
  },

  // Search and filters
  SEARCH: {
    PLACEHOLDER: 'コンピテンシーを検索...',
    DEBOUNCE_DELAY: 300,
    MAX_WIDTH: 'max-w-sm',
  },

  // Stage filter
  STAGE_FILTER: {
    ALL_VALUE: 'all',
    ALL_LABEL: 'すべてのステージ',
    WIDTH: 'w-[200px]',
  },

  // Description levels (1-5 for ideal behaviors)
  DESCRIPTION_LEVELS: ['1', '2', '3', '4', '5'] as const,
} as const;

// =============================================================================
// MESSAGES
// =============================================================================

export const COMPETENCY_MESSAGES = {
  // Success messages
  SUCCESS: {
    UPDATE: 'コンピテンシーが正常に更新されました。',
    DELETE: 'コンピテンシーが正常に削除されました。',
  },

  // Error messages
  ERROR: {
    UPDATE: 'コンピテンシーの更新に失敗しました。',
    DELETE: 'コンピテンシーの削除に失敗しました。',
    LOAD: 'コンピテンシーデータの読み込みに失敗しました。',
  },

  // Confirmation messages
  CONFIRM: {
    DELETE: (name: string) => `コンピテンシー「${name}」を削除しますか？この操作は取り消せません。`,
  },

  // UI labels
  LABELS: {
    COMPETENCY_NAME: 'コンピテンシー名',
    STAGE: 'ステージ',
    IDEAL_BEHAVIORS: '理想的な行動（任意）',
    PLACEHOLDER_NAME: 'コンピテンシー名を入力',
    PLACEHOLDER_STAGE: 'ステージを選択',
    PLACEHOLDER_BEHAVIOR: (level: string) => `${level}の理想的な行動を入力（任意）`,
  },

  // Buttons
  BUTTONS: {
    SAVE: '保存',
    SAVING: '保存中...',
    CANCEL: 'キャンセル',
    CLOSE: '閉じる',
    DELETE: '削除',
    DELETING: '削除中...',
  },

  // Modal titles
  MODAL: {
    EDIT_TITLE: 'コンピテンシー編集',
    VIEW_TITLE: 'コンピテンシー詳細',
    EDIT_DESCRIPTION: 'コンピテンシーの詳細を編集できます。',
    VIEW_DESCRIPTION: 'コンピテンシーの詳細を確認できます。',
  },

  // Status messages
  STATUS: {
    NO_COMPETENCIES: 'このステージにはコンピテンシーが設定されていません。',
    NO_FILTERED_RESULTS: 'フィルタ条件に該当するコンピテンシーはありません。',
    BEHAVIORS_COUNT: (count: number) => `${count} つの理想的な行動が設定されています`,
    FILTERED_COUNT: (filtered: number, total: number) => `${filtered} / ${total} のコンピテンシーを表示`,
  },
} as const;

// =============================================================================
// TYPES
// =============================================================================

export type DescriptionLevel = typeof COMPETENCY_CONSTANTS.DESCRIPTION_LEVELS[number];