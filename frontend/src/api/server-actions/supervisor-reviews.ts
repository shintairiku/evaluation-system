'use server';

import { supervisorReviewsApi } from '../endpoints/supervisor-reviews';
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
 * Server action to get supervisor reviews with pagination
 */
export async function getSupervisorReviewsAction(params?: { pagination?: PaginationParams; periodId?: string; goalId?: string; status?: string; }): Promise<{
  success: boolean;
  data?: SupervisorReviewList;
  error?: string;
}> {
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
}

/**
 * Server action to get a specific supervisor review by ID
 */
export async function getSupervisorReviewByIdAction(reviewId: UUID): Promise<{
  success: boolean;
  data?: SupervisorReviewDetail;
  error?: string;
}> {
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
}

/**
 * Server action to create a new supervisor review
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
 * Server action to update an existing supervisor review
 */
export async function updateSupervisorReviewAction(reviewId: UUID, updateData: SupervisorReviewUpdate): Promise<{
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
 * Server action to delete a supervisor review
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
 * Server action to get supervisor reviews by supervisor ID
 */
export async function getSupervisorReviewsBySupervisorAction(supervisorId: UUID): Promise<{
  success: boolean;
  data?: SupervisorReviewList;
  error?: string;
}> {
  try {
    const response = await supervisorReviewsApi.getSupervisorReviewsBySupervisor(supervisorId);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to fetch supervisor reviews by supervisor',
      };
    }
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Get supervisor reviews by supervisor action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while fetching supervisor reviews by supervisor',
    };
  }
}

/**
 * Server action to get supervisor reviews by employee ID
 */
export async function getSupervisorReviewsByEmployeeAction(employeeId: UUID): Promise<{
  success: boolean;
  data?: SupervisorReviewList;
  error?: string;
}> {
  try {
    const response = await supervisorReviewsApi.getSupervisorReviewsByEmployee(employeeId);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to fetch supervisor reviews by employee',
      };
    }
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Get supervisor reviews by employee action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while fetching supervisor reviews by employee',
    };
  }
}

/**
 * Server action to get supervisor reviews by goal ID
 */
export async function getSupervisorReviewsByGoalAction(goalId: UUID): Promise<{
  success: boolean;
  data?: SupervisorReviewList;
  error?: string;
}> {
  try {
    const response = await supervisorReviewsApi.getSupervisorReviewsByGoal(goalId);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to fetch supervisor reviews by goal',
      };
    }
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Get supervisor reviews by goal action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while fetching supervisor reviews by goal',
    };
  }
}

/**
 * Server action to get pending supervisor reviews
 */
export async function getPendingSupervisorReviewsAction(): Promise<{
  success: boolean;
  data?: SupervisorReviewList;
  error?: string;
}> {
  try {
    const response = await supervisorReviewsApi.getPendingSupervisorReviews();
    
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
}

/**
 * Server action to submit a supervisor review
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

/**
 * Server action to bulk submit supervisor reviews
 */
export async function bulkSubmitSupervisorReviewsAction(periodId: UUID, goalIds?: UUID[]): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const response = await supervisorReviewsApi.bulkSubmitSupervisorReviews(periodId, goalIds);
    
    if (!response.success) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to bulk submit supervisor reviews',
      };
    }
    
    return {
      success: true,
    };
  } catch (error) {
    console.error('Bulk submit supervisor reviews action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while bulk submitting supervisor reviews',
    };
  }
}