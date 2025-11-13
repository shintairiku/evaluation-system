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
