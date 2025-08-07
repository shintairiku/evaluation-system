"use client";

import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
  SelectTrigger, 
  SelectValue 
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
  Save,
  X,
  Undo2,
  UserPlus,
  UserMinus
} from "lucide-react";
import { toast } from 'sonner';
import type { UserDetailResponse } from '@/api/types';
import { updateUserAction } from '@/api/server-actions/users';

interface HierarchyEditCardProps {
  user: UserDetailResponse;
  allUsers: UserDetailResponse[];
  isLoading?: boolean;
  onUserUpdate?: (user: UserDetailResponse) => void;
  onPendingChanges?: (hasPendingChanges: boolean, saveHandler?: () => Promise<void>, undoHandler?: () => void) => void;
}

interface PendingChange {
  userId: string;
  newSupervisorId: string | null;
  originalSupervisorId: string | null;
  timestamp: number;
}

interface PendingSubordinateChange {
  subordinateId: string;
  action: 'add' | 'remove';
  timestamp: number;
}

export default function HierarchyEditCard({ 
  user, 
  allUsers, 
  isLoading,
  onUserUpdate,
  onPendingChanges 
}: HierarchyEditCardProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const [pendingSubordinateChanges, setPendingSubordinateChanges] = useState<PendingSubordinateChange[]>([]);
  const [isSaving, setIsSaving] = useState(false);


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

  // Get potential supervisors (excluding self and subordinates to prevent circular hierarchy)
  const potentialSupervisors = useMemo(() => {
    const getSubordinateIds = (userId: string): Set<string> => {
      const subordinateIds = new Set<string>();
      const collectSubordinates = (currentUserId: string) => {
        allUsers.forEach(u => {
          if (u.supervisor?.id === currentUserId) {
            subordinateIds.add(u.id);
            collectSubordinates(u.id); // Recursively collect subordinates
          }
        });
      };
      collectSubordinates(userId);
      return subordinateIds;
    };

    const subordinateIds = getSubordinateIds(user.id);
    
    return allUsers.filter(u => 
      u.id !== user.id && // Not self
      !subordinateIds.has(u.id) && // Not a subordinate
      u.status === 'active' // Only active users
    );
  }, [user.id, allUsers]);

  // Get potential subordinates (users without supervisor or users that could have this user as supervisor)
  const potentialSubordinates = useMemo(() => {
    const currentSubordinateIds = new Set((user.subordinates || []).map(s => s.id));
    
    return allUsers.filter(u => 
      u.id !== user.id && // Not self
      u.supervisor?.id !== user.id && // Not already a subordinate
      u.status === 'active' && // Only active users
      !wouldCreateCircularHierarchy(user.id, u.id) // Prevent circular hierarchy
    );

    function wouldCreateCircularHierarchy(supervisorId: string, potentialSubordinateId: string): boolean {
      // Check if making potentialSubordinate a subordinate of supervisor would create a circle
      let currentId: string | undefined = supervisorId;
      const visited = new Set<string>();
      
      while (currentId && !visited.has(currentId)) {
        if (currentId === potentialSubordinateId) {
          return true; // Would create circle
        }
        visited.add(currentId);
        const currentUser = allUsers.find(u => u.id === currentId);
        currentId = currentUser?.supervisor?.id;
      }
      
      return false;
    }
  }, [user, allUsers]);

  // Get current subordinates with pending changes applied
  const currentSubordinates = useMemo(() => {
    let subordinates = [...(user.subordinates || [])];
    
    // Apply pending changes
    pendingSubordinateChanges.forEach(change => {
      if (change.action === 'add') {
        const userToAdd = allUsers.find(u => u.id === change.subordinateId);
        if (userToAdd && !subordinates.find(s => s.id === change.subordinateId)) {
          subordinates.push(userToAdd);
        }
      } else if (change.action === 'remove') {
        subordinates = subordinates.filter(s => s.id !== change.subordinateId);
      }
    });
    
    return subordinates;
  }, [user.subordinates, pendingSubordinateChanges, allUsers]);

  // Validation function
  const validateHierarchyChange = useCallback((newSupervisorId: string | null): string | null => {
    if (newSupervisorId === user.id) {
      return "ユーザーは自分自身の上司になることはできません";
    }

    if (newSupervisorId) {
      // Check for circular hierarchy
      const wouldCreateCircle = (checkUserId: string, targetSupervisorId: string): boolean => {
        const checkUser = allUsers.find(u => u.id === checkUserId);
        if (!checkUser?.supervisor?.id) return false;
        if (checkUser.supervisor.id === targetSupervisorId) return true;
        return wouldCreateCircle(checkUser.supervisor.id, targetSupervisorId);
      };

      if (wouldCreateCircle(newSupervisorId, user.id)) {
        return "この変更は循環参照を作成するため許可されません";
      }
    }

    return null;
  }, [user.id, allUsers]);

  // Handle supervisor change
  const handleSupervisorChange = useCallback((newSupervisorId: string | null) => {
    // Skip if no change
    const currentSupervisorId = pendingChange 
      ? pendingChange.newSupervisorId 
      : user.supervisor?.id || null;
    
    if (currentSupervisorId === newSupervisorId) return;

    // Validate the change
    const validationError = validateHierarchyChange(newSupervisorId);
    if (validationError) {
      toast.error("階層変更エラー", {
        description: validationError,
      });
      return;
    }

    // Create pending change
    const originalSupervisorId = user.supervisor?.id || null;
    const change: PendingChange = {
      userId: user.id,
      newSupervisorId,
      originalSupervisorId,
      timestamp: Date.now(),
    };

    // If new supervisor is same as original, clear pending change
    if (newSupervisorId === originalSupervisorId) {
      setPendingChange(null);
      return;
    }

    setPendingChange(change);

    const supervisorName = newSupervisorId 
      ? allUsers.find(u => u.id === newSupervisorId)?.name || '不明'
      : 'なし';

    toast.info("変更待機中", {
      description: `${user.name}の上司を${supervisorName}に変更予定。「保存」をクリックして確定してください。`,
    });
  }, [user, allUsers, pendingChange, validateHierarchyChange]);

  // Handle add subordinate
  const handleAddSubordinate = useCallback((subordinateId: string) => {
    const subordinate = allUsers.find(u => u.id === subordinateId);
    if (!subordinate) return;

    // Check if already in pending changes
    const existingChange = pendingSubordinateChanges.find(c => c.subordinateId === subordinateId);
    if (existingChange) {
      if (existingChange.action === 'remove') {
        // Remove the remove action (cancelling removal)
        setPendingSubordinateChanges(prev => 
          prev.filter(c => c.subordinateId !== subordinateId)
        );
        toast.info("削除を取り消しました", {
          description: `${subordinate.name}の削除を取り消しました`,
        });
      }
      return;
    }

    // Add to pending changes
    const change: PendingSubordinateChange = {
      subordinateId,
      action: 'add',
      timestamp: Date.now(),
    };

    setPendingSubordinateChanges(prev => [...prev, change]);

    toast.info("部下追加待機中", {
      description: `${subordinate.name}を部下として追加予定。「保存」をクリックして確定してください。`,
    });
  }, [allUsers, pendingSubordinateChanges]);

  // Handle remove subordinate
  const handleRemoveSubordinate = useCallback((subordinateId: string) => {
    const subordinate = allUsers.find(u => u.id === subordinateId);
    if (!subordinate) return;

    // Check if this is a newly added subordinate (not in original list)
    const wasOriginalSubordinate = user.subordinates?.some(s => s.id === subordinateId);
    const existingAddChange = pendingSubordinateChanges.find(c => 
      c.subordinateId === subordinateId && c.action === 'add'
    );

    if (existingAddChange && !wasOriginalSubordinate) {
      // Just remove the add action (cancelling addition)
      setPendingSubordinateChanges(prev => 
        prev.filter(c => c.subordinateId !== subordinateId)
      );
      toast.info("追加を取り消しました", {
        description: `${subordinate.name}の追加を取り消しました`,
      });
      return;
    }

    // Add remove action for original subordinate
    const change: PendingSubordinateChange = {
      subordinateId,
      action: 'remove',
      timestamp: Date.now(),
    };

    setPendingSubordinateChanges(prev => [...prev, change]);

    toast.info("部下削除待機中", {
      description: `${subordinate.name}を部下から削除予定。「保存」をクリックして確定してください。`,
    });
  }, [allUsers, pendingSubordinateChanges, user.subordinates]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!pendingChange && pendingSubordinateChanges.length === 0) return;

    setIsSaving(true);
    const changesToProcess = [...pendingSubordinateChanges];
    let hasErrors = false;

    try {
      // Save supervisor change first if exists
      if (pendingChange) {
        const result = await updateUserAction(
          pendingChange.userId,
          { supervisor_id: pendingChange.newSupervisorId || undefined }
        );

        if (!result.success) {
          toast.error("上司変更エラー", {
            description: "上司の変更保存に失敗しました",
          });
          hasErrors = true;
        }
      }

      // Process subordinate changes
      for (const change of changesToProcess) {
        try {
          if (change.action === 'add') {
            // Set this user as supervisor for the subordinate
            const result = await updateUserAction(
              change.subordinateId,
              { supervisor_id: user.id }
            );

            if (!result.success) {
              const subordinate = allUsers.find(u => u.id === change.subordinateId);
              toast.error("部下追加エラー", {
                description: `${subordinate?.name || '不明なユーザー'}の追加に失敗しました`,
              });
              hasErrors = true;
            }
          } else if (change.action === 'remove') {
            // Remove supervisor for the subordinate
            const result = await updateUserAction(
              change.subordinateId,
              { supervisor_id: undefined }
            );

            if (!result.success) {
              const subordinate = allUsers.find(u => u.id === change.subordinateId);
              toast.error("部下削除エラー", {
                description: `${subordinate?.name || '不明なユーザー'}の削除に失敗しました`,
              });
              hasErrors = true;
            }
          }
        } catch (error) {
          const subordinate = allUsers.find(u => u.id === change.subordinateId);
          console.error('Error processing subordinate change:', error);
          toast.error("部下変更エラー", {
            description: `${subordinate?.name || '不明なユーザー'}の変更中にエラーが発生しました`,
          });
          hasErrors = true;
        }
      }

      if (!hasErrors) {
        // Clear all pending changes
        setPendingChange(null);
        setPendingSubordinateChanges([]);
        setIsEditMode(false);

        // Refresh user data by fetching updated user
        if (onUserUpdate && user) {
          // For now, we'll trigger a refresh - in a real app you might want to fetch fresh data
          onUserUpdate(user);
        }

        const totalChanges = (pendingChange ? 1 : 0) + changesToProcess.length;
        toast.success("変更保存完了", {
          description: `${totalChanges}件の階層変更が正常に保存されました`,
        });
      } else {
        toast.warning("一部保存完了", {
          description: "一部の変更が保存されました。エラーがあった変更を確認してください。",
        });
      }
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error("保存エラー", {
        description: "変更の保存中に予期しないエラーが発生しました",
      });
    } finally {
      setIsSaving(false);
    }
  }, [pendingChange, pendingSubordinateChanges, user, allUsers, onUserUpdate]);

  // Handle undo
  const handleUndo = useCallback(() => {
    setPendingChange(null);
    setPendingSubordinateChanges([]);
    const totalChanges = (pendingChange ? 1 : 0) + pendingSubordinateChanges.length;
    toast.success("変更を取り消しました", {
      description: `${totalChanges}件の待機中の変更を取り消しました`,
    });
  }, [pendingChange, pendingSubordinateChanges]);

  // Handle cancel edit
  const handleCancelEdit = useCallback(() => {
    setPendingChange(null);
    setPendingSubordinateChanges([]);
    setIsEditMode(false);
  }, []);

  // Notify parent about pending changes
  useEffect(() => {
    const hasPendingChanges = !!(pendingChange || pendingSubordinateChanges.length > 0);
    if (onPendingChanges) {
      onPendingChanges(hasPendingChanges, hasPendingChanges ? handleSave : undefined, hasPendingChanges ? handleUndo : undefined);
    }
  }, [pendingChange, pendingSubordinateChanges, onPendingChanges, handleSave, handleUndo]);

  // Get current supervisor (considering pending change)
  const currentSupervisor = useMemo(() => {
    if (pendingChange) {
      return pendingChange.newSupervisorId 
        ? allUsers.find(u => u.id === pendingChange.newSupervisorId) || null
        : null;
    }
    return user.supervisor;
  }, [user.supervisor, pendingChange, allUsers]);

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
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsEditMode(!isEditMode)}
            disabled={isSaving}
          >
            <Edit3 className="h-4 w-4 mr-2" />
            {isEditMode ? 'プレビュー' : '編集'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Supervisor Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Crown className="h-4 w-4" />
              上司
              {pendingChange && (
                <Badge variant="destructive" className="text-xs animate-pulse ml-2">
                  変更待機中
                </Badge>
              )}
            </Label>
            {isEditMode && (
              <Select
                value={currentSupervisor?.id || 'none'}
                onValueChange={(value) => handleSupervisorChange(value === 'none' ? null : value)}
                disabled={isSaving}
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
              pendingChange ? 'bg-red-50 border-red-200' : 'bg-blue-50'
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
                  {pendingChange && (
                    <Badge variant="destructive" className="text-xs animate-pulse">
                      変更待機中
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground truncate">
                  {currentSupervisor.employee_code} • {currentSupervisor.job_title || '役職未設定'}
                </div>
              </div>
              <ChevronUp className={`h-4 w-4 ${pendingChange ? 'text-red-500' : 'text-blue-500'}`} />
            </div>
          ) : (
            <div className="p-3 text-center text-sm text-muted-foreground bg-gray-50 rounded-lg border-2 border-dashed">
              {pendingChange ? (
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
              部下 ({currentSubordinates.length}人)
              {pendingSubordinateChanges.length > 0 && (
                <Badge variant="destructive" className="text-xs animate-pulse ml-2">
                  {pendingSubordinateChanges.length}件変更待機中
                </Badge>
              )}
            </Label>
            {isEditMode && potentialSubordinates.length > 0 && (
              <Select
                value=""
                onValueChange={handleAddSubordinate}
                disabled={isSaving}
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
          
          {currentSubordinates && currentSubordinates.length > 0 ? (
            <div className="relative">
              <div className={`grid gap-2 max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 ${
                currentSubordinates.length >= 4 ? 'grid-cols-2' : 'grid-cols-1'
              }`}>
              {currentSubordinates.map((subordinate) => {
                const pendingChange = pendingSubordinateChanges.find(c => c.subordinateId === subordinate.id);
                const isOriginalSubordinate = user.subordinates?.some(s => s.id === subordinate.id);
                const isPendingAdd = pendingChange?.action === 'add';
                const isPendingRemove = pendingChange?.action === 'remove';
                
                return (
                  <div key={subordinate.id} className={`flex items-center gap-2 p-2 rounded-md border ${
                    isPendingAdd ? 'bg-green-50 border-green-200' :
                    isPendingRemove ? 'bg-red-50 border-red-200 opacity-60' :
                    'bg-orange-50'
                  }`}>
                    <Avatar className="h-7 w-7 flex-shrink-0">
                      <AvatarFallback className={`text-xs ${
                        isPendingAdd ? 'bg-green-100 text-green-700' :
                        isPendingRemove ? 'bg-red-100 text-red-700' :
                        'bg-orange-100 text-orange-700'
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
                          {isPendingAdd && (
                            <Badge variant="default" className="bg-green-100 text-green-800 text-[10px] px-1 py-0 h-4">
                              追加予定
                            </Badge>
                          )}
                          {isPendingRemove && (
                            <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">
                              削除予定
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
                          {isEditMode && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveSubordinate(subordinate.id)}
                              disabled={isSaving}
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
              pendingChange ? 'bg-red-50' : 'bg-blue-50'
            }`}>
              <div className={`text-lg font-semibold ${
                pendingChange ? 'text-red-700' : 'text-blue-700'
              }`}>
                {currentSupervisor ? '1' : '0'}
                {pendingChange && (
                  <span className="text-xs ml-1 text-red-500">*</span>
                )}
              </div>
              <div className={`text-xs ${
                pendingChange ? 'text-red-600' : 'text-blue-600'
              }`}>上司</div>
            </div>
            <div className={`p-3 rounded-lg text-center ${
              pendingSubordinateChanges.length > 0 ? 'bg-red-50' : 'bg-orange-50'
            }`}>
              <div className={`text-lg font-semibold ${
                pendingSubordinateChanges.length > 0 ? 'text-red-700' : 'text-orange-700'
              }`}>
                {currentSubordinates.length}
                {pendingSubordinateChanges.length > 0 && (
                  <span className="text-xs ml-1 text-red-500">*</span>
                )}
              </div>
              <div className={`text-xs ${
                pendingSubordinateChanges.length > 0 ? 'text-red-600' : 'text-orange-600'
              }`}>部下</div>
            </div>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}