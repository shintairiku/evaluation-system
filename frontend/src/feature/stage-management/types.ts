import type { Stage, UUID } from '@/api/types';

/**
 * Stage data with associated users for stage management
 * Extends the base Stage type with user management capabilities
 */
export interface StageData extends Stage {
  /** List of users currently assigned to this stage */
  users: UserCardData[];
}

/**
 * User data optimized for display in stage management cards
 * Contains essential user information for drag & drop operations
 */
export interface UserCardData {
  /** Unique user identifier */
  id: UUID;
  /** User's full name */
  name: string;
  /** Company employee code */
  employee_code: string;
  /** User's job title (optional) */
  job_title?: string;
  /** User's email address */
  email: string;
  /** Current stage assignment */
  current_stage_id: UUID;
}

/**
 * Represents a pending user stage change in edit mode
 * Used to batch operations before saving to database
 */
export interface UserStageChange {
  /** ID of the user being moved */
  userId: UUID;
  /** Stage ID where the user is currently assigned */
  fromStageId: UUID;
  /** Stage ID where the user will be moved to */
  toStageId: UUID;
}