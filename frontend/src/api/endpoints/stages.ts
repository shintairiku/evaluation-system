import { getHttpClient } from '../client/http-client';
import { API_ENDPOINTS } from '../constants/config';
import type {
  Stage,
  StageDetail,
  StageWithUserCount,
  StageCreate,
  StageUpdate,
  StageWeightUpdate,
  StageWeightHistoryEntry,
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
    return httpClient.get<StageWithUserCount[]>(API_ENDPOINTS.STAGES.ADMIN);
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
   * Update only the weights for an existing stage (admin only)
   */
  updateStageWeights: async (stageId: UUID, data: StageWeightUpdate): Promise<ApiResponse<StageDetail>> => {
    return httpClient.patch<StageDetail>(API_ENDPOINTS.STAGES.WEIGHTS(stageId), data);
  },

  /**
   * Fetch weight history entries for a stage (admin only)
   */
  getStageWeightHistory: async (stageId: UUID, limit = 20): Promise<ApiResponse<StageWeightHistoryEntry[]>> => {
    return httpClient.get<StageWeightHistoryEntry[]>(
      `${API_ENDPOINTS.STAGES.WEIGHT_HISTORY(stageId)}?limit=${limit}`,
    );
  },

  /**
   * Delete a stage (admin only)
   */
  deleteStage: async (stageId: UUID): Promise<ApiResponse<void>> => {
    return httpClient.delete<void>(API_ENDPOINTS.STAGES.DELETE(stageId));
  },
};
