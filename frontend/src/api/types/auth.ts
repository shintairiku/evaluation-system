import { UUID } from './common';
import { Department, Stage, Role } from './user';

export interface UserProfileOption {
  id: UUID;
  name: string;
  email: string;
  employee_code: string;
  job_title?: string;
  roles: Role[];
}

export interface SignUpProfileOptionsResponse {
  departments: Department[];
  stages: Stage[];
  roles: Role[];
  users: UserProfileOption[];
}

export interface SignUpRequest {
  clerk_user_id: string;
  name: string;
  email: string;
  employee_code: string;
  job_title?: string;
  department_id: UUID;
  stage_id: UUID;
  supervisor_id?: UUID;
}

export interface UserExistsResponse {
  exists: boolean;
  user_id?: UUID | null;
  name?: string | null;
  email?: string | null;
  status?: string | null;
}