import type { Stage, UUID } from '@/api/types';

export interface StageData extends Stage {
  users: UserCardData[];
}

export interface UserCardData {
  id: UUID;
  name: string;
  employee_code: string;
  job_title?: string;
  email: string;
  current_stage_id: UUID;
}

export interface UserStageChange {
  userId: UUID;
  fromStageId: UUID;
  toStageId: UUID;
}

export interface StageManagementState {
  stages: StageData[];
  editMode: boolean;
  pendingChanges: UserStageChange[];
  isLoading: boolean;
  error: string | null;
}