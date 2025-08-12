// Common types
export * from './common';

// Auth types
export * from './auth';

// User types
export * from './user';

// Goal types
export * from './goal';

// API Response wrapper type
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  errorMessage?: string;
  /** @deprecated Use errorMessage instead */
  error?: string;
  /** @deprecated Use errorMessage instead */
  message?: string;
}