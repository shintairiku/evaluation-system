import { getHttpClient } from '../client/http-client';
import { API_ENDPOINTS } from '../constants/config';
import type {
  Stage,
  StageDetail,
  StageWithUserCount,
  StageCreate,
  StageUpdate,
  ApiResponse,
  UUID,
} from '../types';

const httpClient = getHttpClient();

/**
 * Stage API endpoints for CRUD operations and admin functions
 * All functions follow the standardized pattern with proper error handling
 */
export const stagesApi = {
  /**
   * Get all stages (public access)
   */
  getStages: async (): Promise<ApiResponse<Stage[]>> => {
    return httpClient.get<Stage[]>(API_ENDPOINTS.STAGES.LIST);
  },

  /**
   * Get all stages with user count (admin only)
   */
  getStagesAdmin: async (): Promise<ApiResponse<StageWithUserCount[]>> => {
    // Development: Add dev admin header to ensure access
    const headers = process.env.NODE_ENV === 'development' ? {
      'Authorization': 'Bearer dev-admin-key'
    } : undefined;
    
    return httpClient.get<StageWithUserCount[]>(API_ENDPOINTS.STAGES.ADMIN, { headers });
  },

  /**
   * Get a specific stage by ID with detailed information
   */
  getStageById: async (stageId: UUID): Promise<ApiResponse<StageDetail>> => {
    return httpClient.get<StageDetail>(API_ENDPOINTS.STAGES.BY_ID(stageId));
  },

  /**
   * Create a new stage (admin only)
   */
  createStage: async (data: StageCreate): Promise<ApiResponse<StageDetail>> => {
    return httpClient.post<StageDetail>(API_ENDPOINTS.STAGES.CREATE, data);
  },

  /**
   * Update an existing stage (admin only)
   */
  updateStage: async (stageId: UUID, data: StageUpdate): Promise<ApiResponse<StageDetail>> => {
    return httpClient.put<StageDetail>(API_ENDPOINTS.STAGES.UPDATE(stageId), data);
  },

  /**
   * Delete a stage (admin only)
   */
  deleteStage: async (stageId: UUID): Promise<ApiResponse<void>> => {
    return httpClient.delete<void>(API_ENDPOINTS.STAGES.DELETE(stageId));
  },
};