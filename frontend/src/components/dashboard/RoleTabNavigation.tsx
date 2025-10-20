'use client';

import { useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Shield, Users, User } from 'lucide-react';

// Import UserRole type directly to avoid server-only imports
export interface UserRole {
  role: string;
  label: string;
  hierarchyLevel: number;
}

export interface RoleTabNavigationProps {
  /** Currently active role tab */
  activeRole: string;
  /** Callback when role tab changes */
  onRoleChange: (role: string) => void;
  /** Available user roles (pass from parent to avoid client-side fetching) */
  userRoles?: UserRole[];
  /** Custom styling classes */
  className?: string;
  /** Disable tab switching (useful during loading) */
  disabled?: boolean;
}

// Icon mapping for different roles
const ROLE_ICONS: Record<string, React.ReactNode> = {
  'admin': <Shield className="w-4 h-4" />,
  'supervisor': <Users className="w-4 h-4" />,
  'employee': <User className="w-4 h-4" />
};

/**
 * RoleTabNavigation component for multi-role dashboard switching
 *
 * This component:
 * - Displays available role tabs based on user's permissions
 * - Handles role switching with proper validation
 * - Shows role hierarchy badges
 * - Supports dynamic grid layout based on available roles
 * - Provides loading and error states
 *
 * Usage:
 * <RoleTabNavigation
 *   activeRole={activeRole}
 *   onRoleChange={setActiveRole}
 * />
 */
export default function RoleTabNavigation({
  activeRole,
  onRoleChange,
  userRoles,
  className = '',
  disabled = false
}: RoleTabNavigationProps) {
  // Roles must be provided as props to avoid server-only imports
  if (!userRoles) {
    return (
      <div className={`p-4 text-center ${className}`}>
        <p className="text-sm text-muted-foreground">ロール情報を読み込めませんでした</p>
      </div>
    );
  }

  // Calculate grid columns based on number of available roles
  const gridColumns = useMemo(() => {
    const count = userRoles.length;
    if (count === 0) return 'grid-cols-1';
    if (count === 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-2';
    return 'grid-cols-3';
  }, [userRoles.length]);

  // Handle no roles available
  if (userRoles.length === 0) {
    return (
      <div className={`p-4 text-center ${className}`}>
        <p className="text-sm text-muted-foreground">利用可能なダッシュボードがありません</p>
      </div>
    );
  }

  // Handle single role (no tabs needed)
  if (userRoles.length === 1) {
    const role = userRoles[0];
    return (
      <div className={`p-4 border-b ${className}`}>
        <div className="flex items-center justify-center gap-2">
          {ROLE_ICONS[role.role]}
          <span className="font-medium text-lg">{role.label}</span>
          <Badge variant="secondary" className="text-xs">
            レベル {role.hierarchyLevel}
          </Badge>
        </div>
      </div>
    );
  }

  // Ensure active role is valid
  const validActiveRole = userRoles.some(role => role.role === activeRole)
    ? activeRole
    : userRoles[0].role;

  return (
    <div className={`w-full ${className}`}>
      <Tabs
        value={validActiveRole}
        onValueChange={disabled ? () => {} : onRoleChange}
      >
        <TabsList className={`grid w-full ${gridColumns} bg-muted/50 p-1 rounded-lg`}>
          {userRoles.map((role) => (
            <TabsTrigger
              key={role.role}
              value={role.role}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-md
                transition-all duration-200
                data-[state=active]:bg-background
                data-[state=active]:text-foreground
                data-[state=active]:shadow-sm
                hover:bg-background/50
                ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}
              `}
            >
              {ROLE_ICONS[role.role]}
              <span className="hidden sm:inline">{role.label}</span>
              <span className="sm:hidden">{role.label.split('視点')[0]}</span>
              <Badge
                variant={role.role === validActiveRole ? "default" : "secondary"}
                className="text-xs ml-1 hidden md:inline-flex"
              >
                L{role.hierarchyLevel}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Role description for accessibility */}
      <div className="sr-only">
        現在選択中: {userRoles.find(r => r.role === validActiveRole)?.label}
      </div>
    </div>
  );
}

/**
 * Simple role indicator component for contexts where full tab navigation isn't needed
 */
export function RoleIndicator({ role }: { role: UserRole }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ROLE_ICONS[role.role]}
      <span className="font-medium">{role.label}</span>
      <Badge variant="outline" className="text-xs">
        レベル {role.hierarchyLevel}
      </Badge>
    </div>
  );
}

/**
 * Compact role switcher for sidebar or mobile use
 */
export function CompactRoleSwitcher({
  activeRole,
  onRoleChange,
  userRoles,
  className = ''
}: Omit<RoleTabNavigationProps, 'disabled'>) {
  if (!userRoles || userRoles.length <= 1) {
    return null;
  }

  return (
    <div className={`flex gap-1 ${className}`}>
      {userRoles.map((role) => (
        <button
          key={role.role}
          onClick={() => onRoleChange(role.role)}
          className={`
            flex items-center gap-1 px-2 py-1 rounded text-xs font-medium
            transition-colors duration-200
            ${role.role === activeRole
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted hover:bg-muted/80'
            }
          `}
          title={role.label}
        >
          {ROLE_ICONS[role.role]}
          <span className="hidden sm:inline">{role.role}</span>
        </button>
      ))}
    </div>
  );
}