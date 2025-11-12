'use server';

import { cache } from 'react';
import { revalidateTag } from 'next/cache';
import { rolesApi } from '../endpoints/roles';
import { CACHE_TAGS } from '../utils/cache';
import type { 
  RoleDetail, 
  RoleCreate, 
  RoleUpdate,
  RoleReorderRequest,
  UUID,
} from '../types';

/**
 * Server action to get all roles with caching
 */
async function _getRolesAction(): Promise<{
  success: boolean;
  data?: RoleDetail[];
  error?: string;
}> {
  try {
    const response = await rolesApi.getRoles();
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to fetch roles',
      };
    }
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Get roles action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while fetching roles',
    };
  }
}

export const getRolesAction = cache(async (): Promise<{
  success: boolean;
  data?: RoleDetail[];
  error?: string;
}> => {
  return _getRolesAction();
});

/**
 * Server action to get a specific role by ID with caching
 */
async function _getRoleByIdAction(roleId: UUID): Promise<{
  success: boolean;
  data?: RoleDetail;
  error?: string;
}> {
  try {
    const response = await rolesApi.getRoleById(roleId);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to fetch role',
      };
    }
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Get role by ID action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while fetching role',
    };
  }
}

export const getRoleByIdAction = cache(async (roleId: UUID): Promise<{
  success: boolean;
  data?: RoleDetail;
  error?: string;
}> => {
  return _getRoleByIdAction(roleId);
});

/**
 * Server action to create a new role with cache revalidation
 */
export async function createRoleAction(roleData: RoleCreate): Promise<{
  success: boolean;
  data?: RoleDetail;
  error?: string;
}> {
  try {
    const response = await rolesApi.createRole(roleData);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to create role',
      };
    }
    
    // Revalidate caches after successful creation
    revalidateTag(CACHE_TAGS.ROLES);
    revalidateTag(CACHE_TAGS.PERMISSIONS);
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Create role action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while creating role',
    };
  }
}

/**
 * Server action to update an existing role with cache revalidation
 */
export async function updateRoleAction(roleId: UUID, updateData: RoleUpdate): Promise<{
  success: boolean;
  data?: RoleDetail;
  error?: string;
}> {
  try {
    const response = await rolesApi.updateRole(roleId, updateData);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to update role',
      };
    }
    
    // Revalidate caches after successful update
    revalidateTag(CACHE_TAGS.ROLES);
    revalidateTag(CACHE_TAGS.PERMISSIONS);
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Update role action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while updating role',
    };
  }
}

/**
 * Server action to delete a role with cache revalidation
 */
export async function deleteRoleAction(roleId: UUID): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const response = await rolesApi.deleteRole(roleId);
    
    if (!response.success) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to delete role',
      };
    }
    
    // Revalidate caches after successful deletion
    revalidateTag(CACHE_TAGS.ROLES);
    revalidateTag(CACHE_TAGS.PERMISSIONS);
    
    return {
      success: true,
    };
  } catch (error) {
    console.error('Delete role action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while deleting role',
    };
  }
}

/**
 * Server action to reorder roles hierarchy with cache revalidation
 */
export async function reorderRolesAction(reorderData: RoleReorderRequest): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const response = await rolesApi.reorderRoles(reorderData);
    
    if (!response.success) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to reorder roles',
      };
    }
    
    // Revalidate caches after successful reorder
    revalidateTag(CACHE_TAGS.ROLES);
    revalidateTag(CACHE_TAGS.PERMISSIONS);
    
    return {
      success: true,
    };
  } catch (error) {
    console.error('Reorder roles action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while reordering roles',
    };
  }
}
