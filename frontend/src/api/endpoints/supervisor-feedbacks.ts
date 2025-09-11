import { getHttpClient } from '../client/http-client';
import { API_ENDPOINTS } from '../constants/config';
import type {
  SupervisorFeedback,
  SupervisorFeedbackDetail,
  SupervisorFeedbackCreate,
  SupervisorFeedbackUpdate,
  SupervisorFeedbackList,
  PaginationParams,
  ApiResponse,
  UUID,
} from '../types';

const httpClient = getHttpClient();

/**
 * Supervisor Feedback API endpoints for CRUD operations and related functions
 * All functions follow the standardized pattern with proper error handling
 */
export const supervisorFeedbacksApi = {
  /**
   * Get supervisor feedbacks with optional filters and pagination
   */
  getSupervisorFeedbacks: async (params?: {
    pagination?: PaginationParams;
    periodId?: UUID;
    supervisorId?: UUID;
    subordinateId?: UUID;
    status?: string;
  }): Promise<ApiResponse<SupervisorFeedbackList>> => {
    const queryParams = new URLSearchParams();
    if (params?.pagination?.page) queryParams.append('page', params.pagination.page.toString());
    if (params?.pagination?.limit) queryParams.append('limit', params.pagination.limit.toString());
    if (params?.periodId) queryParams.append('periodId', params.periodId);
    if (params?.supervisorId) queryParams.append('supervisorId', params.supervisorId);
    if (params?.subordinateId) queryParams.append('subordinateId', params.subordinateId);
    if (params?.status) queryParams.append('status', params.status);
    
    const endpoint = queryParams.toString() 
      ? `${API_ENDPOINTS.SUPERVISOR_FEEDBACKS.LIST}?${queryParams.toString()}`
      : API_ENDPOINTS.SUPERVISOR_FEEDBACKS.LIST;
    
    return httpClient.get<SupervisorFeedbackList>(endpoint);
  },

  /**
   * Get supervisor feedbacks by supervisor ID
   */
  getSupervisorFeedbacksBySupervisor: async (supervisorId: UUID): Promise<ApiResponse<SupervisorFeedbackList>> => {
    return httpClient.get<SupervisorFeedbackList>(API_ENDPOINTS.SUPERVISOR_FEEDBACKS.BY_SUPERVISOR(supervisorId));
  },

  /**
   * Get supervisor feedbacks by employee ID
   */
  getSupervisorFeedbacksByEmployee: async (employeeId: UUID): Promise<ApiResponse<SupervisorFeedbackList>> => {
    return httpClient.get<SupervisorFeedbackList>(API_ENDPOINTS.SUPERVISOR_FEEDBACKS.BY_EMPLOYEE(employeeId));
  },

  /**
   * Get supervisor feedback for a specific self-assessment
   */
  getSupervisorFeedbackByAssessment: async (assessmentId: UUID): Promise<ApiResponse<SupervisorFeedback | null>> => {
    return httpClient.get<SupervisorFeedback | null>(API_ENDPOINTS.SUPERVISOR_FEEDBACKS.BY_ASSESSMENT(assessmentId));
  },

  /**
   * Get a specific supervisor feedback by ID with detailed information
   */
  getSupervisorFeedbackById: async (feedbackId: UUID): Promise<ApiResponse<SupervisorFeedbackDetail>> => {
    return httpClient.get<SupervisorFeedbackDetail>(API_ENDPOINTS.SUPERVISOR_FEEDBACKS.BY_ID(feedbackId));
  },

  /**
   * Create a new supervisor feedback
   */
  createSupervisorFeedback: async (data: SupervisorFeedbackCreate): Promise<ApiResponse<SupervisorFeedback>> => {
    return httpClient.post<SupervisorFeedback>(API_ENDPOINTS.SUPERVISOR_FEEDBACKS.CREATE, data);
  },

  /**
   * Update an existing supervisor feedback
   */
  updateSupervisorFeedback: async (feedbackId: UUID, data: SupervisorFeedbackUpdate): Promise<ApiResponse<SupervisorFeedback>> => {
    return httpClient.put<SupervisorFeedback>(API_ENDPOINTS.SUPERVISOR_FEEDBACKS.UPDATE(feedbackId), data);
  },

  /**
   * Submit a supervisor feedback
   */
  submitSupervisorFeedback: async (feedbackId: UUID): Promise<ApiResponse<SupervisorFeedback>> => {
    return httpClient.post<SupervisorFeedback>(API_ENDPOINTS.SUPERVISOR_FEEDBACKS.SUBMIT(feedbackId), {});
  },

  /**
   * Change supervisor feedback status to draft
   */
  draftSupervisorFeedback: async (feedbackId: UUID): Promise<ApiResponse<SupervisorFeedback>> => {
    return httpClient.post<SupervisorFeedback>(API_ENDPOINTS.SUPERVISOR_FEEDBACKS.DRAFT(feedbackId), {});
  },

  /**
   * Delete a supervisor feedback
   */
  deleteSupervisorFeedback: async (feedbackId: UUID): Promise<ApiResponse<void>> => {
    return httpClient.delete<void>(API_ENDPOINTS.SUPERVISOR_FEEDBACKS.DELETE(feedbackId));
  },
};