'use client';

import React from 'react';
import type { UserDetailResponse } from '@/api/types';
import StageUserSearch from './StageUserSearch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface StageManagementHeaderProps {
  users: UserDetailResponse[];
  total: number;
  onFilteredUsers: (filteredUsers: UserDetailResponse[]) => void;
  viewMode: 'users' | 'weights';
  onViewModeChange: (mode: 'users' | 'weights') => void;
}

/**
 * Header component for Stage Management page
 * Contains title, description, and search functionality
 */
export default function StageManagementHeader({ 
  users, 
  total, 
  onFilteredUsers,
  viewMode,
  onViewModeChange,
}: StageManagementHeaderProps) {
  return (
    <div>
      {/* Title only */}
      <div className="mb-2">
        <h1 className="text-3xl font-bold">ステージ管理</h1>
      </div>
      
      <div className="flex flex-col gap-3 mb-2">
        <p className="text-muted-foreground">
          ステージごとのユーザー配置と評価ウェイトを管理します。
        </p>

        <Tabs
          value={viewMode}
          onValueChange={(value) => onViewModeChange(value as 'users' | 'weights')}
          className="w-full md:w-auto"
        >
          <TabsList className="w-full md:w-auto">
            <TabsTrigger value="users" className="flex-1 md:flex-none">
              ユーザー配置
            </TabsTrigger>
            <TabsTrigger value="weights" className="flex-1 md:flex-none">
              ウェイト設定
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {viewMode === 'users' && (
          <div className="flex-shrink-0 self-end">
            <StageUserSearch
              users={users}
              onFilteredUsers={onFilteredUsers}
            />
          </div>
        )}
      </div>
      
      {/* Pagination info */}
      <div>
        {total > users.length && (
          <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800">
              {users.length} / {total} 人のユーザーを表示中。
              一部のユーザーが表示されていない可能性があります。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
