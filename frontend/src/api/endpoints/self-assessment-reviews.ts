import { getHttpClient } from '../client/http-client';
import { API_ENDPOINTS } from '../constants/config';
import type { ApiResponse, PaginationParams, SelfAssessmentReviewList, UpdateBucketDecisionsRequest, UUID } from '../types';

const httpClient = getHttpClient();

export const selfAssessmentReviewsApi = {
  /**
   * List pending self-assessment reviews for supervisor approval (bucket-based)
   */
  listPending: async (params?: {
    pagination?: PaginationParams;
    periodId?: UUID;
    subordinateId?: UUID;
  }): Promise<ApiResponse<SelfAssessmentReviewList>> => {
    const queryParams = new URLSearchParams();
    // Always include page and limit with defaults if not provided
    queryParams.append('page', (params?.pagination?.page || 1).toString());
    queryParams.append('limit', (params?.pagination?.limit || 20).toString());
    if (params?.periodId) queryParams.append('periodId', params.periodId);
    if (params?.subordinateId) queryParams.append('subordinateId', params.subordinateId);

    const endpoint = queryParams.toString()
      ? `${API_ENDPOINTS.SELF_ASSESSMENT_REVIEWS.LIST}?${queryParams.toString()}`
      : API_ENDPOINTS.SELF_ASSESSMENT_REVIEWS.LIST;

    return httpClient.get<SelfAssessmentReviewList>(endpoint);
  },

  /**
   * Update bucket decisions for a supervisor feedback
   */
  updateBucketDecisions: async (
    feedbackId: UUID,
    data: UpdateBucketDecisionsRequest
  ): Promise<ApiResponse<void>> => {
    return httpClient.put<void>(
      `/supervisor-feedbacks/${feedbackId}/bucket-decisions`,
      data
    );
  },
};
