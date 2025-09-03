import type { UserDetailResponse, Role } from '@/api/types/user';

export type HierarchyMode = 'setup' | 'edit';

export interface BaseHierarchyProps {
  mode: HierarchyMode;
  userName: string;
  userEmail: string;
  selectedRoles: Role[];
  allUsers: UserDetailResponse[];
  disabled?: boolean;
}

export interface HierarchySetupProps extends BaseHierarchyProps {
  mode: 'setup';
  selectedSupervisorId: string;
  selectedSubordinateIds: string[];
  onSupervisorChange: (supervisorId: string) => void;
  onSubordinatesChange: (subordinateIds: string[]) => void;
  getPotentialSupervisors: () => UserDetailResponse[];
  getPotentialSubordinates: () => UserDetailResponse[];
}

export interface HierarchyEditProps extends BaseHierarchyProps {
  mode: 'edit';
  user: UserDetailResponse;
  onUserUpdate?: (user: UserDetailResponse) => void;
  onPendingChanges?: (hasPendingChanges: boolean, saveHandler?: () => Promise<void>, undoHandler?: () => void) => void;
  initialEditMode?: boolean;
}