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

// Utility function to sanitize goal IDs by removing invisible characters
const sanitizeGoalId = (id: string): string => {
  // Remove zero-width spaces, zero-width non-joiner, and other invisible Unicode characters
  return id.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '').trim();
};

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
    includeReviews?: boolean;
    includeRejectionHistory?: boolean;
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

    // Performance optimization parameters
    if (params?.includeReviews) queryParams.append('includeReviews', 'true');
    if (params?.includeRejectionHistory) queryParams.append('includeRejectionHistory', 'true');

    const endpoint = queryParams.toString()
      ? `${API_ENDPOINTS.GOALS.LIST}?${queryParams.toString()}`
      : API_ENDPOINTS.GOALS.LIST;

    return httpClient.get<GoalListResponse>(endpoint);
  },

  /**
   * Get rejected draft goals for current user (employee only)
   *
   * Returns goals that are in draft status and have a previous_goal_id
   * (indicating they were created from a rejected goal for correction).
   *
   * Used for sidebar counter to show employees how many goals need attention.
   */
  getRejectedDrafts: async (params?: {
    periodId?: UUID;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<GoalListResponse>> => {
    const queryParams = new URLSearchParams();

    if (params?.periodId) queryParams.append('periodId', params.periodId);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const endpoint = queryParams.toString()
      ? `${API_ENDPOINTS.GOALS.REJECTED_DRAFTS}?${queryParams.toString()}`
      : API_ENDPOINTS.GOALS.REJECTED_DRAFTS;

    return httpClient.get<GoalListResponse>(endpoint);
  },

  /**
   * Get a specific goal by ID
   */
  getGoalById: async (goalId: UUID): Promise<ApiResponse<GoalResponse>> => {
    const sanitizedId = sanitizeGoalId(goalId);
    return httpClient.get<GoalResponse>(API_ENDPOINTS.GOALS.BY_ID(sanitizedId));
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
    const sanitizedId = sanitizeGoalId(goalId);
    return httpClient.put<GoalResponse>(API_ENDPOINTS.GOALS.UPDATE(sanitizedId), data);
  },

  /**
   * Delete a goal
   */
  deleteGoal: async (goalId: UUID): Promise<ApiResponse<void>> => {
    const sanitizedId = sanitizeGoalId(goalId);
    return httpClient.delete<void>(API_ENDPOINTS.GOALS.DELETE(sanitizedId));
  },

  /**
   * Submit a goal with status change
   */
  submitGoal: async (goalId: UUID, status: 'draft' | 'submitted'): Promise<ApiResponse<GoalResponse>> => {
    const sanitizedId = sanitizeGoalId(goalId);
    const endpoint = `${API_ENDPOINTS.GOALS.SUBMIT(sanitizedId)}?status=${status}`;
    return httpClient.post<GoalResponse>(endpoint);
  },

  /**
   * Approve a pending goal (supervisor action)
   */
  approveGoal: async (goalId: UUID): Promise<ApiResponse<GoalResponse>> => {
    const sanitizedId = sanitizeGoalId(goalId);
    return httpClient.post<GoalResponse>(API_ENDPOINTS.GOALS.APPROVE(sanitizedId));
  },

  /**
   * Reject a pending goal with reason (supervisor action)
   */
  rejectGoal: async (goalId: UUID, reason: string): Promise<ApiResponse<GoalResponse>> => {
    const sanitizedId = sanitizeGoalId(goalId);
    const endpoint = `${API_ENDPOINTS.GOALS.REJECT(sanitizedId)}?reason=${encodeURIComponent(reason)}`;
    return httpClient.post<GoalResponse>(endpoint);
  },

  /**
   * Get all goals for admin visualization (admin-only endpoint)
   *
   * This endpoint shows ALL users' goals in the organization.
   * Performance: includeReviews defaults to true for batch optimization
   */
  getAdminGoals: async (params?: {
    periodId?: UUID;
    userId?: UUID;
    departmentId?: UUID;
    goalCategory?: string;
    status?: string | string[];
    page?: number;
    limit?: number;
    includeReviews?: boolean;
    includeRejectionHistory?: boolean;
  }): Promise<ApiResponse<GoalListResponse>> => {
    const queryParams = new URLSearchParams();

    if (params?.periodId) queryParams.append('periodId', params.periodId);
    if (params?.userId) queryParams.append('userId', params.userId);
    if (params?.departmentId) queryParams.append('departmentId', params.departmentId);
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

    // Performance optimization: includeReviews defaults to true (batch optimization)
    const includeReviews = params?.includeReviews !== undefined ? params.includeReviews : true;
    queryParams.append('includeReviews', includeReviews.toString());

    if (params?.includeRejectionHistory) queryParams.append('includeRejectionHistory', 'true');

    const endpoint = queryParams.toString()
      ? `${API_ENDPOINTS.GOALS.ADMIN_LIST}?${queryParams.toString()}`
      : API_ENDPOINTS.GOALS.ADMIN_LIST;

    return httpClient.get<GoalListResponse>(endpoint);
  },
};