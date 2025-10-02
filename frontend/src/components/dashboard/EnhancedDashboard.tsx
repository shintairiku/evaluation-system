'use client';

import { useMemo, useState, useCallback, useRef } from 'react';
import type { AuthUserExistsResponse } from '@/api/types/auth';
import type { UserDetailResponse } from '@/api/types';
import { useTabState } from '@/hooks/useTabState';
import { getRoleHierarchyLevel } from '@/utils/hierarchy';
import RoleTabNavigation from './RoleTabNavigation';
import TabContentContainer from './TabContentContainer';
import DashboardFactory, { hasDashboardForRole, DashboardRole } from './DashboardFactory';
import PendingApprovalNotification from '@/components/display/PendingApprovalNotification';
import UserInfoCard from '@/components/display/UserInfoCard';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { DashboardErrorBoundary } from './DashboardErrorBoundary';
import { getAdminDashboardDataAction } from '@/api/server-actions/admin-dashboard';
import { getSupervisorDashboardDataAction } from '@/api/server-actions/supervisor-dashboard';
import { getEmployeeDashboardDataAction } from '@/api/server-actions/employee-dashboard';

export interface EnhancedDashboardProps {
  /** Authenticated user information */
  user: AuthUserExistsResponse;
  /** Full user details including roles (fetched server-side) */
  userDetail: UserDetailResponse | null;
  /** Initial dashboard data for user's primary role (fetched server-side) */
  initialDashboardData?: any;
  /** Role for which initial dashboard data was fetched */
  initialDashboardRole?: 'admin' | 'supervisor' | 'employee';
}

// Dashboard role mapping for tab labels
const DASHBOARD_ROLE_MAPPING: Record<string, string> = {
  'admin': '管理者視点',
  'supervisor': '上司視点',
  'employee': '従業員視点'
};

/**
 * EnhancedDashboard - Main multi-role dashboard component
 *
 * This component:
 * - Replaces the legacy WelcomeDashboard
 * - Provides role-based tab navigation
 * - Lazy loads dashboard components based on active role
 * - Handles URL synchronization for active tab
 * - Shows pending approval notifications
 * - Supports multi-role users with seamless switching
 *
 * Features:
 * - Admin Dashboard: System stats, pending approvals, alerts
 * - Supervisor Dashboard: Team progress, pending tasks, subordinates
 * - Employee Dashboard: Personal progress, todos, deadlines, history
 *
 * Usage:
 * <EnhancedDashboard user={userCheck} userDetail={userDetail} />
 */
