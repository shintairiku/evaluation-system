import type { UUID } from './common';

/**
 * Stage type definitions
 * These types match the backend Pydantic schemas for Stage-related operations
 */

export interface Stage {
  id: UUID;
  name: string;
  description?: string;
  quantitativeWeight: number;
  qualitativeWeight: number;
  competencyWeight: number;
}

export interface StageDetail extends Stage {
  createdAt: string;
  updatedAt: string;
  userCount?: number;
  users?: unknown[]; // Avoid circular import
  competencies?: unknown[]; // Avoid circular import
}

export interface StageWithUserCount extends Stage {
  userCount: number;
}

export interface StageCreate {
  name: string;
  description?: string;
}

export interface StageUpdate {
  name?: string;
  description?: string;
}

export type StageList = Stage[];

export interface StageWeightUpdate {
  quantitativeWeight: number;
  qualitativeWeight: number;
  competencyWeight: number;
}

export interface StageWeightHistoryEntry {
  id: UUID;
  stageId: UUID;
  organizationId: string;
  actorUserId: UUID;
  actorName?: string | null;
  actorEmployeeCode?: string | null;
  quantitativeWeightBefore?: number | null;
  quantitativeWeightAfter?: number | null;
  qualitativeWeightBefore?: number | null;
  qualitativeWeightAfter?: number | null;
  competencyWeightBefore?: number | null;
  competencyWeightAfter?: number | null;
  changedAt: string;
}
