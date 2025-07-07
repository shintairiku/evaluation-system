import { UUID, Permission, PaginatedResponse } from './common';

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

export interface Stage {
  id: UUID;
  name: string;
  description?: string;
}

export interface StageDetail {
  id: UUID;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  user_count?: number;
  competency_count?: number;
  users?: PaginatedResponse<UserDetailResponse>;
  competencies?: any[]; // TODO: Define Competency type
}

export interface StageCreate {
  name: string;
  description?: string;
}

export interface StageUpdate {
  name?: string;
  description?: string;
}

export interface Role {
  id: number;
  name: string;
  description: string;
}

export interface RoleDetail {
  id: number;
  name: string;
  description: string;
  permissions: Permission[];
  user_count?: number;
}

export interface RoleCreate {
  name: string;
  description: string;
}

export interface RoleUpdate {
  name?: string;
  description?: string;
}

export interface UserBase {
  name: string;
  email: string;
  employee_code: string;
  job_title?: string;
}

export interface UserCreate extends UserBase {
  clerk_user_id: string;
  department_id: UUID;
  stage_id: UUID;
  role_ids?: number[];
  supervisor_id?: UUID;
  status?: UserStatus;
}

export interface UserUpdate {
  name?: string;
  email?: string;
  employee_code?: string;
  job_title?: string;
  department_id?: UUID;
  stage_id?: UUID;
  role_ids?: number[];
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

export interface UserDetailResponse {
  id: UUID;
  clerk_user_id: string;
  employee_code: string;
  name: string;
  email: string;
  status: UserStatus;
  job_title?: string;
  department: Department;
  stage: Stage;
  roles: Role[];
  supervisor?: UserDetailResponse;
}

export interface UserPaginatedResponse extends PaginatedResponse<UserDetailResponse> {
  data: UserDetailResponse[];
}

export interface UserList {
  users: UserDetailResponse[];
  total: number;
}

export interface UserProfile extends UserDetailResponse {
  // Additional profile-specific fields can be added here
}