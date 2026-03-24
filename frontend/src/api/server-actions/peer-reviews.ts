'use server';

import { cache } from 'react';
import { revalidateTag } from 'next/cache';
import { peerReviewsApi } from '../endpoints/peer-reviews';
import { CACHE_TAGS } from '../utils/cache';
import type {
  PeerReviewAssignReviewersRequest,
  PeerReviewAssignment,
  PeerReviewAssignmentsByReviewee,
  PeerReviewEvaluationUpdate,
  PeerReviewEvaluation,
  PeerReviewAveragedScores,
  CoreValueSummaryResponse,
  EvaluationProgressEntry,
  EvaluationDetailResponse,
  BulkAssignReviewersItem,
  BulkAssignReviewersResponse,
} from '../types';

// ---- Admin - Assignments ----

/**
 * Server action to get all assignments for a period (admin)
 */
export async function getAssignmentsAction(
  periodId: string,
): Promise<{
  success: boolean;
  data?: PeerReviewAssignmentsByReviewee[];
  error?: string;
}> {
  try {
    const response = await peerReviewsApi.getAssignments(periodId);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to fetch peer review assignments',
      };
    }

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Get peer review assignments action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while fetching peer review assignments',
    };
  }
}

/**
 * Server action to assign reviewers to a reviewee (admin)
 */
export async function assignReviewersAction(
  periodId: string,
  revieweeId: string,
  data: PeerReviewAssignReviewersRequest,
): Promise<{
  success: boolean;
  data?: PeerReviewAssignment[];
  error?: string;
}> {
  try {
    const response = await peerReviewsApi.assignReviewers(periodId, revieweeId, data);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to assign reviewers',
      };
    }

    revalidateTag(CACHE_TAGS.PEER_REVIEWS);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Assign reviewers action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while assigning reviewers',
    };
  }
}

/**
 * Server action to bulk assign reviewers to multiple reviewees (admin)
 */
export async function bulkAssignReviewersAction(
  periodId: string,
  items: BulkAssignReviewersItem[],
): Promise<{
  success: boolean;
  data?: BulkAssignReviewersResponse;
  error?: string;
}> {
  try {
    const response = await peerReviewsApi.bulkAssignReviewers(periodId, items);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to bulk assign reviewers',
      };
    }

    revalidateTag(CACHE_TAGS.PEER_REVIEWS);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Bulk assign reviewers action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while bulk assigning reviewers',
    };
  }
}

/**
 * Server action to remove an assignment (admin)
 */
export async function removeAssignmentAction(
  assignmentId: string,
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const response = await peerReviewsApi.removeAssignment(assignmentId);

    if (!response.success) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to remove assignment',
      };
    }

    revalidateTag(CACHE_TAGS.PEER_REVIEWS);

    return {
      success: true,
    };
  } catch (error) {
    console.error('Remove assignment action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while removing assignment',
    };
  }
}

// ---- Reviewer - Evaluations ----

/**
 * Server action to get my pending peer reviews (reviewer)
 */
export const getMyReviewsAction = cache(
  async (
    periodId: string,
  ): Promise<{
    success: boolean;
    data?: PeerReviewEvaluation[];
    error?: string;
  }> => {
    try {
      const response = await peerReviewsApi.getMyReviews(periodId);

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.errorMessage || 'Failed to fetch peer reviews',
        };
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('Get my peer reviews action error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred while fetching peer reviews',
      };
    }
  },
);

/**
 * Server action to auto-save peer review evaluation (reviewer)
 */
export async function updatePeerReviewEvaluationAction(
  evalId: string,
  data: PeerReviewEvaluationUpdate,
): Promise<{
  success: boolean;
  data?: PeerReviewEvaluation;
  error?: string;
}> {
  try {
    const response = await peerReviewsApi.updateEvaluation(evalId, data);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to update peer review evaluation',
      };
    }

    revalidateTag(CACHE_TAGS.PEER_REVIEWS);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Update peer review evaluation action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while updating peer review evaluation',
    };
  }
}

/**
 * Server action to submit peer review evaluation (reviewer, definitive)
 */
export async function submitPeerReviewEvaluationAction(
  evalId: string,
): Promise<{
  success: boolean;
  data?: PeerReviewEvaluation;
  error?: string;
}> {
  try {
    const response = await peerReviewsApi.submitEvaluation(evalId);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to submit peer review evaluation',
      };
    }

    revalidateTag(CACHE_TAGS.PEER_REVIEWS);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Submit peer review evaluation action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while submitting peer review evaluation',
    };
  }
}

// ---- Reviewee - Results ----

/**
 * Server action to get my averaged peer review results (anonymized)
 */
export const getMyPeerReviewResultsAction = cache(
  async (
    periodId: string,
  ): Promise<{
    success: boolean;
    data?: PeerReviewAveragedScores;
    error?: string;
  }> => {
    try {
      const response = await peerReviewsApi.getMyResults(periodId);

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.errorMessage || 'Failed to fetch peer review results',
        };
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('Get my peer review results action error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred while fetching peer review results',
      };
    }
  },
);

/**
 * Server action to get a user's averaged peer review results (admin)
 */
export const getUserPeerReviewResultsAction = cache(
  async (
    periodId: string,
    userId: string,
  ): Promise<{
    success: boolean;
    data?: PeerReviewAveragedScores;
    error?: string;
  }> => {
    try {
      const response = await peerReviewsApi.getUserResults(periodId, userId);

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.errorMessage || 'Failed to fetch user peer review results',
        };
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('Get user peer review results action error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred while fetching user peer review results',
      };
    }
  },
);

// ---- Admin - 評価進捗 ----

/**
 * Server action to get evaluation progress for all users (admin)
 */
export async function getProgressAction(
  periodId: string,
): Promise<{
  success: boolean;
  data?: EvaluationProgressEntry[];
  error?: string;
}> {
  try {
    const response = await peerReviewsApi.getProgress(periodId);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to fetch evaluation progress',
      };
    }

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Get evaluation progress action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while fetching evaluation progress',
    };
  }
}

// ---- Admin - 評価詳細 ----

/**
 * Server action to get evaluation detail for a user (admin)
 */
export async function getEvaluationDetailAction(
  periodId: string,
  userId: string,
): Promise<{
  success: boolean;
  data?: EvaluationDetailResponse;
  error?: string;
}> {
  try {
    const response = await peerReviewsApi.getDetail(periodId, userId);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to fetch evaluation detail',
      };
    }

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Get evaluation detail action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while fetching evaluation detail',
    };
  }
}

// ---- Admin - 総合評価 ----

/**
 * Server action to get core value summary (admin, 総合評価)
 */
export const getCoreValueSummaryAction = cache(
  async (
    periodId: string,
    userId: string,
  ): Promise<{
    success: boolean;
    data?: CoreValueSummaryResponse;
    error?: string;
  }> => {
    try {
      const response = await peerReviewsApi.getCoreValueSummary(periodId, userId);

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.errorMessage || 'Failed to fetch core value summary',
        };
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('Get core value summary action error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred while fetching core value summary',
      };
    }
  },
);
