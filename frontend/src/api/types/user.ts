import { UUID, Permission, PaginatedResponse } from './common';
import { Stage } from './stage';

export enum UserStatus {
  PENDING_APPROVAL = 'pending_approval',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export interface Department {
  id: UUID;
  name: string;
  description?: string;
}

export interface DepartmentDetail {
  id: UUID;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  user_count?: number;
  manager_id?: UUID;
  manager_name?: string;
  users?: PaginatedResponse<UserDetailResponse>;
}

export interface DepartmentCreate {
  name: string;
  description?: string;
}

export interface DepartmentUpdate {
  name?: string;
  description?: string;
}


export interface Role {
  id: UUID;
  name: string;
  description: string;
  hierarchy_order: number;
  created_at: string;
  updated_at: string;
}

export interface RoleDetail {
  id: UUID;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  permissions: Permission[];
  user_count?: number;
}

export interface RoleCreate {
  name: string;
  description: string;
  hierarchy_order?: number;
}

export interface RoleUpdate {
  name?: string;
  description?: string;
}

export interface RoleReorderItem {
  id: UUID;
  hierarchy_order: number;
}

export interface RoleReorderRequest {
  roles: RoleReorderItem[];
}

export interface UserBase {
  name: string;
  email: string;
  employee_code: string;
  job_title?: string;
}

export interface UserCreate extends UserBase {
  clerk_user_id: string;
  department_id?: UUID;
  stage_id?: UUID;
  role_ids: UUID[];
  supervisor_id?: UUID;
  subordinate_ids: UUID[];
  status?: UserStatus;
}

export interface UserUpdate {
  name?: string;
  email?: string;
  employee_code?: string;
  job_title?: string;
  department_id?: UUID | null;
  stage_id?: UUID | null;
  role_ids?: UUID[];
  supervisor_id?: UUID | null;
  subordinate_ids?: UUID[];
  status?: UserStatus;
}

export interface UserInDB extends UserBase {
  id: UUID;
  clerk_user_id: string;
  status: UserStatus;
  department_id: UUID;
  stage_id: UUID;
  created_at: string;
  updated_at: string;
}

export interface User extends UserInDB {
  department: Department;
  stage: Stage;
  roles: Role[];
}

export interface SimpleUser extends UserInDB {
  department: Department;
  roles: Role[];
  supervisor?: SimpleUser;
  subordinates?: SimpleUser[];
}

export interface UserDetailResponse {
  id: UUID;
  clerk_user_id: string;
  employee_code: string;
  name: string;
  email: string;
  status: UserStatus;
  job_title?: string;
  department?: Department;
  stage?: Stage;
  roles: Role[];
  supervisor?: User;
  subordinates?: User[];
}

export interface UserList {
  items: UserDetailResponse[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export type UserProfile = UserDetailResponse;

export interface UserProfileOption {
  id: UUID;
  name: string;
  email: string;
  employee_code: string;
  job_title?: string;
  roles: Role[];
}


export interface UserExistsResponse {
  exists: boolean;
  user_id?: UUID;
  name?: string;
  email?: string;
  status?: UserStatus;
}

export interface ProfileOptionsResponse {
  departments: Department[];
  stages: Stage[];
  roles: Role[];
  users: UserProfileOption[];
}

export interface BulkUserStatusUpdateItem {
  userId: UUID;
  newStatus: UserStatus;
}

export interface BulkUserStatusUpdateResult {
  userId: UUID;
  success: boolean;
  error?: string;
}

export interface BulkUserStatusUpdateResponse {
  results: BulkUserStatusUpdateResult[];
  successCount: number;
  failureCount: number;
}
