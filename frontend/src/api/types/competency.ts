import { UUID } from './common';
import type { UserDetailResponse } from './user';

/**
 * Competency type definitions
 * These types match the backend Pydantic schemas for Competency-related operations
 */

export interface CompetencyDescription {
  [key: string]: string; // Keys should be "1", "2", "3", "4", "5"
}

export interface Competency {
  id: UUID;
  name: string;
  description?: CompetencyDescription;
  stageId: UUID;
  createdAt: string;
  updatedAt: string;
}

export interface CompetencyDetail extends Competency {
  users?: UserDetailResponse[];
}

export interface CompetencyCreate {
  name: string;
  description?: CompetencyDescription;
  stageId: UUID;
}

export interface CompetencyUpdate {
  name?: string;
  description?: CompetencyDescription;
  stageId?: UUID;
}