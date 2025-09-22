'use server';

import { cache } from 'react';
import { revalidateTag } from 'next/cache';
import { competenciesApi } from '../endpoints/competencies';
import { CACHE_TAGS } from '../utils/cache';
import type {
  Competency,
  CompetencyDetail,
  CompetencyCreate,
  CompetencyUpdate,
  UUID,
  PaginatedResponse,
  ApiResponse,
} from '../types';

/**
 * Server action to get competencies with optional filtering
 */
export const getCompetenciesAction = cache(
  async (params?: {
    stageId?: UUID;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<PaginatedResponse<Competency>>> => {
    try {
      const response = await competenciesApi.getCompetencies(params);

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.errorMessage || 'Failed to fetch competencies',
        };
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('Get competencies action error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred while fetching competencies',
      };
    }
  },
);

/**
 * Server action to get a specific competency by ID
 */
export const getCompetencyAction = cache(async (competencyId: UUID): Promise<ApiResponse<CompetencyDetail>> => {
  try {
    const response = await competenciesApi.getCompetencyById(competencyId);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to fetch competency',
      };
    }

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Get competency by ID action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while fetching competency',
    };
  }
});

/**
 * Server action to create a new competency with cache revalidation
 */
export async function createCompetencyAction(data: CompetencyCreate): Promise<ApiResponse<Competency>> {
  try {
    const response = await competenciesApi.createCompetency(data);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to create competency',
      };
    }

    // Revalidate competencies cache after successful creation
    revalidateTag(CACHE_TAGS.COMPETENCIES);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Create competency action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while creating competency',
    };
  }
}

/**
 * Server action to update an existing competency with cache revalidation
 */
export async function updateCompetencyAction(competencyId: UUID, data: CompetencyUpdate): Promise<ApiResponse<Competency>> {
  try {
    const response = await competenciesApi.updateCompetency(competencyId, data);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to update competency',
      };
    }

    // Revalidate competencies cache after successful update
    revalidateTag(CACHE_TAGS.COMPETENCIES);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Update competency action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while updating competency',
    };
  }
}

/**
 * Server action to delete a competency with cache revalidation
 */
export async function deleteCompetencyAction(competencyId: UUID): Promise<ApiResponse<void>> {
  try {
    const response = await competenciesApi.deleteCompetency(competencyId);

    if (!response.success) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to delete competency',
      };
    }

    // Revalidate competencies cache after successful deletion
    revalidateTag(CACHE_TAGS.COMPETENCIES);

    return {
      success: true,
    };
  } catch (error) {
    console.error('Delete competency action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while deleting competency',
    };
  }
}