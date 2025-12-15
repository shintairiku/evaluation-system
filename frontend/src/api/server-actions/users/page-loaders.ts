'use server';

import { getUsersPageAction } from './queries';
import type { UserDirectoryBasePageData } from '../../types/page-loaders';

export async function getUserDirectoryBasePageDataAction(
  params?: {
    page?: number;
    limit?: number;
    include?: string;
  },
): Promise<{ success: boolean; data?: UserDirectoryBasePageData; error?: string }> {
  try {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 50;

    const usersPageResult = await getUsersPageAction({
      page,
      limit,
      withCount: false,
      include: params?.include ?? 'department,stage,roles',
    });

    if (!usersPageResult.success || !usersPageResult.data) {
      return { success: false, error: usersPageResult.error || 'Failed to load user directory data' };
    }

    const { users, meta, filters } = usersPageResult.data;

    return {
      success: true,
      data: {
        users,
        meta,
        filters,
      },
    };
  } catch (error) {
    console.error('Get user directory base page data action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while loading user directory data',
    };
  }
}
