'use server';

import { cache } from 'react';
import { revalidateTag } from 'next/cache';
import { selfAssessmentReviewsApi } from '../endpoints/self-assessment-reviews';
import type { PaginationParams, SelfAssessmentReviewList, UpdateBucketDecisionsRequest } from '../types';
import { CACHE_TAGS } from '../utils/cache';

export const getPendingSelfAssessmentReviewsAction = cache(async (params?: {
  pagination?: PaginationParams;
  periodId?: string;
  subordinateId?: string;
}) : Promise<{
  success: boolean;
  data?: SelfAssessmentReviewList;
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

export async function updateBucketDecisionsAction(
  feedbackId: string,
  data: UpdateBucketDecisionsRequest
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await selfAssessmentReviewsApi.updateBucketDecisions(feedbackId, data);

    if (!response.success) {
      return { success: false, error: response.errorMessage || 'Failed to update bucket decisions' };
    }

    // Revalidate relevant caches
    revalidateTag(CACHE_TAGS.SUPERVISOR_FEEDBACKS);
    revalidateTag(CACHE_TAGS.SELF_ASSESSMENT_REVIEWS);

    return { success: true };
  } catch (error) {
    console.error('updateBucketDecisionsAction error:', error);
    return { success: false, error: 'Unexpected error updating bucket decisions' };
  }
}
