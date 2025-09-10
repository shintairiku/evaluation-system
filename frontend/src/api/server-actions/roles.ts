'use server';

import { rolesApi } from '../endpoints/roles';
import type { 
  Role, 
  RoleDetail, 
  RoleCreate, 
  RoleUpdate,
  RoleReorderRequest,
  UUID,
} from '../types';

/**
 * Server action to get all roles
 */
export async function getRolesAction(): Promise<{
  success: boolean;
  data?: Role[];
  error?: string;
}> {
  try {
    const response = await rolesApi.getRoles();
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to fetch roles',
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

/**
 * Server action to get a specific role by ID
 */
export async function getRoleByIdAction(roleId: UUID): Promise<{
  success: boolean;
  data?: RoleDetail;
  error?: string;
}> {
  try {
    const response = await rolesApi.getRoleById(roleId);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to fetch role',
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

/**
 * Server action to create a new role
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
        error: response.error || 'Failed to create role',
      };
    }
    
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
 * Server action to update an existing role
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
        error: response.error || 'Failed to update role',
      };
    }
    
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
 * Server action to delete a role
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
        error: response.error || 'Failed to delete role',
      };
    }
    
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
 * Server action to reorder roles hierarchy
 */
export async function reorderRolesAction(reorderData: RoleReorderRequest): Promise<{
  success: boolean;
  data?: Role[];
  error?: string;
}> {
  try {
    const response = await rolesApi.reorderRoles(reorderData);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to reorder roles',
      };
    }
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Reorder roles action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while reordering roles',
    };
  }
}