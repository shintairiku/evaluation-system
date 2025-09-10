'use server';

import { evaluationPeriodsApi } from '../endpoints/evaluation-periods';
import type { CategorizedEvaluationPeriods } from '../types/evaluation';


// Get categorized evaluation periods for user selection
export async function getEvaluationPeriodsAction(): Promise<{ 
  success: boolean; 
  data?: CategorizedEvaluationPeriods; 
  error?: string 
}> {
  try {
    const response = await evaluationPeriodsApi.getEvaluationPeriods();
    
    if (!response.success || !response.data) {
      return { 
        success: false, 
        error: response.error || 'Failed to fetch evaluation periods' 
      };
    }

    const allPeriods = response.data;
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


