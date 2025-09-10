'use server';
import { API_ENDPOINTS } from '../constants/config';
import type { UUID } from '../types/common';
import type {
  Competency,
  CompetencyDetail,
  CompetencyCreate,
  CompetencyUpdate
} from '../types/competency';
import type { PaginatedResponse } from '../types';
import { getHttpClient } from '../client/http-client';

// Get competencies with optional filtering
export async function getCompetenciesAction(params?: {
  stageId?: UUID;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ success: boolean; data?: PaginatedResponse<Competency>; error?: string }> {
  try {
    const http = getHttpClient();
    const query = new URLSearchParams();
    
    if (params?.stageId) {
      query.append('stageId', params.stageId);
    }
    if (params?.search) {
      query.append('search', params.search);
    }
    if (params?.page) {
      query.append('page', String(params.page));
    }
    if (params?.limit) {
      query.append('limit', String(params.limit));
    }

    const endpoint = query.toString() 
      ? `${API_ENDPOINTS.COMPETENCIES.LIST}?${query.toString()}`
      : API_ENDPOINTS.COMPETENCIES.LIST;

    const res = await http.get<PaginatedResponse<Competency>>(endpoint);
    
    if (!res.success || !res.data) {
      return { success: false, error: res.errorMessage || 'Failed to fetch competencies' };
    }

    return { success: true, data: res.data };
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Failed to fetch competencies';
    return { success: false, error };
  }
}

// Get competency by ID
export async function getCompetencyAction(competencyId: UUID): Promise<{
  success: boolean;
  data?: CompetencyDetail;
  error?: string;
}> {
  try {
    const http = getHttpClient();
    const res = await http.get<CompetencyDetail>(API_ENDPOINTS.COMPETENCIES.BY_ID(competencyId));
    
    if (!res.success || !res.data) {
      return { success: false, error: res.errorMessage || 'Failed to fetch competency' };
    }

    return { success: true, data: res.data };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to fetch competency' };
  }
}

// Create competency (admin only)
export async function createCompetencyAction(data: CompetencyCreate): Promise<{
  success: boolean;
  data?: Competency;
  error?: string;
}> {
  try {
    const http = getHttpClient();
    const res = await http.post<Competency>(API_ENDPOINTS.COMPETENCIES.CREATE, data);
    
    if (!res.success || !res.data) {
      return { success: false, error: res.errorMessage || 'Failed to create competency' };
    }
    
    return { success: true, data: res.data };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to create competency' };
  }
}

// Update competency (admin only)
export async function updateCompetencyAction(competencyId: UUID, data: CompetencyUpdate): Promise<{
  success: boolean;
  data?: Competency;
  error?: string;
}> {
  try {
    const http = getHttpClient();
    const res = await http.put<Competency>(API_ENDPOINTS.COMPETENCIES.UPDATE(competencyId), data);
    
    if (!res.success || !res.data) {
      return { success: false, error: res.errorMessage || 'Failed to update competency' };
    }
    
    return { success: true, data: res.data };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to update competency' };
  }
}

// Delete competency (admin only)
export async function deleteCompetencyAction(competencyId: UUID): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const http = getHttpClient();
    const res = await http.delete(API_ENDPOINTS.COMPETENCIES.DELETE(competencyId));
    
    if (!res.success) {
      return { success: false, error: res.errorMessage || 'Failed to delete competency' };
    }
    
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to delete competency' };
  }
}