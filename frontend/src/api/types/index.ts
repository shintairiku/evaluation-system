// Common types
export * from './common';

// Auth types
export * from './auth';

// Clerk types (includes JWT, Organization, Webhook types)
export * from './clerk';

// User types (includes Department, Role types)
export * from './user';

// Goal types
export * from './goal';

// Competency types
export * from './competency';

// Stage types
export * from './stage';

// Evaluation Period types
export * from './evaluation-period';

// Self Assessment types
export * from './self-assessment';

// Supervisor Review types
export * from './supervisor-review';

// Supervisor Feedback types
export * from './supervisor-feedback';

// Admin Dashboard types
export * from './admin-dashboard';

// Supervisor Dashboard types
export * from './supervisor-dashboard';

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