import { UUID } from './common';

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
  users?: any[]; // TODO: Define User type when needed
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

export interface CompetencyList {
  competencies: Competency[];
  meta: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

// Stage-related interfaces
export interface Stage {
  id: UUID;
  name: string;
  description?: string;
}

export interface StageDetail extends Stage {
  createdAt: string;
  updatedAt: string;
  userCount?: number;
  users?: any[];
  competencies: Competency[];
}

export interface StageCreate {
  name: string;
  description?: string;
}

export interface StageUpdate {
  name?: string;
  description?: string;
}

export interface StageWithUserCount extends Stage {
  userCount: number;
  createdAt: string;
  updatedAt: string;
}