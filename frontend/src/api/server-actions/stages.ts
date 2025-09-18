'use server';

import { revalidateTag } from 'next/cache';
import { stagesApi } from '../endpoints/stages';
import { createFullyCachedAction, CACHE_TAGS } from '../utils/cache';
import type { 
  Stage, 
  StageDetail, 
  StageCreate, 
  StageUpdate,
  StageWithUserCount,
  UUID,
} from '../types';

/**
 * Server action to get all stages with caching
 */
async function _getStagesAction(): Promise<{
  success: boolean;
  data?: Stage[];
  error?: string;
}> {
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
}

export const getStagesAction = createFullyCachedAction(
  _getStagesAction,
  'getStages',
  CACHE_TAGS.STAGES
);

/**
 * Server action to get a specific stage by ID with caching
 */
async function _getStageByIdAction(stageId: UUID): Promise<{
  success: boolean;
  data?: StageDetail;
  error?: string;
}> {
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
}

export const getStageByIdAction = createFullyCachedAction(
  _getStageByIdAction,
  'getStageById',
  CACHE_TAGS.STAGES
);

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
    
    // Revalidate stages cache after successful creation
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
    
    // Revalidate stages cache after successful update
    revalidateTag(CACHE_TAGS.STAGES);
    
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
    
    // Revalidate stages cache after successful deletion
    revalidateTag(CACHE_TAGS.STAGES);
    
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
 * Server action to get stages for admin with user counts and caching
 */
async function _getStagesAdminAction(): Promise<{
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

// Cannot use caching with Clerk auth() calls due to Next.js restrictions
// Dynamic data sources (auth) are not supported inside cached functions
export const getStagesAdminAction = _getStagesAdminAction;
