import type { UUID } from './common';

export interface PermissionCatalogItem {
  code: string;
  description: string;
}

export interface RolePermissionResponse {
  roleId: UUID;
  permissions: PermissionCatalogItem[];
}

export interface RolePermissionUpdateRequest {
  permissions: string[];
}

export interface RolePermissionPatchRequest {
  add?: string[];
  remove?: string[];
}

export interface RolePermissionCloneRequest {
  fromRoleId: UUID;
}
