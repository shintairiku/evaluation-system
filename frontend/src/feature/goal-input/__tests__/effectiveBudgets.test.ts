import { describe, it, expect } from 'vitest';
import {
  computeEffectiveBudgets,
  type StageWeightBudget,
  type ReadOnlyGoals,
  type ReadOnlyPerformanceGoal,
  type ReadOnlyCompetencyGoal,
} from '../types';

const defaultBudgets: StageWeightBudget = {
  quantitative: 70,
  qualitative: 30,
  competency: 10,
  stageName: 'Test Stage',
};

function buildReadOnlyPerf(overrides: Partial<ReadOnlyPerformanceGoal> = {}): ReadOnlyPerformanceGoal {
  return {
    id: 'ro-perf-' + Math.random().toString(36).slice(2),
    status: 'submitted',
    type: 'quantitative',
    title: 'RO Goal',
    specificGoal: 'Specific',
    achievementCriteria: 'Criteria',
    method: 'Method',
    weight: 50,
    ...overrides,
  };
}

function buildReadOnlyComp(overrides: Partial<ReadOnlyCompetencyGoal> = {}): ReadOnlyCompetencyGoal {
  return {
    id: 'ro-comp-' + Math.random().toString(36).slice(2),
    status: 'submitted',
    actionPlan: 'Action plan',
    competencyIds: null,
    selectedIdealActions: null,
    ...overrides,
  };
}

describe('computeEffectiveBudgets', () => {
  it('no read-only goals → returns original stageBudgets', () => {
    const result = computeEffectiveBudgets(defaultBudgets, null);
    expect(result).toEqual(defaultBudgets);
  });

  it('empty read-only goals → returns original stageBudgets', () => {
    const readOnly: ReadOnlyGoals = { performanceGoals: [], competencyGoals: [] };
    const result = computeEffectiveBudgets(defaultBudgets, readOnly);
    expect(result).toEqual(defaultBudgets);
  });

  it('quantitative read-only 50% → quantitative reduced', () => {
    const readOnly: ReadOnlyGoals = {
      performanceGoals: [buildReadOnlyPerf({ type: 'quantitative', weight: 50 })],
      competencyGoals: [],
    };
    const result = computeEffectiveBudgets(defaultBudgets, readOnly);
    expect(result.quantitative).toBe(20);
    expect(result.qualitative).toBe(30);
    expect(result.competency).toBe(10);
  });

  it('qualitative read-only 20% → qualitative reduced', () => {
    const readOnly: ReadOnlyGoals = {
      performanceGoals: [buildReadOnlyPerf({ type: 'qualitative', weight: 20 })],
      competencyGoals: [],
    };
    const result = computeEffectiveBudgets(defaultBudgets, readOnly);
    expect(result.quantitative).toBe(70);
    expect(result.qualitative).toBe(10);
    expect(result.competency).toBe(10);
  });

  it('competency read-only → competency=0', () => {
    const readOnly: ReadOnlyGoals = {
      performanceGoals: [],
      competencyGoals: [buildReadOnlyComp()],
    };
    const result = computeEffectiveBudgets(defaultBudgets, readOnly);
    expect(result.quantitative).toBe(70);
    expect(result.qualitative).toBe(30);
    expect(result.competency).toBe(0);
  });

  it('read-only weight exceeds budget → Math.max(0, ...)', () => {
    const readOnly: ReadOnlyGoals = {
      performanceGoals: [buildReadOnlyPerf({ type: 'quantitative', weight: 80 })],
      competencyGoals: [],
    };
    const result = computeEffectiveBudgets(defaultBudgets, readOnly);
    expect(result.quantitative).toBe(0);
    expect(result.qualitative).toBe(30);
  });

  it('multiple read-only performance goals → weights summed', () => {
    const readOnly: ReadOnlyGoals = {
      performanceGoals: [
        buildReadOnlyPerf({ type: 'quantitative', weight: 30 }),
        buildReadOnlyPerf({ type: 'quantitative', weight: 20 }),
        buildReadOnlyPerf({ type: 'qualitative', weight: 15 }),
      ],
      competencyGoals: [],
    };
    const result = computeEffectiveBudgets(defaultBudgets, readOnly);
    expect(result.quantitative).toBe(20); // 70 - 30 - 20
    expect(result.qualitative).toBe(15); // 30 - 15
  });

  it('all read-only → all reduced', () => {
    const readOnly: ReadOnlyGoals = {
      performanceGoals: [
        buildReadOnlyPerf({ type: 'quantitative', weight: 70 }),
        buildReadOnlyPerf({ type: 'qualitative', weight: 30 }),
      ],
      competencyGoals: [buildReadOnlyComp()],
    };
    const result = computeEffectiveBudgets(defaultBudgets, readOnly);
    expect(result.quantitative).toBe(0);
    expect(result.qualitative).toBe(0);
    expect(result.competency).toBe(0);
  });

  it('preserves stageName', () => {
    const readOnly: ReadOnlyGoals = {
      performanceGoals: [buildReadOnlyPerf({ weight: 10 })],
      competencyGoals: [],
    };
    const result = computeEffectiveBudgets(defaultBudgets, readOnly);
    expect(result.stageName).toBe('Test Stage');
  });
});
