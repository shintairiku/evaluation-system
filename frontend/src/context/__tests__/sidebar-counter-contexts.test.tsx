import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

// ── Mocks ──

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => '/',
}));

vi.mock('@/context/CurrentUserContext', () => ({
  useOptionalCurrentUserContext: vi.fn(() => null),
}));

vi.mock('@/api/server-actions/supervisor-reviews', () => ({
  getPendingSupervisorReviewsAction: vi.fn(),
}));

vi.mock('@/api/server-actions/goals', () => ({
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

import { GoalReviewProvider, useGoalReviewContext } from '../GoalReviewContext';
import { GoalListProvider, useGoalListContext } from '../GoalListContext';
import { DraftAssessmentsProvider, useDraftAssessmentsContext } from '../ReturnedAssessmentsContext';
import { PendingEvaluationsProvider, usePendingEvaluationsContext } from '../PendingEvaluationsContext';

import { getPendingSupervisorReviewsAction } from '@/api/server-actions/supervisor-reviews';
import { getGoalsAction } from '@/api/server-actions/goals';
import { getSelfAssessmentsAction } from '@/api/server-actions/self-assessments';
import { getMyEvaluationAction, getCoreValuePendingFeedbackCountAction } from '@/api/server-actions/core-values';
import { getSupervisorFeedbacksAction } from '@/api/server-actions/supervisor-feedbacks';

const mockGetPendingSupervisorReviews = vi.mocked(getPendingSupervisorReviewsAction);
const mockGetGoals = vi.mocked(getGoalsAction);
const mockGetSelfAssessments = vi.mocked(getSelfAssessmentsAction);
const mockGetMyEvaluation = vi.mocked(getMyEvaluationAction);
const mockGetSupervisorFeedbacks = vi.mocked(getSupervisorFeedbacksAction);
const mockGetCoreValuePendingCount = vi.mocked(getCoreValuePendingFeedbackCountAction);

// ── Test consumers ──

function GoalReviewConsumer() {
  const { pendingCount, setPendingCount, resetPendingCount, refreshPendingCount } = useGoalReviewContext();
  return (
    <div>
      <span data-testid="count">{pendingCount}</span>
      <button data-testid="set" onClick={() => setPendingCount(5)}>set</button>
      <button data-testid="set-negative" onClick={() => setPendingCount(-1)}>set-negative</button>
      <button data-testid="reset" onClick={resetPendingCount}>reset</button>
      <button data-testid="refresh" onClick={refreshPendingCount}>refresh</button>
    </div>
  );
}

function GoalListConsumer() {
  const { rejectedGoalsCount, setRejectedGoalsCount, resetRejectedGoalsCount, refreshRejectedGoalsCount } = useGoalListContext();
  return (
    <div>
      <span data-testid="count">{rejectedGoalsCount}</span>
      <button data-testid="set" onClick={() => setRejectedGoalsCount(5)}>set</button>
      <button data-testid="set-negative" onClick={() => setRejectedGoalsCount(-1)}>set-negative</button>
      <button data-testid="reset" onClick={resetRejectedGoalsCount}>reset</button>
      <button data-testid="refresh" onClick={refreshRejectedGoalsCount}>refresh</button>
    </div>
  );
}

function DraftAssessmentsConsumer() {
  const { draftCount, setDraftCount, resetDraftCount, refreshDraftCount } = useDraftAssessmentsContext();
  return (
    <div>
      <span data-testid="count">{draftCount}</span>
      <button data-testid="set" onClick={() => setDraftCount(5)}>set</button>
      <button data-testid="set-negative" onClick={() => setDraftCount(-1)}>set-negative</button>
      <button data-testid="reset" onClick={resetDraftCount}>reset</button>
      <button data-testid="refresh" onClick={refreshDraftCount}>refresh</button>
    </div>
  );
}

function PendingEvaluationsConsumer() {
  const { pendingEvaluationsCount, setPendingEvaluationsCount, resetPendingEvaluationsCount, refreshPendingEvaluationsCount } = usePendingEvaluationsContext();
  return (
    <div>
      <span data-testid="count">{pendingEvaluationsCount}</span>
      <button data-testid="set" onClick={() => setPendingEvaluationsCount(5)}>set</button>
      <button data-testid="set-negative" onClick={() => setPendingEvaluationsCount(-1)}>set-negative</button>
      <button data-testid="reset" onClick={resetPendingEvaluationsCount}>reset</button>
      <button data-testid="refresh" onClick={refreshPendingEvaluationsCount}>refresh</button>
    </div>
  );
}

// ── Helper ──

function setupAllMocksResolving() {
  mockGetPendingSupervisorReviews.mockResolvedValue({ success: true, data: { total: 0, items: [] } } as any);
  mockGetGoals.mockResolvedValue({ success: true, data: { total: 0, items: [] } } as any);
  mockGetSelfAssessments.mockResolvedValue({ success: true, data: { total: 0, items: [] } } as any);
  mockGetMyEvaluation.mockResolvedValue({ success: true, data: null } as any);
  mockGetSupervisorFeedbacks.mockResolvedValue({ success: true, data: { total: 0, items: [] } } as any);
  mockGetCoreValuePendingCount.mockResolvedValue({ success: true, data: { count: 0 } } as any);
}

// ── Tests ──

describe('GoalReviewContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAllMocksResolving();
  });

  it('initializes with initialPendingCount prop', async () => {
    mockGetPendingSupervisorReviews.mockResolvedValue({ success: true, data: { total: 7, items: [] } } as any);
    render(
      <GoalReviewProvider initialPendingCount={7} initialPeriodId="p1">
        <GoalReviewConsumer />
      </GoalReviewProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('7');
    });
  });

  it('defaults to 0 when no initial prop', async () => {
    render(
      <GoalReviewProvider>
        <GoalReviewConsumer />
      </GoalReviewProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('0');
    });
  });

  it('setPendingCount updates the count', async () => {
    render(
      <GoalReviewProvider initialPeriodId="p1">
        <GoalReviewConsumer />
      </GoalReviewProvider>
    );
    fireEvent.click(screen.getByTestId('set'));
    expect(screen.getByTestId('count')).toHaveTextContent('5');
  });

  it('setPendingCount rejects negative values', async () => {
    mockGetPendingSupervisorReviews.mockResolvedValue({ success: true, data: { total: 3, items: [] } } as any);
    render(
      <GoalReviewProvider initialPendingCount={3} initialPeriodId="p1">
        <GoalReviewConsumer />
      </GoalReviewProvider>
    );
    fireEvent.click(screen.getByTestId('set-negative'));
    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('3');
    });
  });

  it('resetPendingCount sets count to 0', async () => {
    render(
      <GoalReviewProvider initialPendingCount={5} initialPeriodId="p1">
        <GoalReviewConsumer />
      </GoalReviewProvider>
    );
    fireEvent.click(screen.getByTestId('reset'));
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });

  it('refreshPendingCount fetches and updates count', async () => {
    mockGetPendingSupervisorReviews.mockResolvedValue({ success: true, data: { total: 10, items: [] } } as any);
    render(
      <GoalReviewProvider initialPendingCount={0} initialPeriodId="p1">
        <GoalReviewConsumer />
      </GoalReviewProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('10');
    });
  });

  it('refreshPendingCount keeps previous value on error', async () => {
    mockGetPendingSupervisorReviews
      .mockResolvedValueOnce({ success: true, data: { total: 5, items: [] } } as any) // mount
      .mockRejectedValueOnce(new Error('fail')); // manual refresh

    render(
      <GoalReviewProvider initialPendingCount={5} initialPeriodId="p1">
        <GoalReviewConsumer />
      </GoalReviewProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('5');
    });

    fireEvent.click(screen.getByTestId('refresh'));

    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('5');
    });
  });

  it('useGoalReviewContext throws outside provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<GoalReviewConsumer />)).toThrow(
      'useGoalReviewContext must be used within a GoalReviewProvider'
    );
    consoleError.mockRestore();
  });
});

