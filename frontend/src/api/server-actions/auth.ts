'use server';

import { authApi } from '../endpoints/auth';
import type { 
  UserDetailResponse, 
  SignUpRequest, 
  SignUpProfileOptionsResponse 
} from '../types';

/**
 * Server action to get a user by Clerk ID
 * This function runs on the server side for SSR
 */
export async function getUserByClerkIdAction(clerkId: string): Promise<{
  success: boolean;
  data?: UserDetailResponse;
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
    const response = await authApi.getSignupProfileOptions();
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to fetch signup profile options',
      };
    }
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Get signup profile options action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while fetching profile options',
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