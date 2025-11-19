import { getHttpClient } from '../client/http-client';
import { API_ENDPOINTS } from '../constants/config';
import type { ApiResponse, PaginationParams, SupervisorFeedbackList, UUID } from '../types';

const httpClient = getHttpClient();

export const selfAssessmentReviewsApi = {
  listPending: async (params?: {
    pagination?: PaginationParams;
    periodId?: UUID;
    subordinateId?: UUID;
  }): Promise<ApiResponse<SupervisorFeedbackList>> => {
    const queryParams = new URLSearchParams();
    // Always include page and limit with defaults if not provided
    queryParams.append('page', (params?.pagination?.page || 1).toString());
    queryParams.append('limit', (params?.pagination?.limit || 20).toString());
    if (params?.periodId) queryParams.append('periodId', params.periodId);
    if (params?.subordinateId) queryParams.append('subordinateId', params.subordinateId);

    const endpoint = queryParams.toString()
      ? `${API_ENDPOINTS.SELF_ASSESSMENT_REVIEWS.LIST}?${queryParams.toString()}`
      : API_ENDPOINTS.SELF_ASSESSMENT_REVIEWS.LIST;

    return httpClient.get<SupervisorFeedbackList>(endpoint);
  },
};
