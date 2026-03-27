import { describe, it, expect } from 'vitest';
import { canProceedCompetency } from '../../types';

describe('canProceedCompetency', () => {
  const mockGoalTracking = {
    isGoalDirty: (id: string) => false,
  };

  const dirtyGoalTracking = {
    isGoalDirty: (id: string) => true,
  };

  it('all OK (actionPlan, server ID, not dirty, not saving) → true', () => {
    expect(canProceedCompetency(
      'My action plan',
      'server-uuid-123',
      mockGoalTracking,
      false
    )).toBe(true);
  });

  it('empty actionPlan → false', () => {
    expect(canProceedCompetency(
      '',
      'server-uuid-123',
      mockGoalTracking,
      false
    )).toBe(false);
  });

  it('whitespace-only actionPlan → false', () => {
    expect(canProceedCompetency(
      '   \n  ',
      'server-uuid-123',
      mockGoalTracking,
      false
    )).toBe(false);
  });

  it('temporary ID (numeric) → false', () => {
    expect(canProceedCompetency(
      'My action plan',
      '1711900000000',
      mockGoalTracking,
      false
    )).toBe(false);
  });

  it('goal is dirty → false', () => {
    expect(canProceedCompetency(
      'My action plan',
      'server-uuid-123',
      dirtyGoalTracking,
      false
    )).toBe(false);
  });

  it('auto-save in flight → false', () => {
    expect(canProceedCompetency(
      'My action plan',
      'server-uuid-123',
      mockGoalTracking,
      true
    )).toBe(false);
  });

  it('undefined goal ID → false', () => {
    expect(canProceedCompetency(
      'My action plan',
      undefined,
      mockGoalTracking,
      false
    )).toBe(false);
  });

  it('undefined goalTracking → uses false for dirty check', () => {
    expect(canProceedCompetency(
      'My action plan',
      'server-uuid-123',
      undefined,
      false
    )).toBe(true);
  });

  it('server ID with letters is not temporary', () => {
    expect(canProceedCompetency(
      'My action plan',
      'abc-123-def',
      mockGoalTracking,
      false
    )).toBe(true);
  });
});
