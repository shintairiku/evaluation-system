import { getHttpClient } from '../client/http-client';
import { API_ENDPOINTS } from '../constants/config';
import type {
  ApiResponse,
  ProfileOptionsResponse,
} from '../types';

const httpClient = getHttpClient();

export const authApi = {
  /**
   * Get profile options for user creation/signup
   * Equivalent to GET /auth/signup/profile-options
   */
  getProfileOptions: async (organizationId?: string): Promise<ApiResponse<ProfileOptionsResponse>> => {
    const endpoint = organizationId
      ? `${API_ENDPOINTS.AUTH.SIGNUP_PROFILE_OPTIONS}?organization_id=${encodeURIComponent(organizationId)}`
      : API_ENDPOINTS.AUTH.SIGNUP_PROFILE_OPTIONS;
    return httpClient.get<ProfileOptionsResponse>(endpoint);
  },
}; 