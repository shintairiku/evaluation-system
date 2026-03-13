'use server';

import { cache } from 'react';
import { revalidateTag } from 'next/cache';
import { supportDocumentsApi } from '../endpoints/support-documents';
import { CACHE_TAGS } from '../utils/cache';
import type {
  SupportDocument,
  SupportDocumentCreate,
  SupportDocumentUpdate,
  SupportDocumentListResponse,
  SupportDocumentReorderItem,
  ApiResponse,
  UUID,
} from '../types';

export const getSupportDocumentsAction = cache(
  async (params?: {
    category?: string;
  }): Promise<ApiResponse<SupportDocumentListResponse>> => {
    try {
      const response = await supportDocumentsApi.getDocuments(params);

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.errorMessage || 'Failed to fetch support documents',
        };
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('Get support documents action error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred while fetching support documents',
      };
    }
  },
);

export async function createSupportDocumentAction(
  data: SupportDocumentCreate,
): Promise<ApiResponse<SupportDocument>> {
  try {
    const response = await supportDocumentsApi.createDocument(data);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to create support document',
      };
    }

    revalidateTag(CACHE_TAGS.SUPPORT_DOCUMENTS);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Create support document action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while creating support document',
    };
  }
}

export async function updateSupportDocumentAction(
  id: UUID,
  data: SupportDocumentUpdate,
): Promise<ApiResponse<SupportDocument>> {
  try {
    const response = await supportDocumentsApi.updateDocument(id, data);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to update support document',
      };
    }

    revalidateTag(CACHE_TAGS.SUPPORT_DOCUMENTS);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Update support document action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while updating support document',
    };
  }
}

export async function deleteSupportDocumentAction(id: UUID): Promise<ApiResponse<void>> {
  try {
    const response = await supportDocumentsApi.deleteDocument(id);

    if (!response.success) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to delete support document',
      };
    }

    revalidateTag(CACHE_TAGS.SUPPORT_DOCUMENTS);

    return {
      success: true,
    };
  } catch (error) {
    console.error('Delete support document action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while deleting support document',
    };
  }
}

export async function reorderSupportDocumentsAction(
  items: SupportDocumentReorderItem[],
): Promise<ApiResponse<void>> {
  try {
    const response = await supportDocumentsApi.reorderDocuments(items);

    if (!response.success) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to reorder support documents',
      };
    }

    revalidateTag(CACHE_TAGS.SUPPORT_DOCUMENTS);

    return {
      success: true,
    };
  } catch (error) {
    console.error('Reorder support documents action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while reordering support documents',
    };
  }
}
