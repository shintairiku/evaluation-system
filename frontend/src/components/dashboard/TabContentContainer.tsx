'use client';

import { Suspense, ComponentType, ReactNode, useState, useEffect, useCallback, useRef } from 'react';
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
  /** Enable parallel rendering (all tabs rendered simultaneously) - DEFAULT TRUE */
  enableParallelRendering?: boolean;
  /** Unmount inactive tabs after this duration (ms, default: 5 minutes) */
  unmountInactiveAfter?: number;
}

interface RoleVisibility {
  [role: string]: {
    rendered: boolean;
    lastActive: number;
  };
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

/**
 * TabContentContainer component with parallel rendering support
 *
 * NEW ARCHITECTURE:
 * - Renders ALL role dashboards simultaneously (hidden via CSS)
 * - Uses display: none for inactive tabs (instant switching)
 * - Intelligently unmounts inactive tabs after timeout
 * - Zero latency tab switching for better UX
 *
 * This component:
 * - Supports both parallel and sequential rendering modes
 * - Manages visibility state for instant tab switching
 * - Provides error boundaries for each tab
 * - Handles lifecycle management efficiently
 *
 * Usage:
 * <TabContentContainer
 *   activeRole={activeRole}
 *   roleComponents={{
 *     admin: AdminDashboardServer,
 *     supervisor: SupervisorDashboardServer,
 *     employee: EmployeeDashboardServer
 *   }}
 *   enableParallelRendering={true}
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
  className = '',
  enableParallelRendering = true, // DEFAULT TRUE for instant switching
  unmountInactiveAfter = 5 * 60 * 1000 // 5 minutes
}: TabContentContainerProps) {
  const [errors, setErrors] = useState<Record<string, Error>>({});
  const [retryKey, setRetryKey] = useState(0);
  const [roleVisibility, setRoleVisibility] = useState<RoleVisibility>({});
  const cleanupTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize visibility state for all roles
  useEffect(() => {
    if (enableParallelRendering) {
      const initialVisibility: RoleVisibility = {};
      Object.keys(roleComponents).forEach(role => {
        initialVisibility[role] = {
          rendered: true, // CRITICAL FIX: Render ALL tabs for instant switching (hidden with display:none)
          lastActive: role === activeRole ? Date.now() : 0
        };
      });
      setRoleVisibility(initialVisibility);
    }
  }, [enableParallelRendering, roleComponents, activeRole]);

  // Update last active timestamp when role changes
  useEffect(() => {
    if (enableParallelRendering) {
      setRoleVisibility(prev => ({
        ...prev,
        [activeRole]: {
          rendered: true,
          lastActive: Date.now()
        }
      }));

      // Clear any existing cleanup timer
      if (cleanupTimerRef.current) {
        clearTimeout(cleanupTimerRef.current);
      }

      // Schedule cleanup of inactive tabs
      if (unmountInactiveAfter > 0) {
        cleanupTimerRef.current = setTimeout(() => {
          const now = Date.now();
          setRoleVisibility(prev => {
            const updated = { ...prev };
            Object.keys(updated).forEach(role => {
              if (role !== activeRole && updated[role].rendered) {
                const timeSinceActive = now - updated[role].lastActive;
                if (timeSinceActive > unmountInactiveAfter) {
                  updated[role] = { ...updated[role], rendered: false };
                }
              }
            });
            return updated;
          });
        }, unmountInactiveAfter);
      }
    }

    return () => {
      if (cleanupTimerRef.current) {
        clearTimeout(cleanupTimerRef.current);
      }
    };
  }, [activeRole, enableParallelRendering, unmountInactiveAfter]);

  // Clear error when active role changes
  useEffect(() => {
    setErrors(prev => {
      const updated = { ...prev };
      delete updated[activeRole];
      return updated;
    });
  }, [activeRole]);

  // Handle retry action
  const handleRetry = useCallback((role: string) => {
    setErrors(prev => {
      const updated = { ...prev };
      delete updated[role];
      return updated;
    });
    setRetryKey(prev => prev + 1);
  }, []);

  // Error boundary wrapper for each role
  const RoleErrorBoundary = ({ role, children }: { role: string; children: ReactNode }) => {
    useEffect(() => {
      const handleError = (event: ErrorEvent) => {
        setErrors(prev => ({
          ...prev,
          [role]: new Error(event.message || 'Unknown error occurred')
        }));
      };

      window.addEventListener('error', handleError);
      return () => window.removeEventListener('error', handleError);
    }, [role]);

    return <>{children}</>;
  };

  // PARALLEL RENDERING MODE: Render all tabs simultaneously
  if (enableParallelRendering) {
    return (
      <div className={`w-full ${className}`} key={retryKey}>
        {Object.entries(roleComponents).map(([role, Component]) => {
          const isActive = role === activeRole;
          const shouldRender = roleVisibility[role]?.rendered ?? isActive;
          const hasError = !!errors[role];

          // Don't render if not needed
          if (!shouldRender) {
            return null;
          }

          return (
            <div
              key={role}
              className="w-full"
              style={{
                display: isActive ? 'block' : 'none'
              }}
              aria-hidden={!isActive}
            >
              {hasError ? (
                <ErrorFallback
                  error={errors[role]}
                  retry={() => handleRetry(role)}
                />
              ) : (
                <RoleErrorBoundary role={role}>
                  <Suspense fallback={loadingComponent}>
                    <Component
                      {...componentProps}
                      role={role}
                      initialData={componentProps.dashboardCache?.[role]}
                    />
                  </Suspense>
                </RoleErrorBoundary>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // SEQUENTIAL RENDERING MODE (Legacy): Only render active tab
  const ActiveComponent = roleComponents[activeRole];

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

  const hasError = !!errors[activeRole];

  return (
    <div className={`w-full ${className}`} key={`${activeRole}-${retryKey}`}>
      {hasError ? (
        <ErrorFallback
          error={errors[activeRole]}
          retry={() => handleRetry(activeRole)}
        />
      ) : (
        <RoleErrorBoundary role={activeRole}>
          <Suspense fallback={loadingComponent}>
            <ActiveComponent {...componentProps} role={activeRole} />
          </Suspense>
        </RoleErrorBoundary>
      )}
    </div>
  );
}

/**
 * Get rendering statistics for debugging
 */
export function getTabRenderingStats(container: HTMLElement) {
  const tabs = container.querySelectorAll('[aria-hidden]');
  return {
    totalTabs: tabs.length,
    visibleTabs: Array.from(tabs).filter(t => t.getAttribute('aria-hidden') === 'false').length,
    hiddenTabs: Array.from(tabs).filter(t => t.getAttribute('aria-hidden') === 'true').length
  };
}
