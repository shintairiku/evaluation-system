"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Crown, ChevronUp } from "lucide-react";
import UserSearchCommand from './UserSearchCommand';
import type { UserDetailResponse } from '@/api/types/user';
import type { HierarchyMode } from '../types';

interface SupervisorSelectorProps {
  mode: HierarchyMode;
  currentSupervisor?: UserDetailResponse;
  potentialSupervisors: UserDetailResponse[];
  onSupervisorChange: (supervisorId: string) => void;
  onSupervisorRemove: () => void;
  hasPendingChanges?: boolean;
  canEdit?: boolean;
  isPending?: boolean;
}

export default function SupervisorSelector({
  mode,
  currentSupervisor,
  potentialSupervisors,
  onSupervisorChange,
  onSupervisorRemove,
  hasPendingChanges = false,
  canEdit = true,
  isPending = false
}: SupervisorSelectorProps) {
  const [supervisorPopoverOpen, setSupervisorPopoverOpen] = useState(false);

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

  const handleSupervisorSelect = (supervisorId: string) => {
    setSupervisorPopoverOpen(false);
    onSupervisorChange(supervisorId);
  };

  const handleSupervisorRemove = () => {
    onSupervisorRemove();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Crown className="h-4 w-4" />
          上司
          {mode === 'edit' && hasPendingChanges && (
            <Badge variant="destructive" className="text-xs animate-pulse ml-2">
              変更待機中
            </Badge>
          )}
        </Label>
        {canEdit && (
          <Popover open={supervisorPopoverOpen} onOpenChange={setSupervisorPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
              >
                <Crown className="h-4 w-4 mr-2" />
                {mode === 'setup' ? '上司を選択' : '上司を変更'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start">
              <UserSearchCommand
                placeholder="上司を検索..."
                emptyMessage="該当する上司がいません"
                users={potentialSupervisors}
                onUserSelect={handleSupervisorSelect}
                showRemoveOption={true}
                removeOptionLabel="上司なし"
                onRemove={handleSupervisorRemove}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>
      
      {currentSupervisor ? (
        <div className={`flex items-center gap-3 p-3 rounded-lg border ${
          mode === 'edit' && hasPendingChanges ? 'bg-red-50 border-red-200' : 'bg-blue-50'
        }`}>
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-blue-100 text-blue-700 text-sm">
              {getUserInitials(currentSupervisor.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate">
                {currentSupervisor.name}
              </span>
              <Badge variant="outline" className={getStatusColor(currentSupervisor.status)}>
                {currentSupervisor.status === 'active' ? 'アクティブ' : 
                 currentSupervisor.status === 'inactive' ? '非アクティブ' : '承認待ち'}
              </Badge>
              {mode === 'edit' && hasPendingChanges && (
                <Badge variant="destructive" className="text-xs animate-pulse">
                  変更待機中
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground truncate">
              {currentSupervisor.employee_code} • {currentSupervisor.job_title || '役職未設定'}
            </div>
          </div>
          <ChevronUp className={`h-4 w-4 ${mode === 'edit' && hasPendingChanges ? 'text-red-500' : 'text-blue-500'}`} />
        </div>
      ) : (
        <div className="p-3 text-center text-sm text-muted-foreground bg-gray-50 rounded-lg border-2 border-dashed">
          {mode === 'edit' && hasPendingChanges ? (
            <span className="text-red-600 font-medium">上司を削除予定</span>
          ) : (
            "上司が設定されていません"
          )}
        </div>
      )}
    </div>
  );
}