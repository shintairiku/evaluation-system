'use server';

import { cache } from 'react';
import { usersApi } from '../../endpoints/users';
import type {
  UserList,
  UserDetailResponse,
  PaginationParams,
  UUID,
  UserExistsResponse,
  SimpleUser,
  UserListPageResponse,
} from '../../types';

export interface SearchUsersParams extends PaginationParams {
  query?: string;
  department_id?: string;
  stage_id?: string;
  role_id?: string;
  status?: string;
  supervisor_id?: string;
}

export const getUsersAction = cache(
  async (
    params?: PaginationParams,
  ): Promise<{
    success: boolean;
    data?: UserList;
    error?: string;
  }> => {
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
  },
);

export const getUsersPageAction = cache(
  async (
    params?: Parameters<typeof usersApi.getUsersPage>[0],
  ): Promise<{
    success: boolean;
    data?: UserListPageResponse;
    error?: string;
  }> => {
    try {
      const response = await usersApi.getUsersPage(params);

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error || 'Failed to fetch user list page',
        };
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('Get users page action error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred while fetching user list page',
      };
    }
  },
);

export const getUserByIdAction = cache(
  async (
    userId: UUID,
  ): Promise<{
    success: boolean;
    data?: UserDetailResponse;
    error?: string;
  }> => {
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
  },
);

export const getUsersByIdsAction = cache(
  async (
    params: {
      userIds: UUID[];
      include?: string;
    },
  ): Promise<{
    success: boolean;
    data?: UserDetailResponse[];
    error?: string;
  }> => {
    try {
      const response = await usersApi.getUsersByIds(params);

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
      console.error('Get users by ids action error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred while fetching users',
      };
    }
  },
);

export const getCurrentUserAction = cache(async (): Promise<{
  success: boolean;
  data?: UserDetailResponse | null;
  error?: string;
}> => {
  try {
    const response = await usersApi.getCurrentUser();

    if (!response.success) {
      return {
        success: false,
        error: response.error || 'Failed to fetch current user',
      };
    }

    return {
      success: true,
      data: response.data ?? null,
    };
  } catch (error) {
    console.error('Get current user action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while fetching current user',
    };
  }
});

export const checkUserExistsAction = cache(
  async (
    clerkId: string,
  ): Promise<{
    success: boolean;
    data?: UserExistsResponse;
    error?: string;
  }> => {
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
  },
);

export const searchUsersAction = cache(
  async (
    params: SearchUsersParams,
  ): Promise<{
    success: boolean;
    data?: UserList;
    error?: string;
  }> => {
    try {
      const page = params.page ?? 1;
      const limit = params.limit ?? 50;
      const q = params.query?.trim();

      const usersPageResult = await getUsersPageAction({
        page,
        limit,
        withCount: false,
        include: 'department,stage,roles',
        q: q && q.length > 0 ? q : undefined,
        department_ids:
          params.department_id && params.department_id !== 'all' ? [params.department_id] : undefined,
        stage_ids:
          params.stage_id && params.stage_id !== 'all' ? [params.stage_id] : undefined,
        role_ids:
          params.role_id && params.role_id !== 'all' ? [params.role_id] : undefined,
        statuses:
          params.status && params.status !== 'all' ? [params.status] : undefined,
        supervisor_id: params.supervisor_id,
      });

      if (!usersPageResult.success || !usersPageResult.data) {
        return {
          success: false,
          error: usersPageResult.error || 'Failed to search users',
        };
      }

      const { users, meta } = usersPageResult.data;

      return {
        success: true,
        data: {
          items: users,
          total: meta.total,
          page: meta.page,
          limit: meta.limit,
          pages: meta.pages,
        },
      };
    } catch (error) {
      console.error('Search users action error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred while searching users',
      };
    }
  },
);

export const getDepartmentManagersAction = cache(
  async (
    departmentId: string,
  ): Promise<{
    success: boolean;
    data?: UserList;
    error?: string;
  }> => {
    try {
      return await searchUsersAction({
        department_id: departmentId,
        role_id: '2',
        page: 1,
        limit: 100,
      });
    } catch (error) {
      console.error('Get department managers action error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred while fetching department managers',
      };
    }
  },
);

export const getDepartmentSupervisorsAction = cache(
  async (
    departmentId: string,
  ): Promise<{
    success: boolean;
    data?: UserList;
    error?: string;
  }> => {
    try {
      return await searchUsersAction({
        department_id: departmentId,
        role_id: '3',
        page: 1,
        limit: 100,
      });
    } catch (error) {
      console.error('Get department supervisors action error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred while fetching department supervisors',
      };
    }
  },
);

export const getSubordinatesAction = cache(
  async (
    supervisorId: string,
  ): Promise<{
    success: boolean;
    data?: UserList;
    error?: string;
  }> => {
    try {
      return await searchUsersAction({
        supervisor_id: supervisorId,
        page: 1,
        limit: 100,
      });
    } catch (error) {
      console.error('Get subordinates action error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred while fetching subordinates',
      };
    }
  },
);

export const getUsersForOrgChartAction = cache(
  async (filters?: {
    department_ids?: string[];
    role_ids?: string[];
    supervisor_id?: string;
  }): Promise<{
    success: boolean;
    data?: SimpleUser[];
    error?: string;
  }> => {
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
  },
);

export const searchOrgChartUsersAction = cache(
  async (params: {
    query?: string;
    department_id?: string;
    role_id?: string;
    status?: string;
    stage_id?: string;
    supervisor_id?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    success: boolean;
    data?: SimpleUser[];
    total?: number;
    error?: string;
  }> => {
    try {
      if (params.stage_id && params.stage_id !== 'all') {
        return { success: true, data: [], total: 0 };
      }

      const response = await getUsersForOrgChartAction({
        department_ids:
          params.department_id && params.department_id !== 'all' ? [params.department_id] : undefined,
        role_ids: params.role_id && params.role_id !== 'all' ? [params.role_id] : undefined,
        supervisor_id: params.supervisor_id,
      });

      if (!response.success || !response.data) {
        return { success: false, error: response.error || 'Failed to search org chart users' };
      }

      let items = response.data;

      const q = (params.query || '').trim().toLowerCase();
      if (q.length >= 2) {
        items = items.filter(
          (u) =>
            u.name.toLowerCase().includes(q) ||
            u.employee_code.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q),
        );
      }

      if (params.status && params.status !== 'all') {
        items = items.filter((u) => u.status === params.status);
      }

      return { success: true, data: items, total: items.length };
    } catch (error) {
      console.error('Search org chart users action error:', error);
      return { success: false, error: 'An unexpected error occurred while searching org chart users' };
    }
  },
);
