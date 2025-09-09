'use server';

import { revalidatePath } from 'next/cache';
import { usersApi } from '../endpoints/users';
import type { UUID } from '../types';

export interface UserStageChange {
  userId: UUID;
  fromStageId: UUID;
  toStageId: UUID;
}

export interface ServerActionResponse {
  success: boolean;
  error?: string;
}

/**
 * Server Action to update multiple user stages
 * Implements the batch update pattern specified in .kiro design.md
 * Uses individual PATCH calls per user as per the sequence diagram
 */
export async function updateUserStagesAction(
  changes: UserStageChange[]
): Promise<ServerActionResponse> {
  try {
    if (!changes.length) {
      return { success: true };
    }

    // Process updates individually as specified in .kiro design.md
    // This follows the sequence: SC->>API: PATCH /api/v1/users/{id}/stage
    const updateResults = await Promise.allSettled(
      changes.map(async (change) => {
        const result = await usersApi.updateUserStage(change.userId, {
          stage_id: change.toStageId
        });
        
        if (!result.success) {
          throw new Error(`Failed to update user ${change.userId}: ${result.error}`);
        }
        
        return result;
      })
    );

    // Check for any failures
    const failures = updateResults
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map(result => result.reason);

    if (failures.length > 0) {
      console.error('Stage update failures:', failures);
      return {
        success: false,
        error: `${failures.length} updates failed. Check server logs for details.`
      };
    }

    // Revalidate the stage management page to show updated data
    // This triggers a fresh server-side data fetch
    revalidatePath('/stage-management');

    return { success: true };

  } catch (error) {
    console.error('Server action error (updateUserStagesAction):', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}