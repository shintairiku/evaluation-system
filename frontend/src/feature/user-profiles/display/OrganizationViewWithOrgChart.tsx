"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Edit, Eye, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import type { UserDetailResponse, SimpleUser } from '@/api/types';
import { getUsersForOrgChartAction } from '@/api/server-actions';
import UserOrganizationView from './UserOrganizationView';
import ReadOnlyOrganizationView from './ReadOnlyOrganizationView';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface OrganizationViewWithOrgChartProps {
  users: UserDetailResponse[];
  onUserUpdate?: (user: UserDetailResponse) => void;
}

export default function OrganizationViewWithOrgChart({ users, onUserUpdate }: OrganizationViewWithOrgChartProps) {
  const [editMode, setEditMode] = useState(false);
  const [orgChartUsers, setOrgChartUsers] = useState<SimpleUser[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load org chart data when switching to readonly mode
  useEffect(() => {
    if (!editMode) {
      // Heuristic: treat as "filtered" only when more than 1 user is supplied.
      // When employees land with only themselves available from RBAC-limited list (1 user),
      // we still load the full org-chart dataset so counts and departments render correctly.
      const hasFilteredUsers = users && users.length > 1;
      
      if (hasFilteredUsers) {
        // Skip loading org chart data if we have filtered users from search
        setOrgChartUsers(null);
        setLoading(false);
        setError(null);
      } else {
        // Load org chart data when there are no or only a single pre-supplied user
        setLoading(true);
        setError(null);
        
        getUsersForOrgChartAction()
          .then(result => {
            if (result.success && result.data) {
              setOrgChartUsers(result.data);
            } else {
              setError(result.error || '組織図データの取得に失敗しました');
            }
          })
          .catch(err => {
            console.error('Failed to load org chart data:', err);
            setError('組織図データの取得中にエラーが発生しました');
          })
          .finally(() => {
            setLoading(false);
          });
      }
    }
  }, [editMode, users]);

  const toggleEditMode = () => {
    setEditMode(!editMode);
  };

  const renderReadOnlyView = () => {
    // Priority: Use filtered users from search if available
    const hasFilteredUsers = users && users.length > 1;
    
    if (hasFilteredUsers) {
      return <ReadOnlyOrganizationView users={users} />;
    }

    // Fallback: Use org chart users when no filtered data
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            組織図を読み込み中...
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

    if (!orgChartUsers || orgChartUsers.length === 0) {
      return (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            組織図に表示するユーザーが見つかりませんでした。
          </AlertDescription>
        </Alert>
      );
    }

    return <ReadOnlyOrganizationView users={orgChartUsers} />;
  };

  return (
    <div className="space-y-4">
      {/* View Toggle Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-slate-50 rounded-lg border">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {editMode ? (
              <Edit className="w-5 h-5 text-blue-600" />
            ) : (
              <Eye className="w-5 h-5 text-green-600" />
            )}
            <span className="text-lg font-semibold">
              {editMode ? '編集モード' : '閲覧モード'}
            </span>
          </div>
          <div className="h-4 w-px bg-gray-300" />
          <p className="text-sm text-gray-600">
            {editMode 
              ? 'ドラッグ＆ドロップで組織階層を編集できます' 
              : '部署から始まる階層的なナビゲーションで組織を探索できます'
            }
          </p>
        </div>
        
        {/* Toggle Button */}
        <Button
          onClick={toggleEditMode}
          variant="outline"
          className="flex items-center gap-2 border-2 hover:border-blue-300"
        >
          {editMode ? (
            <>
              <ToggleRight className="w-4 h-4" />
              閲覧モードに切り替え
            </>
          ) : (
            <>
              <ToggleLeft className="w-4 h-4" />
              編集モードに切り替え
            </>
          )}
        </Button>
      </div>
      
      {/* Conditional View Rendering */}
      {editMode ? (
        <UserOrganizationView users={users} onUserUpdate={onUserUpdate} />
      ) : (
        renderReadOnlyView()
      )}
    </div>
  );
}