import type { SimpleUser, UserDetailResponse } from '@/api/types';

export function mapToSimpleUser(users: UserDetailResponse[]): SimpleUser[] {
  return users.map(u => ({
    id: u.id,
    clerk_user_id: u.clerk_user_id,
    name: u.name,
    email: u.email,
    employee_code: u.employee_code,
    job_title: u.job_title,
    status: u.status as any,
    department_id: u.department?.id as any,
    stage_id: u.stage?.id as any,
    created_at: '',
    updated_at: '',
    department: u.department as any,
    roles: u.roles,
    supervisor: undefined,
    subordinates: undefined,
  }));
}


