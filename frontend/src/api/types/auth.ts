import { UUID } from './common';
import { Department, Stage } from './user';

export interface SignUpProfileOptionsResponse {
  departments: Department[];
  stages: Stage[];
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