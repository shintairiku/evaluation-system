'use server';

import { cache } from 'react';
import { revalidateTag } from 'next/cache';
import { coreValuesApi } from '../endpoints/core-values';
import { CACHE_TAGS } from '../utils/cache';
import type {
  CoreValueDefinition,
  CoreValueEvaluation,
  CoreValueEvaluationUpdate,
  CoreValueFeedback,
  CoreValueFeedbackUpdate,
  CoreValueFeedbackSubmit,
  CoreValueFeedbackReturn,
  CoreValueSubordinateData,
} from '../types';

// ---- Definitions ----

/**
 * Server action to get core value definitions (cacheable, rarely changes)
 */
export const getCoreValueDefinitionsAction = cache(
  async (): Promise<{
    success: boolean;
    data?: CoreValueDefinition[];
    error?: string;
  }> => {
    try {
      const response = await coreValuesApi.getDefinitions();

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.errorMessage || 'Failed to fetch core value definitions',
        };
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('Get core value definitions action error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred while fetching core value definitions',
      };
    }
  },
);

// ---- Employee Evaluation ----

/**
 * Server action to get my core value evaluation for a period
 */
export const getMyEvaluationAction = cache(
  async (
    periodId: string,
  ): Promise<{
    success: boolean;
    data?: CoreValueEvaluation | null;
    error?: string;
  }> => {
    try {
      const response = await coreValuesApi.getMyEvaluation(periodId);

      if (!response.success) {
        return {
          success: false,
          error: response.errorMessage || 'Failed to fetch core value evaluation',
        };
      }

      return {
        success: true,
        data: response.data ?? null,
      };
    } catch (error) {
      console.error('Get my core value evaluation action error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred while fetching core value evaluation',
      };
    }
  },
);

/**
 * Server action to update (auto-save) core value evaluation
 */
export async function updateCoreValueEvaluationAction(
  evaluationId: string,
  data: CoreValueEvaluationUpdate,
): Promise<{
  success: boolean;
  data?: CoreValueEvaluation;
  error?: string;
}> {
  try {
    const response = await coreValuesApi.updateEvaluation(evaluationId, data);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to update core value evaluation',
      };
    }

    revalidateTag(CACHE_TAGS.CORE_VALUES);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Update core value evaluation action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while updating core value evaluation',
    };
  }
}

/**
 * Server action to submit core value evaluation
 */
export async function submitCoreValueEvaluationAction(
  evaluationId: string,
): Promise<{
  success: boolean;
  data?: CoreValueEvaluation;
  error?: string;
}> {
  try {
    const response = await coreValuesApi.submitEvaluation(evaluationId);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to submit core value evaluation',
      };
    }

    revalidateTag(CACHE_TAGS.CORE_VALUES);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Submit core value evaluation action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while submitting core value evaluation',
    };
  }
}

/**
 * Server action to reopen a submitted core value evaluation
 */
export async function reopenCoreValueEvaluationAction(
  evaluationId: string,
): Promise<{
  success: boolean;
  data?: CoreValueEvaluation;
  error?: string;
}> {
  try {
    const response = await coreValuesApi.reopenEvaluation(evaluationId);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to reopen core value evaluation',
      };
    }

    revalidateTag(CACHE_TAGS.CORE_VALUES);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Reopen core value evaluation action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while reopening core value evaluation',
    };
  }
}

// ---- Supervisor ----

/**
 * Server action to get subordinate core value data (evaluation + feedback)
 */
export const getSubordinateCoreValueDataAction = cache(
  async (
    periodId: string,
    subordinateId: string,
  ): Promise<{
    success: boolean;
    data?: CoreValueSubordinateData;
    error?: string;
  }> => {
    try {
      const response = await coreValuesApi.getSubordinateData(periodId, subordinateId);

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.errorMessage || 'Failed to fetch subordinate core value data',
        };
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('Get subordinate core value data action error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred while fetching subordinate core value data',
      };
    }
  },
);

/**
 * Server action to update (auto-save) core value feedback
 */
export async function updateCoreValueFeedbackAction(
  feedbackId: string,
  data: CoreValueFeedbackUpdate,
): Promise<{
  success: boolean;
  data?: CoreValueFeedback;
  error?: string;
}> {
  try {
    const response = await coreValuesApi.updateFeedback(feedbackId, data);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to update core value feedback',
      };
    }

    revalidateTag(CACHE_TAGS.CORE_VALUES);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Update core value feedback action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while updating core value feedback',
    };
  }
}

/**
 * Server action to submit/approve core value feedback
 */
export async function submitCoreValueFeedbackAction(
  feedbackId: string,
  data: CoreValueFeedbackSubmit,
): Promise<{
  success: boolean;
  data?: CoreValueFeedback;
  error?: string;
}> {
  try {
    const response = await coreValuesApi.submitFeedback(feedbackId, data);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to submit core value feedback',
      };
    }

    revalidateTag(CACHE_TAGS.CORE_VALUES);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Submit core value feedback action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while submitting core value feedback',
    };
  }
}

/**
 * Server action to return core value feedback for correction (差し戻し)
 */
export async function returnCoreValueFeedbackAction(
  feedbackId: string,
  data: CoreValueFeedbackReturn,
): Promise<{
  success: boolean;
  data?: CoreValueFeedback;
  error?: string;
}> {
  try {
    const response = await coreValuesApi.returnFeedback(feedbackId, data);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to return core value feedback',
      };
    }

    revalidateTag(CACHE_TAGS.CORE_VALUES);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Return core value feedback action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while returning core value feedback',
    };
  }
}
