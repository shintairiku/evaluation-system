'use server';

import { getHttpClient } from '../client/http-client';
import { API_ENDPOINTS } from '../constants/config';
import type { 
  UserList, 
  UserDetailResponse, 
  UserCreate, 
  UserUpdate,
  PaginationParams,
  UUID,
  UserExistsResponse,
  ProfileOptionsResponse
} from '../types';

const httpClient = getHttpClient();

/**
 * Server action to get all users with pagination
 * This function runs on the server side for SSR
 */
export async function getUsersAction(params?: PaginationParams): Promise<{
  success: boolean;
  data?: UserList;
  error?: string;
}> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    
    const endpoint = queryParams.toString() 
      ? `${API_ENDPOINTS.USERS.LIST}?${queryParams.toString()}`
      : API_ENDPOINTS.USERS.LIST;
    
    const response = await httpClient.get<UserList>(endpoint);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || response.error || 'Failed to fetch users',
      };
    }
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Get users action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while fetching users',
    };
  }
}

/**
 * Server action to get a specific user by ID
 */
export async function getUserByIdAction(userId: UUID): Promise<{
  success: boolean;
  data?: UserDetailResponse;
  error?: string;
}> {
  try {
    const response = await httpClient.get<UserDetailResponse>(
      API_ENDPOINTS.USERS.BY_ID(userId)
    );
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || response.error || 'Failed to fetch user',
      };
    }
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Get user by ID action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while fetching user',
    };
  }
}

/**
 * Server action to create a new user
 */
export async function createUserAction(userData: UserCreate): Promise<{
  success: boolean;
  data?: UserDetailResponse;
  error?: string;
}> {
  try {
    const response = await httpClient.post<UserDetailResponse>(
      API_ENDPOINTS.USERS.CREATE,
      userData
    );
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || response.error || 'Failed to create user',
      };
    }
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Create user action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while creating user',
    };
  }
}

/**
 * Server action to update an existing user
 */
export async function updateUserAction(userId: UUID, updateData: UserUpdate): Promise<{
  success: boolean;
  data?: UserDetailResponse;
  error?: string;
}> {
  try {
    const response = await httpClient.put<UserDetailResponse>(
      API_ENDPOINTS.USERS.UPDATE(userId),
      updateData
    );
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || response.error || 'Failed to update user',
      };
    }
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Update user action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while updating user',
    };
  }
}

/**
 * Server action to delete a user
 */
export async function deleteUserAction(userId: UUID): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const response = await httpClient.delete(
      API_ENDPOINTS.USERS.DELETE(userId)
    );
    
    if (!response.success) {
      return {
        success: false,
        error: response.errorMessage || response.error || 'Failed to delete user',
      };
    }
    
    return {
      success: true,
    };
  } catch (error) {
    console.error('Delete user action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while deleting user',
    };
  }
}

/**
 * Server action to check if user exists by Clerk ID
 * Uses new user endpoint instead of auth endpoint
 */
export async function checkUserExistsAction(clerkId: string): Promise<{
  success: boolean;
  data?: UserExistsResponse;
  error?: string;
}> {
  try {
    const response = await httpClient.get<UserExistsResponse>(
      API_ENDPOINTS.USERS.EXISTS(clerkId)
    );
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || response.error || 'Failed to check user existence',
      };
    }
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Check user exists action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while checking user existence',
    };
  }
}

/**
 * Server action to get profile options for signup
 * Uses new user endpoint instead of auth endpoint
 */
export async function getProfileOptionsAction(): Promise<{
  success: boolean;
  data?: ProfileOptionsResponse;
  error?: string;
}> {
  try {
    console.log('Server action: Starting getProfileOptionsAction (using users endpoint)');
    const response = await httpClient.get<ProfileOptionsResponse>(
      API_ENDPOINTS.USERS.PROFILE_OPTIONS
    );
    console.log('Server action: API response received:', response);
    
    if (!response.success || !response.data) {
      console.log('Server action: API response failed:', response.errorMessage || response.error);
      return {
        success: false,
        error: response.errorMessage || response.error || 'Failed to fetch profile options',
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
