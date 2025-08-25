'use server';

import { API_ENDPOINTS } from '../constants/config';
import { getHttpClient } from '../client/http-client';
import type { EvaluationPeriod, EvaluationPeriodListResponse, CategorizedEvaluationPeriods } from '../types/evaluation';


// Get evaluation periods for user selection
export async function getEvaluationPeriodsAction(params?: {
  status?: string;
  limit?: number;
  page?: number;
}): Promise<{ 
  success: boolean; 
  data?: CategorizedEvaluationPeriods; 
  error?: string 
}> {
  try {
    const http = getHttpClient();
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    queryParams.append('status', params?.status || 'all');
    queryParams.append('limit', String(params?.limit || 50));
    queryParams.append('page', String(params?.page || 1));
    
    const response = await http.get<EvaluationPeriodListResponse>(`${API_ENDPOINTS.EVALUATION_PERIODS.LIST}?${queryParams.toString()}`);
    
    if (!response.success || !response.data?.evaluation_periods) {
      return { success: false, error: response.errorMessage || 'Failed to fetch evaluation periods' };
    }

    const allPeriods = response.data.evaluation_periods;
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
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to fetch evaluation periods' };
  }
}


