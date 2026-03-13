import type { UUID } from './common';

export interface SupportDocument {
  id: UUID;
  organizationId: string | null;
  title: string;
  description: string | null;
  documentType: 'link' | 'file';
  url: string | null;
  filePath: string | null;
  fileName: string | null;
  category: string;
  displayOrder: number;
  isActive: boolean;
  createdBy: UUID | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupportDocumentCreate {
  title: string;
  description?: string;
  documentType?: 'link' | 'file';
  url?: string;
  category?: string;
  displayOrder?: number;
}

export interface SupportDocumentUpdate {
  title?: string;
  description?: string;
  url?: string;
  category?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export interface SupportDocumentListResponse {
  items: SupportDocument[];
  categories: string[];
}
