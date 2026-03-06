import { getHttpClient } from '../client/http-client';
import { API_ENDPOINTS } from '../constants/config';
import type {
  PeerReviewAssignReviewersRequest,
  PeerReviewAssignment,
  PeerReviewAssignmentsByReviewee,
  PeerReviewEvaluationUpdate,
  PeerReviewEvaluation,
  PeerReviewAveragedScores,
  CoreValueSummaryResponse,
  EvaluationProgressEntry,
  EvaluationDetailResponse,
  ApiResponse,
} from '../types';

const httpClient = getHttpClient();

/**
 * Peer Review API endpoints for assignments, evaluations, and results
 */
export const peerReviewsApi = {
  // ---- Admin - Assignments ----

  getAssignments: async (
    periodId: string,
  ): Promise<ApiResponse<PeerReviewAssignmentsByReviewee[]>> => {
    return httpClient.get<PeerReviewAssignmentsByReviewee[]>(
      `${API_ENDPOINTS.PEER_REVIEWS.ASSIGNMENTS}?periodId=${periodId}`,
    );
  },

  assignReviewers: async (
    periodId: string,
    revieweeId: string,
    data: PeerReviewAssignReviewersRequest,
  ): Promise<ApiResponse<PeerReviewAssignment[]>> => {
    return httpClient.put<PeerReviewAssignment[]>(
      API_ENDPOINTS.PEER_REVIEWS.ASSIGN_REVIEWERS(periodId, revieweeId),
      data,
    );
  },

  removeAssignment: async (
    assignmentId: string,
  ): Promise<ApiResponse<{ success: boolean; message: string }>> => {
    return httpClient.delete<{ success: boolean; message: string }>(
      API_ENDPOINTS.PEER_REVIEWS.REMOVE_ASSIGNMENT(assignmentId),
    );
  },

  // ---- Reviewer - Evaluations ----

  getMyReviews: async (
    periodId: string,
  ): Promise<ApiResponse<PeerReviewEvaluation[]>> => {
    return httpClient.get<PeerReviewEvaluation[]>(
      `${API_ENDPOINTS.PEER_REVIEWS.MINE}?periodId=${periodId}`,
    );
  },

  updateEvaluation: async (
    evalId: string,
    data: PeerReviewEvaluationUpdate,
  ): Promise<ApiResponse<PeerReviewEvaluation>> => {
    return httpClient.put<PeerReviewEvaluation>(
      API_ENDPOINTS.PEER_REVIEWS.UPDATE_EVALUATION(evalId),
      data,
    );
  },

  submitEvaluation: async (
    evalId: string,
  ): Promise<ApiResponse<PeerReviewEvaluation>> => {
    return httpClient.post<PeerReviewEvaluation>(
      API_ENDPOINTS.PEER_REVIEWS.SUBMIT_EVALUATION(evalId),
      {},
    );
  },

  // ---- Reviewee - Results ----

  getMyResults: async (
    periodId: string,
  ): Promise<ApiResponse<PeerReviewAveragedScores>> => {
    return httpClient.get<PeerReviewAveragedScores>(
      `${API_ENDPOINTS.PEER_REVIEWS.RESULTS_MINE}?periodId=${periodId}`,
    );
  },

  getUserResults: async (
    periodId: string,
    userId: string,
  ): Promise<ApiResponse<PeerReviewAveragedScores>> => {
    return httpClient.get<PeerReviewAveragedScores>(
      `${API_ENDPOINTS.PEER_REVIEWS.RESULTS_USER}?periodId=${periodId}&userId=${userId}`,
    );
  },

  // ---- Admin - 評価進捗 ----

  getProgress: async (
    periodId: string,
  ): Promise<ApiResponse<EvaluationProgressEntry[]>> => {
    return httpClient.get<EvaluationProgressEntry[]>(
      `${API_ENDPOINTS.PEER_REVIEWS.PROGRESS}?periodId=${periodId}`,
    );
  },

  // ---- Admin - 総合評価 ----

  getDetail: async (
    periodId: string,
    userId: string,
  ): Promise<ApiResponse<EvaluationDetailResponse>> => {
    return httpClient.get<EvaluationDetailResponse>(
      `${API_ENDPOINTS.PEER_REVIEWS.DETAIL}?periodId=${periodId}&userId=${userId}`,
    );
  },

  getCoreValueSummary: async (
    periodId: string,
    userId: string,
  ): Promise<ApiResponse<CoreValueSummaryResponse>> => {
    return httpClient.get<CoreValueSummaryResponse>(
      `${API_ENDPOINTS.PEER_REVIEWS.SUMMARY_USER}?periodId=${periodId}&userId=${userId}`,
    );
  },
};
