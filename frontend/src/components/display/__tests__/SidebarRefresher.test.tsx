import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import SidebarRefresher from '../SidebarRefresher';

const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

describe('SidebarRefresher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockRefresh.mockClear();
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

  it('calls router.refresh() after 30 seconds when tab is visible', () => {
    render(<SidebarRefresher />);

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(mockRefresh).toHaveBeenCalledTimes(1);
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

    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('does not call refresh when user is focused on TEXTAREA', () => {
    render(<SidebarRefresher />);

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(mockRefresh).not.toHaveBeenCalled();
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

    expect(mockRefresh).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('does not call refresh when user is in contentEditable element', () => {
    render(<SidebarRefresher />);

    const div = document.createElement('div');
    div.contentEditable = 'true';
    document.body.appendChild(div);
    // jsdom doesn't fully support isContentEditable, so mock both activeElement and the property
    Object.defineProperty(div, 'isContentEditable', { configurable: true, get: () => true });
    Object.defineProperty(document, 'activeElement', { configurable: true, get: () => div });

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(mockRefresh).not.toHaveBeenCalled();
    Object.defineProperty(document, 'activeElement', { configurable: true, get: () => document.body });
    document.body.removeChild(div);
  });

  it('triggers immediate refresh on visibility change to visible', () => {
    render(<SidebarRefresher />);

    // Simulate tab becoming hidden then visible
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(mockRefresh).toHaveBeenCalledTimes(1);
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

    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('cleans up interval and event listener on unmount', () => {
    const { unmount } = render(<SidebarRefresher />);

    unmount();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
