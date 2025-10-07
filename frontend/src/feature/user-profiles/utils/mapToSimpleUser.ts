import type { SimpleUser, UserDetailResponse } from '@/api/types';

export function mapToSimpleUser(users: UserDetailResponse[]): SimpleUser[] {
  return users.map(u => ({
    id: u.id,
    clerk_user_id: u.clerk_user_id,
    name: u.name,
    email: u.email,
    employee_code: u.employee_code,
    job_title: u.job_title,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    status: u.status as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    department_id: u.department?.id as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stage_id: u.stage?.id as any,
    created_at: '',
    updated_at: '',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    department: u.department as any,
    roles: u.roles,
    supervisor: undefined,
    subordinates: undefined,
  }));
}


