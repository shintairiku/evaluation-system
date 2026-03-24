import { getHttpClient } from '../client/http-client';
import { API_ENDPOINTS } from '../constants/config';
import type {
  ApiResponse,
  ComprehensiveEvaluationListResponse,
  ComprehensiveEvaluationSettingsWorkspaceResponse,
  ComprehensiveRulesetAssignmentResponse,
  ComprehensiveRulesetTemplateResponse,
  ExportComprehensiveEvaluationRequest,
  ComprehensiveManualDecisionHistoryResponse,
  FinalizeComprehensiveEvaluationRequest,
  FinalizeComprehensiveEvaluationResponse,
  GetComprehensiveEvaluationSettingsWorkspaceParams,
  GetComprehensiveEvaluationListParams,
  GetComprehensiveManualDecisionHistoryParams,
  UpdateComprehensiveDepartmentAssignmentRequest,
  UpdateComprehensiveDefaultAssignmentRequest,
  UpdateComprehensiveStageAssignmentRequest,
  ProcessComprehensiveEvaluationUserRequest,
  ProcessComprehensiveEvaluationUserResponse,
  UUID,
  UpsertComprehensiveRulesetRequest,
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
    if (params.candidateView !== undefined) queryParams.append('candidateView', String(params.candidateView));
    if (params.page) queryParams.append('page', String(params.page));
    if (params.limit) queryParams.append('limit', String(params.limit));

    return httpClient.get<ComprehensiveEvaluationListResponse>(
      `${API_ENDPOINTS.COMPREHENSIVE_EVALUATION.LIST}?${queryParams.toString()}`,
    );
  },

  exportComprehensiveEvaluationCsv: async (
    payload: ExportComprehensiveEvaluationRequest,
  ): Promise<ApiResponse<string>> => {
    return httpClient.post<string>(
      API_ENDPOINTS.COMPREHENSIVE_EVALUATION.EXPORT,
      payload,
    );
  },

  getComprehensiveEvaluationSettingsWorkspace: async (
    params: GetComprehensiveEvaluationSettingsWorkspaceParams,
  ): Promise<ApiResponse<ComprehensiveEvaluationSettingsWorkspaceResponse>> => {
    const queryParams = new URLSearchParams({ periodId: params.periodId });
    return httpClient.get<ComprehensiveEvaluationSettingsWorkspaceResponse>(
      `${API_ENDPOINTS.COMPREHENSIVE_EVALUATION.SETTINGS_WORKSPACE}?${queryParams.toString()}`,
    );
  },

  updateComprehensiveEvaluationDefaultAssignment: async (
    payload: UpdateComprehensiveDefaultAssignmentRequest,
  ): Promise<ApiResponse<ComprehensiveRulesetAssignmentResponse>> => {
    return httpClient.put<ComprehensiveRulesetAssignmentResponse>(
      API_ENDPOINTS.COMPREHENSIVE_EVALUATION.DEFAULT_ASSIGNMENT,
      payload,
    );
  },

  updateComprehensiveEvaluationDepartmentAssignment: async (
    departmentId: UUID,
    payload: UpdateComprehensiveDepartmentAssignmentRequest,
  ): Promise<ApiResponse<ComprehensiveRulesetAssignmentResponse>> => {
    return httpClient.put<ComprehensiveRulesetAssignmentResponse>(
      API_ENDPOINTS.COMPREHENSIVE_EVALUATION.DEPARTMENT_ASSIGNMENT(departmentId),
      payload,
    );
  },

  updateComprehensiveEvaluationStageAssignment: async (
    stageId: UUID,
    payload: UpdateComprehensiveStageAssignmentRequest,
  ): Promise<ApiResponse<ComprehensiveRulesetAssignmentResponse>> => {
    return httpClient.put<ComprehensiveRulesetAssignmentResponse>(
      API_ENDPOINTS.COMPREHENSIVE_EVALUATION.STAGE_ASSIGNMENT(stageId),
      payload,
    );
  },

  createComprehensiveEvaluationRuleset: async (
    payload: UpsertComprehensiveRulesetRequest,
  ): Promise<ApiResponse<ComprehensiveRulesetTemplateResponse>> => {
    return httpClient.post<ComprehensiveRulesetTemplateResponse>(
      API_ENDPOINTS.COMPREHENSIVE_EVALUATION.RULESETS,
      payload,
    );
  },

  updateComprehensiveEvaluationRuleset: async (
    rulesetId: UUID,
    payload: UpsertComprehensiveRulesetRequest,
  ): Promise<ApiResponse<ComprehensiveRulesetTemplateResponse>> => {
    return httpClient.put<ComprehensiveRulesetTemplateResponse>(
      API_ENDPOINTS.COMPREHENSIVE_EVALUATION.RULESET(rulesetId),
      payload,
    );
  },

  deleteComprehensiveEvaluationRuleset: async (rulesetId: UUID): Promise<ApiResponse<unknown>> => {
    return httpClient.delete<unknown>(API_ENDPOINTS.COMPREHENSIVE_EVALUATION.RULESET(rulesetId));
  },

  finalizeComprehensiveEvaluationPeriod: async (
    payload: FinalizeComprehensiveEvaluationRequest,
  ): Promise<ApiResponse<FinalizeComprehensiveEvaluationResponse>> => {
    return httpClient.post<FinalizeComprehensiveEvaluationResponse>(
      API_ENDPOINTS.COMPREHENSIVE_EVALUATION.FINALIZE,
      payload,
    );
  },

  processComprehensiveEvaluationUser: async (
    payload: ProcessComprehensiveEvaluationUserRequest,
  ): Promise<ApiResponse<ProcessComprehensiveEvaluationUserResponse>> => {
    return httpClient.post<ProcessComprehensiveEvaluationUserResponse>(
      API_ENDPOINTS.COMPREHENSIVE_EVALUATION.PROCESS_USER,
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
