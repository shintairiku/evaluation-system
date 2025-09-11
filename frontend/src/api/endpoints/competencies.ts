import { getHttpClient } from '../client/http-client';
import { API_ENDPOINTS } from '../constants/config';
import type {
  Competency,
  CompetencyDetail,
  CompetencyCreate,
  CompetencyUpdate,
  PaginatedResponse,
  PaginationParams,
  ApiResponse,
  UUID,
} from '../types';

const httpClient = getHttpClient();

/**
 * Competency API endpoints for CRUD operations
 * All functions follow the standardized pattern with proper error handling
 */
export const competenciesApi = {
  /**
   * Get all competencies with optional pagination
   */
  getCompetencies: async (params?: PaginationParams): Promise<ApiResponse<PaginatedResponse<Competency>>> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    
    const endpoint = queryParams.toString() 
      ? `${API_ENDPOINTS.COMPETENCIES.LIST}?${queryParams.toString()}`
      : API_ENDPOINTS.COMPETENCIES.LIST;
    
    return httpClient.get<PaginatedResponse<Competency>>(endpoint);
  },

  /**
   * Get a specific competency by ID with detailed information
   */
  getCompetencyById: async (competencyId: UUID): Promise<ApiResponse<CompetencyDetail>> => {
    return httpClient.get<CompetencyDetail>(API_ENDPOINTS.COMPETENCIES.BY_ID(competencyId));
  },

  /**
   * Create a new competency
   */
  createCompetency: async (data: CompetencyCreate): Promise<ApiResponse<Competency>> => {
    return httpClient.post<Competency>(API_ENDPOINTS.COMPETENCIES.CREATE, data);
  },

  /**
   * Update an existing competency
   */
  updateCompetency: async (competencyId: UUID, data: CompetencyUpdate): Promise<ApiResponse<Competency>> => {
    return httpClient.put<Competency>(API_ENDPOINTS.COMPETENCIES.UPDATE(competencyId), data);
  },

  /**
   * Delete a competency
   */
  deleteCompetency: async (competencyId: UUID): Promise<ApiResponse<void>> => {
    return httpClient.delete<void>(API_ENDPOINTS.COMPETENCIES.DELETE(competencyId));
  },
};