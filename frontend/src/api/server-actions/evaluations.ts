'use server';

import { evaluationPeriodsApi } from '../endpoints/evaluation-periods';
import type { CategorizedEvaluationPeriods, EvaluationPeriod } from '../types/evaluation';


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
        error: response.errorMessage || 'Failed to fetch evaluation periods' 
      };
    }

    // Debug: Log the actual response structure
    console.log('Debug - response.data:', response.data);
    console.log('Debug - response.data type:', typeof response.data);
    console.log('Debug - response.data.items:', response.data.items);
    
    // Backend returns { evaluation_periods: EvaluationPeriod[], ... }
    // Client types expect { items: EvaluationPeriod[], ... }
    // Normalize to an array of EvaluationPeriod
    let allPeriods: EvaluationPeriod[];
    if (Array.isArray(response.data)) {
      allPeriods = response.data as EvaluationPeriod[];
    } else if (Array.isArray((response.data as any).evaluation_periods)) {
      allPeriods = (response.data as any).evaluation_periods as EvaluationPeriod[];
    } else if ((response.data as any).items && Array.isArray((response.data as any).items)) {
      allPeriods = (response.data as any).items as EvaluationPeriod[];
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


