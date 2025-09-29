'use client';

import { ReactNode } from 'react';
import { useUserRoles } from '@/hooks/useUserRoles';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldX } from 'lucide-react';

export interface RolePermissionGuardProps {
  /** The role required to view the content */
  requiredRole?: string;
  /** Alternative: specify required hierarchy level (lower number = higher authority) */
  requiredHierarchyLevel?: number;
  /** Allow access if user has ANY of these roles */
  allowedRoles?: string[];
  /** Deny access if user has ANY of these roles */
  deniedRoles?: string[];
  /** Content to show when user has permission */
  children: ReactNode;
  /** Custom component to show when access is denied */
  fallback?: ReactNode;
  /** Show loading component while checking permissions */
  loadingComponent?: ReactNode;
  /** Show a simple message instead of the default access denied UI */
  hideOnDenied?: boolean;
  /** Custom error message when access is denied */
  deniedMessage?: string;
}

/**
 * RolePermissionGuard component for role-based access control
 *
 * This component provides unified permission checking across the application.
 * It supports multiple permission strategies:
 * - Single role requirement
 * - Hierarchy level requirement
 * - Multiple allowed roles (OR logic)
 * - Role denial list
 *
 * Usage Examples:
 *
 * // Require admin role
 * <RolePermissionGuard requiredRole="admin">
 *   <AdminOnlyContent />
 * </RolePermissionGuard>
 *
 * // Require hierarchy level 2 or higher (admin or manager)
 * <RolePermissionGuard requiredHierarchyLevel={2}>
 *   <ManagerContent />
 * </RolePermissionGuard>
 *
 * // Allow multiple roles
 * <RolePermissionGuard allowedRoles={['admin', 'supervisor']}>
 *   <SupervisorContent />
 * </RolePermissionGuard>
 *
 * // Hide content silently when denied
 * <RolePermissionGuard requiredRole="admin" hideOnDenied>
 *   <AdminButton />
 * </RolePermissionGuard>
 */
export default function RolePermissionGuard({
  requiredRole,
  requiredHierarchyLevel,
  allowedRoles,
  deniedRoles,
  children,
  fallback,
  loadingComponent,
  hideOnDenied = false,
  deniedMessage
}: RolePermissionGuardProps) {
  const { currentUser, isLoading, error, hasRole, getHighestHierarchyLevel, canAccessRole } = useUserRoles();

  // Show loading state
  if (isLoading) {
    if (loadingComponent) {
      return <>{loadingComponent}</>;
    }
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        <span className="ml-2 text-sm text-muted-foreground">権限確認中...</span>
      </div>
    );
  }

  // Show error state
  if (error || !currentUser) {
    return (
      <Alert variant="destructive">
        <ShieldX className="h-4 w-4" />
        <AlertDescription>
          {error || 'ユーザー情報の取得に失敗しました'}
        </AlertDescription>
      </Alert>
    );
  }

  // Check denied roles first (highest priority)
  if (deniedRoles && deniedRoles.length > 0) {
    const hasDeniedRole = deniedRoles.some(role => hasRole(role));
    if (hasDeniedRole) {
      return hideOnDenied ? null : (
        fallback || (
          <Alert variant="destructive">
            <ShieldX className="h-4 w-4" />
            <AlertDescription>
              {deniedMessage || 'この機能へのアクセスは制限されています'}
            </AlertDescription>
          </Alert>
        )
      );
    }
  }

  // Check specific role requirement
  if (requiredRole) {
    if (!hasRole(requiredRole) && !canAccessRole(requiredRole)) {
      return hideOnDenied ? null : (
        fallback || (
          <Alert variant="destructive">
            <ShieldX className="h-4 w-4" />
            <AlertDescription>
              {deniedMessage || `この機能には${requiredRole}権限が必要です`}
            </AlertDescription>
          </Alert>
        )
      );
    }
  }

  // Check hierarchy level requirement
  if (requiredHierarchyLevel !== undefined) {
    const userHierarchyLevel = getHighestHierarchyLevel();
    if (userHierarchyLevel > requiredHierarchyLevel) {
      return hideOnDenied ? null : (
        fallback || (
          <Alert variant="destructive">
            <ShieldX className="h-4 w-4" />
            <AlertDescription>
              {deniedMessage || '権限レベルが不足しています'}
            </AlertDescription>
          </Alert>
        )
      );
    }
  }

  // Check allowed roles (OR logic)
  if (allowedRoles && allowedRoles.length > 0) {
    const hasAllowedRole = allowedRoles.some(role => hasRole(role) || canAccessRole(role));
    if (!hasAllowedRole) {
      return hideOnDenied ? null : (
        fallback || (
          <Alert variant="destructive">
            <ShieldX className="h-4 w-4" />
            <AlertDescription>
              {deniedMessage || 'この機能へのアクセス権限がありません'}
            </AlertDescription>
          </Alert>
        )
      );
    }
  }

  // All permission checks passed
  return <>{children}</>;
}

/**
 * Higher-order component version of RolePermissionGuard
 *
 * Usage:
 * const ProtectedComponent = withRolePermission(MyComponent, { requiredRole: 'admin' });
 */
export function withRolePermission<P extends object>(
  Component: React.ComponentType<P>,
  guardProps: Omit<RolePermissionGuardProps, 'children'>
) {
  return function ProtectedComponent(props: P) {
    return (
      <RolePermissionGuard {...guardProps}>
        <Component {...props} />
      </RolePermissionGuard>
    );
  };
}

/**
 * Hook version for conditional rendering in components
 *
 * Usage:
 * const { canAccess } = useRolePermission({ requiredRole: 'admin' });
 * return canAccess ? <AdminContent /> : <AccessDenied />;
 */
export function useRolePermission(guardProps: Omit<RolePermissionGuardProps, 'children' | 'fallback' | 'hideOnDenied'>) {
  const { currentUser, isLoading, error, hasRole, getHighestHierarchyLevel, canAccessRole } = useUserRoles();

  const canAccess = (() => {
    if (isLoading || error || !currentUser) return false;

    // Check denied roles
    if (guardProps.deniedRoles && guardProps.deniedRoles.length > 0) {
      const hasDeniedRole = guardProps.deniedRoles.some(role => hasRole(role));
      if (hasDeniedRole) return false;
    }

    // Check specific role requirement
    if (guardProps.requiredRole) {
      if (!hasRole(guardProps.requiredRole) && !canAccessRole(guardProps.requiredRole)) {
        return false;
      }
    }

    // Check hierarchy level requirement
    if (guardProps.requiredHierarchyLevel !== undefined) {
      const userHierarchyLevel = getHighestHierarchyLevel();
      if (userHierarchyLevel > guardProps.requiredHierarchyLevel) {
        return false;
      }
    }

    // Check allowed roles
    if (guardProps.allowedRoles && guardProps.allowedRoles.length > 0) {
      const hasAllowedRole = guardProps.allowedRoles.some(role => hasRole(role) || canAccessRole(role));
      if (!hasAllowedRole) return false;
    }

    return true;
  })();

  return {
    canAccess,
    isLoading,
    error,
    currentUser
  };
}