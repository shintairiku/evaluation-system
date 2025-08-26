"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger 
} from "@/components/ui/select";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Users, 
  UserCheck, 
  Crown,
  ChevronDown,
  ChevronUp,
  Edit3,
  UserPlus,
  UserMinus
} from "lucide-react";
import { toast } from 'sonner';
import type { UserDetailResponse } from '@/api/types';
import { useHierarchyEdit } from '@/hooks/useHierarchyEdit';
import { updateUserAction, getUserByIdAction } from '@/api/server-actions/users';

interface HierarchyEditCardProps {
  user: UserDetailResponse;
  allUsers: UserDetailResponse[];
  isLoading?: boolean;
  onUserUpdate?: (user: UserDetailResponse) => void;
  onPendingChanges?: (hasPendingChanges: boolean, saveHandler?: () => Promise<void>, undoHandler?: () => void) => void;
}

export default function HierarchyEditCard({ 
  user, 
  allUsers, 
  isLoading,
  onUserUpdate,
  onPendingChanges 
}: HierarchyEditCardProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [temporarySubordinates, setTemporarySubordinates] = useState<UserDetailResponse[]>([]);

  // Use the custom hierarchy editing hook
  const {
    canEditHierarchy,
    currentUser,
    optimisticState,
    hasPendingChanges,
    isPending,
    changeSupervisor,
    addSubordinate,
    removeSubordinate,
    rollbackChanges,
    saveAllChanges,
    getPotentialSupervisors,
    getPotentialSubordinates
  } = useHierarchyEdit({
    user,
    allUsers,
    onUserUpdate
  });


  // Helper functions
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

  // Get potential supervisors and subordinates from the hook
  const potentialSupervisors = getPotentialSupervisors();
  const potentialSubordinates = getPotentialSubordinates();
  
  // Use the optimistic state from the hook + temporary subordinates for preview
  const currentUser_display = optimisticState;
  const currentSubordinates = currentUser_display.subordinates || [];
  
  // Combine optimistic state with temporary subordinates for immediate preview
  const allSubordinatesForDisplay = [...currentSubordinates, ...temporarySubordinates];

  // Handle supervisor change
  const handleSupervisorChange = useCallback(async (newSupervisorId: string | null) => {
    try {
      await changeSupervisor(newSupervisorId);
      const supervisorName = newSupervisorId 
        ? allUsers.find(u => u.id === newSupervisorId)?.name || '不明'
        : 'なし';
      toast.info("上司変更", {
        description: `${user.name}の上司を${supervisorName}に変更しました`,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '上司の変更に失敗しました';
      toast.error("階層変更エラー", {
        description: errorMsg,
      });
    }
  }, [changeSupervisor, user.name, allUsers]);

  // Handle add subordinate to temporary list for immediate preview (no API call)
  const handleAddTemporarySubordinate = useCallback((subordinateId: string) => {
    const subordinate = allUsers.find(u => u.id === subordinateId);
    if (subordinate && !temporarySubordinates.find(s => s.id === subordinateId)) {
      setTemporarySubordinates(prev => [...prev, subordinate]);
      toast.info("部下を仮選択", {
        description: `${subordinate.name}を部下候補として追加しました（保存まで仮選択）`,
      });
    }
  }, [allUsers, temporarySubordinates]);

  // Handle remove temporary subordinate from preview list
  const handleRemoveTemporarySubordinate = useCallback((subordinateId: string) => {
    const subordinate = temporarySubordinates.find(s => s.id === subordinateId);
    setTemporarySubordinates(prev => prev.filter(s => s.id !== subordinateId));
    if (subordinate) {
      toast.info("仮選択を解除", {
        description: `${subordinate.name}の仮選択を解除しました`,
      });
    }
  }, [temporarySubordinates]);

  // Handle remove actual subordinate
  const handleRemoveSubordinate = useCallback(async (subordinateId: string) => {
    try {
      await removeSubordinate(subordinateId);
      const subordinate = allUsers.find(u => u.id === subordinateId);
      toast.success("部下削除", {
        description: `${subordinate?.name || '不明なユーザー'}を部下から削除しました`,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '部下の削除に失敗しました';
      toast.error("部下削除エラー", {
        description: errorMsg,
      });
    }
  }, [removeSubordinate, allUsers]);

  // Hybrid save handler - supervisor changes via hook, subordinates via direct API calls
  const handleSaveWithTemporary = useCallback(async () => {
    try {
      let successCount = 0;
      
      // First save any supervisor changes via hook
      if (hasPendingChanges) {
        await saveAllChanges();
      }
      
      // Process each temporary subordinate ONE BY ONE (like working 組織図)
      console.log(`[HierarchyCard] Processing ${temporarySubordinates.length} temporary subordinates for user ${user.name}`);
      
      for (const tempSubordinate of temporarySubordinates) {
        try {
          console.log(`[HierarchyCard] Updating subordinate ${tempSubordinate.name} (${tempSubordinate.id}) to have supervisor ${user.name} (${user.id})`);
          
          // Direct API call - exactly like 組織図
          const result = await updateUserAction(tempSubordinate.id, { supervisor_id: user.id });
          
          console.log(`[HierarchyCard] API result for ${tempSubordinate.name}:`, { 
            success: result.success, 
            hasData: !!result.data,
            error: result.error 
          });
          
          if (result.success && result.data) {
            successCount++;
            console.log(`[HierarchyCard] Successfully updated ${tempSubordinate.name}, calling onUserUpdate`);
            
            // Update the subordinate data in the parent list (like 組織図)
            if (onUserUpdate) {
              onUserUpdate(result.data);
            }
          } else {
            console.error(`[HierarchyCard] Failed to add subordinate ${tempSubordinate.name}:`, result.error);
          }
        } catch (error) {
          console.error(`[HierarchyCard] Error adding subordinate ${tempSubordinate.name}:`, error);
        }
      }
      
      // Also get fresh current user data to see ALL updated subordinates (like 組織図)
      console.log(`[HierarchyCard] Fetching fresh data for supervisor ${user.name}. successCount: ${successCount}, hasPendingChanges: ${hasPendingChanges}`);
      
      if (onUserUpdate && (successCount > 0 || hasPendingChanges)) {
        const userResult = await getUserByIdAction(user.id);
        console.log(`[HierarchyCard] Fresh supervisor data result:`, { 
          success: userResult.success, 
          hasData: !!userResult.data,
          subordinatesCount: userResult.data?.subordinates?.length || 0,
          error: userResult.error 
        });
        
        if (userResult.success && userResult.data) {
          console.log(`[HierarchyCard] Calling onUserUpdate with fresh supervisor data`);
          onUserUpdate(userResult.data);
        }
      }
      
      // Clear temporary subordinates after successful save
      setTemporarySubordinates([]);
      
      toast.success("階層変更保存", {
        description: `${successCount}人の部下を含む階層変更を保存しました`,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '階層変更の保存に失敗しました';
      toast.error("保存エラー", {
        description: errorMsg,
      });
    }
  }, [temporarySubordinates, user.id, onUserUpdate, hasPendingChanges, saveAllChanges]);

  // Hybrid rollback handler - clear temporary subordinates and hook changes
  const handleRollbackWithTemporary = useCallback(() => {
    setTemporarySubordinates([]);
    rollbackChanges();
    toast.info("変更をリセット", {
      description: "すべての変更をリセットしました",
    });
  }, [rollbackChanges]);

  // Keep latest handlers in refs to avoid effect churn
  const saveRef = useRef(handleSaveWithTemporary);
  const rollbackRef = useRef(handleRollbackWithTemporary);
  useEffect(() => { saveRef.current = handleSaveWithTemporary; }, [handleSaveWithTemporary]);
  useEffect(() => { rollbackRef.current = handleRollbackWithTemporary; }, [handleRollbackWithTemporary]);

  // Check if there are any changes (hook changes OR temporary subordinates)
  const hasAnyChanges = hasPendingChanges || temporarySubordinates.length > 0;

  // Notify parent about pending changes with stable handler identities
  useEffect(() => {
    if (!onPendingChanges) return;
    const stableSave = hasAnyChanges ? async () => { await saveRef.current(); } : undefined;
    const stableUndo = hasAnyChanges ? () => rollbackRef.current() : undefined;
    onPendingChanges(hasAnyChanges, stableSave, stableUndo);
    // Only react to toggle and parent callback identity
  }, [hasAnyChanges, onPendingChanges]);

  // Get current supervisor from optimistic state
  const currentSupervisor = currentUser_display.supervisor;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            階層関係
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Crown className="h-4 w-4" />
              上司
            </Label>
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            階層関係
            {!canEditHierarchy && currentUser && (
              <Badge variant="secondary" className="text-xs ml-2">
                編集権限なし
              </Badge>
            )}
          </CardTitle>
          {canEditHierarchy && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditMode(!isEditMode)}
              disabled={isPending}
            >
              <Edit3 className="h-4 w-4 mr-2" />
              {isEditMode ? 'プレビュー' : '編集'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Supervisor Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Crown className="h-4 w-4" />
              上司
              {hasPendingChanges && (
                <Badge variant="destructive" className="text-xs animate-pulse ml-2">
                  変更待機中
                </Badge>
              )}
            </Label>
            {isEditMode && canEditHierarchy && (
              <Select
                value={currentSupervisor?.id || 'none'}
                onValueChange={(value) => handleSupervisorChange(value === 'none' ? null : value)}
                disabled={isPending}
              >
                <SelectTrigger className="w-auto">
                  <Crown className="h-4 w-4 mr-2" />
                  上司を変更
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">上司なし</SelectItem>
                  {potentialSupervisors.map((supervisor) => (
                    <SelectItem key={supervisor.id} value={supervisor.id}>
                      <div className="flex items-center gap-2">
                        <span>{supervisor.name}</span>
                        <span className="text-sm text-muted-foreground">
                          ({supervisor.employee_code})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          
          {currentSupervisor ? (
            <div className={`flex items-center gap-3 p-3 rounded-lg border ${
              hasPendingChanges ? 'bg-red-50 border-red-200' : 'bg-blue-50'
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
                  {hasPendingChanges && (
                    <Badge variant="destructive" className="text-xs animate-pulse">
                      変更待機中
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground truncate">
                  {currentSupervisor.employee_code} • {currentSupervisor.job_title || '役職未設定'}
                </div>
              </div>
              <ChevronUp className={`h-4 w-4 ${hasPendingChanges ? 'text-red-500' : 'text-blue-500'}`} />
            </div>
          ) : (
            <div className="p-3 text-center text-sm text-muted-foreground bg-gray-50 rounded-lg border-2 border-dashed">
              {hasPendingChanges ? (
                <span className="text-red-600 font-medium">上司を削除予定</span>
              ) : (
                "上司が設定されていません"
              )}
            </div>
          )}
        </div>

        {/* Current User Position */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            現在のユーザー
          </Label>
          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border-2 border-green-200">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-green-100 text-green-700 text-sm">
                {getUserInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">
                  {user.name}
                </span>
                <Badge variant="outline" className={getStatusColor(user.status)}>
                  {user.status === 'active' ? 'アクティブ' : 
                   user.status === 'inactive' ? '非アクティブ' : '承認待ち'}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground truncate">
                {user.employee_code} • {user.job_title || '役職未設定'}
              </div>
            </div>
          </div>
        </div>

        {/* Subordinates Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <ChevronDown className="h-4 w-4" />
              部下 ({allSubordinatesForDisplay.length}人)
              {(hasAnyChanges) && (
                <Badge variant="destructive" className="text-xs animate-pulse ml-2">
                  変更待機中
                </Badge>
              )}
            </Label>
            {isEditMode && canEditHierarchy && potentialSubordinates.length > 0 && (
              <Select
                value=""
                onValueChange={handleAddTemporarySubordinate}
                disabled={isPending}
              >
                <SelectTrigger className="w-auto">
                  <UserPlus className="h-4 w-4 mr-2" />
                  部下を追加
                </SelectTrigger>
                <SelectContent>
                  {potentialSubordinates.map((potential) => (
                    <SelectItem key={potential.id} value={potential.id}>
                      <div className="flex items-center gap-2">
                        <span>{potential.name}</span>
                        <span className="text-sm text-muted-foreground">
                          ({potential.employee_code})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          
          {allSubordinatesForDisplay && allSubordinatesForDisplay.length > 0 ? (
            <div className="relative">
              <div className={`grid gap-2 max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 ${
                allSubordinatesForDisplay.length >= 4 ? 'grid-cols-2' : 'grid-cols-1'
              }`}>
              {allSubordinatesForDisplay.map((subordinate) => {
                const isTemporary = temporarySubordinates.some(temp => temp.id === subordinate.id);
                const isActual = currentSubordinates.some(actual => actual.id === subordinate.id);
                
                return (
                  <div key={subordinate.id} className={`flex items-center gap-2 p-2 rounded-md border ${
                    isTemporary ? 'bg-yellow-50 border-yellow-200' : 'bg-orange-50'
                  }`}>
                    <Avatar className="h-7 w-7 flex-shrink-0">
                      <AvatarFallback className={`text-xs ${
                        isTemporary ? 'bg-yellow-100 text-yellow-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {getUserInitials(subordinate.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-medium text-xs truncate">
                          {subordinate.name}
                        </span>
                        <div className="flex items-center gap-1">
                          {isTemporary && (
                            <Badge variant="default" className="bg-yellow-100 text-yellow-800 text-[10px] px-1 py-0 h-4">
                              仮選択
                            </Badge>
                          )}
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
                          {isEditMode && canEditHierarchy && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => isTemporary ? 
                                handleRemoveTemporarySubordinate(subordinate.id) : 
                                handleRemoveSubordinate(subordinate.id)
                              }
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
                );
              })}
              </div>
            </div>
          ) : (
            <div className="p-3 text-center text-sm text-muted-foreground bg-gray-50 rounded-lg border-2 border-dashed">
              部下がいません
            </div>
          )}
        </div>

        {/* Summary Statistics */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            組織情報
          </Label>
          <div className="grid grid-cols-2 gap-3">
            <div className={`p-3 rounded-lg text-center ${
              hasPendingChanges ? 'bg-red-50' : 'bg-blue-50'
            }`}>
              <div className={`text-lg font-semibold ${
                hasPendingChanges ? 'text-red-700' : 'text-blue-700'
              }`}>
                {currentSupervisor ? '1' : '0'}
                {hasPendingChanges && (
                  <span className="text-xs ml-1 text-red-500">*</span>
                )}
              </div>
              <div className={`text-xs ${
                hasPendingChanges ? 'text-red-600' : 'text-blue-600'
              }`}>上司</div>
            </div>
            <div className={`p-3 rounded-lg text-center ${
              hasAnyChanges ? 'bg-red-50' : 'bg-orange-50'
            }`}>
              <div className={`text-lg font-semibold ${
                hasAnyChanges ? 'text-red-700' : 'text-orange-700'
              }`}>
                {allSubordinatesForDisplay.length}
                {hasAnyChanges && (
                  <span className="text-xs ml-1 text-red-500">*</span>
                )}
              </div>
              <div className={`text-xs ${
                hasAnyChanges ? 'text-red-600' : 'text-orange-600'
              }`}>部下</div>
            </div>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}