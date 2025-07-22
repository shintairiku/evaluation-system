/**
 * Optimistic update utilities for common patterns
 * Provides helper functions for typical optimistic update scenarios
 */

export type OptimisticAction<T> = 
  | { type: 'ADD'; payload: T }
  | { type: 'UPDATE'; payload: { id: string | number; updates: Partial<T> } }
  | { type: 'REMOVE'; payload: { id: string | number } }
  | { type: 'SET'; payload: T[] }
  | { type: 'RESET'; payload?: T[] };

/**
 * Reducer for managing optimistic list operations
 */
export function optimisticListReducer<T extends { id: string | number }>(
  state: T[],
  action: OptimisticAction<T>
): T[] {
  switch (action.type) {
    case 'ADD':
      return [...state, action.payload];
    
    case 'UPDATE':
      return state.map(item =>
        item.id === action.payload.id
          ? { ...item, ...action.payload.updates }
          : item
      );
    
    case 'REMOVE':
      return state.filter(item => item.id !== action.payload.id);
    
    case 'SET':
      return action.payload;
    
    case 'RESET':
      return action.payload || [];
    
    default:
      return state;
  }
}

/**
 * Creates optimistic update functions for form submissions
 */
export function createOptimisticFormHelpers<TFormData, TResult = any>() {
  return {
    // Immediately update UI state for form fields
    updateFormField: <K extends keyof TFormData>(
      currentData: TFormData,
      field: K,
      value: TFormData[K]
    ): TFormData => ({
      ...currentData,
      [field]: value
    }),

    // Create optimistic success state
    createOptimisticSuccess: (
      formData: TFormData,
      successState?: Partial<TResult>
    ): TResult => ({
      success: true,
      data: formData,
      timestamp: new Date().toISOString(),
      ...successState
    } as TResult),

    // Create optimistic loading state
    createOptimisticLoading: (formData: TFormData): TResult => ({
      loading: true,
      data: formData,
      timestamp: new Date().toISOString(),
    } as TResult),

    // Validate optimistic update can proceed
    canOptimisticUpdate: (formData: TFormData, requiredFields: (keyof TFormData)[]): boolean => {
      return requiredFields.every(field => {
        const value = formData[field];
        return value !== undefined && value !== null && value !== '';
      });
    }
  };
}

/**
 * Creates optimistic navigation helpers for smooth transitions
 */
export function createOptimisticNavigation() {
  return {
    // Preload route optimistically
    optimisticNavigate: (
      router: { push: (path: string) => void },
      path: string,
      condition: () => boolean = () => true
    ) => {
      if (condition()) {
        // Navigate immediately for optimistic UX
        router.push(path);
        return true;
      }
      return false;
    },

    // Create loading state for navigation
    createNavigationState: (isNavigating: boolean, destination?: string) => ({
      isNavigating,
      destination,
      startTime: isNavigating ? Date.now() : null
    })
  };
}

/**
 * Debounced optimistic update for real-time operations like search
 */
export function createOptimisticDebounce<T>(
  updateFn: (value: T) => void,
  delay: number = 300
) {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastOptimisticValue: T | undefined;

  return {
    // Apply optimistic update immediately with debounced API call
    update: (value: T, apiCall?: () => Promise<any>) => {
      // Clear existing timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Update UI immediately
      lastOptimisticValue = value;
      updateFn(value);

      // Debounce the API call
      if (apiCall) {
        timeoutId = setTimeout(async () => {
          try {
            await apiCall();
            // API succeeded, keep optimistic state
          } catch (error) {
            // API failed, could trigger rollback here if needed
            console.warn('Debounced optimistic update failed:', error);
          }
        }, delay);
      }
    },

    // Cancel pending updates
    cancel: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    },

    // Get last optimistic value
    getLastValue: () => lastOptimisticValue,

    // Clear state
    clear: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      lastOptimisticValue = undefined;
    }
  };
}

/**
 * Creates optimistic validation helpers for forms
 */
export function createOptimisticValidation<TFormData>(
  validationRules: Record<keyof TFormData, (value: any) => string | null>
) {
  return {
    // Validate single field optimistically
    validateField: (field: keyof TFormData, value: any): string | null => {
      const validator = validationRules[field];
      return validator ? validator(value) : null;
    },

    // Validate entire form optimistically
    validateForm: (formData: TFormData): Record<keyof TFormData, string | null> => {
      const errors = {} as Record<keyof TFormData, string | null>;
      
      Object.keys(validationRules).forEach((field) => {
        const key = field as keyof TFormData;
        errors[key] = validationRules[key](formData[key]);
      });

      return errors;
    },

    // Check if form can be submitted optimistically
    canSubmitOptimistically: (formData: TFormData): boolean => {
      return Object.keys(validationRules).every((field) => {
        const key = field as keyof TFormData;
        const error = validationRules[key](formData[key]);
        return error === null;
      });
    }
  };
}

/**
 * Error boundary helper for optimistic updates
 */
export class OptimisticUpdateError extends Error {
  constructor(
    message: string,
    public readonly originalError: Error,
    public readonly rollbackData?: any
  ) {
    super(message);
    this.name = 'OptimisticUpdateError';
  }
}

/**
 * Creates a safe wrapper for optimistic operations
 */
export function withOptimisticErrorBoundary<T extends any[], R>(
  operation: (...args: T) => Promise<R>,
  fallback: (...args: T) => R
) {
  return async (...args: T): Promise<R> => {
    try {
      return await operation(...args);
    } catch (error) {
      console.error('Optimistic operation failed, falling back:', error);
      return fallback(...args);
    }
  };
}

/**
 * Utility for managing optimistic UI states
 */
export interface OptimisticUIState {
  isOptimistic: boolean;
  isPending: boolean;
  hasError: boolean;
  errorMessage?: string;
  successMessage?: string;
}

export function createOptimisticUIState(): OptimisticUIState {
  return {
    isOptimistic: false,
    isPending: false,
    hasError: false
  };
}

export function updateOptimisticUIState(
  current: OptimisticUIState,
  update: Partial<OptimisticUIState>
): OptimisticUIState {
  return {
    ...current,
    ...update
  };
}

/**
 * Conflict resolution for concurrent optimistic updates
 */
export function resolveOptimisticConflict<T>(
  optimisticValue: T,
  serverValue: T,
  resolver: (optimistic: T, server: T) => T = (_, server) => server
): T {
  return resolver(optimisticValue, serverValue);
}

/**
 * Timestamps for optimistic update tracking
 */
export interface OptimisticTimestamp {
  created: number;
  lastUpdated: number;
  serverConfirmed?: number;
}

export function createOptimisticTimestamp(): OptimisticTimestamp {
  const now = Date.now();
  return {
    created: now,
    lastUpdated: now
  };
}

export function updateOptimisticTimestamp(
  timestamp: OptimisticTimestamp,
  serverConfirmed: boolean = false
): OptimisticTimestamp {
  return {
    ...timestamp,
    lastUpdated: Date.now(),
    ...(serverConfirmed && { serverConfirmed: Date.now() })
  };
}