describe('GoalListContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAllMocksResolving();
  });

  it('initializes with initialRejectedGoalsCount prop', async () => {
    mockGetGoals.mockResolvedValue({ success: true, data: { total: 4, items: [] } } as any);
    render(
      <GoalListProvider initialRejectedGoalsCount={4} initialPeriodId="p1" initialUserId="u1">
        <GoalListConsumer />
      </GoalListProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('4');
    });
  });

  it('refreshRejectedGoalsCount sets 0 when userId or periodId is missing', async () => {
    render(
      <GoalListProvider initialRejectedGoalsCount={5}>
        <GoalListConsumer />
      </GoalListProvider>
    );
    // Without periodId/userId, refresh sets count to 0
    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('0');
    });
    expect(mockGetGoals).not.toHaveBeenCalled();
  });

  it('setRejectedGoalsCount rejects negative values', async () => {
    mockGetGoals.mockResolvedValue({ success: true, data: { total: 3, items: [] } } as any);
    render(
      <GoalListProvider initialRejectedGoalsCount={3} initialPeriodId="p1" initialUserId="u1">
        <GoalListConsumer />
      </GoalListProvider>
    );
    fireEvent.click(screen.getByTestId('set-negative'));
    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('3');
    });
  });

  it('useGoalListContext throws outside provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<GoalListConsumer />)).toThrow(
      'useGoalListContext must be used within a GoalListProvider'
    );
    consoleError.mockRestore();
  });
});

