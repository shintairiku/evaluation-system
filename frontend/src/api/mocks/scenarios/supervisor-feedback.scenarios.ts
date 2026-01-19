import type {
  SupervisorFeedback,
  SupervisorFeedbackAction,
  SupervisorFeedbackStatus,
} from '../../types';

/**
 * Mock scenarios for Supervisor Feedback feature testing
 * Each scenario represents a different state/situation for UI testing
 */

export type FeedbackScenarioName =
  | 'default'
  | 'pendingReviews'
  | 'completedReviews'
  | 'mixedActions'
  | 'draftsOnly'
  | 'empty'
  | 'error';

interface SupervisorFeedbackScenario {
  name: FeedbackScenarioName;
  description: string;
  feedbacks: SupervisorFeedback[];
}

/**
 * Base supervisor feedback for scenarios
 */
const createBaseFeedback = (
  id: string,
  selfAssessmentId: string,
  action: SupervisorFeedbackAction,
  status: SupervisorFeedbackStatus,
  overrides?: Partial<SupervisorFeedback>,
): SupervisorFeedback => ({
  id,
  selfAssessmentId,
  periodId: 'period-2024-h2',
  supervisorId: 'user-supervisor-001',
  subordinateId: 'user-employee-001',
  supervisorRatingCode:
    action === 'APPROVED' ? 'A' : action === 'REJECTED' ? undefined : undefined,
  supervisorRating: action === 'APPROVED' ? 4.0 : undefined,
  supervisorComment:
    action === 'APPROVED'
      ? '良い成果です。期待通りの結果を出しました。'
      : action === 'REJECTED'
        ? '再度見直しが必要です。詳細を追加してください。'
        : undefined,
  action,
  status,
  submittedAt: status === 'submitted' ? '2024-12-16T10:00:00Z' : undefined,
  reviewedAt: status === 'submitted' ? '2024-12-16T10:00:00Z' : undefined,
  createdAt: '2024-12-15T10:30:00Z',
  updatedAt: '2024-12-16T10:00:00Z',
  ...overrides,
});

/**
 * Available scenarios for testing
 */
export const supervisorFeedbackScenarios: Record<
  FeedbackScenarioName,
  SupervisorFeedbackScenario
> = {
  /**
   * Default scenario: Mixed states
   */
  default: {
    name: 'default',
    description: 'Mixed feedback states and actions',
    feedbacks: [
      createBaseFeedback('sf-001', 'sa-001', 'APPROVED', 'submitted', {
        supervisorRatingCode: 'A+',
        supervisorRating: 5.0,
      }),
      createBaseFeedback('sf-002', 'sa-002', 'PENDING', 'draft'),
      createBaseFeedback('sf-003', 'sa-003', 'REJECTED', 'submitted'),
    ],
  },

  /**
   * Pending reviews scenario
   */
  pendingReviews: {
    name: 'pendingReviews',
    description: 'Supervisor has pending reviews to complete',
    feedbacks: [
      createBaseFeedback('sf-001', 'sa-001', 'PENDING', 'incomplete', {
        supervisorRatingCode: undefined,
        supervisorComment: undefined,
      }),
      createBaseFeedback('sf-002', 'sa-002', 'PENDING', 'draft', {
        supervisorRatingCode: 'A',
        supervisorRating: 4.0,
        supervisorComment: 'レビュー中...',
      }),
      createBaseFeedback('sf-003', 'sa-003', 'PENDING', 'incomplete'),
    ],
  },

  /**
   * Completed reviews scenario
   */
  completedReviews: {
    name: 'completedReviews',
    description: 'All reviews are completed (approved or rejected)',
    feedbacks: [
      createBaseFeedback('sf-001', 'sa-001', 'APPROVED', 'submitted', {
        supervisorRatingCode: 'S',
        supervisorRating: 6.0,
        supervisorComment: '卓越した成果です。',
      }),
      createBaseFeedback('sf-002', 'sa-002', 'APPROVED', 'submitted', {
        supervisorRatingCode: 'A+',
        supervisorRating: 5.0,
      }),
      createBaseFeedback('sf-003', 'sa-003', 'APPROVED', 'submitted', {
        supervisorRatingCode: 'A',
        supervisorRating: 4.0,
      }),
    ],
  },

  /**
   * Mixed actions scenario
   */
  mixedActions: {
    name: 'mixedActions',
    description: 'Mix of approved, rejected, and pending',
    feedbacks: [
      createBaseFeedback('sf-001', 'sa-001', 'APPROVED', 'submitted', {
        supervisorRatingCode: 'A+',
        supervisorRating: 5.0,
      }),
      createBaseFeedback('sf-002', 'sa-002', 'REJECTED', 'submitted', {
        supervisorComment:
          '自己評価が不十分です。具体的な成果を追加してください。',
      }),
      createBaseFeedback('sf-003', 'sa-003', 'PENDING', 'draft', {
        supervisorRatingCode: 'A',
        supervisorRating: 4.0,
      }),
      createBaseFeedback('sf-004', 'sa-004', 'PENDING', 'incomplete'),
    ],
  },

  /**
   * Drafts only scenario
   */
  draftsOnly: {
    name: 'draftsOnly',
    description: 'Supervisor has only draft feedbacks',
    feedbacks: [
      createBaseFeedback('sf-001', 'sa-001', 'PENDING', 'draft', {
        supervisorRatingCode: 'A',
        supervisorRating: 4.0,
        supervisorComment: '下書き保存中...',
      }),
      createBaseFeedback('sf-002', 'sa-002', 'PENDING', 'draft', {
        supervisorRatingCode: 'B',
        supervisorRating: 2.0,
      }),
    ],
  },

  /**
   * Empty scenario
   */
  empty: {
    name: 'empty',
    description: 'No feedbacks to review',
    feedbacks: [],
  },

  /**
   * Error scenario - for error handling testing
   */
  error: {
    name: 'error',
    description: 'Triggers API error responses',
    feedbacks: [], // Will be handled by mock service to return errors
  },
};

/**
 * Get scenario by name
 */
export const getFeedbackScenario = (
  name: FeedbackScenarioName,
): SupervisorFeedbackScenario => {
  return supervisorFeedbackScenarios[name] || supervisorFeedbackScenarios.default;
};

/**
 * Get all available scenario names
 */
export const getFeedbackScenarioNames = (): FeedbackScenarioName[] => {
  return Object.keys(supervisorFeedbackScenarios) as FeedbackScenarioName[];
};
