"use client";

import { useState, useEffect, useMemo } from 'react';
import type { UserDetailResponse } from '@/api/types';
import { useViewMode } from '../hooks/useViewMode';
import ViewModeSelector from './ViewModeSelector';
import FilterBar, { FilterState } from './FilterBar';
import UserTableView from './UserTableView';
import UserGalleryView from './UserGalleryView';
// import UserOrganizationView from './UserOrganizationView';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLoading } from '@/hooks/useLoading';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { UserListSkeleton } from '@/components/ui/loading-skeleton';

interface UserManagementIndexProps {
  initialUsers: UserDetailResponse[];
}

export default function UserManagementIndex({ initialUsers }: UserManagementIndexProps) {
  // Safety check to ensure initialUsers is always an array
  const safeInitialUsers = initialUsers || [];
  const [users, setUsers] = useState<UserDetailResponse[]>(safeInitialUsers);
  const [error, setError] = useState<string | null>(null);
  const { isLoading, withLoading } = useLoading('user-list-fetch');
  const [currentFilters, setCurrentFilters] = useState<FilterState>({
    search: '',
    department: 'all',
    stage: 'all',
    role: 'all',
    status: 'all'
  });

  const { viewMode, setViewMode } = useViewMode('table');

  // Callback to update user data when edited
  const handleUserUpdate = (updatedUser: UserDetailResponse) => {
    setUsers(prevUsers => 
      prevUsers.map(user => 
        user.id === updatedUser.id ? updatedUser : user
      )
    );
  };

  // Initialize with real data from server-side fetch
  useEffect(() => {
    console.log('UserManagementIndex: Initialized with real API data:', initialUsers);
    setUsers(safeInitialUsers);
    setError(null);
  }, [initialUsers]); // Remove safeInitialUsers from dependencies to prevent infinite loop

  // Filter users based on current filters
  const filteredUsers = useMemo(() => {
    let filtered = safeInitialUsers;

    // Search filter
    if (currentFilters.search.trim()) {
      const searchTerm = currentFilters.search.toLowerCase();
      filtered = filtered.filter(user => 
        user.name.toLowerCase().includes(searchTerm) ||
        user.employee_code.toLowerCase().includes(searchTerm) ||
        user.email.toLowerCase().includes(searchTerm)
      );
    }

    // Department filter
    if (currentFilters.department !== 'all') {
      filtered = filtered.filter(user => user.department?.id === currentFilters.department);
    }

    // Stage filter
    if (currentFilters.stage !== 'all') {
      filtered = filtered.filter(user => user.stage?.id === currentFilters.stage);
    }

    // Role filter
    if (currentFilters.role !== 'all') {
      filtered = filtered.filter(user => 
        user.roles.some(role => role.id === currentFilters.role)
      );
    }

    // Status filter
    if (currentFilters.status !== 'all') {
      filtered = filtered.filter(user => user.status === currentFilters.status);
    }

    return filtered;
  }, [safeInitialUsers, currentFilters]);

  // Handle filter changes from FilterBar
  const handleFilterChange = (filters: FilterState) => {
    console.log('UserManagementIndex: Filters changed:', filters);
    setCurrentFilters(filters);
  };

  // Update users state when filters change
  useEffect(() => {
    setUsers(filteredUsers);
  }, [filteredUsers]);
  
  const renderCurrentView = () => {
    switch (viewMode) {
      case 'table':
        return <UserTableView users={users} onUserUpdate={handleUserUpdate} />;
      case 'gallery':
        return <UserGalleryView users={users} onUserUpdate={handleUserUpdate} />;
      // case 'organization':
      //   return <UserOrganizationView users={users} onUserUpdate={handleUserUpdate} />;
      default:
        return <UserTableView users={users} onUserUpdate={handleUserUpdate} />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Loading state with view selector skeleton */}
        <div className="flex justify-between items-center">
          <div className="h-10 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
        </div>
        
        {/* Filter bar skeleton */}
        <div className="flex gap-4">
          <div className="h-10 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 w-24 bg-gray-200 rounded animate-pulse" />
        </div>

        <div className="text-center py-4">
          <LoadingSpinner 
            size="lg" 
            text="ユーザー情報を読み込み中..." 
            className="mb-6"
          />
          <UserListSkeleton />
        </div>
      </div>
    );
  }

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

      {/* フィルターバー */}
      <FilterBar users={users} onFilter={handleFilterChange} />

      {/* 結果表示 */}
      <div className="space-y-4">
        {/* 現在のビュー */}
        {renderCurrentView()}
      </div>
    </div>
  );
}