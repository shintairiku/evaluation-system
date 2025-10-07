import { getHttpClient } from '../client/http-client';
import { API_ENDPOINTS } from '../constants/config';
import type {
  Department,
  DepartmentDetail,
  DepartmentCreate,
  DepartmentUpdate,
  ApiResponse,
  UUID,
} from '../types';

const httpClient = getHttpClient();

/**
 * Department API endpoints for CRUD operations
 * All functions follow the standardized pattern with proper error handling
 */
export const departmentsApi = {
  /**
   * Get all departments
   */
  getDepartments: async (): Promise<ApiResponse<Department[]>> => {
    return httpClient.get<Department[]>(API_ENDPOINTS.DEPARTMENTS.LIST);
  },

  /**
   * Get a specific department by ID with detailed information
   */
  getDepartmentById: async (departmentId: UUID): Promise<ApiResponse<DepartmentDetail>> => {
    return httpClient.get<DepartmentDetail>(API_ENDPOINTS.DEPARTMENTS.BY_ID(departmentId));
  },

  /**
   * Create a new department
   */
  createDepartment: async (data: DepartmentCreate): Promise<ApiResponse<Department>> => {
    return httpClient.post<Department>(API_ENDPOINTS.DEPARTMENTS.CREATE, data);
  },

  /**
   * Update an existing department
   */
  updateDepartment: async (departmentId: UUID, data: DepartmentUpdate): Promise<ApiResponse<Department>> => {
    return httpClient.put<Department>(API_ENDPOINTS.DEPARTMENTS.UPDATE(departmentId), data);
  },

  /**
   * Delete a department
   */
  deleteDepartment: async (departmentId: UUID): Promise<ApiResponse<void>> => {
    return httpClient.delete<void>(API_ENDPOINTS.DEPARTMENTS.DELETE(departmentId));
  },
};