'use server';
import { API_ENDPOINTS } from '../constants/config';
import type { UUID } from '../types/common';
import type {
    GoalCreateRequest,
    GoalUpdateRequest,
    GoalListResponse,
    GoalResponse,
} from '../types/goal';
import { getHttpClient } from '../client/http-client';


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

// Create a goal
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

// Update goal
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

// Delete goal
export async function deleteGoalAction(id: UUID): Promise<{
success: boolean;
error?: string;
}> {
try {
    const http = getHttpClient();
    const res = await http.delete(API_ENDPOINTS.GOALS.DELETE(id));
    if (!res.success) {
    return { success: false, error: res.errorMessage || 'Failed to delete goal' };
    }
    return { success: true };
} catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to delete goal' };
}
}
