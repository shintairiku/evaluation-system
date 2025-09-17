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
   * Get competencies with optional filtering and pagination
   */
  getCompetencies: async (
    params?: PaginationParams & {
      stageId?: UUID;
      search?: string;
    }
  ): Promise<ApiResponse<PaginatedResponse<Competency>>> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.stageId) queryParams.append('stageId', params.stageId);
    if (params?.search) queryParams.append('search', params.search);

    const endpoint = queryParams.toString()
      ? `${API_ENDPOINTS.COMPETENCIES.LIST}?${queryParams.toString()}`
      : API_ENDPOINTS.COMPETENCIES.LIST;

    // Development: Add dev admin header to ensure access
    const headers = process.env.NODE_ENV === 'development' ? {
      'Authorization': 'Bearer dev-admin-key'
    } : undefined;

    return httpClient.get<PaginatedResponse<Competency>>(endpoint, { headers });
  },

  /**
   * Get a specific competency by ID with detailed information
   */
  getCompetencyById: async (competencyId: UUID): Promise<ApiResponse<CompetencyDetail>> => {
    return httpClient.get<CompetencyDetail>(API_ENDPOINTS.COMPETENCIES.BY_ID(competencyId));
  },

  /**
   * Create a new competency (admin only)
   */
  createCompetency: async (data: CompetencyCreate): Promise<ApiResponse<Competency>> => {
    // Development: Add dev admin header to ensure access
    const headers = process.env.NODE_ENV === 'development' ? {
      'Authorization': 'Bearer dev-admin-key'
    } : undefined;

    return httpClient.post<Competency>(API_ENDPOINTS.COMPETENCIES.CREATE, data, headers);
  },

  /**
   * Update an existing competency (admin only)
   */
  updateCompetency: async (competencyId: UUID, data: CompetencyUpdate): Promise<ApiResponse<Competency>> => {
    // Development: Add dev admin header to ensure access
    const headers = process.env.NODE_ENV === 'development' ? {
      'Authorization': 'Bearer dev-admin-key'
    } : undefined;

    return httpClient.put<Competency>(API_ENDPOINTS.COMPETENCIES.UPDATE(competencyId), data, headers);
  },

  /**
   * Delete a competency (admin only)
   */
  deleteCompetency: async (competencyId: UUID): Promise<ApiResponse<void>> => {
    // Development: Add dev admin header to ensure access
    const headers = process.env.NODE_ENV === 'development' ? {
      'Authorization': 'Bearer dev-admin-key'
    } : undefined;

    return httpClient.delete<void>(API_ENDPOINTS.COMPETENCIES.DELETE(competencyId), headers);
  },
};