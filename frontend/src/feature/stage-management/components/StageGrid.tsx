'use client';

import { useState, useCallback, useEffect } from 'react';
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay } from '@dnd-kit/core';
import type { StageData, UserCardData, UserStageChange } from '../types';
import StageColumn from './StageColumn';
import UserCard from './UserCard';
import EditModeControls from './EditModeControls';
import { updateUserStagesAction } from '@/api/server-actions/stage-management';

interface StageGridProps {
  initialStages: StageData[];
  onError: (error: string) => void;
  onClearError: () => void;
}

/**
 * Stage Grid Component with Drag & Drop functionality
 * 
 * Implements the drag & drop behavior specified in .kiro requirements.md:
 * - WHEN 管理者がユーザーカードをドラッグ&ドロップする THEN システムは編集モードを有効化する
 * - WHEN 編集モード中 THEN 管理者は複数のユーザーを移動できる
 * - WHEN 管理者が「保存」ボタンをクリックしない限り THEN システムはDBに変更を反映しない
 */
export default function StageGrid({ initialStages, onError, onClearError }: StageGridProps) {
  const [stages, setStages] = useState<StageData[]>(initialStages);
  const [editMode, setEditMode] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<UserStageChange[]>([]);
  const [activeUser, setActiveUser] = useState<UserCardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Hydration guard to prevent SSR/CSR mismatch with drag and drop
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Update stages when initialStages changes (from search filtering)
  useEffect(() => {
    setStages(initialStages);
  }, [initialStages]);

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const draggedUser = stages
      .flatMap(stage => stage.users)
      .find(user => user.id === active.id);
    
    if (draggedUser) {
      setActiveUser(draggedUser);
    }
  }, [stages]);

  // Handle drag end - core logic for stage management
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveUser(null);

    if (!over || active.id === over.id) return;

    const userId = active.id as string;
    const newStageId = over.id as string;

    // Find current stage of the user
    const currentStage = stages.find(stage => 
      stage.users.some(user => user.id === userId)
    );

    if (!currentStage || currentStage.id === newStageId) return;

    // Activate edit mode on first drag & drop (requirement 1.3)
    if (!editMode) {
      setEditMode(true);
    }

    // Add to pending changes
    const newChange: UserStageChange = {
      userId: userId,
      fromStageId: currentStage.id,
      toStageId: newStageId
    };

    // Remove any existing change for this user and add the new one
    setPendingChanges(prev => [
      ...prev.filter(change => change.userId !== userId),
      newChange
    ]);

    // Optimistically update the UI
    setStages(prev => {
      const newStages = prev.map(stage => ({ ...stage, users: [...stage.users] }));
      
      // Remove user from current stage
      const fromStage = newStages.find(s => s.id === currentStage.id);
      if (fromStage) {
        fromStage.users = fromStage.users.filter(user => user.id !== userId);
      }
      
      // Add user to new stage
      const toStage = newStages.find(s => s.id === newStageId);
      const userToMove = currentStage.users.find(user => user.id === userId);
      if (toStage && userToMove) {
        toStage.users.push({
          ...userToMove,
          current_stage_id: newStageId
        });
      }
      
      return newStages;
    });

    onClearError();
  }, [stages, editMode, onClearError]);

  // Handle save - batch update all pending changes
  const handleSave = useCallback(async () => {
    if (!pendingChanges.length) return;

    setIsLoading(true);
    onClearError();

    try {
      const result = await updateUserStagesAction(pendingChanges);
      
      if (result.success) {
        // Success - clear edit mode and pending changes
        setEditMode(false);
        setPendingChanges([]);
        // The page will be revalidated automatically by the server action
      } else {
        onError(result.error || 'ユーザーステージの更新に失敗しました');
        // Optionally revert optimistic updates here
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : '予期しないエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  }, [pendingChanges, onError, onClearError]);

  // Handle cancel - revert all optimistic changes
  const handleCancel = useCallback(() => {
    setStages(initialStages);
    setPendingChanges([]);
    setEditMode(false);
    onClearError();
  }, [initialStages, onClearError]);

  // Show static version during SSR to prevent hydration mismatch
  if (!isMounted) {
    return (
      <div className="space-y-6">
        {/* Static stage columns grid - no drag and drop during SSR */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {stages.map(stage => (
            <StageColumn
              key={stage.id}
              stage={stage}
              editMode={false}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DndContext
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Stage columns grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {stages.map(stage => (
            <StageColumn
              key={stage.id}
              stage={stage}
              editMode={editMode}
            />
          ))}
        </div>

        {/* Drag overlay for better visual feedback */}
        <DragOverlay>
          {activeUser && (
            <UserCard 
              user={activeUser} 
              isDragOverlay 
            />
          )}
        </DragOverlay>
      </DndContext>

      {/* Edit mode controls - appears when there are pending changes */}
      {editMode && pendingChanges.length > 0 && (
        <EditModeControls
          pendingChangesCount={pendingChanges.length}
          onSave={handleSave}
          onCancel={handleCancel}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}