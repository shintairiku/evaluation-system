import { UUID } from './common';

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

export interface AuthUserExistsResponse {
  exists: boolean;
  user_id?: UUID | null;
  name?: string | null;
  email?: string | null;
  status?: string | null;
  organization_id?: string | null;
}