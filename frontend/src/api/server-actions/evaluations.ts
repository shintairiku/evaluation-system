'use server';

import { API_ENDPOINTS } from '../constants/config';
import { getHttpClient } from '../client/http-client';
import type { UUID } from '../types/common';

// Helper: fetch current evaluation period ID via server-side request
export async function getCurrentEvaluationPeriodId(): Promise<{ success: boolean; data?: { periodId: UUID }; error?: string }>{
  try {
    const http = getHttpClient();
    // Try dedicated CURRENT endpoint first (if backend implements it)
    const res = await http.get<{ id: UUID }>(API_ENDPOINTS.EVALUATION_PERIODS.CURRENT);
    if (res.success && res.data?.id) {
      return { success: true, data: { periodId: res.data.id } };
    }
    // Fallback: list active periods and pick the first one
    const list = await http.get<{ items: Array<{ id: UUID }>; total: number }>(`${API_ENDPOINTS.EVALUATION_PERIODS.LIST}?status=実施中&limit=1&page=1`);
    if (list.success && list.data?.items?.length) {
      return { success: true, data: { periodId: list.data.items[0].id } };
    }
    return { success: false, error: res.errorMessage || list.errorMessage || 'Failed to fetch current evaluation period' };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to fetch current evaluation period' };
  }
}


