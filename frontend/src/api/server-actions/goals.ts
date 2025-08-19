'use server';
import { API_ENDPOINTS } from '../constants/config';
import type { UUID } from '../types/common';
import type {
  GoalCreateRequest,
  GoalUpdateRequest,
  GoalResponse,
  GoalListResponse,
} from '../types/goal';
import { getHttpClient } from '../client/http-client';

export async function createGoalAction(data: GoalCreateRequest): Promise<{
  success: boolean;
  data?: GoalResponse;
  error?: string;
}> {
  try {
    const http = getHttpClient();
    const res = await http.post<GoalResponse>(API_ENDPOINTS.GOALS.CREATE, data);
    if (!res.success || !res.data) {
      return { success: false, error: res.errorMessage || 'Failed to create goal' };
    }
    return { success: true, data: res.data };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to create goal' };
  }
}

export async function submitGoalAction(id: UUID): Promise<{
  success: boolean;
  data?: GoalResponse;
  error?: string;
}> {
  try {
    const http = getHttpClient();
    const res = await http.post<GoalResponse>(API_ENDPOINTS.GOALS.SUBMIT(id));
    if (!res.success || !res.data) {
      return { success: false, error: res.errorMessage || 'Failed to submit goal' };
    }
    return { success: true, data: res.data };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to submit goal' };
  }
}

export async function updateGoalAction(id: UUID, data: GoalUpdateRequest): Promise<{
  success: boolean;
  data?: GoalResponse;
  error?: string;
}> {
  try {
    const http = getHttpClient();
    const res = await http.put<GoalResponse>(API_ENDPOINTS.GOALS.UPDATE(id), data);
    if (!res.success || !res.data) {
      return { success: false, error: res.errorMessage || 'Failed to update goal' };
    }
    return { success: true, data: res.data };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to update goal' };
  }
}


// Supervisor: list pending approvals
export async function getSupervisorGoalsAction(params: {
  supervisorId: UUID;
  periodId?: UUID;
  status?: string;
  page?: number;
  limit?: number;
}): Promise<{ success: boolean; data?: GoalListResponse; error?: string }> {
  try {
    const http = getHttpClient();
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.periodId) query.append('periodId', params.periodId);
    if (params?.status) query.append('status', params.status);
    const endpoint = query.toString()
      ? `${API_ENDPOINTS.GOALS.SUPERVISOR_GOALS(params.supervisorId)}?${query.toString()}`
      : API_ENDPOINTS.GOALS.SUPERVISOR_GOALS(params.supervisorId);
    const res = await http.get<GoalListResponse>(endpoint);
    if (!res.success || !res.data) return { success: false, error: res.errorMessage || 'Failed to fetch pending approvals' };
    return { success: true, data: res.data };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to fetch pending approvals' };
  }
}

// Supervisor: approve pending goal
export async function approveGoalAction(goalId: UUID): Promise<{ success: boolean; data?: GoalResponse; error?: string }> {
  try {
    const http = getHttpClient();
    const res = await http.post<GoalResponse>(API_ENDPOINTS.GOALS.APPROVE(goalId));
    if (!res.success || !res.data) return { success: false, error: res.errorMessage || 'Failed to approve goal' };
    return { success: true, data: res.data };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to approve goal' };
  }
}

// Supervisor: reject pending goal
export async function rejectGoalAction(goalId: UUID, reason: string): Promise<{ success: boolean; data?: GoalResponse; error?: string }> {
  try {
    const http = getHttpClient();
    const endpoint = `${API_ENDPOINTS.GOALS.REJECT(goalId)}?reason=${encodeURIComponent(reason)}`;
    const res = await http.post<GoalResponse>(endpoint);
    if (!res.success || !res.data) return { success: false, error: res.errorMessage || 'Failed to reject goal' };
    return { success: true, data: res.data };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to reject goal' };
  }
}

// Get goals with filters - maps directly to GET /goals backend endpoint
export async function getGoalsAction(params?: {
  periodId?: UUID;
  userId?: UUID;
  goalCategory?: string;
  status?: string;
  page?: number;
  limit?: number;
}): Promise<{ success: boolean; data?: GoalListResponse; error?: string }> {
  try {
    const http = getHttpClient();
    const query = new URLSearchParams();
    
    // Add all supported backend filters
    if (params?.periodId) {
      query.append('periodId', params.periodId);
    }
    if (params?.userId) {
      query.append('userId', params.userId);
    }
    if (params?.goalCategory) {
      query.append('goalCategory', params.goalCategory);
    }
    if (params?.status) {
      query.append('status', params.status);
    }
    if (params?.page) {
      query.append('page', String(params.page));
    }
    if (params?.limit) {
      query.append('limit', String(params.limit));
    }

    // Construct final endpoint
    const endpoint = query.toString() 
      ? `${API_ENDPOINTS.GOALS.LIST}?${query.toString()}`
      : API_ENDPOINTS.GOALS.LIST;

    // Make the API call
    const res = await http.get<GoalListResponse>(endpoint);
    
    if (!res.success || !res.data) {
      return { success: false, error: res.errorMessage || 'Failed to fetch goals' };
    }

    return { success: true, data: res.data };
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Failed to fetch goals';
    return { success: false, error };
  }
}



