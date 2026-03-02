import { getHttpClient } from '../client/http-client';
import { API_ENDPOINTS } from '../constants/config';
import type {
  CoreValueDefinition,
  CoreValueEvaluation,
  CoreValueEvaluationUpdate,
  CoreValueFeedback,
  CoreValueFeedbackUpdate,
  CoreValueFeedbackSubmit,
  CoreValueFeedbackReturn,
  CoreValueSubordinateData,
  ApiResponse,
} from '../types';

const httpClient = getHttpClient();

/**
 * Core Value API endpoints for definitions, evaluations, and feedback
 */
export const coreValuesApi = {
  // ---- Definitions ----

  getDefinitions: async (): Promise<ApiResponse<CoreValueDefinition[]>> => {
    return httpClient.get<CoreValueDefinition[]>(API_ENDPOINTS.CORE_VALUES.DEFINITIONS);
  },

  seedDefinitions: async (): Promise<ApiResponse<{ success: boolean; message: string }>> => {
    return httpClient.post<{ success: boolean; message: string }>(
      API_ENDPOINTS.CORE_VALUES.DEFINITIONS_SEED,
      {},
    );
  },

  // ---- Employee Evaluation ----

  getMyEvaluation: async (
    periodId: string,
  ): Promise<ApiResponse<CoreValueEvaluation | null>> => {
    return httpClient.get<CoreValueEvaluation | null>(
      `${API_ENDPOINTS.CORE_VALUES.MY_EVALUATION}?periodId=${periodId}`,
    );
  },

  updateEvaluation: async (
    evaluationId: string,
    data: CoreValueEvaluationUpdate,
  ): Promise<ApiResponse<CoreValueEvaluation>> => {
    return httpClient.put<CoreValueEvaluation>(
      API_ENDPOINTS.CORE_VALUES.UPDATE_EVALUATION(evaluationId),
      data,
    );
  },

  submitEvaluation: async (
    evaluationId: string,
  ): Promise<ApiResponse<CoreValueEvaluation>> => {
    return httpClient.post<CoreValueEvaluation>(
      API_ENDPOINTS.CORE_VALUES.SUBMIT_EVALUATION(evaluationId),
      {},
    );
  },

  reopenEvaluation: async (
    evaluationId: string,
  ): Promise<ApiResponse<CoreValueEvaluation>> => {
    return httpClient.post<CoreValueEvaluation>(
      API_ENDPOINTS.CORE_VALUES.REOPEN_EVALUATION(evaluationId),
      {},
    );
  },

  // ---- Supervisor ----

  getSubordinateData: async (
    periodId: string,
    subordinateId: string,
  ): Promise<ApiResponse<CoreValueSubordinateData>> => {
    return httpClient.get<CoreValueSubordinateData>(
      `${API_ENDPOINTS.CORE_VALUES.SUBORDINATE_DATA}?periodId=${periodId}&subordinateId=${subordinateId}`,
    );
  },

  updateFeedback: async (
    feedbackId: string,
    data: CoreValueFeedbackUpdate,
  ): Promise<ApiResponse<CoreValueFeedback>> => {
    return httpClient.put<CoreValueFeedback>(
      API_ENDPOINTS.CORE_VALUES.UPDATE_FEEDBACK(feedbackId),
      data,
    );
  },

  submitFeedback: async (
    feedbackId: string,
    data: CoreValueFeedbackSubmit,
  ): Promise<ApiResponse<CoreValueFeedback>> => {
    return httpClient.post<CoreValueFeedback>(
      API_ENDPOINTS.CORE_VALUES.SUBMIT_FEEDBACK(feedbackId),
      data,
    );
  },

  returnFeedback: async (
    feedbackId: string,
    data: CoreValueFeedbackReturn,
  ): Promise<ApiResponse<CoreValueFeedback>> => {
    return httpClient.post<CoreValueFeedback>(
      API_ENDPOINTS.CORE_VALUES.RETURN_FEEDBACK(feedbackId),
      data,
    );
  },
};
