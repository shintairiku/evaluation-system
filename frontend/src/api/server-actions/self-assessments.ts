'use server';

import { cache } from 'react';
import { revalidateTag } from 'next/cache';
import { selfAssessmentsApi } from '../endpoints/self-assessments';
import { CACHE_TAGS } from '../utils/cache';
import type { 
  SelfAssessment, 
  SelfAssessmentDetail, 
  SelfAssessmentCreate, 
  SelfAssessmentUpdate,
  SelfAssessmentList,
  PaginationParams,
  UUID,
} from '../types';

/**
 * Server action to get self-assessments with pagination
 */
export const getSelfAssessmentsAction = cache(
  async (params?: {
    pagination?: PaginationParams;
    periodId?: string;
    userId?: string;
    status?: string;
  }): Promise<{
    success: boolean;
    data?: SelfAssessmentList;
    error?: string;
  }> => {
    try {
      const response = await selfAssessmentsApi.getSelfAssessments(params);

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.errorMessage || 'Failed to fetch self-assessments',
        };
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('Get self-assessments action error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred while fetching self-assessments',
      };
    }
  },
);

/**
 * Server action to get a specific self-assessment by ID
 */
export const getSelfAssessmentByIdAction = cache(
  async (
    assessmentId: UUID,
  ): Promise<{
    success: boolean;
    data?: SelfAssessmentDetail;
    error?: string;
  }> => {
    try {
      const response = await selfAssessmentsApi.getSelfAssessmentById(assessmentId);

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.errorMessage || 'Failed to fetch self-assessment',
        };
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('Get self-assessment by ID action error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred while fetching self-assessment',
      };
    }
  },
);

/**
 * Server action to create a new self-assessment with cache revalidation
 */
export async function createSelfAssessmentAction(
  assessmentData: SelfAssessmentCreate,
  goalId: UUID,
): Promise<{
  success: boolean;
  data?: SelfAssessment;
  error?: string;
}> {
  try {
    const response = await selfAssessmentsApi.createSelfAssessment(assessmentData, goalId);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to create self-assessment',
      };
    }

    revalidateTag(CACHE_TAGS.SELF_ASSESSMENTS);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Create self-assessment action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while creating self-assessment',
    };
  }
}

/**
 * Server action to update an existing self-assessment with cache revalidation
 */
export async function updateSelfAssessmentAction(
  assessmentId: UUID,
  updateData: SelfAssessmentUpdate,
): Promise<{
  success: boolean;
  data?: SelfAssessment;
  error?: string;
}> {
  try {
    const response = await selfAssessmentsApi.updateSelfAssessment(assessmentId, updateData);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to update self-assessment',
      };
    }

    revalidateTag(CACHE_TAGS.SELF_ASSESSMENTS);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Update self-assessment action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while updating self-assessment',
    };
  }
}

/**
 * Server action to delete a self-assessment with cache revalidation
 */
export async function deleteSelfAssessmentAction(assessmentId: UUID): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const response = await selfAssessmentsApi.deleteSelfAssessment(assessmentId);

    if (!response.success) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to delete self-assessment',
      };
    }

    revalidateTag(CACHE_TAGS.SELF_ASSESSMENTS);

    return {
      success: true,
    };
  } catch (error) {
    console.error('Delete self-assessment action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while deleting self-assessment',
    };
  }
}

/**
 * Server action to get self-assessments by user ID
 */
export const getSelfAssessmentsByUserAction = cache(
  async (
    userId: UUID,
  ): Promise<{
    success: boolean;
    data?: SelfAssessmentList;
    error?: string;
  }> => {
    try {
      const response = await selfAssessmentsApi.getSelfAssessmentsByUser(userId);

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.errorMessage || 'Failed to fetch user self-assessments',
        };
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('Get self-assessments by user action error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred while fetching user self-assessments',
      };
    }
  },
);

/**
 * Server action to get self-assessments by period ID
 */
export const getSelfAssessmentsByPeriodAction = cache(
  async (
    periodId: UUID,
  ): Promise<{
    success: boolean;
    data?: SelfAssessmentList;
    error?: string;
  }> => {
    try {
      const response = await selfAssessmentsApi.getSelfAssessmentsByPeriod(periodId);

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.errorMessage || 'Failed to fetch period self-assessments',
        };
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('Get self-assessments by period action error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred while fetching period self-assessments',
      };
    }
  },
);

/**
 * Server action to get self-assessments by goal ID
 */
export const getSelfAssessmentsByGoalAction = cache(
  async (
    goalId: UUID,
  ): Promise<{
    success: boolean;
    data?: SelfAssessment | null;
    error?: string;
  }> => {
    try {
      const response = await selfAssessmentsApi.getSelfAssessmentByGoal(goalId);

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.errorMessage || 'Failed to fetch goal self-assessments',
        };
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('Get self-assessments by goal action error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred while fetching goal self-assessments',
      };
    }
  },
);

/**
 * Server action to submit a self-assessment with cache revalidation
 */
export async function submitSelfAssessmentAction(assessmentId: UUID): Promise<{
  success: boolean;
  data?: SelfAssessment;
  error?: string;
}> {
  try {
    const response = await selfAssessmentsApi.submitSelfAssessment(assessmentId);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to submit self-assessment',
      };
    }

    revalidateTag(CACHE_TAGS.SELF_ASSESSMENTS);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Submit self-assessment action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while submitting self-assessment',
    };
  }
}