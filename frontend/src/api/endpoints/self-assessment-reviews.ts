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
    if (params?.pagination?.page) queryParams.append('page', params.pagination.page.toString());
    if (params?.pagination?.limit) queryParams.append('limit', params.pagination.limit.toString());
    if (params?.periodId) queryParams.append('periodId', params.periodId);
    if (params?.subordinateId) queryParams.append('subordinateId', params.subordinateId);

    const endpoint = queryParams.toString()
      ? `${API_ENDPOINTS.SELF_ASSESSMENT_REVIEWS.LIST}?${queryParams.toString()}`
      : API_ENDPOINTS.SELF_ASSESSMENT_REVIEWS.LIST;

    return httpClient.get<SupervisorFeedbackList>(endpoint);
  },
};
