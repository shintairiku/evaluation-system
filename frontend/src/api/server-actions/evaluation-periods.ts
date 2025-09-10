'use server';

import { evaluationPeriodsApi } from '../endpoints/evaluation-periods';
import type { 
  EvaluationPeriod, 
  EvaluationPeriodDetail, 
  EvaluationPeriodCreate, 
  EvaluationPeriodUpdate,
  UUID,
} from '../types';

/**
 * Server action to get all evaluation periods (raw list)
 */
export async function getAllEvaluationPeriodsAction(): Promise<{
  success: boolean;
  data?: EvaluationPeriod[];
  error?: string;
}> {
  try {
    const response = await evaluationPeriodsApi.getEvaluationPeriods();
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to fetch evaluation periods',
      };
    }
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Get evaluation periods action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while fetching evaluation periods',
    };
  }
}

/**
 * Server action to get a specific evaluation period by ID
 */
export async function getEvaluationPeriodByIdAction(periodId: UUID): Promise<{
  success: boolean;
  data?: EvaluationPeriodDetail;
  error?: string;
}> {
  try {
    const response = await evaluationPeriodsApi.getEvaluationPeriodById(periodId);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to fetch evaluation period',
      };
    }
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Get evaluation period by ID action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while fetching evaluation period',
    };
  }
}

/**
 * Server action to create a new evaluation period
 */
export async function createEvaluationPeriodAction(periodData: EvaluationPeriodCreate): Promise<{
  success: boolean;
  data?: EvaluationPeriodDetail;
  error?: string;
}> {
  try {
    const response = await evaluationPeriodsApi.createEvaluationPeriod(periodData);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to create evaluation period',
      };
    }
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Create evaluation period action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while creating evaluation period',
    };
  }
}

/**
 * Server action to update an existing evaluation period
 */
export async function updateEvaluationPeriodAction(periodId: UUID, updateData: EvaluationPeriodUpdate): Promise<{
  success: boolean;
  data?: EvaluationPeriodDetail;
  error?: string;
}> {
  try {
    const response = await evaluationPeriodsApi.updateEvaluationPeriod(periodId, updateData);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to update evaluation period',
      };
    }
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Update evaluation period action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while updating evaluation period',
    };
  }
}

/**
 * Server action to delete an evaluation period
 */
export async function deleteEvaluationPeriodAction(periodId: UUID): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const response = await evaluationPeriodsApi.deleteEvaluationPeriod(periodId);
    
    if (!response.success) {
      return {
        success: false,
        error: response.error || 'Failed to delete evaluation period',
      };
    }
    
    return {
      success: true,
    };
  } catch (error) {
    console.error('Delete evaluation period action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while deleting evaluation period',
    };
  }
}

/**
 * Server action to get the current active evaluation period
 */
export async function getCurrentEvaluationPeriodAction(): Promise<{
  success: boolean;
  data?: EvaluationPeriod;
  error?: string;
}> {
  try {
    const response = await evaluationPeriodsApi.getCurrentEvaluationPeriod();
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to fetch current evaluation period',
      };
    }
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Get current evaluation period action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while fetching current evaluation period',
    };
  }
}