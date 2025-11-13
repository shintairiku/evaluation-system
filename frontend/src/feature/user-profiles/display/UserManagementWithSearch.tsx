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
  const [, setIsFiltered] = useState<boolean>(false);
  const [allUsers, setAllUsers] = useState<UserDetailResponse[]>(initialUsers);
  const [error, setError] = useState<string | null>(null);
  // Keep Organization Chart dataset isolated so filters there don't affect Table/Gallery
  const [orgUsers, setOrgUsers] = useState<UserDetailResponse[]>(initialUsers);
  const [orgIsFiltered, setOrgIsFiltered] = useState<boolean>(false);
  // Track edit mode for organization view
  const [isOrganizationEditMode, setIsOrganizationEditMode] = useState<boolean>(false);

  const { viewMode, setViewMode } = useViewMode('table');

  // FORCE initialization with initialUsers when component mounts
  useEffect(() => {
    if (initialUsers.length > 0) {
      setUsers(initialUsers);
      setOrgUsers(initialUsers);
      setAllUsers(initialUsers);
      setTotalUsers(initialUsers.length);
    }
  }, [initialUsers]);

  // Callback to update user data when edited
  const handleUserUpdate = (updatedUser: UserDetailResponse) => {
    const updateList = (list: UserDetailResponse[]) =>
      list.map(user => (user.id === updatedUser.id ? updatedUser : user));

    setUsers(prevUsers => updateList(prevUsers));
    setOrgUsers(prevOrgUsers => updateList(prevOrgUsers));
    setAllUsers(prevAllUsers => {
      // If updated user isn't in the cached directory, append it so permissions stay accurate
      const exists = prevAllUsers.some(user => user.id === updatedUser.id);
      return exists ? updateList(prevAllUsers) : [...prevAllUsers, updatedUser];
    });
  };

  // Callback to handle edit mode changes from OrganizationViewWithOrgChart
  const handleEditModeChange = (editMode: boolean) => {
    setIsOrganizationEditMode(editMode);
  };

  // Callback to handle search results from UserSearch component
  const handleSearchResults = (searchUsers: UserDetailResponse[], total: number, isFilteredArg?: boolean) => {
    setError(null);
    const isFiltered = Boolean(isFilteredArg);

    // Cache the last unfiltered dataset so hierarchy editing keeps full context even after filters
    if (!isFiltered) {
      setAllUsers(searchUsers);
    }
    if (viewMode === 'organization') {
      // Apply security restriction only in edit mode for non-admin users
      if (isOrganizationEditMode && initialUsers.length === 1) {
        // Employee heuristic: initialUsers length == 1 → restrict to self only in edit mode
        setOrgUsers(initialUsers);
        setOrgIsFiltered(false);
        return;
      }
      // Apply search results normally (admin in edit mode OR any user in readonly mode)
      setOrgUsers(searchUsers);
      setOrgIsFiltered(isFiltered);
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
      setIsFiltered(isFiltered);
    }
  };

  const renderCurrentView = () => {
    switch (viewMode) {
      case 'table':
        return <UserTableView users={users} allUsers={allUsers} onUserUpdate={handleUserUpdate} />;
      case 'gallery':
        return <UserGalleryView users={users} allUsers={allUsers} onUserUpdate={handleUserUpdate} />;
      case 'organization':
        return <OrganizationViewWithOrgChart users={orgUsers} onUserUpdate={handleUserUpdate} isFiltered={orgIsFiltered} onEditModeChange={handleEditModeChange} />;
      default:
        return <UserTableView users={users} allUsers={allUsers} onUserUpdate={handleUserUpdate} />;
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

        {/* Empty state is handled within each view component to avoid duplication */}

        {/* Current view */}
        {renderCurrentView()}
      </div>
    </div>
  );
}
