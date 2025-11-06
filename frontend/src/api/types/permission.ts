import type { UUID } from './common';

export interface PermissionCatalogItem {
  code: string;
  description: string;
  permission_group: string;
}

export interface PermissionGroup {
  permission_group: string;
  permissions: PermissionCatalogItem[];
}

export interface PermissionCatalogGroupedResponse {
  groups: PermissionGroup[];
  total_permissions: number;
}

export interface RolePermissionResponse {
  role_id?: UUID;
  roleId?: UUID;
  permissions: PermissionCatalogItem[];
  version: string;
}

export interface RolePermissionUpdateRequest {
  permissions: string[];
  version?: string;
}

export interface RolePermissionPatchRequest {
  add?: string[];
  remove?: string[];
  version?: string;
}

export interface RolePermissionCloneRequest {
  fromRoleId: UUID;
}
