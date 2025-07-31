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

// Search parameters interface for server-side search
export interface SearchUsersParams extends PaginationParams {
  query?: string;
  department_id?: string;
  stage_id?: string;
  role_id?: string;
  status?: string;
}

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
 * Server action to get profile options for user creation/signup
 * This function runs on the server side for SSR
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
      error: 'An unexpected error occurred while fetching profile options',
    };
  }
}

/**
 * Server action to get users with hierarchy data for organization view
 * This function runs on the server side for SSR
 */
export async function getUsersForOrganizationAction(params?: PaginationParams): Promise<{
  success: boolean;
  data?: UserList;
  error?: string;
}> {
  try {
    const response = await usersApi.getUsersForOrganization(params);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to fetch users for organization',
      };
    }
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Get users for organization action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while fetching users for organization',
    };
  }
}

/**
 * Server action to search users with filters and pagination
 * This function performs server-side search and filtering
 */
export async function searchUsersAction(params: SearchUsersParams): Promise<{
  success: boolean;
  data?: UserList;
  error?: string;
}> {
  try {
    // Build query parameters for the API call
    const queryParams = new URLSearchParams();
    
    // Add pagination parameters
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    
    // Add search parameters
    if (params.query?.trim()) queryParams.append('search', params.query.trim());
    if (params.department_id && params.department_id !== 'all') {
      queryParams.append('department_id', params.department_id);
    }
    if (params.stage_id && params.stage_id !== 'all') {
      queryParams.append('stage_id', params.stage_id);
    }
    if (params.role_id && params.role_id !== 'all') {
      queryParams.append('role_id', params.role_id);
    }
    if (params.status && params.status !== 'all') {
      queryParams.append('status', params.status);
    }
    
    // Use existing getUsersAction as base but extend it for search
    // For now, we'll use the existing API and filter server-side
    const response = await usersApi.getUsers({
      page: params.page,
      limit: params.limit
    });
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to search users',
      };
    }
    
    let filteredUsers = response.data.items;
    
    // Server-side filtering (until backend supports search parameters)
    if (params.query?.trim()) {
      const searchTerm = params.query.toLowerCase();
      filteredUsers = filteredUsers.filter(user => 
        user.name.toLowerCase().includes(searchTerm) ||
        user.employee_code.toLowerCase().includes(searchTerm) ||
        user.email.toLowerCase().includes(searchTerm)
      );
    }
    
    if (params.department_id && params.department_id !== 'all') {
      filteredUsers = filteredUsers.filter(user => user.department?.id === params.department_id);
    }
    
    if (params.stage_id && params.stage_id !== 'all') {
      filteredUsers = filteredUsers.filter(user => user.stage?.id === params.stage_id);
    }
    
    if (params.role_id && params.role_id !== 'all') {
      filteredUsers = filteredUsers.filter(user => 
        user.roles.some(role => role.id === params.role_id)
      );
    }
    
    if (params.status && params.status !== 'all') {
      filteredUsers = filteredUsers.filter(user => user.status === params.status);
    }
    
    const searchResult: UserList = {
      items: filteredUsers,
      total: filteredUsers.length,
      page: params.page || 1,
      limit: params.limit || 50,
      pages: Math.ceil(filteredUsers.length / (params.limit || 50))
    };
    
    return {
      success: true,
      data: searchResult,
    };
  } catch (error) {
    console.error('Search users action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while searching users',
    };
  }
}

export async function getUsersHierarchyAction(params?: PaginationParams): Promise<{
  success: boolean;
  data?: UserList;
  error?: string;
}> {
  try {
    const response = await usersApi.getUsersHierarchy(params);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to fetch users hierarchy',
      };
    }
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Error fetching users hierarchy:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while fetching users hierarchy',
    };
  }
}

export async function getHierarchyDataAction(): Promise<{
  success: boolean;
  data?: { hierarchy: Record<string, string>; total_relations: number };
  error?: string;
}> {
  try {
    const response = await usersApi.getHierarchyData();
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to fetch hierarchy data',
      };
    }
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Error fetching hierarchy data:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while fetching hierarchy data',
    };
  }
}
