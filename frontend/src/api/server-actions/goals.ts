'use server';
import { API_ENDPOINTS } from '../constants/config';
import type { UUID } from '../types/common';
import type {
  GoalCreateRequest,
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

interface CreateGoalsDraftPayload {
  periodId: UUID;
  performanceGoals: Array<{
    performanceGoalType: 'quantitative' | 'qualitative';
    specificGoalText: string;
    achievementCriteriaText: string;
    meansMethodsText: string;
    weight: number;
  }>;
  competencyGoal: {
    competencyId: UUID;
    actionPlan: string;
  };
}

export async function createGoalsDraftAction(payload: CreateGoalsDraftPayload): Promise<{
  success: boolean;
  data?: { createdGoalIds: UUID[] };
  error?: string;
}> {
  const createdIds: UUID[] = [];
  try {
    // Create or update performance goals sequentially
    for (const pg of payload.performanceGoals as any[]) {
      const body: GoalCreateRequest = {
        periodId: payload.periodId,
        goalCategory: '業績目標',
        weight: pg.weight,
        status: 'draft',
        performanceGoalType: pg.performanceGoalType,
        specificGoalText: pg.specificGoalText,
        achievementCriteriaText: pg.achievementCriteriaText,
        meansMethodsText: pg.meansMethodsText,
      };
      // If serverId exists, update instead of create
      const http = getHttpClient();
      if (pg.serverId) {
        const res = await http.put<GoalResponse>(API_ENDPOINTS.GOALS.UPDATE(pg.serverId), body);
        if (!res.success || !res.data) throw new Error(res.errorMessage || 'Failed to update performance goal');
        createdIds.push(res.data.id as UUID);
      } else {
        const res = await http.post<GoalResponse>(API_ENDPOINTS.GOALS.CREATE, body);
        if (!res.success || !res.data) throw new Error(res.errorMessage || 'Failed to create performance goal');
        createdIds.push(res.data.id);
      }
    }

    // Create competency goal (weight is always 100 for competency category)
    const cg: GoalCreateRequest = {
      periodId: payload.periodId,
      goalCategory: 'コンピテンシー',
      weight: 100,
      status: 'draft',
      competencyId: payload.competencyGoal.competencyId,
      actionPlan: payload.competencyGoal.actionPlan,
    };
    const http = getHttpClient();
    const cgRes = await http.post<GoalResponse>(API_ENDPOINTS.GOALS.CREATE, cg);
    if (!cgRes.success || !cgRes.data) throw new Error(cgRes.errorMessage || 'Failed to create competency goal');
    createdIds.push(cgRes.data.id);

    return { success: true, data: { createdGoalIds: createdIds } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to create goals draft' };
  }
}

interface CreateAndSubmitPayload extends Omit<CreateGoalsDraftPayload, 'periodId'> {
  periodId?: UUID;
}

export async function createAndSubmitGoalsAction(payload: CreateAndSubmitPayload): Promise<{
  success: boolean;
  data?: { submittedGoalIds: UUID[] };
  error?: string;
}> {
  const createdIds: UUID[] = [];
  try {
    // periodId is always provided since user selects evaluation period
    const draftRes = await createGoalsDraftAction(payload);
    if (!draftRes.success || !draftRes.data) throw new Error(draftRes.error || 'Failed to create drafts');
    createdIds.push(...draftRes.data.createdGoalIds);

    const submittedIds: UUID[] = [];
    const http = getHttpClient();
    for (const id of createdIds) {
      const submitRes = await http.post<GoalResponse>(API_ENDPOINTS.GOALS.SUBMIT(id));
      if (!submitRes.success || !submitRes.data) throw new Error(submitRes.errorMessage || 'Failed to submit goal');
      submittedIds.push(id);
    }

    return { success: true, data: { submittedGoalIds: submittedIds } };
  } catch (e) {
    // Best-effort rollback: delete created drafts
    const http = getHttpClient();
    for (const id of createdIds) {
      try { await http.delete(API_ENDPOINTS.GOALS.DELETE(id)); } catch { /* ignore */ }
    }
    return { success: false, error: e instanceof Error ? e.message : 'Failed to create and submit goals' };
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


