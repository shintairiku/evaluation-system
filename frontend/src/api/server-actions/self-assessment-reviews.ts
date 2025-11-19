'use server';

import { cache } from 'react';
import { selfAssessmentReviewsApi } from '../endpoints/self-assessment-reviews';
import type { PaginationParams, SupervisorFeedbackList } from '../types';

export const getPendingSelfAssessmentReviewsAction = cache(async (params?: {
  pagination?: PaginationParams;
  periodId?: string;
  subordinateId?: string;
}) : Promise<{
  success: boolean;
  data?: SupervisorFeedbackList;
  error?: string;
}> => {
  try {
    const response = await selfAssessmentReviewsApi.listPending({
      pagination: params?.pagination,
      periodId: params?.periodId as string | undefined,
      subordinateId: params?.subordinateId as string | undefined,
    });

    if (!response.success || !response.data) {
      return { success: false, error: response.errorMessage || 'Failed to fetch pending self-assessment reviews' };
    }

    return { success: true, data: response.data };
  } catch (error) {
    console.error('getPendingSelfAssessmentReviewsAction error:', error);
    return { success: false, error: 'Unexpected error fetching pending self-assessment reviews' };
  }
});
