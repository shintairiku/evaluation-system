"use client";

import { useState, useEffect } from 'react';
import type { UserDetailResponse } from '@/api/types';
import { useViewMode } from '../hooks/useViewMode';
import ViewModeSelector from './ViewModeSelector';
import FilterBar from './FilterBar';
import UserTableView from './UserTableView';
import UserGalleryView from './UserGalleryView';
// import UserOrganizationView from './UserOrganizationView';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLoading } from '@/hooks/useLoading';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { UserListSkeleton } from '@/components/ui/loading-skeleton';

// ダミーデータをインポート
import dummyUsers from '../data/dummy-users.json';

export default function UserManagementIndex() {
  const [users, setUsers] = useState<UserDetailResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { isLoading, withLoading } = useLoading('user-list-fetch');

  const { viewMode, setViewMode } = useViewMode('table');

  useEffect(() => {
    const loadDummyData = async () => {
      await withLoading(async () => {
        try {
          console.log('UserManagementIndex: Loading dummy data...');
          
          // ダミーデータの読み込みをシミュレート（実際のAPIコールのような遅延を追加）
          await new Promise(resolve => setTimeout(resolve, 800));
          
          console.log('UserManagementIndex: Dummy data loaded:', dummyUsers);
          setUsers(dummyUsers as unknown as UserDetailResponse[]);
          setError(null); // Clear any previous errors
        } catch (err) {
          console.error('UserManagementIndex: Error loading dummy data:', err);
          const errorMessage = 'ダミーデータの読み込みに失敗しました';
          setError(errorMessage);
          throw new Error(errorMessage); // Re-throw to let withLoading handle it
        }
      }, {
        onError: (error) => {
          console.error('UserManagementIndex: Loading error:', error);
        }
      });
    };

    loadDummyData();
  }, []); // Empty dependency array - only run once on mount

  const renderCurrentView = () => {
    switch (viewMode) {
      case 'table':
        return <UserTableView users={users} />;
      case 'gallery':
        return <UserGalleryView users={users} />;
      // case 'organization':
      //   return <UserOrganizationView users={users} />;
      default:
        return <UserTableView users={users} />;
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
      <FilterBar users={users} />

      {/* 結果表示 */}
      <div className="space-y-4">
        {/* 現在のビュー */}
        {renderCurrentView()}
      </div>
    </div>
  );
}