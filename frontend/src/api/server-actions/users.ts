'use server';

import { usersApi } from '../endpoints/users';
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
    const response = await usersApi.getUsers(params);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to fetch users',
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
    const response = await usersApi.getUserById(userId);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to fetch user',
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
    const response = await usersApi.createUser(userData);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to create user',
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
    const response = await usersApi.updateUser(userId, updateData);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to update user',
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
    const response = await usersApi.deleteUser(userId);
    
    if (!response.success) {
      return {
        success: false,
        error: response.error || 'Failed to delete user',
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
    const response = await usersApi.checkUserExists(clerkId);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to check user existence',
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
    const response = await usersApi.getProfileOptions();
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to fetch profile options',
      };
    }
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Get profile options action error:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred while fetching profile options',
    };
  }
}
