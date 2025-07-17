// Common types
export * from './common';

// Auth types
export * from './auth';

// User types
export * from './user';

// API Response wrapper type
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}