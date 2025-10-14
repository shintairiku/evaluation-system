'use client';

import { Suspense, lazy, ComponentType, ReactNode, useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface TabContentContainerProps {
  /** Current active role */
  activeRole: string;
  /** Content components for each role */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  roleComponents: Record<string, ComponentType<any>>;
  /** Props to pass to the active role component */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  componentProps?: Record<string, any>;
  /** Custom loading component */
  loadingComponent?: ReactNode;
  /** Custom error boundary fallback */
  errorFallback?: ComponentType<{ error: Error; retry: () => void }>;
  /** Cache timeout in milliseconds (default: 5 minutes) */
  cacheTimeout?: number;
  /** Disable caching for dynamic content */
  disableCache?: boolean;
  /** Custom container styling */
  className?: string;
}

interface CacheEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<any>;
  timestamp: number;
}

// Default loading component
const DefaultLoadingComponent = () => (
  <div className="flex flex-col items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
    <p className="text-sm text-muted-foreground">ダッシュボードを読み込み中...</p>
  </div>
);

// Default error fallback component
const DefaultErrorFallback = ({ error, retry }: { error: Error; retry: () => void }) => (
  <Alert variant="destructive" className="m-4">
    <AlertTriangle className="h-4 w-4" />
    <AlertDescription className="flex flex-col gap-2">
      <span>ダッシュボードの読み込みに失敗しました</span>
      <span className="text-xs opacity-80">{error.message}</span>
      <Button variant="outline" size="sm" onClick={retry} className="w-fit">
        <RefreshCw className="w-4 h-4 mr-2" />
        再試行
      </Button>
    </AlertDescription>
  </Alert>
);

// Component cache for lazy-loaded components
const componentCache = new Map<string, CacheEntry>();

/**
 * TabContentContainer component for managing dashboard tab content with lazy loading
 *
 * This component:
 * - Lazy loads dashboard components only when needed
 * - Caches loaded components for performance
 * - Provides error boundaries for each tab
 * - Supports custom loading and error states
 * - Manages component lifecycle efficiently
 *
 * Usage:
 * <TabContentContainer
 *   activeRole={activeRole}
 *   roleComponents={{
 *     admin: AdminDashboard,
 *     supervisor: SupervisorDashboard,
 *     employee: EmployeeDashboard
 *   }}
 *   componentProps={{ userId: currentUser.id }}
 * />
 */
export default function TabContentContainer({
  activeRole,
  roleComponents,
  componentProps = {},
  loadingComponent = <DefaultLoadingComponent />,
  errorFallback: ErrorFallback = DefaultErrorFallback,
  cacheTimeout = 5 * 60 * 1000, // 5 minutes
  disableCache = false,
  className = ''
}: TabContentContainerProps) {
  const [error, setError] = useState<Error | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  // Clear error when active role changes
  useEffect(() => {
    setError(null);
  }, [activeRole]);

  // Get component for active role
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getActiveComponent = (): ComponentType<any> | null => {
    const componentFactory = roleComponents[activeRole];

    if (!componentFactory) {
      console.warn(`No component found for role: ${activeRole}`);
      return null;
    }

    // Check cache first
    if (!disableCache) {
      const cached = componentCache.get(activeRole);
      if (cached && Date.now() - cached.timestamp < cacheTimeout) {
        return cached.component;
      }
    }

    // Create new component instance
    const component = componentFactory;

    // Cache the component
    if (!disableCache) {
      componentCache.set(activeRole, {
        component,
        timestamp: Date.now()
      });
    }

    return component;
  };

  // Handle retry action
  const handleRetry = () => {
    setError(null);
    setRetryKey(prev => prev + 1);

    // Clear cache for current role
    if (componentCache.has(activeRole)) {
      componentCache.delete(activeRole);
    }
  };

  // Error boundary component
  const ErrorBoundary = ({ children }: { children: ReactNode }) => {
    useEffect(() => {
      const handleError = (event: ErrorEvent) => {
        setError(new Error(event.message || 'Unknown error occurred'));
      };

      window.addEventListener('error', handleError);
      return () => window.removeEventListener('error', handleError);
    }, []);

    return <>{children}</>;
  };

  // Show error state
  if (error) {
    return (
      <div className={className}>
        <ErrorFallback error={error} retry={handleRetry} />
      </div>
    );
  }

  const ActiveComponent = getActiveComponent();

  // Show not found message if no component
  if (!ActiveComponent) {
    return (
      <div className={`flex flex-col items-center justify-center p-8 ${className}`}>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            指定されたロール「{activeRole}」のダッシュボードが見つかりません
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`} key={`${activeRole}-${retryKey}`}>
      <ErrorBoundary>
        <Suspense fallback={loadingComponent}>
          <ActiveComponent {...componentProps} role={activeRole} />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}

/**
 * Clear component cache (useful for memory management or forced refresh)
 */
export function clearComponentCache(role?: string) {
  if (role) {
    componentCache.delete(role);
  } else {
    componentCache.clear();
  }
}

/**
 * Get cache statistics for debugging
 */
export function getCacheStats() {
  return {
    size: componentCache.size,
    entries: Array.from(componentCache.entries()).map(([role, entry]) => ({
      role,
      timestamp: entry.timestamp,
      age: Date.now() - entry.timestamp
    }))
  };
}

/**
 * Higher-order component for creating lazy-loaded dashboard components
 *
 * Usage:
 * export default withLazyDashboard(() => import('./AdminDashboard'));
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withLazyDashboard<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): ComponentType<any> {
  return lazy(importFn);
}

/**
 * Preload a dashboard component for better performance
 *
 * Usage:
 * preloadDashboard('admin', () => import('./AdminDashboard'));
 */
export function preloadDashboard(
  role: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  componentFactory: ComponentType<any>
) {
  if (!componentCache.has(role)) {
    componentCache.set(role, {
      component: componentFactory,
      timestamp: Date.now()
    });
  }
}