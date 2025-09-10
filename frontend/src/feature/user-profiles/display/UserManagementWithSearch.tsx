"use client";

import { useState, useEffect } from 'react';
import type { UserDetailResponse } from '@/api/types';
import { useViewMode } from '../hooks/useViewMode';
import ViewModeSelector from './ViewModeSelector';
import UserSearch from '../components/UserSearch';
import UserTableView from './UserTableView';
import UserGalleryView from './UserGalleryView';
import OrganizationViewWithOrgChart from './OrganizationViewWithOrgChart';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface UserManagementWithSearchProps {
  initialUsers: UserDetailResponse[];
}

export default function UserManagementWithSearch({ initialUsers }: UserManagementWithSearchProps) {
  // Initialize with initialUsers directly to avoid race condition
  const [users, setUsers] = useState<UserDetailResponse[]>(initialUsers);
  const [, setTotalUsers] = useState<number>(initialUsers.length);
  const [error, setError] = useState<string | null>(null);
  const [isFiltered, setIsFiltered] = useState<boolean>(false);
  // Keep Organization Chart dataset isolated so filters there don't affect Table/Gallery
  const [orgUsers, setOrgUsers] = useState<UserDetailResponse[]>([]);
  const [orgIsFiltered, setOrgIsFiltered] = useState<boolean>(false);

  const { viewMode, setViewMode } = useViewMode('table');

  // FORCE initialization with initialUsers when component mounts
  useEffect(() => {
    if (initialUsers.length > 0) {
      setUsers(initialUsers);
      setTotalUsers(initialUsers.length);
    }
  }, [initialUsers]);

  // Callback to update user data when edited
  const handleUserUpdate = (updatedUser: UserDetailResponse) => {
    setUsers(prevUsers => 
      prevUsers.map(user => 
        user.id === updatedUser.id ? updatedUser : user
      )
    );
  };

  // Callback to handle search results from UserSearch component
  const handleSearchResults = (searchUsers: UserDetailResponse[], total: number, isFilteredArg?: boolean) => {
    setError(null);
    if (viewMode === 'organization') {
      // Apply only to Organization Chart
      setOrgUsers(searchUsers);
      setOrgIsFiltered(Boolean(isFilteredArg));
      // Do not touch table/gallery dataset
    } else {
      // For other views (e.g., admin/supervisor paths), keep default behavior
      // Employee heuristic: initialUsers length == 1 → clamp Table/Gallery to self only
      if (initialUsers.length === 1) {
        setUsers(initialUsers);
        setTotalUsers(1);
        setIsFiltered(false);
        return;
      }
      setUsers(searchUsers);
      setTotalUsers(total);
      setIsFiltered(Boolean(isFilteredArg));
    }
  };

  const renderCurrentView = () => {
    switch (viewMode) {
      case 'table':
        return <UserTableView users={users} onUserUpdate={handleUserUpdate} />;
      case 'gallery':
        return <UserGalleryView users={users} onUserUpdate={handleUserUpdate} />;
      case 'organization':
        return <OrganizationViewWithOrgChart users={orgUsers} onUserUpdate={handleUserUpdate} isFiltered={orgIsFiltered} />;
      default:
        return <UserTableView users={users} onUserUpdate={handleUserUpdate} />;
    }
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          エラー: {error}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* 表示モード選択 */}
      <ViewModeSelector viewMode={viewMode} onViewModeChange={setViewMode} />

      {/* 検索・フィルター - Global search and filters for all views */}
      <UserSearch 
        onSearchResults={handleSearchResults}
        initialUsers={initialUsers}
        useOrgChartDataset={viewMode === 'organization'}
      />

      {/* 結果表示 */}
      <div className="space-y-4">
        {/* Results summary - Hide count for organization view as it has its own detailed header */}
        {users.length > 0 && viewMode !== 'organization' && (
          <div className="text-sm text-muted-foreground px-1">
            {users.length}件のユーザー
          </div>
        )}

        {/* Empty state */}
        {users.length === 0 && viewMode !== 'organization' && (
          <div className="text-center py-8">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground">該当するユーザーが見つかりませんでした</h3>
            <p className="text-sm text-muted-foreground mt-2">
              検索条件を変更してもう一度お試しください。
            </p>
          </div>
        )}

        {/* Current view */}
        {renderCurrentView()}
      </div>
    </div>
  );
}