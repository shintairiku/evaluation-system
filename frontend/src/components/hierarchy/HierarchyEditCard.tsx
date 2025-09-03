"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit3 } from "lucide-react";
import { toast } from 'sonner';
import HierarchyCard from './HierarchyCard';
import SupervisorSelector from './components/SupervisorSelector';
import SubordinateManager from './components/SubordinateManager';
import HierarchyDisplay from './components/HierarchyDisplay';
import { useHierarchyEdit } from './hooks/useHierarchyEdit';
import type { UserDetailResponse } from '@/api/types';

interface HierarchyEditCardProps {
  user: UserDetailResponse;
  allUsers: UserDetailResponse[];
  isLoading?: boolean;
  onUserUpdate?: (user: UserDetailResponse) => void;
  onPendingChanges?: (hasPendingChanges: boolean, saveHandler?: () => Promise<void>, undoHandler?: () => void) => void;
  initialEditMode?: boolean;
}

export default function HierarchyEditCard({ 
  user, 
  allUsers, 
  isLoading,
  onUserUpdate,
  onPendingChanges,
  initialEditMode = false
}: HierarchyEditCardProps) {
  const [isEditMode, setIsEditMode] = useState(initialEditMode);

  // Use the hierarchy editing hook for all operations
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

  const currentSubordinates = optimisticState.subordinates || [];
  const currentSupervisor = optimisticState.supervisor;

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
  }, [changeSupervisor, user, allUsers]);

  const handleSupervisorSelect = useCallback(async (supervisorId: string) => {
    await handleSupervisorChange(supervisorId);
  }, [handleSupervisorChange]);

  const handleSupervisorRemove = useCallback(async () => {
    await handleSupervisorChange(null);
  }, [handleSupervisorChange]);

  // Handle subordinates
  const handleAddSubordinate = useCallback(async (subordinateId: string) => {
    try {
      await addSubordinate(subordinateId);
      const subordinate = allUsers.find(u => u.id === subordinateId);
      toast.info("部下追加", {
        description: `${subordinate?.name || '不明なユーザー'}を部下として追加しました`,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '部下の追加に失敗しました';
      toast.error("部下追加エラー", {
        description: errorMsg,
      });
    }
  }, [addSubordinate, allUsers]);

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

  // Handle save all changes
  const handleSaveAllChanges = useCallback(async () => {
    try {
      await saveAllChanges();
      toast.success("変更保存完了", {
        description: "階層変更が正常に保存されました",
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '変更の保存に失敗しました';
      toast.error("保存エラー", {
        description: errorMsg,
      });
    }
  }, [saveAllChanges]);

  // Handle rollback changes
  const handleRollbackChanges = useCallback(() => {
    rollbackChanges();
    toast.info("変更をリセット", {
      description: "すべての変更をリセットしました",
    });
  }, [rollbackChanges]);

  // Keep latest handlers in refs to avoid effect churn
  const saveRef = useRef(handleSaveAllChanges);
  const rollbackRef = useRef(handleRollbackChanges);
  useEffect(() => { saveRef.current = handleSaveAllChanges; }, [handleSaveAllChanges]);
  useEffect(() => { rollbackRef.current = handleRollbackChanges; }, [handleRollbackChanges]);

  // Notify parent about pending changes
  useEffect(() => {
    if (!onPendingChanges) return;
    const stableSave = hasPendingChanges ? async () => { await saveRef.current(); } : undefined;
    const stableUndo = hasPendingChanges ? () => rollbackRef.current() : undefined;
    onPendingChanges(hasPendingChanges, stableSave, stableUndo);
  }, [hasPendingChanges, onPendingChanges]);

  if (isLoading) {
    return (
      <HierarchyCard mode="edit">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-12" />
            </div>
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
        </div>
      </HierarchyCard>
    );
  }

  return (
    <div className="space-y-4">
      <HierarchyCard mode="edit">
        {/* Header with Edit Toggle */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {!canEditHierarchy && currentUser && (
              <Badge variant="secondary" className="text-xs">
                編集権限なし
              </Badge>
            )}
          </div>
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

        {/* Supervisor Section */}
        <SupervisorSelector
          mode="edit"
          currentSupervisor={currentSupervisor}
          potentialSupervisors={getPotentialSupervisors()}
          onSupervisorChange={handleSupervisorSelect}
          onSupervisorRemove={handleSupervisorRemove}
          hasPendingChanges={hasPendingChanges}
          canEdit={isEditMode && canEditHierarchy}
          isPending={isPending}
        />

        {/* Current User Display */}
        <HierarchyDisplay
          mode="edit"
          userName={user.name}
          userEmail={user.email}
          user={user}
          currentSupervisor={currentSupervisor}
          currentSubordinates={currentSubordinates}
          hasPendingChanges={hasPendingChanges}
        />

        {/* Subordinates Section */}
        <SubordinateManager
          mode="edit"
          currentSubordinates={currentSubordinates}
          potentialSubordinates={getPotentialSubordinates()}
          onSubordinateAdd={handleAddSubordinate}
          onSubordinateRemove={handleRemoveSubordinate}
          hasPendingChanges={hasPendingChanges}
          canEdit={isEditMode && canEditHierarchy}
          isPending={isPending}
        />
      </HierarchyCard>
    </div>
  );
}