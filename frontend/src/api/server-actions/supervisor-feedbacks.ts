'use server';

import { supervisorFeedbacksApi } from '../endpoints/supervisor-feedbacks';
import type { 
  SupervisorFeedback, 
  SupervisorFeedbackDetail, 
  SupervisorFeedbackCreate, 
  SupervisorFeedbackUpdate,
  SupervisorFeedbackList,
  PaginationParams,
  UUID,
} from '../types';

/**
 * Server action to get supervisor feedbacks with pagination
 */
export async function getSupervisorFeedbacksAction(params?: PaginationParams): Promise<{
  success: boolean;
  data?: SupervisorFeedbackList;
  error?: string;
}> {
  try {
    const response = await supervisorFeedbacksApi.getSupervisorFeedbacks(params);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to fetch supervisor feedbacks',
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
}

/**
 * Server action to get a specific supervisor feedback by ID
 */
export async function getSupervisorFeedbackByIdAction(feedbackId: UUID): Promise<{
  success: boolean;
  data?: SupervisorFeedbackDetail;
  error?: string;
}> {
  try {
    const response = await supervisorFeedbacksApi.getSupervisorFeedbackById(feedbackId);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to fetch supervisor feedback',
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
}

/**
 * Server action to create a new supervisor feedback
 */
export async function createSupervisorFeedbackAction(feedbackData: SupervisorFeedbackCreate): Promise<{
  success: boolean;
  data?: SupervisorFeedbackDetail;
  error?: string;
}> {
  try {
    const response = await supervisorFeedbacksApi.createSupervisorFeedback(feedbackData);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to create supervisor feedback',
      };
    }
    
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
 * Server action to update an existing supervisor feedback
 */
export async function updateSupervisorFeedbackAction(feedbackId: UUID, updateData: SupervisorFeedbackUpdate): Promise<{
  success: boolean;
  data?: SupervisorFeedbackDetail;
  error?: string;
}> {
  try {
    const response = await supervisorFeedbacksApi.updateSupervisorFeedback(feedbackId, updateData);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to update supervisor feedback',
      };
    }
    
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
 * Server action to delete a supervisor feedback
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
        error: response.error || 'Failed to delete supervisor feedback',
      };
    }
    
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
export async function getSupervisorFeedbacksBySupervisorAction(supervisorId: UUID): Promise<{
  success: boolean;
  data?: SupervisorFeedback[];
  error?: string;
}> {
  try {
    const response = await supervisorFeedbacksApi.getSupervisorFeedbacksBySupervisor(supervisorId);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to fetch supervisor feedbacks by supervisor',
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
}

/**
 * Server action to get supervisor feedbacks by employee ID
 */
export async function getSupervisorFeedbacksByEmployeeAction(employeeId: UUID): Promise<{
  success: boolean;
  data?: SupervisorFeedback[];
  error?: string;
}> {
  try {
    const response = await supervisorFeedbacksApi.getSupervisorFeedbacksByEmployee(employeeId);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to fetch supervisor feedbacks by employee',
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
}

/**
 * Server action to get supervisor feedbacks by assessment ID
 */
export async function getSupervisorFeedbacksByAssessmentAction(assessmentId: UUID): Promise<{
  success: boolean;
  data?: SupervisorFeedback[];
  error?: string;
}> {
  try {
    const response = await supervisorFeedbacksApi.getSupervisorFeedbacksByAssessment(assessmentId);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to fetch supervisor feedbacks by assessment',
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
}

/**
 * Server action to submit a supervisor feedback
 */
export async function submitSupervisorFeedbackAction(feedbackId: UUID): Promise<{
  success: boolean;
  data?: SupervisorFeedbackDetail;
  error?: string;
}> {
  try {
    const response = await supervisorFeedbacksApi.submitSupervisorFeedback(feedbackId);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to submit supervisor feedback',
      };
    }
    
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
 * Server action to mark supervisor feedback as draft
 */
export async function draftSupervisorFeedbackAction(feedbackId: UUID): Promise<{
  success: boolean;
  data?: SupervisorFeedbackDetail;
  error?: string;
}> {
  try {
    const response = await supervisorFeedbacksApi.draftSupervisorFeedback(feedbackId);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to mark supervisor feedback as draft',
      };
    }
    
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