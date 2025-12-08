export type UUID = string;

export enum SubmissionStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
}

export interface Permission {
  name: string;
  description: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  withCount?: boolean;
  /**
   * Optional comma-separated list of related entities to include.
   * Used by some v2 endpoints (e.g. users) to control eager loading.
   */
  include?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface BaseResponse {
  success: boolean;
  message?: string;
}

export interface ErrorResponse {
  error: boolean;
  message: string;
  status_code: number;
}

export interface HealthCheckResponse {
  status: string;
  timestamp: string;
  version: string;
}
