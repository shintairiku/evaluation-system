"use client";

import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { UserCheck, Users } from "lucide-react";
import type { UserDetailResponse, Role } from '@/api/types/user';
import type { HierarchyMode } from '../types';

interface HierarchyDisplayProps {
  mode: HierarchyMode;
  userName: string;
  userEmail: string;
  selectedRoles?: Role[];
  user?: UserDetailResponse; // For edit mode
  currentSupervisor?: UserDetailResponse;
  currentSubordinates: UserDetailResponse[];
  hasPendingChanges?: boolean;
}

export default function HierarchyDisplay({
  mode,
  userName,
  userEmail,
  selectedRoles = [],
  user,
  currentSupervisor,
  currentSubordinates,
  hasPendingChanges = false
}: HierarchyDisplayProps) {
  
  const getUserInitials = (name: string) => {
    return name.split(' ').map(part => part[0]).join('').toUpperCase();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-red-100 text-red-800';
      case 'pending_approval':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <>
      {/* Current User Position */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <UserCheck className="h-4 w-4" />
          {mode === 'setup' ? 'あなた' : '現在のユーザー'}
        </Label>
        <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border-2 border-green-200">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-green-100 text-green-700 text-sm">
              {getUserInitials(userName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate">
                {userName}
              </span>
              <Badge variant="outline" className={
                mode === 'setup' 
                  ? "bg-green-100 text-green-800" 
                  : user ? getStatusColor(user.status) : "bg-green-100 text-green-800"
              }>
                {mode === 'setup' 
                  ? 'セットアップ中'
                  : user?.status === 'active' ? 'アクティブ' : 
                    user?.status === 'inactive' ? '非アクティブ' : '承認待ち'
                }
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground truncate">
              {mode === 'setup' 
                ? userEmail 
                : `${user?.employee_code || ''} • ${user?.job_title || '役職未設定'}`
              }
            </div>
            {mode === 'setup' && selectedRoles.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {selectedRoles.map((role) => (
                  <Badge key={role.id} variant="secondary" className="text-xs">
                    {role.name}
                  </Badge>
                ))}
              </div>
            )}
            {mode === 'edit' && user?.roles && user.roles.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {user.roles.map((role) => (
                  <Badge key={role.id} variant="secondary" className="text-xs">
                    {role.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          組織情報
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <div className={`p-3 rounded-lg text-center ${
            mode === 'edit' && hasPendingChanges ? 'bg-red-50' : 'bg-blue-50'
          }`}>
            <div className={`text-lg font-semibold ${
              mode === 'edit' && hasPendingChanges ? 'text-red-700' : 'text-blue-700'
            }`}>
              {currentSupervisor ? '1' : '0'}
              {mode === 'edit' && hasPendingChanges && (
                <span className="text-xs ml-1 text-red-500">*</span>
              )}
            </div>
            <div className={`text-xs ${
              mode === 'edit' && hasPendingChanges ? 'text-red-600' : 'text-blue-600'
            }`}>上司</div>
          </div>
          <div className={`p-3 rounded-lg text-center ${
            mode === 'edit' && hasPendingChanges ? 'bg-red-50' : 'bg-orange-50'
          }`}>
            <div className={`text-lg font-semibold ${
              mode === 'edit' && hasPendingChanges ? 'text-red-700' : 'text-orange-700'
            }`}>
              {currentSubordinates.length}
              {mode === 'edit' && hasPendingChanges && (
                <span className="text-xs ml-1 text-red-500">*</span>
              )}
            </div>
            <div className={`text-xs ${
              mode === 'edit' && hasPendingChanges ? 'text-red-600' : 'text-orange-600'
            }`}>部下</div>
          </div>
        </div>
      </div>
    </>
  );
}