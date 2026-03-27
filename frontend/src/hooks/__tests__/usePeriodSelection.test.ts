import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/api/server-actions/goals/queries', () => ({
  getGoalsAction: vi.fn(),
}));

import { getGoalsAction } from '@/api/server-actions/goals/queries';
import { usePeriodSelection } from '../usePeriodSelection';
import type { GoalResponse } from '@/api/types/goal';
import type { EvaluationPeriod } from '@/api/types';

const mockGetGoals = vi.mocked(getGoalsAction);

function buildGoalResponse(overrides: Partial<GoalResponse> = {}): GoalResponse {
  return {
    id: 'goal-' + Math.random().toString(36).slice(2),
    userId: 'user-1',
    periodId: 'period-1',
    goalCategory: '業績目標',
    weight: 50,
    status: 'draft',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    title: 'Test Goal',
    performanceGoalType: 'quantitative',
    specificGoalText: 'Specific',
    achievementCriteriaText: 'Criteria',
    meansMethodsText: 'Method',
    actionPlan: '',
    competencyIds: null,
    selectedIdealActions: null,
    ...overrides,
  } as GoalResponse;
}

const mockPeriod: EvaluationPeriod = {
  id: 'period-1',
  name: 'Test Period',
  start_date: '2025-01-01',
  end_date: '2025-12-31',
  status: 'active',
} as EvaluationPeriod;

const mockResetGoalData = vi.fn();

