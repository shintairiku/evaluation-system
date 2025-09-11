import type { UUID, PaginatedResponse } from './common';

/**
 * Department type definitions
 * These types match the backend Pydantic schemas for Department-related operations
 */

export interface Department {
  id: UUID;
  name: string;
  description?: string;
}

export interface DepartmentDetail {
  id: UUID;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  user_count?: number;
  manager_id?: UUID;
  manager_name?: string;
  users?: PaginatedResponse<unknown>; // Avoid circular import, use generic type
}

export interface DepartmentCreate {
  name: string;
  description?: string;
}

export interface DepartmentUpdate {
  name?: string;
  description?: string;
}

export type DepartmentList = Department[];