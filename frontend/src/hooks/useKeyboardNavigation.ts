import { useCallback, useEffect, useRef } from 'react';

/**
 * Direction for keyboard navigation
 */
type Direction = 'up' | 'down' | 'left' | 'right';

/**
 * Keyboard navigation configuration
 */
interface KeyboardNavigationConfig {
  /** Enable arrow key navigation */
  enableArrowKeys?: boolean;
  /** Enable tab navigation */
  enableTabNavigation?: boolean;
  /** Enable escape key handling */
  enableEscapeKey?: boolean;
  /** Callback when escape is pressed */
  onEscape?: () => void;
  /** Callback for arrow key navigation */
  onNavigate?: (direction: Direction) => void;
  /** Callback for tab navigation */
  onTab?: (event: KeyboardEvent) => void;
  /** Callback for enter key */
  onEnter?: () => void;
  /** Callback for space key */
  onSpace?: () => void;
}

/**
 * Return type for useKeyboardNavigation hook
 */
interface UseKeyboardNavigationReturn {
  /** Ref to attach to the container element */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Current focus index for navigation */
  focusIndex: number;
  /** Set focus to specific index */
  setFocusIndex: (index: number) => void;
  /** Focus the next focusable element */
  focusNext: () => void;
  /** Focus the previous focusable element */
  focusPrevious: () => void;
  /** Focus the first focusable element */
  focusFirst: () => void;
  /** Focus the last focusable element */
  focusLast: () => void;
}

/**
 * Custom hook for keyboard navigation and accessibility
 * Provides comprehensive keyboard navigation support following WCAG guidelines
 *
 * @param config - Configuration options for keyboard navigation
 * @returns Object containing navigation controls and refs
 */
export function useKeyboardNavigation(
  config: KeyboardNavigationConfig = {}
): UseKeyboardNavigationReturn {
  const {
    enableArrowKeys = true,
    enableTabNavigation = true,
    enableEscapeKey = true,
    onEscape,
    onNavigate,
    onTab,
    onEnter,
    onSpace
  } = config;

  const containerRef = useRef<HTMLElement>(null);
  const focusIndexRef = useRef(0);

  /**
   * Get all focusable elements within the container
   */
  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];

    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'textarea:not([disabled])',
      'select:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[role="button"]:not([disabled])',
      '[role="link"]:not([disabled])',
      '[role="menuitem"]:not([disabled])',
      '[role="tab"]:not([disabled])'
    ].join(', ');

    const elements = containerRef.current.querySelectorAll(focusableSelectors);
    return Array.from(elements) as HTMLElement[];
  }, []);

  /**
   * Focus element at specific index
   */
  const focusElementAtIndex = useCallback((index: number) => {
    const elements = getFocusableElements();
    if (elements.length === 0) return;

    const clampedIndex = Math.max(0, Math.min(index, elements.length - 1));
    const element = elements[clampedIndex];

    if (element) {
      element.focus();
      focusIndexRef.current = clampedIndex;
    }
  }, [getFocusableElements]);

  /**
   * Navigation handlers
   */
  const focusNext = useCallback(() => {
    const elements = getFocusableElements();
    if (elements.length === 0) return;

    const nextIndex = (focusIndexRef.current + 1) % elements.length;
    focusElementAtIndex(nextIndex);
  }, [getFocusableElements, focusElementAtIndex]);

  const focusPrevious = useCallback(() => {
    const elements = getFocusableElements();
    if (elements.length === 0) return;

    const prevIndex = focusIndexRef.current === 0
      ? elements.length - 1
      : focusIndexRef.current - 1;
    focusElementAtIndex(prevIndex);
  }, [getFocusableElements, focusElementAtIndex]);

  const focusFirst = useCallback(() => {
    focusElementAtIndex(0);
  }, [focusElementAtIndex]);

  const focusLast = useCallback(() => {
    const elements = getFocusableElements();
    if (elements.length > 0) {
      focusElementAtIndex(elements.length - 1);
    }
  }, [getFocusableElements, focusElementAtIndex]);

  const setFocusIndex = useCallback((index: number) => {
    focusElementAtIndex(index);
  }, [focusElementAtIndex]);

  /**
   * Keyboard event handler
   */
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Handle escape key
    if (enableEscapeKey && event.key === 'Escape') {
      event.preventDefault();
      onEscape?.();
      return;
    }

    // Handle enter key
    if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey) {
      onEnter?.();
      return;
    }

    // Handle space key
    if (event.key === ' ' && !event.shiftKey && !event.ctrlKey) {
      event.preventDefault();
      onSpace?.();
      return;
    }

    // Handle tab navigation
    if (enableTabNavigation && event.key === 'Tab') {
      onTab?.(event);
      return;
    }

    // Handle arrow key navigation
    if (enableArrowKeys) {
      let direction: Direction | null = null;

      switch (event.key) {
        case 'ArrowUp':
          direction = 'up';
          focusPrevious();
          break;
        case 'ArrowDown':
          direction = 'down';
          focusNext();
          break;
        case 'ArrowLeft':
          direction = 'left';
          focusPrevious();
          break;
        case 'ArrowRight':
          direction = 'right';
          focusNext();
          break;
        case 'Home':
          event.preventDefault();
          focusFirst();
          break;
        case 'End':
          event.preventDefault();
          focusLast();
          break;
        default:
          return;
      }

      if (direction) {
        event.preventDefault();
        onNavigate?.(direction);
      }
    }
  }, [
    enableEscapeKey,
    enableTabNavigation,
    enableArrowKeys,
    onEscape,
    onEnter,
    onSpace,
    onTab,
    onNavigate,
    focusNext,
    focusPrevious,
    focusFirst,
    focusLast
  ]);

  /**
   * Update focus index when focus changes
   */
  const handleFocusChange = useCallback(() => {
    if (!containerRef.current) return;

    const elements = getFocusableElements();
    const activeElement = document.activeElement as HTMLElement;
    const currentIndex = elements.indexOf(activeElement);

    if (currentIndex !== -1) {
      focusIndexRef.current = currentIndex;
    }
  }, [getFocusableElements]);

  /**
   * Setup event listeners
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Add keyboard event listener
    container.addEventListener('keydown', handleKeyDown);

    // Add focus event listener to track focus changes
    container.addEventListener('focusin', handleFocusChange);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      container.removeEventListener('focusin', handleFocusChange);
    };
  }, [handleKeyDown, handleFocusChange]);

  return {
    containerRef,
    focusIndex: focusIndexRef.current,
    setFocusIndex,
    focusNext,
    focusPrevious,
    focusFirst,
    focusLast
  };
}