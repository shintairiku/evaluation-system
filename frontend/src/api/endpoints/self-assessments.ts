import { getHttpClient } from '../client/http-client';
import { API_ENDPOINTS } from '../constants/config';
import type {
  SelfAssessment,
  SelfAssessmentDetail,
  SelfAssessmentUpdate,
  SelfAssessmentList,
  PaginationParams,
  ApiResponse,
  UUID,
} from '../types';

const httpClient = getHttpClient();

/**
 * Self Assessment API endpoints for CRUD operations and related functions
 * All functions follow the standardized pattern with proper error handling
 */
export const selfAssessmentsApi = {
  /**
   * Get self-assessments with optional filters and pagination
   */
  getSelfAssessments: async (params?: {
    pagination?: PaginationParams;
    periodId?: UUID;
    userId?: UUID;
    status?: string;
  }): Promise<ApiResponse<SelfAssessmentList>> => {
    const queryParams = new URLSearchParams();
    if (params?.pagination?.page) queryParams.append('page', params.pagination.page.toString());
    if (params?.pagination?.limit) queryParams.append('limit', params.pagination.limit.toString());
    if (params?.periodId) queryParams.append('periodId', params.periodId);
    if (params?.userId) queryParams.append('userId', params.userId);
    if (params?.status) queryParams.append('status', params.status);
    
    const endpoint = queryParams.toString() 
      ? `${API_ENDPOINTS.SELF_ASSESSMENTS.LIST}?${queryParams.toString()}`
      : API_ENDPOINTS.SELF_ASSESSMENTS.LIST;
    
    return httpClient.get<SelfAssessmentList>(endpoint);
  },

  /**
   * Get self-assessments by evaluation period
   */
  getSelfAssessmentsByPeriod: async (periodId: UUID, params?: {
    pagination?: PaginationParams;
    userId?: UUID;
    status?: string;
  }): Promise<ApiResponse<SelfAssessmentList>> => {
    const queryParams = new URLSearchParams();
    if (params?.pagination?.page) queryParams.append('page', params.pagination.page.toString());
    if (params?.pagination?.limit) queryParams.append('limit', params.pagination.limit.toString());
    if (params?.userId) queryParams.append('userId', params.userId);
    if (params?.status) queryParams.append('status', params.status);
    
    const endpoint = queryParams.toString() 
      ? `${API_ENDPOINTS.SELF_ASSESSMENTS.BY_PERIOD(periodId)}?${queryParams.toString()}`
      : API_ENDPOINTS.SELF_ASSESSMENTS.BY_PERIOD(periodId);
    
    return httpClient.get<SelfAssessmentList>(endpoint);
  },

  /**
   * Get self-assessment by user ID
   */
  getSelfAssessmentsByUser: async (userId: UUID): Promise<ApiResponse<SelfAssessmentList>> => {
    return httpClient.get<SelfAssessmentList>(API_ENDPOINTS.SELF_ASSESSMENTS.BY_USER(userId));
  },

  /**
   * Get self-assessment for a specific goal
   */
  getSelfAssessmentByGoal: async (goalId: UUID): Promise<ApiResponse<SelfAssessment | null>> => {
    return httpClient.get<SelfAssessment | null>(API_ENDPOINTS.SELF_ASSESSMENTS.BY_GOAL(goalId));
  },

  /**
   * Get a specific self-assessment by ID with detailed information
   */
  getSelfAssessmentById: async (assessmentId: UUID): Promise<ApiResponse<SelfAssessmentDetail>> => {
    return httpClient.get<SelfAssessmentDetail>(API_ENDPOINTS.SELF_ASSESSMENTS.BY_ID(assessmentId));
  },

  /**
   * Update an existing self-assessment
   * NOTE: Self-assessments are auto-created when goals are approved.
   * There is no manual creation endpoint.
   */
  updateSelfAssessment: async (assessmentId: UUID, data: SelfAssessmentUpdate): Promise<ApiResponse<SelfAssessment>> => {
    return httpClient.put<SelfAssessment>(API_ENDPOINTS.SELF_ASSESSMENTS.UPDATE(assessmentId), data);
  },

  /**
   * Submit a self-assessment
   */
  submitSelfAssessment: async (assessmentId: UUID): Promise<ApiResponse<SelfAssessment>> => {
    return httpClient.post<SelfAssessment>(API_ENDPOINTS.SELF_ASSESSMENTS.SUBMIT(assessmentId), {});
  },

  /**
   * Delete a self-assessment
   */
  deleteSelfAssessment: async (assessmentId: UUID): Promise<ApiResponse<void>> => {
    return httpClient.delete<void>(API_ENDPOINTS.SELF_ASSESSMENTS.DELETE(assessmentId));
  },
};