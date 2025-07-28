"use client";

import { useState, useEffect } from 'react';
import type { UserDetailResponse } from '@/api/types';
import { useViewMode } from '../hooks/useViewMode';
import ViewModeSelector from './ViewModeSelector';
import UserSearch from '../components/UserSearch';
import UserTableView from './UserTableView';
import UserGalleryView from './UserGalleryView';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface UserManagementWithSearchProps {
  initialUsers: UserDetailResponse[];
}

export default function UserManagementWithSearch({ initialUsers }: UserManagementWithSearchProps) {
  console.log('🏁 UserManagementWithSearch: Component mounted with initialUsers:', initialUsers.length);
  
  // Initialize with initialUsers directly to avoid race condition
  const [users, setUsers] = useState<UserDetailResponse[]>(initialUsers);
  const [totalUsers, setTotalUsers] = useState<number>(initialUsers.length);
  const [error, setError] = useState<string | null>(null);

  const { viewMode, setViewMode } = useViewMode('table');

  // FORCE initialization with initialUsers when component mounts
  useEffect(() => {
    console.log('🏁 UserManagementWithSearch: useEffect - Ensuring users are set with initialUsers:', initialUsers.length);
    if (initialUsers.length > 0) {
      setUsers(initialUsers);
      setTotalUsers(initialUsers.length);
      console.log('🏁 UserManagementWithSearch: ✅ Users state updated directly with', initialUsers.length, 'users');
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
  const handleSearchResults = (searchUsers: UserDetailResponse[], total: number) => {
    console.log('🎯 UserManagementWithSearch: Received search results:', {
      userCount: searchUsers.length,
      total: total,
      firstUser: searchUsers[0]?.name || 'none'
    });
    
    setUsers(searchUsers);
    setTotalUsers(total);
    setError(null);
  };

  const renderCurrentView = () => {
    switch (viewMode) {
      case 'table':
        return <UserTableView users={users} onUserUpdate={handleUserUpdate} />;
      case 'gallery':
        return <UserGalleryView users={users} onUserUpdate={handleUserUpdate} />;
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

      {/* 検索・フィルター - New UserSearch with useActionState */}
      <UserSearch 
        onSearchResults={handleSearchResults}
        initialUsers={initialUsers}
      />

      {/* 結果表示 */}
      <div className="space-y-4">
        {/* Results summary */}
        {users.length > 0 && (
          <div className="text-sm text-muted-foreground px-1">
            {users.length}件のユーザー
          </div>
        )}

        {/* Empty state */}
        {users.length === 0 && (
          <div className="text-center py-8">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground">該当するユーザーが見つかりませんでした</h3>
            <p className="text-sm text-muted-foreground mt-2">
              検索条件を変更してもう一度お試しください。
            </p>
          </div>
        )}

        {/* Current view */}
        {users.length > 0 && renderCurrentView()}
      </div>
    </div>
  );
}