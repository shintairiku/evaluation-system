import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchSidebarCounts } from '../sidebar-counts';

vi.mock('@/api/server-actions/supervisor-reviews', () => ({
  getPendingSupervisorReviewsAction: vi.fn(),
}));
vi.mock('@/api/server-actions/goals/queries', () => ({
  getGoalsAction: vi.fn(),
}));
vi.mock('@/api/server-actions/self-assessments', () => ({
  getSelfAssessmentsAction: vi.fn(),
}));
vi.mock('@/api/server-actions/core-values', () => ({
  getMyEvaluationAction: vi.fn(),
  getCoreValuePendingFeedbackCountAction: vi.fn(),
}));
vi.mock('@/api/server-actions/supervisor-feedbacks', () => ({
  getSupervisorFeedbacksAction: vi.fn(),
}));

import { getPendingSupervisorReviewsAction } from '@/api/server-actions/supervisor-reviews';
import { getGoalsAction } from '@/api/server-actions/goals/queries';
import { getSelfAssessmentsAction } from '@/api/server-actions/self-assessments';
import { getMyEvaluationAction, getCoreValuePendingFeedbackCountAction } from '@/api/server-actions/core-values';
import { getSupervisorFeedbacksAction } from '@/api/server-actions/supervisor-feedbacks';

const mockGetPendingSupervisorReviews = vi.mocked(getPendingSupervisorReviewsAction);
const mockGetGoals = vi.mocked(getGoalsAction);
const mockGetSelfAssessments = vi.mocked(getSelfAssessmentsAction);
const mockGetMyEvaluation = vi.mocked(getMyEvaluationAction);
const mockGetSupervisorFeedbacks = vi.mocked(getSupervisorFeedbacksAction);
const mockGetCoreValuePendingCount = vi.mocked(getCoreValuePendingFeedbackCountAction);

function setupSuccessMocks(overrides: {
  pendingReviews?: number;
  rejectedGoals?: number;
  selfAssessments?: number;
  coreValueStatus?: string;
  supervisorFeedbacks?: number;
  coreValuePending?: number;
} = {}) {
  const {
    pendingReviews = 3,
    rejectedGoals = 2,
    selfAssessments = 1,
    coreValueStatus = 'submitted',
    supervisorFeedbacks = 4,
    coreValuePending = 1,
  } = overrides;

  mockGetPendingSupervisorReviews.mockResolvedValue({ success: true, data: { total: pendingReviews, items: [] } } as any);
  mockGetGoals.mockResolvedValue({ success: true, data: { total: rejectedGoals, items: [] } } as any);
  mockGetSelfAssessments.mockResolvedValue({ success: true, data: { total: selfAssessments, items: [] } } as any);
  mockGetMyEvaluation.mockResolvedValue({ success: true, data: { status: coreValueStatus } } as any);
  mockGetSupervisorFeedbacks.mockResolvedValue({ success: true, data: { total: supervisorFeedbacks, items: [] } } as any);
  mockGetCoreValuePendingCount.mockResolvedValue({ success: true, data: { count: coreValuePending } } as any);
}

