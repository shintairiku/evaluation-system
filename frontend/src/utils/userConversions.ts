import type { 
  UserProfileOption, 
  UserDetailResponse, 
  SetupUserDetail,
  UUID,
  Role
} from '@/api/types/user';
import { UserStatus } from '@/api/types/user';

/**
 * Safely convert UserProfileOption to UserDetailResponse for hierarchy operations.
 * This function creates a minimal UserDetailResponse that's compatible with hierarchy utilities.
 */
export function convertToUserDetailResponse(
  user: UserProfileOption,
  supervisor?: SetupUserDetail['supervisor'],
  subordinates: SetupUserDetail['subordinates'] = []
): UserDetailResponse {
  return {
    id: user.id,
    clerk_user_id: '', // Not available in UserProfileOption - setup context doesn't need this
    employee_code: user.employee_code,
    name: user.name,
    email: user.email,
    status: UserStatus.ACTIVE, // Assume active for setup context
    job_title: user.job_title,
    department: undefined, // Not available in UserProfileOption
    stage: undefined, // Not available in UserProfileOption
    roles: user.roles,
    supervisor: supervisor ? {
      id: supervisor.id,
      name: supervisor.name,
      email: supervisor.email,
      employee_code: supervisor.employee_code,
      department: undefined,
      stage: undefined,
      roles: [],
      status: UserStatus.ACTIVE
    } : undefined,
    subordinates: subordinates.map(sub => ({
      id: sub.id,
      name: sub.name,
      email: sub.email,
      employee_code: sub.employee_code,
      department: undefined,
      stage: undefined,
      roles: [],
      status: UserStatus.ACTIVE,
      supervisor: {
        id: user.id,
        name: user.name,
        email: user.email,
        employee_code: user.employee_code,
        department: undefined,
        stage: undefined,
        roles: user.roles,
        status: UserStatus.ACTIVE
      }
    }))
  };
}

/**
 * Create a mock UserDetailResponse for setup context based on selected roles.
 */
export function createSetupUserMock(
  clerkUserId: string,
  userName: string,
  userEmail: string,
  selectedRoles: Role[],
  supervisor?: SetupUserDetail['supervisor'],
  subordinates: SetupUserDetail['subordinates'] = []
): UserDetailResponse {
  return {
    id: 'setup-user-mock' as UUID,
    clerk_user_id: clerkUserId,
    employee_code: 'SETUP',
    name: userName,
    email: userEmail,
    status: UserStatus.ACTIVE,
    job_title: undefined,
    department: undefined,
    stage: undefined,
    roles: selectedRoles,
    supervisor: supervisor ? {
      id: supervisor.id,
      name: supervisor.name,
      email: supervisor.email,
      employee_code: supervisor.employee_code,
      department: undefined,
      stage: undefined,
      roles: [],
      status: UserStatus.ACTIVE
    } : undefined,
    subordinates: subordinates.map(sub => ({
      id: sub.id,
      name: sub.name,
      email: sub.email,
      employee_code: sub.employee_code,
      department: undefined,
      stage: undefined,
      roles: [],
      status: UserStatus.ACTIVE,
      supervisor: {
        id: 'setup-user-mock' as UUID,
        name: userName,
        email: userEmail,
        employee_code: 'SETUP',
        department: undefined,
        stage: undefined,
        roles: selectedRoles,
        status: UserStatus.ACTIVE
      }
    }))
  };
}