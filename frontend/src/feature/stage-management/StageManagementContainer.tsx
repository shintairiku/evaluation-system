'use client';

import { useState, useCallback } from 'react';
import type { Stage, UserDetailResponse } from '@/api/types';
import StageManagementHeader from './components/StageManagementHeader';
import StageManagementView from './StageManagementView';

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
  const [filteredUsers, setFilteredUsers] = useState<UserDetailResponse[]>(initialUsers);

  const handleFilteredUsers = useCallback((users: UserDetailResponse[]) => {
    console.log('📦 Container received filtered users:', users.length, users.map(u => u.name));
    setFilteredUsers(users);
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header with Search */}
      <StageManagementHeader
        users={initialUsers}
        total={total}
        onFilteredUsers={handleFilteredUsers}
      />

      {/* Stage Management Interface */}
      <StageManagementView
        initialStages={initialStages}
        initialUsers={filteredUsers}
      />
    </div>
  );
}