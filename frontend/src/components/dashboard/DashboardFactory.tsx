'use client';

import { ComponentType, useEffect, useState, useRef } from 'react';
import AdminDashboard from './admin/AdminDashboard';
import SupervisorDashboard from './supervisor/SupervisorDashboard';
import EmployeeDashboard from './employee/EmployeeDashboard';
import { getAdminDashboardDataAction } from '@/api/server-actions/admin-dashboard';
import { getSupervisorDashboardDataAction } from '@/api/server-actions/supervisor-dashboard';
import { getEmployeeDashboardDataAction } from '@/api/server-actions/employee-dashboard';
import type { AdminDashboardData, SupervisorDashboardData, EmployeeDashboardData } from '@/api/types';

export type DashboardRole = 'admin' | 'supervisor' | 'employee';

export interface DashboardFactoryProps {
  /** Current active role */
  role: DashboardRole;
  /** Organization ID/slug for API requests */
  organizationId?: string;
  /** Additional props to pass to the dashboard component */
  dashboardProps?: Record<string, any>;
  /** Initial dashboard data (pre-fetched server-side or cached) */
  initialData?: any;
  /** Callback to fetch data on-demand (used for lazy loading when parallel rendering) */
  onFetchData?: (role: DashboardRole) => Promise<any>;
  /** Whether parallel rendering is enabled (skips auto-fetch in useEffect) */
  enableParallelRendering?: boolean;
}

/**
 * DashboardFactory - Factory component that returns the appropriate dashboard based on role
 *
 * This component:
 * - Uses pre-fetched server-side data when available (optimal for initial load)
 * - Falls back to client-side server actions for role switching
 * - Maps role string to appropriate dashboard component
 * - Passes through common props to all dashboards
 * - Provides type-safe role-to-component mapping
 * - Handles loading and error states
 *
 * Usage:
 * <DashboardFactory
 *   role="admin"
 *   initialData={serverFetchedData}
 *   dashboardProps={{ onRefresh: handleRefresh }}
 * />
 */
export default function DashboardFactory({
  role,
  organizationId,
  dashboardProps = {},
  initialData,
  onFetchData,
  enableParallelRendering = false
}: DashboardFactoryProps) {
  const [data, setData] = useState<AdminDashboardData | SupervisorDashboardData | EmployeeDashboardData | null>(initialData || null);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track if we've already loaded data for the current role to prevent infinite loops
  const hasLoadedRef = useRef(false);
  const currentRoleRef = useRef(role);
  const initialDataRef = useRef(initialData);

  // Fetch dashboard data based on role using server actions
  // CRITICAL FIX: Detect when initialData changes to use cache
  useEffect(() => {
    // CRITICAL: Detect when initialData actually changes (new cache data)
    // This allows instant tab switching with cached data
    if (initialData && initialData !== initialDataRef.current) {
      initialDataRef.current = initialData;
      setData(initialData);
      setIsLoading(false);
      hasLoadedRef.current = true;
      return; // Use cached data immediately
    }

    // Reset loaded state when role changes
    if (currentRoleRef.current !== role) {
      hasLoadedRef.current = false;
      currentRoleRef.current = role;
      initialDataRef.current = null;
    }

    // If we have initial data and haven't loaded yet, use it
    if (initialData && !hasLoadedRef.current) {
      initialDataRef.current = initialData;
      setData(initialData);
      setIsLoading(false);
      hasLoadedRef.current = true;
      return; // Don't fetch - we have fresh data from parent
    }

    // Skip if we've already loaded for this role
    if (hasLoadedRef.current) {
      return;
    }

    let isMounted = true;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        let result;

        // Use onFetchData callback if available (enables caching via parent)
        if (onFetchData) {
          result = await onFetchData(role);

          if (!isMounted) return;

          if (result) {
            setData(result);
            hasLoadedRef.current = true;
          } else {
            // Only set error if we don't have any data to show
            if (!data) {
              setError('ダッシュボードデータの取得に失敗しました');
            }
          }
        } else {
          // Fall back to direct fetching if no callback provided
          if (role === 'admin') {
            result = await getAdminDashboardDataAction();
          } else if (role === 'supervisor') {
            result = await getSupervisorDashboardDataAction();
          } else if (role === 'employee') {
            result = await getEmployeeDashboardDataAction();
          }

          if (!isMounted) return;

          if (result?.success && result.data) {
            setData(result.data);
            hasLoadedRef.current = true;
          } else {
            // Only set error if we don't have any data to show
            if (!data) {
              setError(result?.error || result?.errorMessage || 'ダッシュボードデータの取得に失敗しました');
            }
          }
        }
      } catch (err) {
        if (!isMounted) return;
        // Only set error if we don't have any data to show
        if (!data) {
          setError(err instanceof Error ? err.message : 'データの取得中に予期しないエラーが発生しました');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [role, organizationId, initialData]); // CRITICAL: Added initialData back to detect cache changes

  // Role to component mapping
  const dashboardComponents: Record<DashboardRole, ComponentType<any>> = {
    admin: AdminDashboard,
    supervisor: SupervisorDashboard,
    employee: EmployeeDashboard
  };

  const DashboardComponent = dashboardComponents[role];

  if (!DashboardComponent) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-muted-foreground">
            指定されたロール「{role}」のダッシュボードが見つかりません
          </p>
        </div>
      </div>
    );
  }

  // Refresh function using server actions
  const handleRefresh = async () => {
    setIsLoading(true);
    setError(null);

    try {
      let result;

      if (role === 'admin') {
        result = await getAdminDashboardDataAction();
      } else if (role === 'supervisor') {
        result = await getSupervisorDashboardDataAction();
      } else if (role === 'employee') {
        result = await getEmployeeDashboardDataAction();
      }

      if (result?.success && result.data) {
        setData(result.data);
      } else {
        setError(result?.error || result?.errorMessage || 'データの更新に失敗しました');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新中に予期しないエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  // Don't render dashboard component until we have data or confirmed error
  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">ダッシュボードを読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Subtle refreshing indicator - doesn't block UI */}
      {isRefreshing && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-2 bg-background/95 backdrop-blur-sm px-3 py-1.5 rounded-full border shadow-sm">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
          <span className="text-xs text-muted-foreground">更新中</span>
        </div>
      )}

      <DashboardComponent
        {...dashboardProps}
        role={role}
        initialData={data}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        error={error}
        onRefresh={handleRefresh}
      />
    </div>
  );
}

/**
 * Get dashboard component for a given role without rendering
 * Useful for lazy loading or preloading
 */
export function getDashboardComponent(role: DashboardRole): ComponentType<any> | null {
  const dashboardComponents: Record<DashboardRole, ComponentType<any>> = {
    admin: AdminDashboard,
    supervisor: SupervisorDashboard,
    employee: EmployeeDashboard
  };

  return dashboardComponents[role] || null;
}

/**
 * Check if a role has a dashboard component
 */
export function hasDashboardForRole(role: string): role is DashboardRole {
  return ['admin', 'supervisor', 'employee'].includes(role);
}
