'use server';

import { authApi } from '../endpoints/auth';
import type { ProfileOptionsResponse } from '../types';

/**
 * Server action to get profile options for signup
 * Supports organization context for org-scoped data
 */
export async function getProfileOptionsAction(organizationId?: string): Promise<{
  success: boolean;
  data?: ProfileOptionsResponse;
  error?: string;
}> {
  try {
    const response = await authApi.getProfileOptions(organizationId);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || response.errorMessage || 'Failed to fetch profile options',
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