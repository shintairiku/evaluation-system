'use client';

import { useState, useCallback, useEffect } from 'react';
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay } from '@dnd-kit/core';

import type { StageData, UserCardData, UserStageChange } from '../types';
import { useHydration } from '../hooks/useHydration';
import { useStageNotifications } from '../hooks/useStageNotifications';
import { getGridClasses } from '../utils/classNames';
import { updateUserStagesAction, updateStageAction } from '@/api/server-actions/stage-management';

import StageColumn from './StageColumn';
import UserCard from './UserCard';
import EditModeControls from './EditModeControls';
import StageEditModal from './StageEditModal';

interface StageGridProps {
  /** Initial stages data with users */
  initialStages: StageData[];
  /** Error handler callback */
  onError: (error: string) => void;
  /** Error clearing callback */
  onClearError: () => void;
}

/**
 * Stage Grid Component with Drag & Drop functionality
 * 
 * Implements the drag & drop behavior with the following requirements:
 * - WHEN administrator drags & drops a user card THEN system enables edit mode
 * - WHEN in edit mode THEN administrator can move multiple users
 * - WHEN administrator doesn't click "save" button THEN system doesn't persist changes to DB
 */
export default function StageGrid({ initialStages, onError, onClearError }: StageGridProps) {
  const [stages, setStages] = useState<StageData[]>(initialStages);
  const [editMode, setEditMode] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<UserStageChange[]>([]);
  const [activeUser, setActiveUser] = useState<UserCardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [editingStage, setEditingStage] = useState<StageData | null>(null);
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  
  const isMounted = useHydration();
  const { showSuccess, showError, handleServerActionResult } = useStageNotifications(onError, onClearError);

  // Update stages when initialStages changes (from search filtering)
  useEffect(() => {
    setStages(initialStages);
  }, [initialStages]);

  // Handle stage edit modal
  const handleEditStage = useCallback((stage: StageData) => {
    setEditingStage(stage);
    setIsStageModalOpen(true);
  }, []);

  const handleCloseStageModal = useCallback(() => {
    setIsStageModalOpen(false);
    setEditingStage(null);
  }, []);

  const handleSaveStage = useCallback(async (stageId: string, title: string, description: string) => {
    setIsLoading(true);

    try {
      const result = await updateStageAction(stageId, { name: title, description });
      const actionResult = handleServerActionResult(result, 'ステージが正常に更新されました');
      
      if (actionResult.success) {
        // Update local state optimistically
        setStages(prev => prev.map(stage => 
          stage.id === stageId 
            ? { ...stage, name: title, description }
            : stage
        ));
      }
    } catch (error) {
      showError(error);
    } finally {
      setIsLoading(false);
    }
  }, [handleServerActionResult, showError]);

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

    try {
      const result = await updateUserStagesAction(pendingChanges);
      const actionResult = handleServerActionResult(result, 'ユーザーステージが正常に更新されました');
      
      if (actionResult.success) {
        // Success - clear edit mode and pending changes
        setEditMode(false);
        setPendingChanges([]);
        // The page will be revalidated automatically by the server action
      }
      // Optionally revert optimistic updates on error
    } catch (error) {
      showError(error);
    } finally {
      setIsLoading(false);
    }
  }, [pendingChanges, handleServerActionResult, showError]);

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
        <div className={getGridClasses()}>
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
      {/* Edit mode controls - appears when there are pending changes */}
      {editMode && pendingChanges.length > 0 && (
        <EditModeControls
          pendingChangesCount={pendingChanges.length}
          onSave={handleSave}
          onCancel={handleCancel}
          isLoading={isLoading}
        />
      )}

      <DndContext
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Stage columns grid */}
        <div className={getGridClasses()}>
          {stages.map(stage => (
            <StageColumn
              key={stage.id}
              stage={stage}
              editMode={editMode}
              onEditStage={handleEditStage}
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

      {/* Stage Edit Modal */}
      <StageEditModal
        stage={editingStage}
        isOpen={isStageModalOpen}
        onClose={handleCloseStageModal}
        onSave={handleSaveStage}
        isLoading={isLoading}
      />
    </div>
  );
}