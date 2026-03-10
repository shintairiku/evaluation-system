'use server';

import { revalidateTag } from 'next/cache';

import { comprehensiveEvaluationApi } from '../endpoints/comprehensive-evaluation';
import { CACHE_TAGS } from '../utils/cache';
import type {
  ComprehensiveEvaluationListResponse,
  ComprehensiveEvaluationSettingsWorkspaceResponse,
  ComprehensiveManualDecisionHistoryResponse,
  FinalizeComprehensiveEvaluationResponse,
  GetComprehensiveEvaluationSettingsWorkspaceParams,
  GetComprehensiveEvaluationListParams,
  GetComprehensiveManualDecisionHistoryParams,
  UpdateComprehensiveDepartmentAssignmentRequest,
  UpdateComprehensiveDefaultAssignmentRequest,
  UpdateComprehensiveStageAssignmentRequest,
  UUID,
  UpsertComprehensiveRulesetRequest,
  UpsertComprehensiveManualDecisionRequest,
  ComprehensiveRulesetAssignmentResponse,
  ComprehensiveRulesetTemplateResponse,
} from '../types';

export async function getComprehensiveEvaluationListAction(params: GetComprehensiveEvaluationListParams): Promise<{
  success: boolean;
  data?: ComprehensiveEvaluationListResponse;
  error?: string;
}> {
  try {
    const response = await comprehensiveEvaluationApi.getComprehensiveEvaluationList(params);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to fetch comprehensive evaluation rows',
      };
    }

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('getComprehensiveEvaluationListAction error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while fetching comprehensive evaluation rows',
    };
  }
}

export async function getComprehensiveEvaluationStageOptionsAction(): Promise<{
  success: boolean;
  data?: string[];
  error?: string;
}> {
  try {
    const response = await comprehensiveEvaluationApi.getComprehensiveEvaluationStageOptions();

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to fetch comprehensive evaluation stage options',
      };
    }

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('getComprehensiveEvaluationStageOptionsAction error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while fetching comprehensive evaluation stage options',
    };
  }
}

export async function getComprehensiveEvaluationSettingsWorkspaceAction(
  params: GetComprehensiveEvaluationSettingsWorkspaceParams,
): Promise<{
  success: boolean;
  data?: ComprehensiveEvaluationSettingsWorkspaceResponse;
  error?: string;
}> {
  try {
    const response = await comprehensiveEvaluationApi.getComprehensiveEvaluationSettingsWorkspace(params);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to fetch comprehensive evaluation settings workspace',
      };
    }

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('getComprehensiveEvaluationSettingsWorkspaceAction error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while fetching comprehensive evaluation settings workspace',
    };
  }
}

export async function updateComprehensiveEvaluationDefaultAssignmentAction(
  payload: UpdateComprehensiveDefaultAssignmentRequest,
): Promise<{
  success: boolean;
  data?: ComprehensiveRulesetAssignmentResponse;
  error?: string;
}> {
  try {
    const response = await comprehensiveEvaluationApi.updateComprehensiveEvaluationDefaultAssignment(payload);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || response.errorMessage || 'Failed to update default assignment',
      };
    }

    revalidateTag(CACHE_TAGS.COMPREHENSIVE_EVALUATION_LIST);
    revalidateTag(CACHE_TAGS.COMPREHENSIVE_EVALUATION_SETTINGS);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('updateComprehensiveEvaluationDefaultAssignmentAction error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while updating default assignment',
    };
  }
}

export async function updateComprehensiveEvaluationDepartmentAssignmentAction(
  departmentId: UUID,
  payload: UpdateComprehensiveDepartmentAssignmentRequest,
): Promise<{
  success: boolean;
  data?: ComprehensiveRulesetAssignmentResponse;
  error?: string;
}> {
  try {
    const response = await comprehensiveEvaluationApi.updateComprehensiveEvaluationDepartmentAssignment(departmentId, payload);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || response.errorMessage || 'Failed to update department assignment',
      };
    }

    revalidateTag(CACHE_TAGS.COMPREHENSIVE_EVALUATION_LIST);
    revalidateTag(CACHE_TAGS.COMPREHENSIVE_EVALUATION_SETTINGS);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('updateComprehensiveEvaluationDepartmentAssignmentAction error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while updating department assignment',
    };
  }
}

export async function updateComprehensiveEvaluationStageAssignmentAction(
  stageId: UUID,
  payload: UpdateComprehensiveStageAssignmentRequest,
): Promise<{
  success: boolean;
  data?: ComprehensiveRulesetAssignmentResponse;
  error?: string;
}> {
  try {
    const response = await comprehensiveEvaluationApi.updateComprehensiveEvaluationStageAssignment(stageId, payload);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || response.errorMessage || 'Failed to update stage assignment',
      };
    }

    revalidateTag(CACHE_TAGS.COMPREHENSIVE_EVALUATION_LIST);
    revalidateTag(CACHE_TAGS.COMPREHENSIVE_EVALUATION_SETTINGS);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('updateComprehensiveEvaluationStageAssignmentAction error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while updating stage assignment',
    };
  }
}

