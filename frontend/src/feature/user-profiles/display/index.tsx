"use client";

import { useState, useEffect } from 'react';
import type { UserDetailResponse } from '@/api/types';
import { useViewMode } from '../hooks/useViewMode';
import ViewModeSelector from './ViewModeSelector';
import FilterBar from './FilterBar';
import UserTableView from './UserTableView';
import UserGalleryView from './UserGalleryView';
// import UserOrganizationView from './UserOrganizationView';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

// ダミーデータをインポート
import dummyUsers from '../data/dummy-users.json';

export default function UserManagementIndex() {
  const [users, setUsers] = useState<UserDetailResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { viewMode, setViewMode } = useViewMode('table');

  useEffect(() => {
    const loadDummyData = async () => {
      try {
        setLoading(true);
        console.log('UserManagementIndex: Loading dummy data...');
        
        // ダミーデータの読み込みをシミュレート（実際のAPIコールのような遅延を追加）
        await new Promise(resolve => setTimeout(resolve, 800));
        
        console.log('UserManagementIndex: Dummy data loaded:', dummyUsers);
        setUsers(dummyUsers as unknown as UserDetailResponse[]);
      } catch (err) {
        console.error('UserManagementIndex: Error loading dummy data:', err);
        setError('ダミーデータの読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    };

    loadDummyData();
  }, []);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">ユーザー情報を読み込み中...</p>
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