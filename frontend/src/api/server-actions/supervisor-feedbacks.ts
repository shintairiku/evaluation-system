'use server';

import { cache } from 'react';
import { revalidateTag } from 'next/cache';
import { supervisorFeedbacksApi } from '../endpoints/supervisor-feedbacks';
import { CACHE_TAGS } from '../utils/cache';
import type {
  SupervisorFeedback,
  SupervisorFeedbackDetail,
  SupervisorFeedbackCreate,
  SupervisorFeedbackUpdate,
  SupervisorFeedbackSubmit,
  SupervisorFeedbackList,
  PaginationParams,
  UUID,
} from '../types';

/**
 * Server action to get supervisor feedbacks with pagination
 */
export const getSupervisorFeedbacksAction = cache(
  async (params?: {
    pagination?: PaginationParams;
    periodId?: string;
    supervisorId?: string;
    subordinateId?: string;
    status?: string;
    action?: string;
  }): Promise<{
    success: boolean;
    data?: SupervisorFeedbackList;
    error?: string;
  }> => {
    try {
      const response = await supervisorFeedbacksApi.getSupervisorFeedbacks(params);

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.errorMessage || 'Failed to fetch supervisor feedbacks',
        };
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('Get supervisor feedbacks action error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred while fetching supervisor feedbacks',
      };
    }
  },
);

/**
 * Server action to get a specific supervisor feedback by ID
 */
export const getSupervisorFeedbackByIdAction = cache(
  async (
    feedbackId: UUID,
  ): Promise<{
    success: boolean;
    data?: SupervisorFeedbackDetail;
    error?: string;
  }> => {
    try {
      const response = await supervisorFeedbacksApi.getSupervisorFeedbackById(feedbackId);

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.errorMessage || 'Failed to fetch supervisor feedback',
        };
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('Get supervisor feedback by ID action error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred while fetching supervisor feedback',
      };
    }
  },
);

/**
 * Server action to create a new supervisor feedback with cache revalidation
 */
export async function createSupervisorFeedbackAction(feedbackData: SupervisorFeedbackCreate): Promise<{
  success: boolean;
  data?: SupervisorFeedback;
  error?: string;
}> {
  try {
    const response = await supervisorFeedbacksApi.createSupervisorFeedback(feedbackData);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to create supervisor feedback',
      };
    }

    revalidateTag(CACHE_TAGS.SUPERVISOR_FEEDBACKS);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Create supervisor feedback action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while creating supervisor feedback',
    };
  }
}

/**
 * Server action to update an existing supervisor feedback with cache revalidation
 */
export async function updateSupervisorFeedbackAction(
  feedbackId: UUID,
  updateData: SupervisorFeedbackUpdate,
): Promise<{
  success: boolean;
  data?: SupervisorFeedback;
  error?: string;
}> {
  try {
    const response = await supervisorFeedbacksApi.updateSupervisorFeedback(feedbackId, updateData);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to update supervisor feedback',
      };
    }

    revalidateTag(CACHE_TAGS.SUPERVISOR_FEEDBACKS);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Update supervisor feedback action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while updating supervisor feedback',
    };
  }
}

/**
 * Server action to delete a supervisor feedback with cache revalidation
 */
export async function deleteSupervisorFeedbackAction(feedbackId: UUID): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const response = await supervisorFeedbacksApi.deleteSupervisorFeedback(feedbackId);

    if (!response.success) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to delete supervisor feedback',
      };
    }

    revalidateTag(CACHE_TAGS.SUPERVISOR_FEEDBACKS);

    return {
      success: true,
    };
  } catch (error) {
    console.error('Delete supervisor feedback action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while deleting supervisor feedback',
    };
  }
}

/**
 * Server action to get supervisor feedbacks by supervisor ID
 */
export const getSupervisorFeedbacksBySupervisorAction = cache(
  async (
    supervisorId: UUID,
  ): Promise<{
    success: boolean;
    data?: SupervisorFeedbackList;
    error?: string;
  }> => {
    try {
      const response = await supervisorFeedbacksApi.getSupervisorFeedbacksBySupervisor(supervisorId);

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.errorMessage || 'Failed to fetch supervisor feedbacks by supervisor',
        };
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('Get supervisor feedbacks by supervisor action error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred while fetching supervisor feedbacks by supervisor',
      };
    }
  },
);

/**
 * Server action to get supervisor feedbacks by employee ID
 */
export const getSupervisorFeedbacksByEmployeeAction = cache(
  async (
    employeeId: UUID,
  ): Promise<{
    success: boolean;
    data?: SupervisorFeedbackList;
    error?: string;
  }> => {
    try {
      const response = await supervisorFeedbacksApi.getSupervisorFeedbacksByEmployee(employeeId);

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.errorMessage || 'Failed to fetch supervisor feedbacks by employee',
        };
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('Get supervisor feedbacks by employee action error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred while fetching supervisor feedbacks by employee',
      };
    }
  },
);

/**
 * Server action to get supervisor feedbacks by assessment ID
 */
export const getSupervisorFeedbacksByAssessmentAction = cache(
  async (
    assessmentId: UUID,
  ): Promise<{
    success: boolean;
    data?: SupervisorFeedback | null;
    error?: string;
  }> => {
    try {
      const response = await supervisorFeedbacksApi.getSupervisorFeedbackByAssessment(assessmentId);

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.errorMessage || 'Failed to fetch supervisor feedbacks by assessment',
        };
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('Get supervisor feedbacks by assessment action error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred while fetching supervisor feedbacks by assessment',
      };
    }
  },
);

/**
 * Server action to submit a supervisor feedback with cache revalidation
 * This validates the required fields based on action type:
 * - APPROVED: requires supervisorRatingCode
 * - REJECTED: requires supervisorComment
 */
export async function submitSupervisorFeedbackAction(
  feedbackId: UUID,
  submitData: SupervisorFeedbackSubmit,
): Promise<{
  success: boolean;
  data?: SupervisorFeedback;
  error?: string;
}> {
  try {
    const response = await supervisorFeedbacksApi.submitSupervisorFeedback(feedbackId, submitData);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to submit supervisor feedback',
      };
    }

    revalidateTag(CACHE_TAGS.SUPERVISOR_FEEDBACKS);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Submit supervisor feedback action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while submitting supervisor feedback',
    };
  }
}

/**
 * Server action to mark supervisor feedback as draft with cache revalidation
 */
export async function draftSupervisorFeedbackAction(feedbackId: UUID): Promise<{
  success: boolean;
  data?: SupervisorFeedback;
  error?: string;
}> {
  try {
    const response = await supervisorFeedbacksApi.draftSupervisorFeedback(feedbackId);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to mark supervisor feedback as draft',
      };
    }

    revalidateTag(CACHE_TAGS.SUPERVISOR_FEEDBACKS);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Draft supervisor feedback action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while marking supervisor feedback as draft',
    };
  }
}