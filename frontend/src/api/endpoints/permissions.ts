import { getHttpClient } from '../client/http-client';
import { API_ENDPOINTS } from '../constants/config';
import type {
  ApiResponse,
  PermissionCatalogGroupedResponse,
  PermissionCatalogItem,
  RolePermissionCloneRequest,
  RolePermissionPatchRequest,
  RolePermissionResponse,
  RolePermissionUpdateRequest,
  UUID,
} from '../types';

const httpClient = getHttpClient();

export const permissionsApi = {
  getCatalog: async (): Promise<ApiResponse<PermissionCatalogItem[]>> => {
    return httpClient.get<PermissionCatalogItem[]>(API_ENDPOINTS.PERMISSIONS.CATALOG);
  },

  getGroupedCatalog: async (): Promise<ApiResponse<PermissionCatalogGroupedResponse>> => {
    return httpClient.get<PermissionCatalogGroupedResponse>(API_ENDPOINTS.PERMISSIONS.CATALOG_GROUPED);
  },

  getRolePermissions: async (roleId: UUID): Promise<ApiResponse<RolePermissionResponse>> => {
    return httpClient.get<RolePermissionResponse>(API_ENDPOINTS.PERMISSIONS.ROLE(roleId));
  },

  replaceRolePermissions: async (
    roleId: UUID,
    payload: RolePermissionUpdateRequest,
  ): Promise<ApiResponse<RolePermissionResponse>> => {
    return httpClient.put<RolePermissionResponse>(
      API_ENDPOINTS.PERMISSIONS.ROLE(roleId),
      payload,
    );
  },

  patchRolePermissions: async (
    roleId: UUID,
    payload: RolePermissionPatchRequest,
  ): Promise<ApiResponse<RolePermissionResponse>> => {
    return httpClient.patch<RolePermissionResponse>(
      API_ENDPOINTS.PERMISSIONS.ROLE(roleId),
      payload,
    );
  },

  cloneRolePermissions: async (
    roleId: UUID,
    payload: RolePermissionCloneRequest,
  ): Promise<ApiResponse<RolePermissionResponse>> => {
    return httpClient.post<RolePermissionResponse>(
      API_ENDPOINTS.PERMISSIONS.ROLE_CLONE(roleId),
      payload,
    );
  },

  getAllRolePermissions: async (): Promise<ApiResponse<RolePermissionResponse[]>> => {
    return httpClient.get<RolePermissionResponse[]>(API_ENDPOINTS.PERMISSIONS.ROLE_BULK);
  },
};
