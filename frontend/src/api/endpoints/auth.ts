import { getHttpClient } from '../client/http-client';
import { API_ENDPOINTS } from '../constants/config';
import type {
  ApiResponse,
  UserDetailResponse,
  SignUpRequest,
  SignUpProfileOptionsResponse,
} from '../types';

const httpClient = getHttpClient();

export const authApi = {
  /**
   * Get a user by Clerk ID
   */
  getUserByClerkId: async (clerkId: string): Promise<ApiResponse<UserDetailResponse>> => {
    return httpClient.get<UserDetailResponse>(API_ENDPOINTS.AUTH.GET_USER_BY_CLERK_ID(clerkId));
  },

  /**
   * Get options for signup profile (departments, stages, etc.)
   */
  getSignupProfileOptions: async (): Promise<ApiResponse<SignUpProfileOptionsResponse>> => {
    return httpClient.get<SignUpProfileOptionsResponse>(API_ENDPOINTS.AUTH.SIGNUP_PROFILE_OPTIONS);
  },

  /**
   * Create a new user profile after Clerk signup
   */
  signup: async (data: SignUpRequest): Promise<ApiResponse<UserDetailResponse>> => {
    return httpClient.post<UserDetailResponse>(API_ENDPOINTS.AUTH.SIGNUP, data);
  },
}; 