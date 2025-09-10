'use server';

import { stagesApi } from '../endpoints/stages';
import type { 
  Stage, 
  StageDetail, 
  StageCreate, 
  StageUpdate,
  StageWithUserCount,
  UUID,
} from '../types';

/**
 * Server action to get all stages
 */
export async function getStagesAction(): Promise<{
  success: boolean;
  data?: Stage[];
  error?: string;
}> {
  try {
    const response = await stagesApi.getStages();
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to fetch stages',
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

/**
 * Server action to get a specific stage by ID
 */
export async function getStageByIdAction(stageId: UUID): Promise<{
  success: boolean;
  data?: StageDetail;
  error?: string;
}> {
  try {
    const response = await stagesApi.getStageById(stageId);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to fetch stage',
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

/**
 * Server action to create a new stage
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
        error: response.error || 'Failed to create stage',
      };
    }
    
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
 * Server action to update an existing stage
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
        error: response.error || 'Failed to update stage',
      };
    }
    
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
 * Server action to delete a stage
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
        error: response.error || 'Failed to delete stage',
      };
    }
    
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
 * Server action to get stages for admin with user counts
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
        error: response.error || 'Failed to fetch admin stages',
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