'use server';

import { revalidatePath } from 'next/cache';
import { competenciesApi } from '../endpoints/competencies';
import { stagesApi } from '../endpoints/stages';
import type {
  Competency,
  CompetencyCreate,
  CompetencyUpdate,
  Stage,
  UUID,
  ApiResponse,
  PaginatedResponse,
} from '../types';

/**
 * Server Actions for Competency Management
 * These actions are used by the competency management page for SSR and form submissions
 */

/**
 * Get competencies with stages for admin management view
 */
export async function getCompetenciesWithStagesAction(): Promise<
  ApiResponse<{ competencies: PaginatedResponse<Competency>; stages: Stage[] }>
> {
  try {
    // Fetch both competencies and stages in parallel
    // Using getStagesAdmin to verify admin permissions (similar to stage-management)
    const [competenciesResult, stagesResult] = await Promise.all([
      competenciesApi.getCompetencies({ page: 1, limit: 100 }),
      stagesApi.getStagesAdmin(),
    ]);

    // Check if both requests were successful
    if (!competenciesResult.success) {
      return {
        success: false,
        error: competenciesResult.error || 'Failed to fetch competencies',
      };
    }

    if (!stagesResult.success) {
      return {
        success: false,
        error: stagesResult.error || 'Failed to fetch stages',
      };
    }

    return {
      success: true,
      data: {
        competencies: competenciesResult.data!,
        stages: stagesResult.data!,
      },
    };
  } catch (error) {
    console.error('Error in getCompetenciesWithStagesAction:', error);
    return {
      success: false,
      error: 'Failed to load competency management data',
    };
  }
}

/**
 * Get competencies filtered by stage
 */
export async function getCompetenciesByStageAction(
  stageId?: UUID
): Promise<ApiResponse<PaginatedResponse<Competency>>> {
  try {
    const result = await competenciesApi.getCompetencies({
      stageId,
      page: 1,
      limit: 100,
    });

    return result;
  } catch (error) {
    console.error('Error in getCompetenciesByStageAction:', error);
    return {
      success: false,
      error: 'Failed to fetch competencies for stage',
    };
  }
}

/**
 * Update a competency (admin only)
 */
export async function updateCompetencyAction(
  competencyId: UUID,
  data: CompetencyUpdate
): Promise<ApiResponse<Competency>> {
  try {
    const result = await competenciesApi.updateCompetency(competencyId, data);

    if (result.success) {
      // Revalidate the competency management page to reflect changes
      revalidatePath('/competency-management');
    }

    return result;
  } catch (error) {
    console.error('Error in updateCompetencyAction:', error);
    return {
      success: false,
      error: 'Failed to update competency',
    };
  }
}

/**
 * Delete a competency (admin only)
 */
export async function deleteCompetencyAction(competencyId: UUID): Promise<ApiResponse<void>> {
  try {
    const result = await competenciesApi.deleteCompetency(competencyId);

    if (result.success) {
      // Revalidate the competency management page to reflect changes
      revalidatePath('/competency-management');
    }

    return result;
  } catch (error) {
    console.error('Error in deleteCompetencyAction:', error);
    return {
      success: false,
      error: 'Failed to delete competency',
    };
  }
}

/**
 * Create a new competency (admin only)
 */
export async function createCompetencyAction(data: CompetencyCreate): Promise<ApiResponse<Competency>> {
  try {
    const result = await competenciesApi.createCompetency(data);

    if (result.success) {
      // Revalidate the competency management page to reflect changes
      revalidatePath('/competency-management');
    }

    return result;
  } catch (error) {
    console.error('Error in createCompetencyAction:', error);
    return {
      success: false,
      error: 'Failed to create competency',
    };
  }
}