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
  ProfileOptionsResponse,
  SimpleUser
} from '../types';

// Search parameters interface for server-side search
export interface SearchUsersParams extends PaginationParams {
  query?: string;
  department_id?: string;
  stage_id?: string;
  role_id?: string;
  status?: string;
  supervisor_id?: string; // Task #168: For getting subordinates of a specific supervisor
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
    if (params.supervisor_id) {
      queryParams.append('supervisor_id', params.supervisor_id);
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
    
    // Task #168: Filter by supervisor_id to get subordinates
    if (params.supervisor_id) {
      filteredUsers = filteredUsers.filter(user => user.supervisor?.id === params.supervisor_id);
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

/**
 * Task #168: Server action to get managers/supervisors by department
 * Specifically for the drill-down organization navigation
 */
export async function getDepartmentManagersAction(departmentId: string): Promise<{
  success: boolean;
  data?: UserList;
  error?: string;
}> {
  try {
    return await searchUsersAction({
      department_id: departmentId,
      role_id: '2', // Force role_id to 2 (manager) as specified in task #168
      page: 1,
      limit: 100
    });
  } catch (error) {
    console.error('Get department managers action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while fetching department managers',
    };
  }
}

/**
 * Task #168: Server action to get supervisors by department
 * Specifically for the drill-down organization navigation
 */
export async function getDepartmentSupervisorsAction(departmentId: string): Promise<{
  success: boolean;
  data?: UserList;
  error?: string;
}> {
  try {
    return await searchUsersAction({
      department_id: departmentId,
      role_id: '3', // Force role_id to 3 (supervisor) as specified in task #168
      page: 1,
      limit: 100
    });
  } catch (error) {
    console.error('Get department supervisors action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while fetching department supervisors',
    };
  }
}

/**
 * Task #168: Server action to get subordinates of a specific supervisor
 * Uses the supervisor_id parameter added for task #168
 */
export async function getSubordinatesAction(supervisorId: string): Promise<{
  success: boolean;
  data?: UserList;
  error?: string;
}> {
  try {
    return await searchUsersAction({
      supervisor_id: supervisorId,
      page: 1,
      limit: 100
    });
  } catch (error) {
    console.error('Get subordinates action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while fetching subordinates',
    };
  }
}

/**
 * Server action to get users for organization chart
 * Uses the new /users/org-chart endpoint without role-based access restrictions
 */
export async function getUsersForOrgChartAction(): Promise<{
  success: boolean;
  data?: SimpleUser[];
  error?: string;
}> {
  try {
    const response = await usersApi.getUsersForOrgChart();
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || response.error || 'Failed to fetch users for organization chart',
      };
    }
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Get users for org chart action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while fetching users for organization chart',
    };
  }
}
