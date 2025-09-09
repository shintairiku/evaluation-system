'use server';

import { stagesApi } from '../endpoints/stages';
import type { Stage } from '../types';

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
    const result = await stagesApi.getStages();
    
    if (result.success) {
      return {
        success: true,
        data: result.data
      };
    } else {
      return {
        success: false,
        error: result.error || 'Failed to fetch stages'
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