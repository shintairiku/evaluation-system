"use client";

import { useMemo, useState } from 'react';
import type { UserDetailResponse } from '@/api/types';
import { AlertCircle, Users, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useProfileOptions } from '@/context/ProfileOptionsContext';
import OrganizationFilters, { OrganizationFilters as FiltersType } from './components/OrganizationFilters';

interface UserOrganizationViewProps {
  users: UserDetailResponse[];
  onUserUpdate?: (user: UserDetailResponse) => void;
}

export default function UserOrganizationView({ users }: UserOrganizationViewProps) {
  const { options, isLoading: isLoadingOptions, error: optionsError } = useProfileOptions();
  const [filters, setFilters] = useState<FiltersType>({
    search: '',
    departmentId: '',
    stageId: '',
    roleId: ''
  });

  // Filter users based on current filters
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch = 
          user.name.toLowerCase().includes(searchLower) ||
          user.email.toLowerCase().includes(searchLower) ||
          user.employee_code?.toLowerCase().includes(searchLower);
        
        if (!matchesSearch) return false;
      }

      // Department filter
      if (filters.departmentId && user.department?.id !== filters.departmentId) {
        return false;
      }

      // Stage filter
      if (filters.stageId && user.stage?.id !== filters.stageId) {
        return false;
      }

      // Role filter
      if (filters.roleId && !user.roles?.some(role => role.id === filters.roleId)) {
        return false;
      }

      return true;
    });
  }, [users, filters]);

  // Build hierarchy from the filtered users
  const hierarchy = useMemo(() => {
    return buildHierarchyFromUsers(filteredUsers, options);
  }, [filteredUsers, options]);

  // Loading state while profile options are being fetched
  if (isLoadingOptions) {
    return <OrganizationViewSkeleton />;
  }

  // Error state for profile options
  if (optionsError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          エラー: {optionsError}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <OrganizationFilters 
        filters={filters}
        onFiltersChange={setFilters}
      />

      {/* Organization View */}
      <div className="h-[600px] w-full border rounded-lg p-4 overflow-auto">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              組織図 ({filteredUsers.length}件のユーザー)
              {filteredUsers.length !== users.length && (
                <span className="ml-2 text-xs">
                  (全{users.length}件中)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>部署: {options.departments.length}件</span>
              <span>•</span>
              <span>ステージ: {options.stages.length}件</span>
            </div>
          </div>

          {hierarchy.length === 0 ? (
            <div className="h-[500px] flex items-center justify-center">
              <div className="text-center">
                <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-muted-foreground">
                  {filteredUsers.length === 0 ? 'フィルター条件に一致するユーザーがありません' : '組織図データがありません'}
                </h3>
                <p className="text-sm text-muted-foreground mt-2">
                  {filteredUsers.length === 0 
                    ? 'フィルター条件を変更してお試しください。'
                    : 'ユーザー間の上司-部下関係が設定されていません。'
                  }
                </p>
              </div>
            </div>
          ) : (
            <HierarchyTree users={hierarchy} options={options} />
          )}
        </div>
      </div>
    </div>
  );
}

// Loading skeleton for organization view
function OrganizationViewSkeleton() {
  return (
    <div className="space-y-4">
      {/* Filters Skeleton */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="h-[600px] w-full border rounded-lg p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <div className="flex gap-1">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Component to render hierarchy tree
function HierarchyTree({ 
  users, 
  options 
}: { 
  users: UserDetailResponse[];
  options: {
    departments: any[];
    stages: any[];
    roles: any[];
  };
}) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const toggleNode = (userId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedNodes(newExpanded);
  };

  const renderUserNode = (user: UserDetailResponse, level: number = 0) => {
    const hasSubordinates = user.subordinates && user.subordinates.length > 0;
    const isExpanded = expandedNodes.has(user.id);

    return (
      <div key={user.id} className="space-y-2">
        <div 
          className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
          style={{ marginLeft: `${level * 20}px` }}
        >
          {hasSubordinates && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleNode(user.id)}
              className="h-6 w-6 p-0"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          )}
          
          <Avatar className="h-8 w-8">
            <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm truncate">{user.name}</h4>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
          
          <div className="flex flex-wrap gap-1">
            {user.department && (
              <Badge variant="secondary" className="text-xs">
                {user.department.name}
              </Badge>
            )}
            {user.stage && (
              <Badge variant="outline" className="text-xs">
                {user.stage.name}
              </Badge>
            )}
            {user.roles && user.roles.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {user.roles.slice(0, 2).map((role) => (
                  <Badge key={role.id} variant="outline" className="text-xs">
                    {role.name}
                  </Badge>
                ))}
                {user.roles.length > 2 && (
                  <Badge variant="outline" className="text-xs">
                    +{user.roles.length - 2}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
        
        {hasSubordinates && isExpanded && (
          <div className="space-y-2">
            {user.subordinates!.map(subordinate => 
              renderUserNode(subordinate, level + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {users.map(user => renderUserNode(user))}
    </div>
  );
}

// Function to build hierarchy from users data with enhanced options
function buildHierarchyFromUsers(
  users: UserDetailResponse[], 
  options: {
    departments: any[];
    stages: any[];
    roles: any[];
  }
): UserDetailResponse[] {
  // Find root users (users without supervisors or whose supervisors are not in the list)
  const rootUsers = users.filter(user => {
    if (!user.supervisor) return true;
    return !users.find(u => u.id === user.supervisor?.id);
  });

  return rootUsers;
}
