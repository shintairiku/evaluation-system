import { getHttpClient } from '../client/http-client';
import { API_ENDPOINTS } from '../constants/config';
import type {
  SupportDocument,
  SupportDocumentCreate,
  SupportDocumentUpdate,
  SupportDocumentListResponse,
  ApiResponse,
  UUID,
} from '../types';

const httpClient = getHttpClient();

export const supportDocumentsApi = {
  getDocuments: async (params?: {
    category?: string;
  }): Promise<ApiResponse<SupportDocumentListResponse>> => {
    const queryParams = new URLSearchParams();
    if (params?.category) queryParams.append('category', params.category);

    const endpoint = queryParams.toString()
      ? `${API_ENDPOINTS.SUPPORT_DOCUMENTS.LIST}?${queryParams.toString()}`
      : API_ENDPOINTS.SUPPORT_DOCUMENTS.LIST;

    return httpClient.get<SupportDocumentListResponse>(endpoint);
  },

  createDocument: async (data: SupportDocumentCreate): Promise<ApiResponse<SupportDocument>> => {
    return httpClient.post<SupportDocument>(API_ENDPOINTS.SUPPORT_DOCUMENTS.CREATE, data);
  },

  updateDocument: async (id: UUID, data: SupportDocumentUpdate): Promise<ApiResponse<SupportDocument>> => {
    return httpClient.put<SupportDocument>(API_ENDPOINTS.SUPPORT_DOCUMENTS.UPDATE(id), data);
  },

  deleteDocument: async (id: UUID): Promise<ApiResponse<void>> => {
    return httpClient.delete<void>(API_ENDPOINTS.SUPPORT_DOCUMENTS.DELETE(id));
  },
};
