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
  ProfileOptionsResponse,
  UserStatus,
} from '../types';

const httpClient = getHttpClient();

// Extended parameters interface for user filtering
export interface GetUsersParams extends PaginationParams {
  search?: string;
  department_ids?: UUID[];
  stage_ids?: UUID[];
  role_ids?: UUID[];
  statuses?: UserStatus[];
  exclude_user_id?: UUID;  // For edit modal to exclude current user
}

export const usersApi = {
  /**
   * Get all users with optional pagination and filtering
   * Supports all backend filtering parameters
   */
  getUsers: async (params?: GetUsersParams): Promise<ApiResponse<UserList>> => {
    const queryParams = new URLSearchParams();
    
    // Add pagination parameters
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    
    // Add search parameter
    if (params?.search?.trim()) queryParams.append('search', params.search.trim());
    
    // Add multi-select filter parameters
    if (params?.department_ids?.length) {
      params.department_ids.forEach(id => queryParams.append('department_ids', id));
    }
    if (params?.stage_ids?.length) {
      params.stage_ids.forEach(id => queryParams.append('stage_ids', id));
    }
    if (params?.role_ids?.length) {
      params.role_ids.forEach(id => queryParams.append('role_ids', id));
    }
    if (params?.statuses?.length) {
      params.statuses.forEach(status => queryParams.append('statuses', status));
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
    return httpClient.get<UserExistsResponse>(API_ENDPOINTS.USERS.EXISTS(clerkId));
  },

  /**
   * Get profile options for user creation/signup
   * Equivalent to GET /auth/signup/profile-options
   */
  getProfileOptions: async (): Promise<ApiResponse<ProfileOptionsResponse>> => {
    return httpClient.get<ProfileOptionsResponse>(API_ENDPOINTS.USERS.PROFILE_OPTIONS);
  },
};