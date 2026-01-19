'use server';

import { cache } from 'react';
import { revalidateTag } from 'next/cache';
import { supervisorReviewsApi } from '../endpoints/supervisor-reviews';
import { CACHE_TAGS } from '../utils/cache';
import type { 
  SupervisorReview, 
  SupervisorReviewDetail, 
  SupervisorReviewCreate, 
  SupervisorReviewUpdate,
  SupervisorReviewList,
  PaginationParams,
  UUID,
} from '../types';

/**
 * Server action to get supervisor reviews with pagination and flexible filtering
 */
export const getSupervisorReviewsAction = cache(
  async (params?: {
    pagination?: PaginationParams;
    periodId?: string;
    goalId?: string;
    subordinateId?: string;
    status?: string;
  }): Promise<{
    success: boolean;
    data?: SupervisorReviewList;
    error?: string;
  }> => {
    try {
      const response = await supervisorReviewsApi.getSupervisorReviews(params);

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.errorMessage || 'Failed to fetch supervisor reviews',
        };
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('Get supervisor reviews action error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred while fetching supervisor reviews',
      };
    }
  },
);

/**
 * Server action to get a specific supervisor review by ID
 */
export const getSupervisorReviewByIdAction = cache(
  async (
    reviewId: UUID,
  ): Promise<{
    success: boolean;
    data?: SupervisorReviewDetail;
    error?: string;
  }> => {
    try {
      const response = await supervisorReviewsApi.getSupervisorReviewById(reviewId);

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.errorMessage || 'Failed to fetch supervisor review',
        };
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('Get supervisor review by ID action error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred while fetching supervisor review',
      };
    }
  },
);

/**
 * Server action to create a new supervisor review with cache revalidation
 */
export async function createSupervisorReviewAction(reviewData: SupervisorReviewCreate): Promise<{
  success: boolean;
  data?: SupervisorReview;
  error?: string;
}> {
  try {
    const response = await supervisorReviewsApi.createSupervisorReview(reviewData);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to create supervisor review',
      };
    }

    revalidateTag(CACHE_TAGS.SUPERVISOR_REVIEWS);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Create supervisor review action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while creating supervisor review',
    };
  }
}

/**
 * Server action to update an existing supervisor review with cache revalidation
 */
export async function updateSupervisorReviewAction(
  reviewId: UUID,
  updateData: SupervisorReviewUpdate,
): Promise<{
  success: boolean;
  data?: SupervisorReview;
  error?: string;
}> {
  try {
    const response = await supervisorReviewsApi.updateSupervisorReview(reviewId, updateData);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to update supervisor review',
      };
    }

    revalidateTag(CACHE_TAGS.SUPERVISOR_REVIEWS);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Update supervisor review action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while updating supervisor review',
    };
  }
}

/**
 * Server action to delete a supervisor review with cache revalidation
 */
export async function deleteSupervisorReviewAction(reviewId: UUID): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const response = await supervisorReviewsApi.deleteSupervisorReview(reviewId);

    if (!response.success) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to delete supervisor review',
      };
    }

    revalidateTag(CACHE_TAGS.SUPERVISOR_REVIEWS);

    return {
      success: true,
    };
  } catch (error) {
    console.error('Delete supervisor review action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while deleting supervisor review',
    };
  }
}


/**
 * Server action to get pending supervisor reviews with optional filtering
 */
export const getPendingSupervisorReviewsAction = cache(
  async (params?: {
    pagination?: PaginationParams;
    periodId?: string;
    subordinateId?: string;
    include?: string;
  }): Promise<{
    success: boolean;
    data?: SupervisorReviewList;
    error?: string;
  }> => {
    try {
      const response = await supervisorReviewsApi.getPendingSupervisorReviews(params);

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.errorMessage || 'Failed to fetch pending supervisor reviews',
        };
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('Get pending supervisor reviews action error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred while fetching pending supervisor reviews',
      };
    }
  },
);

/**
 * Server action to submit a supervisor review with cache revalidation
 */
export async function submitSupervisorReviewAction(reviewId: UUID): Promise<{
  success: boolean;
  data?: SupervisorReview;
  error?: string;
}> {
  try {
    const response = await supervisorReviewsApi.submitSupervisorReview(reviewId);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to submit supervisor review',
      };
    }

    revalidateTag(CACHE_TAGS.SUPERVISOR_REVIEWS);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Submit supervisor review action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while submitting supervisor review',
    };
  }
}
