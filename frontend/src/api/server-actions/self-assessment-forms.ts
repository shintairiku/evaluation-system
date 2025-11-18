'use server';

import { cache } from 'react';
import { selfAssessmentFormsApi } from '../endpoints/self-assessment-forms';
import type {
  SelfAssessmentContext,
  SelfAssessmentDraftEntry,
  SelfAssessmentSummary,
  UUID,
} from '../types';

export const getSelfAssessmentContextAction = cache(async (periodId?: string): Promise<{
  success: boolean;
  data?: SelfAssessmentContext;
  error?: string;
}> => {
  try {
    const response = await selfAssessmentFormsApi.getContext(periodId);
    if (!response.success || !response.data) {
      return { success: false, error: response.errorMessage || 'Failed to load context' };
    }
    return { success: true, data: response.data };
  } catch (error) {
    console.error('getSelfAssessmentContextAction error:', error);
    return { success: false, error: 'Unexpected error loading self-assessment context' };
  }
});

export async function saveSelfAssessmentDraftAction(draft: SelfAssessmentDraftEntry[]): Promise<{
  success: boolean;
  updatedAt?: string;
  error?: string;
}> {
  try {
    const response = await selfAssessmentFormsApi.saveDraft(draft);
    if (!response.success) {
      return { success: false, error: response.errorMessage || 'Failed to save draft' };
    }
    return { success: true, updatedAt: response.data?.updatedAt };
  } catch (error) {
    console.error('saveSelfAssessmentDraftAction error:', error);
    return { success: false, error: 'Unexpected error saving draft' };
  }
}

export async function submitSelfAssessmentFormAction(draft: SelfAssessmentDraftEntry[]): Promise<{
  success: boolean;
  data?: SelfAssessmentSummary;
  error?: string;
}> {
  try {
    const response = await selfAssessmentFormsApi.submit(draft);
    if (!response.success || !response.data) {
      return { success: false, error: response.errorMessage || 'Failed to submit self-assessment' };
    }
    return { success: true, data: response.data };
  } catch (error) {
    console.error('submitSelfAssessmentFormAction error:', error);
    return { success: false, error: 'Unexpected error submitting self-assessment' };
  }
}

export const getSelfAssessmentSummaryAction = cache(
  async (periodId: UUID, userId?: UUID): Promise<{
    success: boolean;
    data?: SelfAssessmentSummary | null;
    error?: string;
  }> => {
    try {
      const response = await selfAssessmentFormsApi.getSummary(periodId, userId);
      if (!response.success) {
        return { success: false, error: response.errorMessage || 'Failed to fetch summary' };
      }
      return { success: true, data: response.data ?? null };
    } catch (error) {
      console.error('getSelfAssessmentSummaryAction error:', error);
      return { success: false, error: 'Unexpected error fetching summary' };
    }
  }
);
