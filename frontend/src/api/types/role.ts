import type { UUID, Permission } from './common';

/**
 * Role type definitions
 * These types match the backend Pydantic schemas for Role-related operations
 */

export interface Role {
  id: UUID;
  name: string;
  description: string;
  hierarchy_order: number;
  created_at: string;
  updated_at: string;
}

export interface RoleDetail {
  id: UUID;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  permissions: Permission[];
  user_count?: number;
}

export interface RoleCreate {
  name: string;
  description: string;
  hierarchy_order?: number;
}

export interface RoleUpdate {
  name?: string;
  description?: string;
}

export interface RoleReorderItem {
  id: UUID;
  hierarchy_order: number;
}

export interface RoleReorderRequest {
  roles: RoleReorderItem[];
}

export type RoleList = RoleDetail[];