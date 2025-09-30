/**
 * Accessibility utility functions for WCAG compliance and better UX
 * Provides helpers for ARIA attributes, focus management, and screen reader support
 */

/**
 * ARIA live region politeness levels
 */
export type AriaLivePoliteness = 'off' | 'polite' | 'assertive';

/**
 * ARIA expanded states
 */
export type AriaExpanded = 'true' | 'false' | undefined;

/**
 * ARIA pressed states
 */
export type AriaPressed = 'true' | 'false' | 'mixed' | undefined;

/**
 * Common ARIA role types
 */
export type AriaRole =
  | 'button'
  | 'link'
  | 'tab'
  | 'tabpanel'
  | 'dialog'
  | 'alertdialog'
  | 'menu'
  | 'menuitem'
  | 'listbox'
  | 'option'
  | 'combobox'
  | 'grid'
  | 'gridcell'
  | 'status'
  | 'alert'
  | 'region'
  | 'navigation'
  | 'main'
  | 'banner'
  | 'contentinfo';

/**
 * Generate a unique ID for accessibility purposes
 * Useful for aria-labelledby, aria-describedby, etc.
 *
 * @param prefix - Optional prefix for the ID
 * @returns Unique ID string
 */
export function generateAccessibilityId(prefix = 'a11y'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Create ARIA label attributes for better screen reader support
 *
 * @param label - The accessible label text
 * @param description - Optional description for aria-describedby
 * @returns Object with aria-label and optionally aria-describedby
 */
export function createAriaLabel(
  label: string,
  description?: string
): {
  'aria-label': string;
  'aria-describedby'?: string;
} {
  const result: { 'aria-label': string; 'aria-describedby'?: string } = {
    'aria-label': label
  };

  if (description) {
    const descriptionId = generateAccessibilityId('desc');
    result['aria-describedby'] = descriptionId;
  }

  return result;
}

/**
 * Create ARIA attributes for expandable elements (dropdowns, accordions, etc.)
 *
 * @param isExpanded - Whether the element is expanded
 * @param controlsId - ID of the element being controlled
 * @returns Object with appropriate ARIA attributes
 */
export function createAriaExpandable(
  isExpanded: boolean,
  controlsId?: string
): {
  'aria-expanded': AriaExpanded;
  'aria-controls'?: string;
} {
  const result: { 'aria-expanded': AriaExpanded; 'aria-controls'?: string } = {
    'aria-expanded': isExpanded ? 'true' : 'false'
  };

  if (controlsId) {
    result['aria-controls'] = controlsId;
  }

  return result;
}

/**
 * Create ARIA attributes for pressed/toggled elements (buttons, switches, etc.)
 *
 * @param isPressed - Whether the element is pressed/active
 * @param isMixed - Whether the element is in a mixed state (for tri-state buttons)
 * @returns Object with aria-pressed attribute
 */
export function createAriaPressed(
  isPressed: boolean,
  isMixed = false
): {
  'aria-pressed': AriaPressed;
} {
  return {
    'aria-pressed': isMixed ? 'mixed' : isPressed ? 'true' : 'false'
  };
}

/**
 * Create ARIA attributes for form validation
 *
 * @param isInvalid - Whether the field has validation errors
 * @param errorId - ID of the error message element
 * @param isRequired - Whether the field is required
 * @returns Object with appropriate ARIA attributes
 */
export function createAriaValidation(
  isInvalid: boolean,
  errorId?: string,
  isRequired = false
): {
  'aria-invalid': 'true' | 'false';
  'aria-describedby'?: string;
  'aria-required'?: 'true';
} {
  const result: {
    'aria-invalid': 'true' | 'false';
    'aria-describedby'?: string;
    'aria-required'?: 'true';
  } = {
    'aria-invalid': isInvalid ? 'true' : 'false'
  };

  if (isInvalid && errorId) {
    result['aria-describedby'] = errorId;
  }

  if (isRequired) {
    result['aria-required'] = 'true';
  }

  return result;
}

/**
 * Create ARIA live region for dynamic content announcements
 *
 * @param politeness - How urgently the screen reader should announce changes
 * @param atomic - Whether to read the entire region or just changes
 * @returns Object with ARIA live region attributes
 */
export function createAriaLiveRegion(
  politeness: AriaLivePoliteness = 'polite',
  atomic = false
): {
  'aria-live': AriaLivePoliteness;
  'aria-atomic': 'true' | 'false';
} {
  return {
    'aria-live': politeness,
    'aria-atomic': atomic ? 'true' : 'false'
  };
}

/**
 * Create ARIA attributes for modal dialogs
 *
 * @param titleId - ID of the dialog title element
 * @param descriptionId - Optional ID of the dialog description
 * @param isModal - Whether the dialog is modal (blocks interaction with other elements)
 * @returns Object with dialog ARIA attributes
 */
export function createAriaDialog(
  titleId: string,
  descriptionId?: string,
  isModal = true
): {
  role: 'dialog' | 'alertdialog';
  'aria-labelledby': string;
  'aria-describedby'?: string;
  'aria-modal': 'true' | 'false';
} {
  const result: {
    role: 'dialog' | 'alertdialog';
    'aria-labelledby': string;
    'aria-describedby'?: string;
    'aria-modal': 'true' | 'false';
  } = {
    role: 'dialog',
    'aria-labelledby': titleId,
    'aria-modal': isModal ? 'true' : 'false'
  };

  if (descriptionId) {
    result['aria-describedby'] = descriptionId;
  }

  return result;
}

/**
 * Announce text to screen readers using a temporary live region
 * Useful for dynamic status updates and notifications
 *
 * @param message - Text to announce
 * @param politeness - Urgency level for the announcement
 * @param timeout - How long to keep the announcement (ms)
 */
export function announceToScreenReader(
  message: string,
  politeness: AriaLivePoliteness = 'polite',
  timeout = 1000
): void {
  if (typeof document === 'undefined') return;

  // Create temporary live region
  const liveRegion = document.createElement('div');
  const { 'aria-live': ariaLive, 'aria-atomic': ariaAtomic } = createAriaLiveRegion(politeness, true);

  liveRegion.setAttribute('aria-live', ariaLive);
  liveRegion.setAttribute('aria-atomic', ariaAtomic);
  liveRegion.style.position = 'absolute';
  liveRegion.style.left = '-10000px';
  liveRegion.style.width = '1px';
  liveRegion.style.height = '1px';
  liveRegion.style.overflow = 'hidden';

  // Add to DOM and announce
  document.body.appendChild(liveRegion);
  liveRegion.textContent = message;

  // Clean up after timeout
  setTimeout(() => {
    if (document.body.contains(liveRegion)) {
      document.body.removeChild(liveRegion);
    }
  }, timeout);
}

/**
 * Check if an element is visible to screen readers
 * Considers aria-hidden, display, visibility, and opacity
 *
 * @param element - Element to check
 * @returns Whether the element is accessible to screen readers
 */
export function isAccessible(element: HTMLElement): boolean {
  if (!element) return false;

  // Check aria-hidden
  if (element.getAttribute('aria-hidden') === 'true') return false;

  // Check computed styles
  const styles = window.getComputedStyle(element);
  if (
    styles.display === 'none' ||
    styles.visibility === 'hidden' ||
    styles.opacity === '0'
  ) {
    return false;
  }

  // Check if element is in viewport (basic check)
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * Set focus to an element with fallback and error handling
 * Ensures focus is properly managed for accessibility
 *
 * @param element - Element to focus, selector string, or null
 * @param preventScroll - Whether to prevent scrolling to the element
 * @returns Whether focus was successfully set
 */
export function setAccessibleFocus(
  element: HTMLElement | string | null,
  preventScroll = false
): boolean {
  if (!element) return false;

  try {
    const targetElement = typeof element === 'string'
      ? document.querySelector(element) as HTMLElement
      : element;

    if (!targetElement || !isAccessible(targetElement)) return false;

    targetElement.focus({ preventScroll });
    return document.activeElement === targetElement;
  } catch (error) {
    console.warn('Failed to set accessible focus:', error);
    return false;
  }
}

/**
 * Create a focus trap for modal dialogs and overlays
 * Ensures keyboard users can't tab outside the modal
 *
 * @param container - Container element to trap focus within
 * @returns Function to remove the focus trap
 */
export function createFocusTrap(container: HTMLElement): () => void {
  if (!container) return () => {};

  const focusableSelectors = [
    'button:not([disabled])',
    'input:not([disabled])',
    'textarea:not([disabled])',
    'select:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
    '[role="button"]:not([disabled])'
  ].join(', ');

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') return;

    const focusableElements = container.querySelectorAll(focusableSelectors);
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    if (!firstElement || !lastElement) return;

    if (event.shiftKey) {
      // Shift + Tab: moving backwards
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab: moving forwards
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  };

  // Add event listener
  container.addEventListener('keydown', handleKeyDown);

  // Focus first element
  const firstFocusable = container.querySelector(focusableSelectors) as HTMLElement;
  if (firstFocusable) {
    setAccessibleFocus(firstFocusable);
  }

  // Return cleanup function
  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Check if touch targets meet minimum size requirements (44px)
 * Helps ensure mobile accessibility compliance
 *
 * @param element - Element to check
 * @returns Whether the element meets touch target size requirements
 */
export function meetsTouchTargetSize(element: HTMLElement): boolean {
  if (!element) return false;

  const rect = element.getBoundingClientRect();
  const minSize = 44; // WCAG minimum touch target size

  return rect.width >= minSize && rect.height >= minSize;
}

/**
 * Create skip link for keyboard navigation
 * Allows keyboard users to skip repetitive content
 *
 * @param targetId - ID of the target element to skip to
 * @param text - Text for the skip link
 * @returns Skip link element
 */
export function createSkipLink(targetId: string, text = 'メインコンテンツへスキップ'): HTMLElement {
  const skipLink = document.createElement('a');
  skipLink.href = `#${targetId}`;
  skipLink.textContent = text;
  skipLink.className = 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded';

  return skipLink;
}