import { getHttpClient } from '../client/http-client';
import { API_ENDPOINTS } from '../constants/config';
import type {
  EvaluationPeriod,
  EvaluationPeriodDetail,
  EvaluationPeriodCreate,
  EvaluationPeriodUpdate,
  EvaluationPeriodList,
  PaginationParams,
  ApiResponse,
  UUID,
} from '../types';

const httpClient = getHttpClient();

/**
 * Evaluation Period API endpoints for CRUD operations
 * All functions follow the standardized pattern with proper error handling
 */
export const evaluationPeriodsApi = {
  /**
   * Get all evaluation periods with optional pagination
   */
  getEvaluationPeriods: async (params?: PaginationParams): Promise<ApiResponse<EvaluationPeriodList>> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    
    const endpoint = queryParams.toString() 
      ? `${API_ENDPOINTS.EVALUATION_PERIODS.LIST}?${queryParams.toString()}`
      : API_ENDPOINTS.EVALUATION_PERIODS.LIST;
    
    return httpClient.get<EvaluationPeriodList>(endpoint);
  },

  /**
   * Get current evaluation period
   */
  getCurrentEvaluationPeriod: async (): Promise<ApiResponse<EvaluationPeriod>> => {
    return httpClient.get<EvaluationPeriod>(API_ENDPOINTS.EVALUATION_PERIODS.CURRENT);
  },

  /**
   * Get a specific evaluation period by ID with detailed information
   */
  getEvaluationPeriodById: async (periodId: UUID): Promise<ApiResponse<EvaluationPeriodDetail>> => {
    return httpClient.get<EvaluationPeriodDetail>(API_ENDPOINTS.EVALUATION_PERIODS.BY_ID(periodId));
  },

  /**
   * Create a new evaluation period
   */
  createEvaluationPeriod: async (data: EvaluationPeriodCreate): Promise<ApiResponse<EvaluationPeriod>> => {
    return httpClient.post<EvaluationPeriod>(API_ENDPOINTS.EVALUATION_PERIODS.CREATE, data);
  },

  /**
   * Update an existing evaluation period
   */
  updateEvaluationPeriod: async (periodId: UUID, data: EvaluationPeriodUpdate): Promise<ApiResponse<EvaluationPeriod>> => {
    return httpClient.put<EvaluationPeriod>(API_ENDPOINTS.EVALUATION_PERIODS.UPDATE(periodId), data);
  },

  /**
   * Delete an evaluation period
   */
  deleteEvaluationPeriod: async (periodId: UUID): Promise<ApiResponse<void>> => {
    return httpClient.delete<void>(API_ENDPOINTS.EVALUATION_PERIODS.DELETE(periodId));
  },
};