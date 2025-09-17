/**
 * Stage Management Constants
 * Centralized configuration for consistent styling and behavior
 */

export const STAGE_HEIGHTS = {
  COLLAPSED: 180,
  EXPANDED: 360,
} as const;

export const GRID_CONFIG = {
  COLUMNS: {
    BASE: 'grid-cols-1',
    MD: 'md:grid-cols-2', 
    LG: 'lg:grid-cols-3',
    XL: 'xl:grid-cols-3',
  },
  GAP: 'gap-6',
  ALIGNMENT: 'items-start',
} as const;

export const TRANSITIONS = {
  DEFAULT: 'transition-all duration-200',
  SMOOTH: 'transition-colors',
} as const;

export const DRAG_STYLES = {
  HOVER: 'ring-2 ring-blue-500 bg-blue-50',
  EDIT_MODE: 'border-orange-300 bg-orange-50/30',
} as const;

export const SEARCH_CONFIG = {
  DEBOUNCE_DELAY: 300,
  PLACEHOLDER: 'ユーザー名、社員コード、メールで検索...',
  MAX_WIDTH: 'w-80',
} as const;

export const SCROLL_CONFIG = {
  MAX_HEIGHT: 'max-h-96',
  OVERFLOW: 'overflow-y-auto',
  PADDING: 'pr-1',
} as const;

export const DESCRIPTION_SCROLL = {
  MAX_HEIGHT: 'max-h-16',
  OVERFLOW: 'overflow-y-auto',
} as const;

/**
 * Modal configuration constants
 */
export const MODAL = {
  STAGE_EDIT: {
    MAX_TITLE_LENGTH: 100,
    MAX_DESCRIPTION_LENGTH: 500,
    MIN_TITLE_LENGTH: 1,
  },
} as const;