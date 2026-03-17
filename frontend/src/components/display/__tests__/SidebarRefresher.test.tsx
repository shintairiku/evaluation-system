import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import SidebarRefresher from '../SidebarRefresher';

const mockRefreshPendingCount = vi.fn();
const mockRefreshRejectedGoalsCount = vi.fn();
const mockRefreshDraftCount = vi.fn();
const mockRefreshPendingEvaluationsCount = vi.fn();

vi.mock('@/context/GoalReviewContext', () => ({
  useGoalReviewContext: () => ({ refreshPendingCount: mockRefreshPendingCount }),
}));

vi.mock('@/context/GoalListContext', () => ({
  useGoalListContext: () => ({ refreshRejectedGoalsCount: mockRefreshRejectedGoalsCount }),
}));

vi.mock('@/context/ReturnedAssessmentsContext', () => ({
  useDraftAssessmentsContext: () => ({ refreshDraftCount: mockRefreshDraftCount }),
}));

vi.mock('@/context/PendingEvaluationsContext', () => ({
  usePendingEvaluationsContext: () => ({ refreshPendingEvaluationsCount: mockRefreshPendingEvaluationsCount }),
}));

const allMocks = [mockRefreshPendingCount, mockRefreshRejectedGoalsCount, mockRefreshDraftCount, mockRefreshPendingEvaluationsCount];

describe('SidebarRefresher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    allMocks.forEach(m => m.mockClear());
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing', () => {
    const { container } = render(<SidebarRefresher />);
    expect(container.innerHTML).toBe('');
  });

  it('calls all 4 refresh functions after 30 seconds when tab is visible', () => {
    render(<SidebarRefresher />);

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    allMocks.forEach(m => expect(m).toHaveBeenCalledTimes(1));
  });

  it('does not call refresh when tab is hidden', () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });

    render(<SidebarRefresher />);

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    allMocks.forEach(m => expect(m).not.toHaveBeenCalled());
  });

  it('does not call refresh when user is focused on TEXTAREA', () => {
    render(<SidebarRefresher />);

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    allMocks.forEach(m => expect(m).not.toHaveBeenCalled());
    document.body.removeChild(textarea);
  });

  it('does not call refresh when user is focused on INPUT', () => {
    render(<SidebarRefresher />);

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    allMocks.forEach(m => expect(m).not.toHaveBeenCalled());
    document.body.removeChild(input);
  });

  it('does not call refresh when user is in contentEditable element', () => {
    render(<SidebarRefresher />);

    const div = document.createElement('div');
    div.contentEditable = 'true';
    document.body.appendChild(div);
    Object.defineProperty(div, 'isContentEditable', { configurable: true, get: () => true });
    Object.defineProperty(document, 'activeElement', { configurable: true, get: () => div });

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    allMocks.forEach(m => expect(m).not.toHaveBeenCalled());
    Object.defineProperty(document, 'activeElement', { configurable: true, get: () => document.body });
    document.body.removeChild(div);
  });

  it('triggers immediate refresh on visibility change to visible', () => {
    render(<SidebarRefresher />);

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    allMocks.forEach(m => expect(m).toHaveBeenCalledTimes(1));
  });

  it('does not refresh on visibility change to hidden', () => {
    render(<SidebarRefresher />);

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    allMocks.forEach(m => expect(m).not.toHaveBeenCalled());
  });

  it('debounces rapid visibility changes within 5 seconds', () => {
    render(<SidebarRefresher />);

    // First visibility change triggers refresh
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    allMocks.forEach(m => expect(m).toHaveBeenCalledTimes(1));

    // Rapid second visibility change within 5s is debounced
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    allMocks.forEach(m => expect(m).toHaveBeenCalledTimes(1)); // Still 1

    // After 5s debounce window, refresh fires again
    act(() => {
      vi.advanceTimersByTime(5_000);
      document.dispatchEvent(new Event('visibilitychange'));
    });
    allMocks.forEach(m => expect(m).toHaveBeenCalledTimes(2));
  });

  it('cleans up interval and event listener on unmount', () => {
    const { unmount } = render(<SidebarRefresher />);

    unmount();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    allMocks.forEach(m => expect(m).not.toHaveBeenCalled());
  });
});
