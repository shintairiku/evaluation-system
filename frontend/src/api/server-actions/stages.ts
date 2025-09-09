'use server';

import { getHttpClient } from '../client/http-unified-client';
import { API_ENDPOINTS } from '../constants/config';
import type { Stage, ApiResponse } from '../types';

/**
 * Server action to get all stages
 * This function runs on the server side for SSR
 */
export async function getStagesAction(): Promise<{
  success: boolean;
  data?: Stage[];
  error?: string;
}> {
  try {
    const httpClient = await getHttpClient();
    const result = await httpClient.get<Stage[]>(API_ENDPOINTS.STAGES.LIST);
    
    if (result.success) {
      return {
        success: true,
        data: result.data
      };
    } else {
      return {
        success: false,
        error: result.errorMessage || 'Failed to fetch stages'
      };
    }
  } catch (error) {
    console.error('Server action error (getStagesAction):', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}