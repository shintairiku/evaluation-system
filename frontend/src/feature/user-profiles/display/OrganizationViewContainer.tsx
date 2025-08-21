"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Edit, Eye, ToggleLeft, ToggleRight } from 'lucide-react';
import type { UserDetailResponse } from '@/api/types';
import UserOrganizationView from './UserOrganizationView';
import ReadOnlyOrganizationView from './ReadOnlyOrganizationView';

interface OrganizationViewContainerProps {
  users: UserDetailResponse[];
  onUserUpdate?: (user: UserDetailResponse) => void;
}

export default function OrganizationViewContainer({ users, onUserUpdate }: OrganizationViewContainerProps) {
  const [editMode, setEditMode] = useState(false);

  const toggleEditMode = () => {
    setEditMode(!editMode);
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
        <ReadOnlyOrganizationView users={users} />
      )}
    </div>
  );
}