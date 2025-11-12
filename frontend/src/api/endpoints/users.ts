import { getHttpClient } from '../client/http-client';
import { API_ENDPOINTS } from '../constants/config';
import type {
  UserList,
  UserDetailResponse,
  UserCreate,
  UserUpdate,
  PaginationParams,
  ApiResponse,
  UUID,
  UserExistsResponse,
  SimpleUser,
  BulkUserStatusUpdateItem,
  BulkUserStatusUpdateResponse,
} from '../types';

const httpClient = getHttpClient();

export const usersApi = {
  /**
   * Get all users with optional pagination
   */
  getUsers: async (params?: PaginationParams): Promise<ApiResponse<UserList>> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.withCount !== undefined) {
      queryParams.append('withCount', params.withCount ? 'true' : 'false');
    }
    
    const endpoint = queryParams.toString() 
      ? `${API_ENDPOINTS.USERS.LIST}?${queryParams.toString()}`
      : API_ENDPOINTS.USERS.LIST;
    
    return httpClient.get<UserList>(endpoint);
  },

  /**
   * Get a specific user by ID
   */
  getUserById: async (userId: UUID): Promise<ApiResponse<UserDetailResponse>> => {
    return httpClient.get<UserDetailResponse>(API_ENDPOINTS.USERS.BY_ID(userId));
  },

  /**
   * Create a new user
   */
  createUser: async (data: UserCreate): Promise<ApiResponse<UserDetailResponse>> => {
    return httpClient.post<UserDetailResponse>(API_ENDPOINTS.USERS.CREATE, data);
  },

  /**
   * Update an existing user
   */
  updateUser: async (userId: UUID, data: UserUpdate): Promise<ApiResponse<UserDetailResponse>> => {
    return httpClient.put<UserDetailResponse>(API_ENDPOINTS.USERS.UPDATE(userId), data);
  },

  /**
   * Delete a user
   */
  deleteUser: async (userId: UUID): Promise<ApiResponse<void>> => {
    return httpClient.delete<void>(API_ENDPOINTS.USERS.DELETE(userId));
  },

  /**
   * Check if a user exists by Clerk ID
   * Equivalent to GET /auth/user/{clerk_user_id}
   */
  checkUserExists: async (clerkId: string): Promise<ApiResponse<UserExistsResponse>> => {
    const endpoint = API_ENDPOINTS.AUTH.USER_BY_CLERK_ID(clerkId);
    return httpClient.get<UserExistsResponse>(endpoint);
  },


  /**
   * Update user's stage (admin only)
   */
  updateUserStage: async (userId: UUID, data: { stage_id: UUID }): Promise<ApiResponse<UserDetailResponse>> => {
    return httpClient.patch<UserDetailResponse>(API_ENDPOINTS.USERS.UPDATE_STAGE(userId), data);
  },

  /**
   * Bulk update user statuses
   */
  bulkUpdateStatus: async (
    payload: BulkUserStatusUpdateItem[],
  ): Promise<ApiResponse<BulkUserStatusUpdateResponse>> => {
    return httpClient.patch<BulkUserStatusUpdateResponse>(
      API_ENDPOINTS.USERS.BULK_STATUS_UPDATE,
      payload,
    );
  },

  /**
   * Get users for organization chart - no role-based access restrictions
   * Returns SimpleUser[] format with supervisor/subordinates for organization chart display
   * Supports filtering by department_ids, role_ids, or supervisor_id
   */
  getUsersForOrgChart: async (filters?: {
    department_ids?: string[];
    role_ids?: string[];
    supervisor_id?: string;
  }): Promise<ApiResponse<SimpleUser[]>> => {
    let endpoint: string = API_ENDPOINTS.USERS.ORG_CHART;

    if (filters) {
      const queryParams = new URLSearchParams();

      if (filters.department_ids?.length) {
        filters.department_ids.forEach(id => queryParams.append('department_ids', id));
      }

      if (filters.role_ids?.length) {
        filters.role_ids.forEach(id => queryParams.append('role_ids', id));
      }

      if (filters.supervisor_id) {
        queryParams.append('supervisor_id', filters.supervisor_id);
      }

      if (queryParams.toString()) {
        endpoint = `${endpoint}?${queryParams.toString()}`;
      }
    }
    return httpClient.get<SimpleUser[]>(endpoint);
  },
};
