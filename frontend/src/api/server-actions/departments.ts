'use server';

import { revalidateTag } from 'next/cache';
import { departmentsApi } from '../endpoints/departments';
import { createFullyCachedAction, CACHE_TAGS } from '../utils/cache';
import type { 
  Department, 
  DepartmentDetail, 
  DepartmentCreate, 
  DepartmentUpdate,
  UUID,
} from '../types';

/**
 * Server action to get all departments with caching
 */
async function _getDepartmentsAction(): Promise<{
  success: boolean;
  data?: Department[];
  error?: string;
}> {
  try {
    const response = await departmentsApi.getDepartments();
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to fetch departments',
      };
    }
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Get departments action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while fetching departments',
    };
  }
}

export const getDepartmentsAction = createFullyCachedAction(
  _getDepartmentsAction,
  'getDepartments',
  CACHE_TAGS.DEPARTMENTS
);

/**
 * Server action to get a specific department by ID with caching
 */
async function _getDepartmentByIdAction(departmentId: UUID): Promise<{
  success: boolean;
  data?: DepartmentDetail;
  error?: string;
}> {
  try {
    const response = await departmentsApi.getDepartmentById(departmentId);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to fetch department',
      };
    }
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Get department by ID action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while fetching department',
    };
  }
}

export const getDepartmentByIdAction = createFullyCachedAction(
  _getDepartmentByIdAction,
  'getDepartmentById',
  CACHE_TAGS.DEPARTMENTS
);

/**
 * Server action to create a new department with cache revalidation
 */
export async function createDepartmentAction(departmentData: DepartmentCreate): Promise<{
  success: boolean;
  data?: DepartmentDetail;
  error?: string;
}> {
  try {
    const response = await departmentsApi.createDepartment(departmentData);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to create department',
      };
    }
    
    // Revalidate departments cache after successful creation
    revalidateTag(CACHE_TAGS.DEPARTMENTS);
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Create department action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while creating department',
    };
  }
}

/**
 * Server action to update an existing department with cache revalidation
 */
export async function updateDepartmentAction(departmentId: UUID, updateData: DepartmentUpdate): Promise<{
  success: boolean;
  data?: DepartmentDetail;
  error?: string;
}> {
  try {
    const response = await departmentsApi.updateDepartment(departmentId, updateData);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to update department',
      };
    }
    
    // Revalidate departments cache after successful update
    revalidateTag(CACHE_TAGS.DEPARTMENTS);
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Update department action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while updating department',
    };
  }
}

/**
 * Server action to delete a department with cache revalidation
 */
export async function deleteDepartmentAction(departmentId: UUID): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const response = await departmentsApi.deleteDepartment(departmentId);
    
    if (!response.success) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to delete department',
      };
    }
    
    // Revalidate departments cache after successful deletion
    revalidateTag(CACHE_TAGS.DEPARTMENTS);
    
    return {
      success: true,
    };
  } catch (error) {
    console.error('Delete department action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while deleting department',
    };
  }
}