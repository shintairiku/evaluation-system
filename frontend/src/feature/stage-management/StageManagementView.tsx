'use client';

import { useState, useMemo } from 'react';
import type { Stage, UserDetailResponse } from '@/api/types';
import type { StageData, UserCardData } from './types';
import StageGrid from './components/StageGrid';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface StageManagementViewProps {
  initialStages: Stage[];
  initialUsers: UserDetailResponse[];
}

/**
 * Main Stage Management View Component
 * 
 * Follows the pattern established in UserManagementWithSearch.tsx
 * Implements the component hierarchy specified in .kiro design.md:
 * StageManagementPage > StageManagementView > StageGrid > StageColumn > UserCard
 */
export default function StageManagementView({ 
  initialStages, 
  initialUsers 
}: StageManagementViewProps) {
  const [error, setError] = useState<string | null>(null);

  // Transform initial data into StageData format with users per stage
  const stagesWithUsers: StageData[] = useMemo(() => {
    return initialStages.map(stage => ({
      ...stage,
      users: initialUsers
        .filter(user => user.stage?.id === stage.id)
        .map((user): UserCardData => ({
          id: user.id,
          name: user.name,
          employee_code: user.employee_code,
          job_title: user.job_title,
          email: user.email,
          current_stage_id: user.stage?.id || stage.id,
        }))
    }));
  }, [initialStages, initialUsers]);

  // Handle errors from child components
  const handleError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const clearError = () => {
    setError(null);
  };

  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stage Grid with drag & drop functionality */}
      <StageGrid 
        initialStages={stagesWithUsers}
        onError={handleError}
        onClearError={clearError}
      />
    </div>
  );
}