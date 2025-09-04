"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronDown, UserPlus, UserMinus } from "lucide-react";
import UserSearchCommand from './UserSearchCommand';
import type { UserDetailResponse } from '@/api/types/user';
import type { HierarchyMode } from '../types';

interface SubordinateManagerProps {
  mode: HierarchyMode;
  currentSubordinates: UserDetailResponse[];
  potentialSubordinates: UserDetailResponse[];
  onSubordinateAdd: (subordinateId: string) => void;
  onSubordinateRemove: (subordinateId: string) => void;
  hasPendingChanges?: boolean;
  canEdit?: boolean;
  isPending?: boolean;
}

export default function SubordinateManager({
  mode,
  currentSubordinates,
  potentialSubordinates,
  onSubordinateAdd,
  onSubordinateRemove,
  hasPendingChanges = false,
  canEdit = true,
  isPending = false
}: SubordinateManagerProps) {
  const [subordinatePopoverOpen, setSubordinatePopoverOpen] = useState(false);

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

  const handleSubordinateSelect = (subordinateId: string) => {
    setSubordinatePopoverOpen(false);
    onSubordinateAdd(subordinateId);
  };

  // Filter out already selected subordinates from potential subordinates
  const availableSubordinates = potentialSubordinates.filter(
    potential => !currentSubordinates.some(current => current.id === potential.id)
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <ChevronDown className="h-4 w-4" />
          部下 ({currentSubordinates.length}人)
          {mode === 'edit' && hasPendingChanges && (
            <Badge variant="destructive" className="text-xs animate-pulse ml-2">
              変更待機中
            </Badge>
          )}
        </Label>
        {canEdit && availableSubordinates.length > 0 && (
          <Popover open={subordinatePopoverOpen} onOpenChange={setSubordinatePopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                部下を追加
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start">
              <UserSearchCommand
                placeholder="部下を検索..."
                emptyMessage="該当する部下がいません"
                users={availableSubordinates}
                onUserSelect={handleSubordinateSelect}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>
      
      {currentSubordinates && currentSubordinates.length > 0 ? (
        <div className="relative">
          <div className={`grid gap-2 max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 ${
            currentSubordinates.length >= 4 ? 'grid-cols-2' : 'grid-cols-1'
          }`}>
          {currentSubordinates.map((subordinate) => (
            <div key={subordinate.id} className="flex items-center gap-2 p-2 rounded-md border bg-orange-50">
              <Avatar className="h-7 w-7 flex-shrink-0">
                <AvatarFallback className="text-xs bg-orange-100 text-orange-700">
                  {getUserInitials(subordinate.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-medium text-xs truncate">
                    {subordinate.name}
                  </span>
                  <div className="flex items-center gap-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className={`${getStatusColor(subordinate.status)} text-[10px] px-1 py-0 h-4 cursor-help`}>
                            {subordinate.status === 'active' ? 'A' : 
                             subordinate.status === 'inactive' ? 'I' : 'P'}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{subordinate.status === 'active' ? 'アクティブ' : 
                             subordinate.status === 'inactive' ? '非アクティブ' : '承認待ち'}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {canEdit && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onSubordinateRemove(subordinate.id)}
                        disabled={isPending}
                        className="h-4 w-4 p-0 hover:bg-red-100"
                      >
                        <UserMinus className="h-3 w-3 text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {subordinate.employee_code} • {subordinate.job_title || '役職未設定'}
                </div>
              </div>
            </div>
          ))}
          </div>
        </div>
      ) : (
        <div className="p-3 text-center text-sm text-muted-foreground bg-gray-50 rounded-lg border-2 border-dashed">
          部下がいません
        </div>
      )}
    </div>
  );
}