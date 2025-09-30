import { useState, useEffect } from 'react';

/**
 * Breakpoint names matching Tailwind CSS breakpoints
 */
export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

/**
 * Breakpoint configuration with pixel values
 */
export const BREAKPOINTS = {
  xs: 0,      // Extra small devices (portrait phones)
  sm: 640,    // Small devices (landscape phones)
  md: 768,    // Medium devices (tablets)
  lg: 1024,   // Large devices (desktops)
  xl: 1280,   // Extra large devices (large desktops)
  '2xl': 1536 // 2X large devices (larger desktops)
} as const;

/**
 * Device type classification for responsive design
 */
export type DeviceType = 'mobile' | 'tablet' | 'desktop';

/**
 * Return type for useResponsiveBreakpoint hook
 */
interface UseResponsiveBreakpointReturn {
  /** Current screen width in pixels */
  width: number;
  /** Current screen height in pixels */
  height: number;
  /** Current breakpoint name */
  breakpoint: Breakpoint;
  /** Device type classification */
  deviceType: DeviceType;
  /** Check if current screen is at or above a breakpoint */
  isAbove: (bp: Breakpoint) => boolean;
  /** Check if current screen is below a breakpoint */
  isBelow: (bp: Breakpoint) => boolean;
  /** Check if current screen matches exactly a breakpoint */
  isExactly: (bp: Breakpoint) => boolean;
  /** Check if device is mobile (≤767px) */
  isMobile: boolean;
  /** Check if device is tablet (768-1023px) */
  isTablet: boolean;
  /** Check if device is desktop (≥1024px) */
  isDesktop: boolean;
  /** Check if device supports touch */
  isTouchDevice: boolean;
  /** Check if user prefers reduced motion */
  prefersReducedMotion: boolean;
}

/**
 * Get current breakpoint based on width
 */
function getBreakpoint(width: number): Breakpoint {
  if (width >= BREAKPOINTS['2xl']) return '2xl';
  if (width >= BREAKPOINTS.xl) return 'xl';
  if (width >= BREAKPOINTS.lg) return 'lg';
  if (width >= BREAKPOINTS.md) return 'md';
  if (width >= BREAKPOINTS.sm) return 'sm';
  return 'xs';
}

/**
 * Get device type based on width
 */
function getDeviceType(width: number): DeviceType {
  if (width < 768) return 'mobile';    // < md breakpoint
  if (width < 1024) return 'tablet';   // md to lg breakpoint
  return 'desktop';                    // >= lg breakpoint
}

/**
 * Check if device supports touch
 */
function checkTouchSupport(): boolean {
  if (typeof window === 'undefined') return false;

  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-ignore - Legacy check
    navigator.msMaxTouchPoints > 0
  );
}

/**
 * Check if user prefers reduced motion
 */
function checkReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Custom hook for responsive breakpoint detection and device classification
 * Provides comprehensive responsive design utilities with performance optimization
 *
 * @returns Object containing breakpoint information and utility functions
 */
export function useResponsiveBreakpoint(): UseResponsiveBreakpointReturn {
  const [dimensions, setDimensions] = useState(() => {
    if (typeof window === 'undefined') {
      return { width: 1024, height: 768 }; // Default for SSR
    }
    return {
      width: window.innerWidth,
      height: window.innerHeight
    };
  });

  const [isTouchDevice, setIsTouchDevice] = useState(() => checkTouchSupport());
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => checkReducedMotion());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let timeoutId: NodeJS.Timeout;

    /**
     * Debounced resize handler for performance
     */
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setDimensions({
          width: window.innerWidth,
          height: window.innerHeight
        });
      }, 100); // 100ms debounce
    };

    /**
     * Handle media query changes for reduced motion
     */
    const handleReducedMotionChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    // Set up event listeners
    window.addEventListener('resize', handleResize, { passive: true });

    // Set up media query listener for reduced motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    mediaQuery.addEventListener('change', handleReducedMotionChange);

    // Update touch device detection on mount (can change on device rotation)
    setIsTouchDevice(checkTouchSupport());
    setPrefersReducedMotion(checkReducedMotion());

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
      mediaQuery.removeEventListener('change', handleReducedMotionChange);
    };
  }, []);

  const { width, height } = dimensions;
  const breakpoint = getBreakpoint(width);
  const deviceType = getDeviceType(width);

  /**
   * Utility functions
   */
  const isAbove = (bp: Breakpoint): boolean => {
    return width >= BREAKPOINTS[bp];
  };

  const isBelow = (bp: Breakpoint): boolean => {
    return width < BREAKPOINTS[bp];
  };

  const isExactly = (bp: Breakpoint): boolean => {
    return breakpoint === bp;
  };

  const isMobile = deviceType === 'mobile';
  const isTablet = deviceType === 'tablet';
  const isDesktop = deviceType === 'desktop';

  return {
    width,
    height,
    breakpoint,
    deviceType,
    isAbove,
    isBelow,
    isExactly,
    isMobile,
    isTablet,
    isDesktop,
    isTouchDevice,
    prefersReducedMotion
  };
}

/**
 * Hook for checking a specific breakpoint
 * Useful for conditional rendering based on screen size
 *
 * @param breakpoint - The breakpoint to check against
 * @returns Boolean indicating if current screen is at or above the breakpoint
 */
export function useBreakpoint(breakpoint: Breakpoint): boolean {
  const { isAbove } = useResponsiveBreakpoint();
  return isAbove(breakpoint);
}

/**
 * Hook for checking device type
 * Useful for device-specific logic
 *
 * @returns Current device type
 */
export function useDeviceType(): DeviceType {
  const { deviceType } = useResponsiveBreakpoint();
  return deviceType;
}

/**
 * Hook for checking if device is mobile
 * Commonly used utility for mobile-specific features
 *
 * @returns Boolean indicating if device is mobile
 */
export function useIsMobile(): boolean {
  const { isMobile } = useResponsiveBreakpoint();
  return isMobile;
}