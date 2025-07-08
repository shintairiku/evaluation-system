import { getHttpClient } from '../client/http-client';
import { API_ENDPOINTS } from '../constants/config';
import type {
  UserList,
  UserDetailResponse,
  UserCreate,
  UserUpdate,
  UserProfile,
  PaginationParams,
  ApiResponse,
  UUID,
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
};