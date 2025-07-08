'use server';

import { authApi } from '../endpoints/auth';
import type { 
  UserDetailResponse, 
  SignUpRequest, 
  SignUpProfileOptionsResponse,
  UserExistsResponse
} from '../types';

/**
 * Server action to get a user by Clerk ID
 * This function runs on the server side for SSR
 */
export async function getUserByClerkIdAction(clerkId: string): Promise<{
  success: boolean;
  data?: UserExistsResponse;
  error?: string;
}> {
  try {
    const response = await authApi.getUserByClerkId(clerkId);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to fetch user by Clerk ID',
      };
    }
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Get user by Clerk ID action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while fetching user',
    };
  }
}

/**
 * Server action to get signup profile options
 */
export async function getSignupProfileOptionsAction(): Promise<{
  success: boolean;
  data?: SignUpProfileOptionsResponse;
  error?: string;
}> {
  try {
    console.log('Server action: Starting getSignupProfileOptionsAction');
    const response = await authApi.getSignupProfileOptions();
    console.log('Server action: API response received:', response);
    
    if (!response.success || !response.data) {
      console.log('Server action: API response failed:', response.error);
      return {
        success: false,
        error: response.error || 'Failed to fetch signup profile options',
      };
    }
    
    console.log('Server action: Success, returning data');
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Server action: Exception caught:', error);
    console.error('Error type:', typeof error);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred while fetching profile options',
    };
  }
}

/**
 * Server action to create a new user profile after Clerk signup
 */
export async function signupAction(userData: SignUpRequest): Promise<{
  success: boolean;
  data?: UserDetailResponse;
  error?: string;
}> {
  try {
    const response = await authApi.signup(userData);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to create user profile',
      };
    }
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Signup action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while creating user profile',
    };
  }
} 