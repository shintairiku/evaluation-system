'use server';

import { cache } from 'react';
import { revalidateTag } from 'next/cache';

import { viewersApi } from '../endpoints/viewers';
import { CACHE_TAGS } from '../utils/cache';
import type {
  UUID,
  ViewerVisibilityPatchRequest,
  ViewerVisibilityResponse,
  ViewerVisibilityUpdateRequest,
} from '../types';

const buildTag = (viewerId: UUID) => `${CACHE_TAGS.VIEWER_VISIBILITY}:${viewerId}`;

export const getViewerVisibilityAction = cache(async (viewerId: UUID) => {
  try {
    const response = await viewersApi.getViewerVisibility(viewerId);
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'ビューアーの可視性を取得できませんでした。',
      } as const;
    }

    return {
      success: true,
      data: response.data,
    } as const;
  } catch (error) {
    console.error('getViewerVisibilityAction error', error);
    return {
      success: false,
      error: 'ビューアーの可視性を取得中に予期しないエラーが発生しました。',
    } as const;
  }
});

export async function replaceViewerVisibilityAction(
  viewerId: UUID,
  payload: ViewerVisibilityUpdateRequest,
): Promise<{
  success: boolean;
  data?: ViewerVisibilityResponse;
  error?: string;
}> {
  try {
    const response = await viewersApi.replaceViewerVisibility(viewerId, payload);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'ビジビリティ更新に失敗しました。',
      };
    }

    revalidateTag(buildTag(viewerId));
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('replaceViewerVisibilityAction error', error);
    return {
      success: false,
      error: 'ビジビリティ更新中に予期しないエラーが発生しました。',
    };
  }
}

export async function patchViewerVisibilityAction(
  viewerId: UUID,
  payload: ViewerVisibilityPatchRequest,
): Promise<{
  success: boolean;
  data?: ViewerVisibilityResponse;
  error?: string;
}> {
  try {
    const response = await viewersApi.patchViewerVisibility(viewerId, payload);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'ビジビリティ更新に失敗しました。',
      };
    }

    revalidateTag(buildTag(viewerId));
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('patchViewerVisibilityAction error', error);
    return {
      success: false,
      error: 'ビジビリティ更新中に予期しないエラーが発生しました。',
    };
  }
}
