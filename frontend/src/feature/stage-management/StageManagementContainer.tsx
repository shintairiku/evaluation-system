'use client';

import { useState, useCallback } from 'react';
import type { Stage, UserDetailResponse } from '@/api/types';
import StageManagementHeader from './components/StageManagementHeader';
import StageManagementView from './StageManagementView';
import StageWeightConfig from './components/StageWeightConfig';

interface StageManagementContainerProps {
  initialStages: Stage[];
  initialUsers: UserDetailResponse[];
  total: number;
}

/**
 * Container component that manages state between header search and stage view
 * Handles the filtering communication between components
 */
export default function StageManagementContainer({
  initialStages,
  initialUsers,
  total
}: StageManagementContainerProps) {
  const [viewMode, setViewMode] = useState<'users' | 'weights'>('users');
  const [stages, setStages] = useState<Stage[]>(initialStages);
  const [filteredUsers, setFilteredUsers] = useState<UserDetailResponse[]>(initialUsers);

  const handleFilteredUsers = useCallback((users: UserDetailResponse[]) => {
    setFilteredUsers(users);
  }, []);

  const handleStageUpdated = useCallback((updatedStage: Stage) => {
    setStages((prev) =>
      prev.map((stage) =>
        stage.id === updatedStage.id ? { ...stage, ...updatedStage } : stage
      )
    );
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header with Search */}
      <StageManagementHeader
        users={initialUsers}
        total={total}
        onFilteredUsers={handleFilteredUsers}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {viewMode === 'users' ? (
        <StageManagementView
          stages={stages}
          users={filteredUsers}
        />
      ) : (
        <StageWeightConfig
          stages={stages}
          onStageUpdated={handleStageUpdated}
        />
      )}
    </div>
  );
}
