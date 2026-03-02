import { getHttpClient } from '../client/http-client';
import { API_ENDPOINTS } from '../constants/config';
import type {
  ApiResponse,
  ComprehensiveEvaluationListResponse,
  ComprehensiveEvaluationSettingsRequest,
  ComprehensiveEvaluationSettingsResponse,
  ComprehensiveManualDecisionHistoryResponse,
  FinalizeComprehensiveEvaluationRequest,
  FinalizeComprehensiveEvaluationResponse,
  GetComprehensiveEvaluationListParams,
  GetComprehensiveManualDecisionHistoryParams,
  UUID,
  UpsertComprehensiveManualDecisionRequest,
} from '../types';

const httpClient = getHttpClient();

export const comprehensiveEvaluationApi = {
  getComprehensiveEvaluationStageOptions: async (): Promise<ApiResponse<string[]>> => {
    return httpClient.get<string[]>(
      API_ENDPOINTS.COMPREHENSIVE_EVALUATION.STAGE_OPTIONS,
    );
  },

  getComprehensiveEvaluationList: async (
    params: GetComprehensiveEvaluationListParams,
  ): Promise<ApiResponse<ComprehensiveEvaluationListResponse>> => {
    const queryParams = new URLSearchParams();

    queryParams.append('periodId', params.periodId);
    if (params.departmentId) queryParams.append('departmentId', params.departmentId);
    if (params.stageId) queryParams.append('stageId', params.stageId);
    if (params.employmentType) queryParams.append('employmentType', params.employmentType);
    if (params.search) queryParams.append('search', params.search);
    if (params.processingStatus) queryParams.append('processingStatus', params.processingStatus);
    if (params.page) queryParams.append('page', String(params.page));
    if (params.limit) queryParams.append('limit', String(params.limit));

    return httpClient.get<ComprehensiveEvaluationListResponse>(
      `${API_ENDPOINTS.COMPREHENSIVE_EVALUATION.LIST}?${queryParams.toString()}`,
    );
  },

  getComprehensiveEvaluationSettings: async (): Promise<ApiResponse<ComprehensiveEvaluationSettingsResponse>> => {
    return httpClient.get<ComprehensiveEvaluationSettingsResponse>(
      API_ENDPOINTS.COMPREHENSIVE_EVALUATION.SETTINGS,
    );
  },

  updateComprehensiveEvaluationSettings: async (
    payload: ComprehensiveEvaluationSettingsRequest,
  ): Promise<ApiResponse<ComprehensiveEvaluationSettingsResponse>> => {
    return httpClient.put<ComprehensiveEvaluationSettingsResponse>(
      API_ENDPOINTS.COMPREHENSIVE_EVALUATION.SETTINGS,
      payload,
    );
  },

  finalizeComprehensiveEvaluationPeriod: async (
    payload: FinalizeComprehensiveEvaluationRequest,
  ): Promise<ApiResponse<FinalizeComprehensiveEvaluationResponse>> => {
    return httpClient.post<FinalizeComprehensiveEvaluationResponse>(
      API_ENDPOINTS.COMPREHENSIVE_EVALUATION.FINALIZE,
      payload,
    );
  },

  upsertComprehensiveManualDecision: async (
    userId: UUID,
    payload: UpsertComprehensiveManualDecisionRequest,
  ): Promise<ApiResponse<unknown>> => {
    return httpClient.put<unknown>(
      API_ENDPOINTS.COMPREHENSIVE_EVALUATION.MANUAL_DECISION(userId),
      payload,
    );
  },

  clearComprehensiveManualDecision: async (userId: UUID, periodId: UUID): Promise<ApiResponse<unknown>> => {
    const query = new URLSearchParams({ periodId });
    return httpClient.delete<unknown>(
      `${API_ENDPOINTS.COMPREHENSIVE_EVALUATION.MANUAL_DECISION(userId)}?${query.toString()}`,
    );
  },

  getComprehensiveManualDecisionHistory: async (
    params?: GetComprehensiveManualDecisionHistoryParams,
  ): Promise<ApiResponse<ComprehensiveManualDecisionHistoryResponse>> => {
    const queryParams = new URLSearchParams();

    if (params?.periodId) queryParams.append('periodId', params.periodId);
    if (params?.page) queryParams.append('page', String(params.page));
    if (params?.limit) queryParams.append('limit', String(params.limit));

    const endpoint = queryParams.toString()
      ? `${API_ENDPOINTS.COMPREHENSIVE_EVALUATION.MANUAL_HISTORY}?${queryParams.toString()}`
      : API_ENDPOINTS.COMPREHENSIVE_EVALUATION.MANUAL_HISTORY;

    return httpClient.get<ComprehensiveManualDecisionHistoryResponse>(endpoint);
  },
};