export async function createComprehensiveEvaluationRulesetAction(
  payload: UpsertComprehensiveRulesetRequest,
): Promise<{
  success: boolean;
  data?: ComprehensiveRulesetTemplateResponse;
  error?: string;
}> {
  try {
    const response = await comprehensiveEvaluationApi.createComprehensiveEvaluationRuleset(payload);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || response.errorMessage || 'Failed to create ruleset',
      };
    }

    revalidateTag(CACHE_TAGS.COMPREHENSIVE_EVALUATION_SETTINGS);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('createComprehensiveEvaluationRulesetAction error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while creating ruleset',
    };
  }
}

export async function updateComprehensiveEvaluationRulesetAction(
  rulesetId: UUID,
  payload: UpsertComprehensiveRulesetRequest,
): Promise<{
  success: boolean;
  data?: ComprehensiveRulesetTemplateResponse;
  error?: string;
}> {
  try {
    const response = await comprehensiveEvaluationApi.updateComprehensiveEvaluationRuleset(rulesetId, payload);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || response.errorMessage || 'Failed to update ruleset',
      };
    }

    revalidateTag(CACHE_TAGS.COMPREHENSIVE_EVALUATION_SETTINGS);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('updateComprehensiveEvaluationRulesetAction error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while updating ruleset',
    };
  }
}

export async function deleteComprehensiveEvaluationRulesetAction(
  rulesetId: UUID,
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const response = await comprehensiveEvaluationApi.deleteComprehensiveEvaluationRuleset(rulesetId);

    if (!response.success) {
      return {
        success: false,
        error: response.error || response.errorMessage || 'Failed to delete ruleset',
      };
    }

    revalidateTag(CACHE_TAGS.COMPREHENSIVE_EVALUATION_SETTINGS);

    return {
      success: true,
    };
  } catch (error) {
    console.error('deleteComprehensiveEvaluationRulesetAction error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while deleting ruleset',
    };
  }
}

export async function finalizeComprehensiveEvaluationPeriodAction(
  periodId: UUID,
): Promise<{
  success: boolean;
  data?: FinalizeComprehensiveEvaluationResponse;
  error?: string;
}> {
  try {
    const response = await comprehensiveEvaluationApi.finalizeComprehensiveEvaluationPeriod({ periodId });

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || response.errorMessage || 'Failed to finalize evaluation period',
      };
    }

    revalidateTag(CACHE_TAGS.COMPREHENSIVE_EVALUATION_LIST);
    revalidateTag(CACHE_TAGS.COMPREHENSIVE_EVALUATION_HISTORY);
    revalidateTag(CACHE_TAGS.EVALUATION_PERIODS);
    revalidateTag(CACHE_TAGS.USERS);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('finalizeComprehensiveEvaluationPeriodAction error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while finalizing the evaluation period',
    };
  }
}

export async function upsertComprehensiveManualDecisionAction(
  userId: UUID,
  payload: UpsertComprehensiveManualDecisionRequest,
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const response = await comprehensiveEvaluationApi.upsertComprehensiveManualDecision(userId, payload);

    if (!response.success) {
      return {
        success: false,
        error: response.error || response.errorMessage || 'Failed to upsert manual decision',
      };
    }

    revalidateTag(CACHE_TAGS.COMPREHENSIVE_EVALUATION_LIST);
    revalidateTag(CACHE_TAGS.COMPREHENSIVE_EVALUATION_HISTORY);

    return {
      success: true,
    };
  } catch (error) {
    console.error('upsertComprehensiveManualDecisionAction error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while saving manual decision',
    };
  }
}

export async function clearComprehensiveManualDecisionAction(
  userId: UUID,
  periodId: UUID,
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const response = await comprehensiveEvaluationApi.clearComprehensiveManualDecision(userId, periodId);

    if (!response.success) {
      return {
        success: false,
        error: response.error || response.errorMessage || 'Failed to clear manual decision',
      };
    }

    revalidateTag(CACHE_TAGS.COMPREHENSIVE_EVALUATION_LIST);
    revalidateTag(CACHE_TAGS.COMPREHENSIVE_EVALUATION_HISTORY);

    return {
      success: true,
    };
  } catch (error) {
    console.error('clearComprehensiveManualDecisionAction error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while clearing manual decision',
    };
  }
}

export async function getComprehensiveManualDecisionHistoryAction(
  params?: GetComprehensiveManualDecisionHistoryParams,
): Promise<{
  success: boolean;
  data?: ComprehensiveManualDecisionHistoryResponse;
  error?: string;
}> {
  try {
    const response = await comprehensiveEvaluationApi.getComprehensiveManualDecisionHistory(params);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to fetch manual decision history',
      };
    }

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('getComprehensiveManualDecisionHistoryAction error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while fetching manual decision history',
    };
  }
}
