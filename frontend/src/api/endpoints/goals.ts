import { getHttpClient } from '../client/http-client';
import { API_ENDPOINTS } from '../constants/config';
import type {
  GoalListResponse,
  GoalResponse,
  GoalCreateRequest,
  GoalUpdateRequest,
  ApiResponse,
  UUID,
} from '../types';

const httpClient = getHttpClient();

export const goalsApi = {
  /**
   * Get goals with optional filtering and pagination
   */
  getGoals: async (params?: {
    periodId?: UUID;
    userId?: UUID;
    goalCategory?: string;
    status?: string | string[];
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<GoalListResponse>> => {
    const queryParams = new URLSearchParams();
    
    if (params?.periodId) queryParams.append('periodId', params.periodId);
    if (params?.userId) queryParams.append('userId', params.userId);
    if (params?.goalCategory) queryParams.append('goalCategory', params.goalCategory);
    
    if (params?.status) {
      if (Array.isArray(params.status)) {
        params.status.forEach(s => queryParams.append('status', s));
      } else {
        queryParams.append('status', params.status);
      }
    }
    
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    
    const endpoint = queryParams.toString() 
      ? `${API_ENDPOINTS.GOALS.LIST}?${queryParams.toString()}`
      : API_ENDPOINTS.GOALS.LIST;
    
    return httpClient.get<GoalListResponse>(endpoint);
  },

  /**
   * Get a specific goal by ID
   */
  getGoalById: async (goalId: UUID): Promise<ApiResponse<GoalResponse>> => {
    return httpClient.get<GoalResponse>(API_ENDPOINTS.GOALS.BY_ID(goalId));
  },

  /**
   * Create a new goal
   */
  createGoal: async (data: GoalCreateRequest): Promise<ApiResponse<GoalResponse>> => {
    return httpClient.post<GoalResponse>(API_ENDPOINTS.GOALS.CREATE, data);
  },

  /**
   * Update an existing goal
   */
  updateGoal: async (goalId: UUID, data: GoalUpdateRequest): Promise<ApiResponse<GoalResponse>> => {
    return httpClient.put<GoalResponse>(API_ENDPOINTS.GOALS.UPDATE(goalId), data);
  },

  /**
   * Delete a goal
   */
  deleteGoal: async (goalId: UUID): Promise<ApiResponse<void>> => {
    return httpClient.delete<void>(API_ENDPOINTS.GOALS.DELETE(goalId));
  },

  /**
   * Submit a goal with status change
   */
  submitGoal: async (goalId: UUID, status: 'draft' | 'pending_approval'): Promise<ApiResponse<GoalResponse>> => {
    const endpoint = `${API_ENDPOINTS.GOALS.SUBMIT(goalId)}?status=${status}`;
    return httpClient.post<GoalResponse>(endpoint);
  },

  /**
   * Approve a pending goal (supervisor action)
   */
  approveGoal: async (goalId: UUID): Promise<ApiResponse<GoalResponse>> => {
    return httpClient.post<GoalResponse>(API_ENDPOINTS.GOALS.APPROVE(goalId));
  },

  /**
   * Reject a pending goal with reason (supervisor action)
   */
  rejectGoal: async (goalId: UUID, reason: string): Promise<ApiResponse<GoalResponse>> => {
    const endpoint = `${API_ENDPOINTS.GOALS.REJECT(goalId)}?reason=${encodeURIComponent(reason)}`;
    return httpClient.post<GoalResponse>(endpoint);
  },
};