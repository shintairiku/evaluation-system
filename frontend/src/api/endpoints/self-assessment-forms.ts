import { getHttpClient } from '../client/http-client';
import { API_ENDPOINTS } from '../constants/config';
import type {
  ApiResponse,
  SelfAssessmentContext,
  SelfAssessmentDraftEntry,
  SelfAssessmentSummary,
  UUID,
} from '../types';

const httpClient = getHttpClient();

export const selfAssessmentFormsApi = {
  getContext: async (): Promise<ApiResponse<SelfAssessmentContext>> => {
    return httpClient.get<SelfAssessmentContext>(API_ENDPOINTS.SELF_ASSESSMENT_FORMS.CURRENT);
  },

  saveDraft: async (draft: SelfAssessmentDraftEntry[]): Promise<ApiResponse<{ saved: boolean; updatedAt?: string }>> => {
    return httpClient.post<{ saved: boolean; updatedAt?: string }>(
      API_ENDPOINTS.SELF_ASSESSMENT_FORMS.DRAFT,
      draft
    );
  },

  submit: async (draft: SelfAssessmentDraftEntry[]): Promise<ApiResponse<SelfAssessmentSummary>> => {
    return httpClient.post<SelfAssessmentSummary>(
      API_ENDPOINTS.SELF_ASSESSMENT_FORMS.SUBMIT,
      draft
    );
  },

  getSummary: async (periodId: UUID, userId?: UUID): Promise<ApiResponse<SelfAssessmentSummary | null>> => {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    return httpClient.get<SelfAssessmentSummary | null>(
      `${API_ENDPOINTS.SELF_ASSESSMENT_FORMS.SUMMARY(periodId)}${query}`
    );
  },
};
