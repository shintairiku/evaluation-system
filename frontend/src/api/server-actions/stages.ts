'use server';

import { cache } from 'react';
import { revalidateTag } from 'next/cache';
import { stagesApi } from '../endpoints/stages';
import { CACHE_TAGS } from '../utils/cache';
import type { 
  Stage, 
  StageDetail, 
  StageCreate, 
  StageUpdate,
  StageWithUserCount,
  StageWeightUpdate,
  StageWeightHistoryEntry,
  UUID,
} from '../types';

/**
 * Server action to get all stages with request memoization.
 * Data caching is handled at the fetch level.
 */
export const getStagesAction = cache(async (): Promise<{
  success: boolean;
  data?: Stage[];
  error?: string;
}> => {
  try {
    const response = await stagesApi.getStages();
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to fetch stages',
      };
    }
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Get stages action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while fetching stages',
    };
  }
});

/**
 * Server action to get a specific stage by ID with request memoization.
 * Data caching is handled at the fetch level.
 */
export const getStageByIdAction = cache(async (stageId: UUID): Promise<{
  success: boolean;
  data?: StageDetail;
  error?: string;
}> => {
  try {
    const response = await stagesApi.getStageById(stageId);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to fetch stage',
      };
    }
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Get stage by ID action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while fetching stage',
    };
  }
});

/**
 * Server action to create a new stage with cache revalidation
 */
export async function createStageAction(stageData: StageCreate): Promise<{
  success: boolean;
  data?: StageDetail;
  error?: string;
}> {
  try {
    const response = await stagesApi.createStage(stageData);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to create stage',
      };
    }
    
    // Revalidate stages list cache after successful creation
    revalidateTag(CACHE_TAGS.STAGES);
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Create stage action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while creating stage',
    };
  }
}

/**
 * Server action to update an existing stage with cache revalidation
 */
export async function updateStageAction(stageId: UUID, updateData: StageUpdate): Promise<{
  success: boolean;
  data?: StageDetail;
  error?: string;
}> {
  try {
    const response = await stagesApi.updateStage(stageId, updateData);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to update stage',
      };
    }
    
    // Revalidate stages list and individual stage cache after successful update
    revalidateTag(CACHE_TAGS.STAGES);
    revalidateTag(`${CACHE_TAGS.STAGES}:${stageId}`);
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Update stage action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while updating stage',
    };
  }
}

/**
 * Server action to delete a stage with cache revalidation
 */
export async function deleteStageAction(stageId: UUID): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const response = await stagesApi.deleteStage(stageId);
    
    if (!response.success) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to delete stage',
      };
    }
    
    // Revalidate stages list and individual stage cache after successful deletion
    revalidateTag(CACHE_TAGS.STAGES);
    revalidateTag(`${CACHE_TAGS.STAGES}:${stageId}`);
    
    return {
      success: true,
    };
  } catch (error) {
    console.error('Delete stage action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while deleting stage',
    };
  }
}

/**
 * Server action to get stages for admin with user counts.
 * This action cannot be cached due to the use of Clerk's auth(),
 * which is a dynamic function not supported in cached operations.
 */
export async function getStagesAdminAction(): Promise<{
  success: boolean;
  data?: StageWithUserCount[];
  error?: string;
}> {
  try {
    const response = await stagesApi.getStagesAdmin();
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to fetch admin stages',
      };
    }
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Get admin stages action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while fetching admin stages',
    };
  }
}

export async function updateStageWeightsAction(stageId: UUID, updateData: StageWeightUpdate): Promise<{
  success: boolean;
  data?: StageDetail;
  error?: string;
}> {
  try {
    const response = await stagesApi.updateStageWeights(stageId, updateData);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to update stage weights',
      };
    }

    revalidateTag(CACHE_TAGS.STAGES);
    revalidateTag(`${CACHE_TAGS.STAGES}:${stageId}`);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Update stage weights action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while updating stage weights',
    };
  }
}

export async function getStageWeightHistoryAction(stageId: UUID, limit = 20): Promise<{
  success: boolean;
  data?: StageWeightHistoryEntry[];
  error?: string;
}> {
  try {
    const response = await stagesApi.getStageWeightHistory(stageId, limit);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to fetch stage weight history',
      };
    }

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Get stage weight history action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while fetching stage weight history',
    };
  }
}
