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
  isFiltered?: boolean;
  onEditModeChange?: (editMode: boolean) => void;
}

export default function OrganizationViewWithOrgChart({ users, onUserUpdate, isFiltered = false, onEditModeChange }: OrganizationViewWithOrgChartProps) {
  const [editMode, setEditMode] = useState(false);
  const [orgChartUsers, setOrgChartUsers] = useState<SimpleUser[] | null>(null);
  // Single source of truth for what the chart renders
  const [dataSource, setDataSource] = useState<{ mode: 'auto' | 'filtered'; users: SimpleUser[] }>({ mode: 'auto', users: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load org chart data when switching to readonly mode
  useEffect(() => {
    if (!editMode) {
      // If currently in filtered mode, do nothing here (source controlled externally)
      if (dataSource.mode === 'filtered') return;

      // Auto mode: load dataset
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
  }, [editMode, dataSource.mode]);

  // Apply external filtered users when parent indicates filtered
  useEffect(() => {
    if (isFiltered) {
      // Map UserDetailResponse -> SimpleUser (fields used by chart exist or are subset-compatible)
      const mapped = (users as unknown as SimpleUser[]) || [];
      setDataSource({ mode: 'filtered', users: mapped });
    } else {
      setDataSource({ mode: 'auto', users: [] });
    }
  }, [isFiltered, users]);

  const toggleEditMode = () => {
    const newEditMode = !editMode;
    setEditMode(newEditMode);
    onEditModeChange?.(newEditMode);
  };

  const renderReadOnlyView = () => {
    // Priority: Use filtered users when dataSource indicates filtered
    if (dataSource.mode === 'filtered') {
      // When filtered result is empty, show the standard empty message and do NOT render the chart
      if (!dataSource.users || dataSource.users.length === 0) {
        return (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              該当するユーザーが見つかりませんでした。
            </AlertDescription>
          </Alert>
        );
      }
      return <ReadOnlyOrganizationView users={dataSource.users} isFiltered />;
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