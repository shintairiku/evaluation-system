'use client';

import { useState } from 'react';
import type { UserDetailResponse } from '@/api/types';
import StageUserSearch from './StageUserSearch';

interface StageManagementHeaderProps {
  users: UserDetailResponse[];
  total: number;
  onFilteredUsers: (filteredUsers: UserDetailResponse[]) => void;
}

/**
 * Header component for Stage Management page
 * Contains title, description, and search functionality
 */
export default function StageManagementHeader({ 
  users, 
  total, 
  onFilteredUsers 
}: StageManagementHeaderProps) {
  return (
    <div>
      {/* Title only */}
      <div className="mb-2">
        <h1 className="text-3xl font-bold">ステージ管理</h1>
      </div>
      
      {/* Description and Search in same row */}
      <div className="flex items-center justify-between gap-4 mb-2">
        <div className="flex-1">
          <p className="text-muted-foreground">
            評価ステージ間でユーザーをドラッグ&ドロップして管理します
          </p>
        </div>
        
        {/* Search component aligned to the right */}
        <div className="flex-shrink-0">
          <StageUserSearch
            users={users}
            onFilteredUsers={onFilteredUsers}
          />
        </div>
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