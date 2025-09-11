import { getHttpClient } from '../client/http-client';
import { API_ENDPOINTS } from '../constants/config';
import type {
  SupervisorReview,
  SupervisorReviewDetail,
  SupervisorReviewCreate,
  SupervisorReviewUpdate,
  SupervisorReviewList,
  PaginationParams,
  ApiResponse,
  UUID,
} from '../types';

const httpClient = getHttpClient();

/**
 * Supervisor Review API endpoints for CRUD operations and related functions
 * All functions follow the standardized pattern with proper error handling
 */
export const supervisorReviewsApi = {
  /**
   * Get supervisor reviews with optional filters and pagination
   */
  getSupervisorReviews: async (params?: {
    pagination?: PaginationParams;
    periodId?: UUID;
    goalId?: UUID;
    status?: string;
  }): Promise<ApiResponse<SupervisorReviewList>> => {
    const queryParams = new URLSearchParams();
    if (params?.pagination?.page) queryParams.append('page', params.pagination.page.toString());
    if (params?.pagination?.limit) queryParams.append('limit', params.pagination.limit.toString());
    if (params?.periodId) queryParams.append('periodId', params.periodId);
    if (params?.goalId) queryParams.append('goalId', params.goalId);
    if (params?.status) queryParams.append('status', params.status);
    
    const endpoint = queryParams.toString() 
      ? `${API_ENDPOINTS.SUPERVISOR_REVIEWS.LIST}?${queryParams.toString()}`
      : API_ENDPOINTS.SUPERVISOR_REVIEWS.LIST;
    
    return httpClient.get<SupervisorReviewList>(endpoint);
  },

  /**
   * Get supervisor reviews by supervisor ID
   */
  getSupervisorReviewsBySupervisor: async (supervisorId: UUID): Promise<ApiResponse<SupervisorReviewList>> => {
    return httpClient.get<SupervisorReviewList>(API_ENDPOINTS.SUPERVISOR_REVIEWS.BY_SUPERVISOR(supervisorId));
  },

  /**
   * Get supervisor reviews by employee ID
   */
  getSupervisorReviewsByEmployee: async (employeeId: UUID): Promise<ApiResponse<SupervisorReviewList>> => {
    return httpClient.get<SupervisorReviewList>(API_ENDPOINTS.SUPERVISOR_REVIEWS.BY_EMPLOYEE(employeeId));
  },

  /**
   * Get supervisor reviews for a specific goal
   */
  getSupervisorReviewsByGoal: async (goalId: UUID, params?: {
    pagination?: PaginationParams;
    periodId?: UUID;
    status?: string;
  }): Promise<ApiResponse<SupervisorReviewList>> => {
    const queryParams = new URLSearchParams();
    if (params?.pagination?.page) queryParams.append('page', params.pagination.page.toString());
    if (params?.pagination?.limit) queryParams.append('limit', params.pagination.limit.toString());
    if (params?.periodId) queryParams.append('periodId', params.periodId);
    if (params?.status) queryParams.append('status', params.status);
    
    const endpoint = queryParams.toString() 
      ? `${API_ENDPOINTS.SUPERVISOR_REVIEWS.BY_GOAL(goalId)}?${queryParams.toString()}`
      : API_ENDPOINTS.SUPERVISOR_REVIEWS.BY_GOAL(goalId);
    
    return httpClient.get<SupervisorReviewList>(endpoint);
  },

  /**
   * Get pending supervisor reviews (supervisor only)
   */
  getPendingSupervisorReviews: async (params?: {
    pagination?: PaginationParams;
    periodId?: UUID;
  }): Promise<ApiResponse<SupervisorReviewList>> => {
    const queryParams = new URLSearchParams();
    if (params?.pagination?.page) queryParams.append('page', params.pagination.page.toString());
    if (params?.pagination?.limit) queryParams.append('limit', params.pagination.limit.toString());
    if (params?.periodId) queryParams.append('periodId', params.periodId);
    
    const endpoint = queryParams.toString() 
      ? `${API_ENDPOINTS.SUPERVISOR_REVIEWS.PENDING}?${queryParams.toString()}`
      : API_ENDPOINTS.SUPERVISOR_REVIEWS.PENDING;
    
    return httpClient.get<SupervisorReviewList>(endpoint);
  },

  /**
   * Get a specific supervisor review by ID with detailed information
   */
  getSupervisorReviewById: async (reviewId: UUID): Promise<ApiResponse<SupervisorReviewDetail>> => {
    return httpClient.get<SupervisorReviewDetail>(API_ENDPOINTS.SUPERVISOR_REVIEWS.BY_ID(reviewId));
  },

  /**
   * Create a new supervisor review
   */
  createSupervisorReview: async (data: SupervisorReviewCreate): Promise<ApiResponse<SupervisorReview>> => {
    return httpClient.post<SupervisorReview>(API_ENDPOINTS.SUPERVISOR_REVIEWS.CREATE, data);
  },

  /**
   * Update an existing supervisor review
   */
  updateSupervisorReview: async (reviewId: UUID, data: SupervisorReviewUpdate): Promise<ApiResponse<SupervisorReview>> => {
    return httpClient.put<SupervisorReview>(API_ENDPOINTS.SUPERVISOR_REVIEWS.UPDATE(reviewId), data);
  },

  /**
   * Submit a supervisor review
   */
  submitSupervisorReview: async (reviewId: UUID): Promise<ApiResponse<SupervisorReview>> => {
    return httpClient.post<SupervisorReview>(API_ENDPOINTS.SUPERVISOR_REVIEWS.SUBMIT(reviewId), {});
  },

  /**
   * Bulk submit supervisor reviews
   */
  bulkSubmitSupervisorReviews: async (periodId: UUID, goalIds?: UUID[]): Promise<ApiResponse<void>> => {
    const queryParams = new URLSearchParams();
    queryParams.append('periodId', periodId);
    if (goalIds && goalIds.length > 0) {
      goalIds.forEach(goalId => queryParams.append('goalIds', goalId));
    }
    
    const endpoint = `${API_ENDPOINTS.SUPERVISOR_REVIEWS.BULK_SUBMIT}?${queryParams.toString()}`;
    return httpClient.post<void>(endpoint, {});
  },

  /**
   * Delete a supervisor review
   */
  deleteSupervisorReview: async (reviewId: UUID): Promise<ApiResponse<void>> => {
    return httpClient.delete<void>(API_ENDPOINTS.SUPERVISOR_REVIEWS.DELETE(reviewId));
  },
};