describe('fetchSidebarCounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns correct counts when all calls succeed', async () => {
    setupSuccessMocks({ pendingReviews: 3, rejectedGoals: 2, selfAssessments: 1, coreValueStatus: 'submitted', supervisorFeedbacks: 4, coreValuePending: 1 });

    const result = await fetchSidebarCounts('period-1', 'user-1');

    expect(result).toEqual({
      initialPendingCount: 3,
      initialRejectedGoalsCount: 2,
      initialDraftCount: 1, // selfAssessments=1 + coreValueIsDraft=0
      initialPendingEvaluationsCount: 5, // supervisorFeedbacks=4 + coreValuePending=1
    });
  });

  it('adds 1 to initialDraftCount when core value status is draft', async () => {
    setupSuccessMocks({ selfAssessments: 2, coreValueStatus: 'draft' });

    const result = await fetchSidebarCounts('period-1', 'user-1');

    expect(result.initialDraftCount).toBe(3); // 2 + 1
  });

  it('does not add 1 to initialDraftCount when core value status is not draft', async () => {
    setupSuccessMocks({ selfAssessments: 2, coreValueStatus: 'submitted' });

    const result = await fetchSidebarCounts('period-1', 'user-1');

    expect(result.initialDraftCount).toBe(2); // 2 + 0
  });

  it('returns 0 for failed calls (partial failure)', async () => {
    setupSuccessMocks({ rejectedGoals: 5, selfAssessments: 3, coreValueStatus: 'draft' });
    mockGetPendingSupervisorReviews.mockRejectedValue(new Error('Network error'));

    const result = await fetchSidebarCounts('period-1', 'user-1');

    expect(result.initialPendingCount).toBe(0); // failed
    expect(result.initialRejectedGoalsCount).toBe(5); // succeeded
    expect(result.initialDraftCount).toBe(4); // 3 + 1
  });

  it('returns all zeros when all calls fail', async () => {
    mockGetPendingSupervisorReviews.mockRejectedValue(new Error('fail'));
    mockGetGoals.mockRejectedValue(new Error('fail'));
    mockGetSelfAssessments.mockRejectedValue(new Error('fail'));
    mockGetMyEvaluation.mockRejectedValue(new Error('fail'));
    mockGetSupervisorFeedbacks.mockRejectedValue(new Error('fail'));
    mockGetCoreValuePendingCount.mockRejectedValue(new Error('fail'));

    const result = await fetchSidebarCounts('period-1', 'user-1');

    expect(result).toEqual({
      initialPendingCount: 0,
      initialRejectedGoalsCount: 0,
      initialDraftCount: 0,
      initialPendingEvaluationsCount: 0,
    });
  });

  it('returns 0 when data is null', async () => {
    mockGetPendingSupervisorReviews.mockResolvedValue({ success: true, data: null } as any);
    mockGetGoals.mockResolvedValue({ success: true, data: null } as any);
    mockGetSelfAssessments.mockResolvedValue({ success: true, data: null } as any);
    mockGetMyEvaluation.mockResolvedValue({ success: true, data: null } as any);
    mockGetSupervisorFeedbacks.mockResolvedValue({ success: true, data: null } as any);
    mockGetCoreValuePendingCount.mockResolvedValue({ success: true, data: null } as any);

    const result = await fetchSidebarCounts('period-1', 'user-1');

    expect(result).toEqual({
      initialPendingCount: 0,
      initialRejectedGoalsCount: 0,
      initialDraftCount: 0,
      initialPendingEvaluationsCount: 0,
    });
  });

  it('passes correct parameters to each server action', async () => {
    setupSuccessMocks();

    await fetchSidebarCounts('period-123', 'user-456');

    expect(mockGetPendingSupervisorReviews).toHaveBeenCalledWith({
      pagination: { limit: 1 },
      periodId: 'period-123',
    });
    expect(mockGetGoals).toHaveBeenCalledWith({
      periodId: 'period-123',
      userId: 'user-456',
      status: 'draft',
      hasPreviousGoalId: true,
      limit: 1,
    });
    expect(mockGetSelfAssessments).toHaveBeenCalledWith({
      periodId: 'period-123',
      status: 'draft',
      selfOnly: true,
      pagination: { limit: 1 },
    });
    expect(mockGetMyEvaluation).toHaveBeenCalledWith('period-123');
    expect(mockGetSupervisorFeedbacks).toHaveBeenCalledWith({
      periodId: 'period-123',
      supervisorId: 'user-456',
      action: 'PENDING',
      hasReturnComment: false,
      pagination: { limit: 1 },
    });
    expect(mockGetCoreValuePendingCount).toHaveBeenCalledWith('period-123');
  });

  it('uses empty string for periodId when undefined', async () => {
    setupSuccessMocks();

    await fetchSidebarCounts(undefined, 'user-1');

    expect(mockGetMyEvaluation).toHaveBeenCalledWith('');
    expect(mockGetCoreValuePendingCount).toHaveBeenCalledWith('');
  });
});
