'use server';

import { departmentsApi } from '../endpoints/departments';
import type { 
  Department, 
  DepartmentDetail, 
  DepartmentCreate, 
  DepartmentUpdate,
  UUID,
} from '../types';

/**
 * Server action to get all departments
 */
export async function getDepartmentsAction(): Promise<{
  success: boolean;
  data?: Department[];
  error?: string;
}> {
  try {
    const response = await departmentsApi.getDepartments();
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to fetch departments',
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

/**
 * Server action to get a specific department by ID
 */
export async function getDepartmentByIdAction(departmentId: UUID): Promise<{
  success: boolean;
  data?: DepartmentDetail;
  error?: string;
}> {
  try {
    const response = await departmentsApi.getDepartmentById(departmentId);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to fetch department',
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

/**
 * Server action to create a new department
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
        error: response.error || 'Failed to create department',
      };
    }
    
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
 * Server action to update an existing department
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
        error: response.error || 'Failed to update department',
      };
    }
    
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
 * Server action to delete a department
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
        error: response.error || 'Failed to delete department',
      };
    }
    
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