describe('usePeriodSelection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handlePeriodSelected', () => {
    it('no goals → loadedGoals=null, isAutoSaveReady=true', async () => {
      mockGetGoals.mockResolvedValue({
        success: true,
        data: { items: [], total: 0, page: 1, limit: 100 },
      } as any);

      const { result } = renderHook(() => usePeriodSelection('user-1'));

      await act(async () => {
        await result.current.handlePeriodSelected(mockPeriod, mockResetGoalData);
      });

      expect(result.current.hasBlockingGoals).toBe(false);
      expect(result.current.readOnlyGoals).toBeNull();
      expect(result.current.loadedGoals).toBeNull();
      expect(result.current.isAutoSaveReady).toBe(true);
    });

    it('only draft goals → loads as editable, no read-only', async () => {
      const draftPerf = buildGoalResponse({ status: 'draft', weight: 70 });
      const draftComp = buildGoalResponse({
        status: 'draft',
        goalCategory: 'コンピテンシー',
        actionPlan: 'Plan',
        weight: 10,
      });

      mockGetGoals.mockResolvedValue({
        success: true,
        data: { items: [draftPerf, draftComp], total: 2, page: 1, limit: 100 },
      } as any);

      const { result } = renderHook(() => usePeriodSelection('user-1'));

      await act(async () => {
        await result.current.handlePeriodSelected(mockPeriod, mockResetGoalData);
      });

      expect(result.current.hasBlockingGoals).toBe(false);
      expect(result.current.readOnlyGoals).toBeNull();
      expect(result.current.loadedGoals).not.toBeNull();
      expect(result.current.loadedGoals!.performanceGoals).toHaveLength(1);
      expect(result.current.loadedGoals!.competencyGoals).toHaveLength(1);
    });

    it('all submitted (perf=100% + comp) → FULL BLOCK', async () => {
      const goals = [
        buildGoalResponse({ status: 'submitted', weight: 70, performanceGoalType: 'quantitative' }),
        buildGoalResponse({ status: 'submitted', weight: 30, performanceGoalType: 'qualitative' }),
        buildGoalResponse({
          status: 'submitted',
          goalCategory: 'コンピテンシー',
          actionPlan: 'Plan',
          weight: 10,
        }),
      ];

      mockGetGoals.mockResolvedValue({
        success: true,
        data: { items: goals, total: 3, page: 1, limit: 100 },
      } as any);

      const { result } = renderHook(() => usePeriodSelection('user-1'));

      await act(async () => {
        await result.current.handlePeriodSelected(mockPeriod, mockResetGoalData);
      });

      expect(result.current.hasBlockingGoals).toBe(true);
      expect(result.current.readOnlyGoals).toBeNull();
      expect(result.current.loadedGoals).toBeNull();
    });

    it('partial submitted (perf<100%) → PARTIAL, allows access', async () => {
      const goals = [
        buildGoalResponse({ status: 'submitted', weight: 50, performanceGoalType: 'quantitative' }),
        buildGoalResponse({
          status: 'submitted',
          goalCategory: 'コンピテンシー',
          actionPlan: 'Plan',
          weight: 10,
        }),
      ];

      mockGetGoals.mockResolvedValue({
        success: true,
        data: { items: goals, total: 2, page: 1, limit: 100 },
      } as any);

      const { result } = renderHook(() => usePeriodSelection('user-1'));

      await act(async () => {
        await result.current.handlePeriodSelected(mockPeriod, mockResetGoalData);
      });

      expect(result.current.hasBlockingGoals).toBe(false);
      expect(result.current.readOnlyGoals).not.toBeNull();
      expect(result.current.readOnlyGoals!.performanceGoals).toHaveLength(1);
      expect(result.current.readOnlyGoals!.competencyGoals).toHaveLength(1);
    });

    it('competency submitted + no performance → PARTIAL', async () => {
      const goals = [
        buildGoalResponse({
          status: 'submitted',
          goalCategory: 'コンピテンシー',
          actionPlan: 'Plan',
          weight: 10,
        }),
      ];

      mockGetGoals.mockResolvedValue({
        success: true,
        data: { items: goals, total: 1, page: 1, limit: 100 },
      } as any);

      const { result } = renderHook(() => usePeriodSelection('user-1'));

      await act(async () => {
        await result.current.handlePeriodSelected(mockPeriod, mockResetGoalData);
      });

      expect(result.current.hasBlockingGoals).toBe(false);
      expect(result.current.readOnlyGoals).not.toBeNull();
      expect(result.current.readOnlyGoals!.performanceGoals).toHaveLength(0);
      expect(result.current.readOnlyGoals!.competencyGoals).toHaveLength(1);
    });

    it('performance submitted (100%) + no competency → PARTIAL', async () => {
      const goals = [
        buildGoalResponse({ status: 'submitted', weight: 70, performanceGoalType: 'quantitative' }),
        buildGoalResponse({ status: 'submitted', weight: 30, performanceGoalType: 'qualitative' }),
      ];

      mockGetGoals.mockResolvedValue({
        success: true,
        data: { items: goals, total: 2, page: 1, limit: 100 },
      } as any);

      const { result } = renderHook(() => usePeriodSelection('user-1'));

      await act(async () => {
        await result.current.handlePeriodSelected(mockPeriod, mockResetGoalData);
      });

      expect(result.current.hasBlockingGoals).toBe(false);
      expect(result.current.readOnlyGoals).not.toBeNull();
      expect(result.current.readOnlyGoals!.performanceGoals).toHaveLength(2);
      expect(result.current.readOnlyGoals!.competencyGoals).toHaveLength(0);
    });

    it('mix draft + submitted → separates correctly', async () => {
      const goals = [
        buildGoalResponse({ id: 'perf-submitted', status: 'submitted', weight: 50 }),
        buildGoalResponse({ id: 'perf-draft', status: 'draft', weight: 20 }),
        buildGoalResponse({
          id: 'comp-submitted',
          status: 'submitted',
          goalCategory: 'コンピテンシー',
          actionPlan: 'Plan',
          weight: 10,
        }),
      ];

      mockGetGoals.mockResolvedValue({
        success: true,
        data: { items: goals, total: 3, page: 1, limit: 100 },
      } as any);

      const { result } = renderHook(() => usePeriodSelection('user-1'));

      await act(async () => {
        await result.current.handlePeriodSelected(mockPeriod, mockResetGoalData);
      });

      expect(result.current.hasBlockingGoals).toBe(false);
      expect(result.current.readOnlyGoals!.performanceGoals).toHaveLength(1);
      expect(result.current.readOnlyGoals!.performanceGoals[0].id).toBe('perf-submitted');
      expect(result.current.readOnlyGoals!.competencyGoals).toHaveLength(1);
      expect(result.current.loadedGoals!.performanceGoals).toHaveLength(1);
      expect(result.current.loadedGoals!.performanceGoals[0].id).toBe('perf-draft');
    });

    it('API failure → clears state, enables auto-save', async () => {
      mockGetGoals.mockResolvedValue({
        success: false,
        error: 'Network error',
      } as any);

      const { result } = renderHook(() => usePeriodSelection('user-1'));

      await act(async () => {
        await result.current.handlePeriodSelected(mockPeriod, mockResetGoalData);
      });

      expect(result.current.hasBlockingGoals).toBe(false);
      expect(result.current.readOnlyGoals).toBeNull();
      expect(result.current.loadedGoals).toBeNull();
      expect(result.current.isAutoSaveReady).toBe(true);
      expect(result.current.goalLoadingError).toBeTruthy();
    });
  });

  describe('clearPeriodSelection', () => {
    it('resets all state including readOnlyGoals', async () => {
      // First set some state
      const goals = [
        buildGoalResponse({ status: 'submitted', weight: 50 }),
        buildGoalResponse({
          status: 'submitted',
          goalCategory: 'コンピテンシー',
          actionPlan: 'Plan',
          weight: 10,
        }),
      ];

      mockGetGoals.mockResolvedValue({
        success: true,
        data: { items: goals, total: 2, page: 1, limit: 100 },
      } as any);

      const { result } = renderHook(() => usePeriodSelection('user-1'));

      await act(async () => {
        await result.current.handlePeriodSelected(mockPeriod, mockResetGoalData);
      });

      expect(result.current.readOnlyGoals).not.toBeNull();

      // Now clear
      act(() => {
        result.current.clearPeriodSelection();
      });

      expect(result.current.selectedPeriod).toBeNull();
      expect(result.current.readOnlyGoals).toBeNull();
      expect(result.current.loadedGoals).toBeNull();
      expect(result.current.hasBlockingGoals).toBe(false);
    });
  });
});
