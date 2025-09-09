import { httpClient } from '../client/http-client';
import { API_ENDPOINTS } from '../constants/endpoints';
import type { ApiResponse, Stage } from '../types';

/**
 * Stages API endpoints
 * 1:1 mapping with backend endpoints
 */
export const stagesApi = {
  /**
   * Get all stages
   */
  getStages: async (): Promise<ApiResponse<Stage[]>> => {
    return httpClient.get<Stage[]>(API_ENDPOINTS.STAGES.LIST);
  },
};