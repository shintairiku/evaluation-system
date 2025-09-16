'use server';

import { evaluationPeriodsApi } from '../endpoints/evaluation-periods';
import type { 
  EvaluationPeriod, 
  EvaluationPeriodDetail, 
  EvaluationPeriodCreate, 
  EvaluationPeriodUpdate,
  EvaluationPeriodList,
  CategorizedEvaluationPeriods,
  UUID,
} from '../types';

/**
 * Server action to get all evaluation periods (raw list)
 */
export async function getAllEvaluationPeriodsAction(): Promise<{
  success: boolean;
  data?: EvaluationPeriodList;
  error?: string;
}> {
  try {
    const response = await evaluationPeriodsApi.getEvaluationPeriods();
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to fetch evaluation periods',
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
        error: response.errorMessage || 'Failed to fetch evaluation period',
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
  data?: EvaluationPeriod;
  error?: string;
}> {
  try {
    const response = await evaluationPeriodsApi.createEvaluationPeriod(periodData);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to create evaluation period',
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
  data?: EvaluationPeriod;
  error?: string;
}> {
  try {
    const response = await evaluationPeriodsApi.updateEvaluationPeriod(periodId, updateData);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to update evaluation period',
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
        error: response.errorMessage || 'Failed to delete evaluation period',
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
        error: response.errorMessage || 'Failed to fetch current evaluation period',
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

/**
 * Server action to get categorized evaluation periods for user selection
 */
export async function getCategorizedEvaluationPeriodsAction(): Promise<{ 
  success: boolean; 
  data?: CategorizedEvaluationPeriods; 
  error?: string 
}> {
  try {
    const response = await evaluationPeriodsApi.getEvaluationPeriods();
    
    if (!response.success || !response.data) {
      return { 
        success: false, 
        error: response.errorMessage || 'Failed to fetch evaluation periods' 
      };
    }

    // Backend returns EvaluationPeriodList with evaluation_periods array
    // Extract the periods array from the response
    let allPeriods: EvaluationPeriod[];
    
    if (Array.isArray(response.data)) {
      allPeriods = response.data as EvaluationPeriod[];
    } else if ('evaluation_periods' in response.data && Array.isArray(response.data.evaluation_periods)) {
      allPeriods = response.data.evaluation_periods;
    } else {
      console.error('Unexpected response structure from evaluation periods API:', response.data);
      return {
        success: false,
        error: 'Unexpected response structure from evaluation periods API'
      };
    }

    const current = allPeriods.find(p => p.status === '実施中') || null;
    const upcoming = allPeriods.filter(p => p.status === '準備中');

    return {
      success: true,
      data: {
        current,
        upcoming,
        all: allPeriods
      }
    };
  } catch (error) {
    console.error('Get categorized evaluation periods action error:', error);
    return { 
      success: false, 
      error: 'An unexpected error occurred while fetching categorized evaluation periods' 
    };
  }
}