describe('DraftAssessmentsContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAllMocksResolving();
  });

  it('initializes with initialDraftCount prop', async () => {
    render(
      <DraftAssessmentsProvider initialDraftCount={6} initialPeriodId="p1" initialUserId="u1">
        <DraftAssessmentsConsumer />
      </DraftAssessmentsProvider>
    );
    // Mount refresh may change the count, but initial render should show 6
    expect(screen.getByTestId('count')).toHaveTextContent('6');
  });

  it('refreshDraftCount sums selfAssessments + coreValueIsDraft', async () => {
    mockGetSelfAssessments.mockResolvedValue({ success: true, data: { total: 3, items: [] } } as any);
    mockGetMyEvaluation.mockResolvedValue({ success: true, data: { status: 'draft' } } as any);

    render(
      <DraftAssessmentsProvider initialDraftCount={0} initialPeriodId="p1" initialUserId="u1">
        <DraftAssessmentsConsumer />
      </DraftAssessmentsProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('4'); // 3 + 1
    });
  });

  it('refreshDraftCount does not add 1 when core value is not draft', async () => {
    mockGetSelfAssessments.mockResolvedValue({ success: true, data: { total: 3, items: [] } } as any);
    mockGetMyEvaluation.mockResolvedValue({ success: true, data: { status: 'submitted' } } as any);

    render(
      <DraftAssessmentsProvider initialDraftCount={0} initialPeriodId="p1" initialUserId="u1">
        <DraftAssessmentsConsumer />
      </DraftAssessmentsProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('3'); // 3 + 0
    });
  });

  it('refreshDraftCount sets 0 when userId or periodId is missing', async () => {
    render(
      <DraftAssessmentsProvider initialDraftCount={5}>
        <DraftAssessmentsConsumer />
      </DraftAssessmentsProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('0');
    });
  });

  it('useDraftAssessmentsContext throws outside provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<DraftAssessmentsConsumer />)).toThrow(
      'useDraftAssessmentsContext must be used within a DraftAssessmentsProvider'
    );
    consoleError.mockRestore();
  });
});

describe('PendingEvaluationsContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAllMocksResolving();
  });

  it('initializes with initialPendingEvaluationsCount prop', async () => {
    render(
      <PendingEvaluationsProvider initialPendingEvaluationsCount={8} initialPeriodId="p1" initialUserId="u1">
        <PendingEvaluationsConsumer />
      </PendingEvaluationsProvider>
    );
    expect(screen.getByTestId('count')).toHaveTextContent('8');
  });

  it('refreshPendingEvaluationsCount sums supervisorFeedbacks + coreValuePending', async () => {
    mockGetSupervisorFeedbacks.mockResolvedValue({ success: true, data: { total: 4, items: [] } } as any);
    mockGetCoreValuePendingCount.mockResolvedValue({ success: true, data: { count: 2 } } as any);

    render(
      <PendingEvaluationsProvider initialPendingEvaluationsCount={0} initialPeriodId="p1" initialUserId="u1">
        <PendingEvaluationsConsumer />
      </PendingEvaluationsProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('6'); // 4 + 2
    });
  });

  it('refreshPendingEvaluationsCount sets 0 when userId or periodId is missing', async () => {
    render(
      <PendingEvaluationsProvider initialPendingEvaluationsCount={5}>
        <PendingEvaluationsConsumer />
      </PendingEvaluationsProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('0');
    });
  });

  it('setPendingEvaluationsCount updates count', async () => {
    render(
      <PendingEvaluationsProvider initialPeriodId="p1" initialUserId="u1">
        <PendingEvaluationsConsumer />
      </PendingEvaluationsProvider>
    );
    fireEvent.click(screen.getByTestId('set'));
    expect(screen.getByTestId('count')).toHaveTextContent('5');
  });

  it('resetPendingEvaluationsCount sets count to 0', async () => {
    render(
      <PendingEvaluationsProvider initialPendingEvaluationsCount={8} initialPeriodId="p1" initialUserId="u1">
        <PendingEvaluationsConsumer />
      </PendingEvaluationsProvider>
    );
    fireEvent.click(screen.getByTestId('reset'));
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });

  it('usePendingEvaluationsContext throws outside provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<PendingEvaluationsConsumer />)).toThrow(
      'usePendingEvaluationsContext must be used within a PendingEvaluationsProvider'
    );
    consoleError.mockRestore();
  });
});
