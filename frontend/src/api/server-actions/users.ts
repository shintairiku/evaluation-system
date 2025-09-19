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
 * Server Action to update multiple user stages.
 * This action is moved from the deprecated `stage-management` server action.
 * It revalidates both USERS and STAGES caches upon completion.
 */
export async function updateUserStagesAction(changes: { userId: UUID; toStageId: UUID }[]): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    if (!changes.length) {
      return { success: true };
    }

    const updateResults = await Promise.allSettled(
      changes.map(async (change) => {
        const result = await usersApi.updateUserStage(change.userId, {
          stage_id: change.toStageId,
        });

        if (!result.success) {
          throw new Error(`Failed to update user ${change.userId}: ${result.error}`);
        }

        return result;
      }),
    );

    const failures = updateResults
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map((result) => result.reason);

    if (failures.length > 0) {
      console.error('Stage update failures:', failures);
      return {
        success: false,
        error: `${failures.length} updates failed. Check server logs for details.`,
      };
    }

    revalidateTag(CACHE_TAGS.USERS);
    revalidateTag(CACHE_TAGS.STAGES);

    return { success: true };
  } catch (error) {
    console.error('Server action error (updateUserStagesAction):', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
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
 * Server action to get users for organization chart with optional filters
 * Uses the /users/org-chart endpoint with support for dynamic filtering
 * Returns SimpleUser[] based on department_ids, role_ids, or supervisor_id filters
 */
export async function getUsersForOrgChartAction(filters?: {
  department_ids?: string[];
  role_ids?: string[];
  supervisor_id?: string;
}): Promise<{
  success: boolean;
  data?: SimpleUser[];
  error?: string;
}> {
  try {
    const response = await usersApi.getUsersForOrgChart(filters);
    
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

/**
 * Search over organization chart dataset (readonly, active users only)
 * Filters: query (name/code/email, min 2 chars), department_id, role_id, status (client-side), supervisor_id
 */
export async function searchOrgChartUsersAction(params: {
  query?: string;
  department_id?: string;
  role_id?: string;
  status?: string; // org-chart returns active only; kept for future parity
  stage_id?: string; // employees cannot see others' stages; treat as empty result if set
  supervisor_id?: string;
  page?: number; // reserved for future backend pagination
  limit?: number; // reserved for future backend pagination
}): Promise<{
  success: boolean;
  data?: SimpleUser[];
  total?: number;
  error?: string;
}> {
  try {
    // Stage filtering is not available in org-chart dataset for employees.
    // When a stage filter is applied, return an empty result to reflect no accessible data.
    if (params.stage_id && params.stage_id !== 'all') {
      return { success: true, data: [], total: 0 };
    }

    const response = await getUsersForOrgChartAction({
      department_ids: params.department_id && params.department_id !== 'all' ? [params.department_id] : undefined,
      role_ids: params.role_id && params.role_id !== 'all' ? [params.role_id] : undefined,
      supervisor_id: params.supervisor_id,
    });

    if (!response.success || !response.data) {
      return { success: false, error: response.error || 'Failed to search org chart users' };
    }

    let items = response.data;

    // Query filter (min 2 chars)
    const q = (params.query || '').trim().toLowerCase();
    if (q.length >= 2) {
      items = items.filter(u =>
        u.name.toLowerCase().includes(q) ||
        u.employee_code.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
    }

    // Status filter (org-chart returns active only; keep logic for completeness)
    if (params.status && params.status !== 'all') {
      items = items.filter(u => u.status === params.status);
    }

    return { success: true, data: items, total: items.length };
  } catch (error) {
    console.error('Search org chart users action error:', error);
    return { success: false, error: 'An unexpected error occurred while searching org chart users' };
  }
}
