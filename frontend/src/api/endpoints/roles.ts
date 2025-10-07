import { getHttpClient } from '../client/http-client';
import { API_ENDPOINTS } from '../constants/config';
import type {
  RoleDetail,
  RoleCreate,
  RoleUpdate,
  RoleReorderRequest,
  ApiResponse,
  UUID,
} from '../types';

const httpClient = getHttpClient();

/**
 * Role API endpoints for CRUD operations and reordering
 * All functions follow the standardized pattern with proper error handling
 */
export const rolesApi = {
  /**
   * Get all roles with detailed information
   */
  getRoles: async (): Promise<ApiResponse<RoleDetail[]>> => {
    return httpClient.get<RoleDetail[]>(API_ENDPOINTS.ROLES.LIST);
  },

  /**
   * Get a specific role by ID with detailed information
   */
  getRoleById: async (roleId: UUID): Promise<ApiResponse<RoleDetail>> => {
    return httpClient.get<RoleDetail>(API_ENDPOINTS.ROLES.BY_ID(roleId));
  },

  /**
   * Create a new role
   */
  createRole: async (data: RoleCreate): Promise<ApiResponse<RoleDetail>> => {
    return httpClient.post<RoleDetail>(API_ENDPOINTS.ROLES.CREATE, data);
  },

  /**
   * Update an existing role
   */
  updateRole: async (roleId: UUID, data: RoleUpdate): Promise<ApiResponse<RoleDetail>> => {
    return httpClient.put<RoleDetail>(API_ENDPOINTS.ROLES.UPDATE(roleId), data);
  },

  /**
   * Delete a role
   */
  deleteRole: async (roleId: UUID): Promise<ApiResponse<void>> => {
    return httpClient.delete<void>(API_ENDPOINTS.ROLES.DELETE(roleId));
  },

  /**
   * Reorder roles by updating their hierarchy order
   */
  reorderRoles: async (data: RoleReorderRequest): Promise<ApiResponse<void>> => {
    return httpClient.post<void>(API_ENDPOINTS.ROLES.REORDER, data);
  },
};