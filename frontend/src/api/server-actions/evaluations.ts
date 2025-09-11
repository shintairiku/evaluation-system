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
    
    // Handle both possible response structures
    let allPeriods: EvaluationPeriod[];
    if (Array.isArray(response.data)) {
      // If response.data is directly an array
      allPeriods = response.data as EvaluationPeriod[];
    } else if (response.data.items && Array.isArray(response.data.items)) {
      // If response.data has an items property
      allPeriods = response.data.items as EvaluationPeriod[];
    } else {
      console.error('Unexpected response structure:', response.data);
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