export default function EnhancedDashboard({ user, userDetail, initialDashboardData, initialDashboardRole }: EnhancedDashboardProps) {
  // Dashboard data cache: stores fetched data per role to avoid re-fetching when switching tabs
  const [dashboardCache, setDashboardCache] = useState<Record<DashboardRole, any>>(() => {
    // Initialize cache with server-side pre-fetched data if available
    if (initialDashboardRole && initialDashboardData) {
      return { [initialDashboardRole]: initialDashboardData } as Record<DashboardRole, any>;
    }
    return {} as Record<DashboardRole, any>;
  });

  // Cache timestamp tracking for staleness detection (5-minute TTL)
  const [cacheTimestamps, setCacheTimestamps] = useState<Record<DashboardRole, number>>(() => {
    // Initialize timestamp for pre-fetched data
    if (initialDashboardRole && initialDashboardData) {
      return { [initialDashboardRole]: Date.now() } as Record<DashboardRole, number>;
    }
    return {} as Record<DashboardRole, number>;
  });

  // Track failed fetch attempts to prevent infinite retries
  const [fetchErrors, setFetchErrors] = useState<Record<DashboardRole, boolean>>({});

  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  // Track in-flight fetch requests to prevent duplicate concurrent fetches
  const inflightFetchesRef = useRef<Map<DashboardRole, Promise<any>>>(new Map());

  // Fetch dashboard data for a specific role (with caching and staleness check)
  // CRITICAL FIX: Only fetch if cache is missing or stale (>5 minutes old)
  const fetchDashboardData = useCallback(async (role: DashboardRole) => {
    // CRITICAL: Don't retry if this role has already failed
    if (fetchErrors[role]) {
      console.warn(`[Dashboard] Skipping fetch for ${role} - previous fetch failed`);
      return null;
    }

    // Check cache first
    const cachedData = dashboardCache[role];
    const cacheTimestamp = cacheTimestamps[role];
    const isCacheStale = !cacheTimestamp || (Date.now() - cacheTimestamp) > CACHE_TTL_MS;

    // Helper to fetch fresh data
    const fetchFreshData = async () => {
      let result;
      try {
        if (role === 'admin') {
          result = await getAdminDashboardDataAction();
        } else if (role === 'supervisor') {
          result = await getSupervisorDashboardDataAction();
        } else if (role === 'employee') {
          result = await getEmployeeDashboardDataAction();
        }

        if (result?.success && result.data) {
          // Clear any previous error state
          setFetchErrors(prev => {
            const updated = { ...prev };
            delete updated[role];
            return updated;
          });

          // Update cache with fresh data AND timestamp
          setDashboardCache(prev => ({
            ...prev,
            [role]: result.data
          }));
          setCacheTimestamps(prev => ({
            ...prev,
            [role]: Date.now()
          }));
          return result.data;
        } else {
          // Mark this role as failed to prevent retries
          console.error(`[Dashboard] Failed to fetch ${role} dashboard:`, result?.error || 'Unknown error');
          setFetchErrors(prev => ({
            ...prev,
            [role]: true
          }));
          return null;
        }
      } catch (error) {
        // Mark this role as failed to prevent retries
        console.error(`[Dashboard] Exception fetching ${role} dashboard:`, error);
        setFetchErrors(prev => ({
          ...prev,
          [role]: true
        }));
        return null;
      }
    };

    // If we have cached data and it's fresh (< 5 minutes old), return it immediately
    if (cachedData && !isCacheStale) {
      return cachedData;
    }

    // Check if there's already an in-flight request for this role
    const existingFetch = inflightFetchesRef.current.get(role);
    if (existingFetch) {
      // Return the existing promise to deduplicate concurrent requests
      return await existingFetch;
    }

    // Start a new fetch and track it
    const fetchPromise = fetchFreshData();
    inflightFetchesRef.current.set(role, fetchPromise);

    try {
      const result = await fetchPromise;
      return result;
    } finally {
      // Clean up the in-flight tracking
      inflightFetchesRef.current.delete(role);
    }
  }, [dashboardCache, cacheTimestamps, fetchErrors, CACHE_TTL_MS]);

  // Calculate user roles from server-provided user detail
  const userRoles = useMemo(() => {
    if (!userDetail?.roles) {
      // Default to employee view if no roles available
      return [{
        role: 'employee',
        label: DASHBOARD_ROLE_MAPPING.employee,
        hierarchyLevel: 4
      }];
    }

    const availableRoles: Array<{ role: string; label: string; hierarchyLevel: number }> = [];

    // Determine which dashboard views the user can access based on their roles
    const userHierarchyLevels = userDetail.roles.map(role => getRoleHierarchyLevel(role.name));
    const highestLevel = Math.min(...userHierarchyLevels);

    // Dashboard view logic:
    // - Show ONLY ONE dashboard tab per hierarchy tier
    // - Admin view (管理者視点): for admin or manager roles (level 1-2)
    // - Supervisor view (上司視点): for supervisor role (level 3)
    // - Employee view (従業員視点): for all other roles (level 4+)

    if (highestLevel <= 2) {
      // User has admin or manager role -> show admin view only
      availableRoles.push({
        role: 'admin',
        label: DASHBOARD_ROLE_MAPPING.admin,
        hierarchyLevel: 1
      });
    } else if (highestLevel === 3) {
      // User has supervisor role (but not admin/manager) -> show supervisor view only
      availableRoles.push({
        role: 'supervisor',
        label: DASHBOARD_ROLE_MAPPING.supervisor,
        hierarchyLevel: 3
      });
    }

    // Employee view: always available for all authenticated users
    availableRoles.push({
      role: 'employee',
      label: DASHBOARD_ROLE_MAPPING.employee,
      hierarchyLevel: 4
    });

    return availableRoles;
  }, [userDetail?.roles]);

  // Extract available role names from server-provided user roles
  const availableRoleNames = useMemo(() => userRoles.map(r => r.role), [userRoles]);

  // Use tab state with pre-computed roles (avoids client-side data fetching)
  // Default to the highest privilege role (first in the array)
  const {
    activeRole,
    setActiveRole,
    isLoading: tabLoading,
    error: tabError
  } = useTabState({
    defaultRole: userRoles[0]?.role || 'employee',  // Default to highest privilege role
    syncWithUrl: true,
    enableHistory: true,
    validateRole: true,
    availableRoles: availableRoleNames  // Pass pre-computed roles from server
  });

  // Show error state if tab state failed
  if (tabError) {
    return (
      <div className="space-y-6">
        <DashboardHeader user={user} />
        <Alert variant="destructive" className="max-w-2xl mx-auto">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-semibold mb-1">ダッシュボードの読み込みに失敗しました</p>
            <p className="text-sm opacity-90">{tabError}</p>
            <p className="text-sm mt-2">
              ページを再読み込みしてください。問題が続く場合は管理者にお問い合わせください。
            </p>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Show message if user has no available dashboards
  if (userRoles.length === 0) {
    return (
      <div className="space-y-6">
        <DashboardHeader user={user} />
        <div className="flex flex-col items-center justify-center p-12 space-y-4">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-muted-foreground mb-2">
              利用可能なダッシュボードがありません
            </h3>
            <p className="text-sm text-muted-foreground">
              管理者に役職の割り当てを依頼してください
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Validate active role
  const validActiveRole = hasDashboardForRole(activeRole) ? activeRole : userRoles[0]?.role || 'employee';

  // Use DashboardFactory with server actions (server-side data fetching)
  const roleComponents = {
    admin: DashboardFactory,
    supervisor: DashboardFactory,
    employee: DashboardFactory
  };

  // Memoize component props to prevent unnecessary re-renders
  // CRITICAL FIX: Use dashboardCache directly in deps instead of fetchDashboardData
  const memoizedComponentProps = useMemo(() => ({
    userId: user.user_id,
    organizationId: user.organization_id,
    // Pass cached data for the active role (instant switching)
    initialData: dashboardCache[validActiveRole as DashboardRole],
    // Pass fetch function for lazy loading on demand
    onFetchData: fetchDashboardData
  }), [user.user_id, user.organization_id, validActiveRole, dashboardCache, fetchDashboardData]);

  return (
    <DashboardErrorBoundary>
      <div className="space-y-6 animate-in fade-in duration-500">
        {/* User welcome header */}
        <DashboardHeader user={user} />

        {/* Multi-role tab navigation */}
        {userRoles.length > 1 && (
          <div className="bg-card rounded-lg shadow-sm border">
            <RoleTabNavigation
              activeRole={validActiveRole}
              onRoleChange={setActiveRole}
              userRoles={userRoles}
              disabled={tabLoading}
            />
          </div>
        )}

        {/* Single role header (when user has only one role) */}
        {userRoles.length === 1 && (
          <div className="bg-card rounded-lg shadow-sm border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <span className="text-sm font-medium text-primary">
                  {userRoles[0]?.label || ''}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard content with parallel rendering and instant tab switching */}
        <TabContentContainer
          activeRole={validActiveRole}
          roleComponents={roleComponents}
          componentProps={memoizedComponentProps}
          enableParallelRendering={true}
          unmountInactiveAfter={5 * 60 * 1000} // 5 minutes
          loadingComponent={
            <div className="flex items-center justify-center p-12">
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                <p className="text-sm text-muted-foreground">ダッシュボードを読み込み中...</p>
              </div>
            </div>
          }
        />
      </div>
    </DashboardErrorBoundary>
  );
}

/**
 * DashboardHeader - Header section with user greeting and notifications
 */
function DashboardHeader({ user }: { user: AuthUserExistsResponse }) {
  return (
    <div className="space-y-4">
      {/* Welcome message */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          ようこそ、{user.name || 'ユーザー'} さん
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          人事評価システムのダッシュボードです
        </p>
      </div>

      {/* Pending approval notification */}
      {user.status === 'pending_approval' && (
        <div className="max-w-2xl mx-auto">
          <PendingApprovalNotification />
        </div>
      )}

      {/* User info card (can be hidden or made collapsible if desired) */}
      {user.status === 'pending_approval' && (
        <div className="max-w-2xl mx-auto">
          <UserInfoCard user={user} />
        </div>
      )}
    </div>
  );
}

/**
 * DashboardLoadingSkeleton - Loading state for the entire dashboard
 */
export function DashboardLoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="text-center space-y-3">
        <div className="h-8 bg-muted animate-pulse rounded-md w-64 mx-auto" />
        <div className="h-4 bg-muted animate-pulse rounded-md w-48 mx-auto" />
      </div>

      {/* Tabs skeleton */}
      <div className="bg-card rounded-lg shadow-sm border p-4">
        <div className="flex gap-2">
          <div className="h-10 bg-muted animate-pulse rounded-md w-32" />
          <div className="h-10 bg-muted animate-pulse rounded-md w-32" />
          <div className="h-10 bg-muted animate-pulse rounded-md w-32" />
        </div>
      </div>

      {/* Dashboard content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-card rounded-lg shadow-sm border p-6">
            <div className="space-y-3">
              <div className="h-5 bg-muted animate-pulse rounded-md w-3/4" />
              <div className="h-4 bg-muted animate-pulse rounded-md w-full" />
              <div className="h-4 bg-muted animate-pulse rounded-md w-5/6" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}