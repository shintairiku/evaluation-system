import { getHttpClient } from '../client/http-client';
import { API_ENDPOINTS } from '../constants/config';
import type {
  ApiResponse,
  UUID,
  ViewerVisibilityPatchRequest,
  ViewerVisibilityResponse,
  ViewerVisibilityUpdateRequest,
} from '../types';

const httpClient = getHttpClient();

export const viewersApi = {
  getViewerVisibility: async (
    viewerId: UUID,
  ): Promise<ApiResponse<ViewerVisibilityResponse>> => {
    return httpClient.get<ViewerVisibilityResponse>(API_ENDPOINTS.VIEWERS.VISIBILITY(viewerId));
  },

  replaceViewerVisibility: async (
    viewerId: UUID,
    payload: ViewerVisibilityUpdateRequest,
  ): Promise<ApiResponse<ViewerVisibilityResponse>> => {
    return httpClient.put<ViewerVisibilityResponse>(API_ENDPOINTS.VIEWERS.VISIBILITY(viewerId), payload);
  },

  patchViewerVisibility: async (
    viewerId: UUID,
    payload: ViewerVisibilityPatchRequest,
  ): Promise<ApiResponse<ViewerVisibilityResponse>> => {
    return httpClient.patch<ViewerVisibilityResponse>(API_ENDPOINTS.VIEWERS.VISIBILITY(viewerId), payload);
  },
};
