import type {
  SelfAssessment,
  SelfAssessmentDetail,
  SelfAssessmentStatus,
} from '../../types';

/**
 * Mock scenarios for Self-Assessment feature testing
 * Each scenario represents a different state/situation for UI testing
 */

export type ScenarioName =
  | 'default'
  | 'onlyDrafts'
  | 'hasSubmitted'
  | 'hasApproved'
  | 'hasRejected'
  | 'empty'
  | 'allStates'
  | 'error';

interface SelfAssessmentScenario {
  name: ScenarioName;
  description: string;
  assessments: SelfAssessment[];
}

/**
 * Base self-assessment for scenarios
 */
const createBaseAssessment = (
  id: string,
  goalId: string,
  status: SelfAssessmentStatus,
  overrides?: Partial<SelfAssessment>,
): SelfAssessment => ({
  id,
  goalId,
  periodId: 'period-2024-h2',
  selfRatingCode: status === 'draft' ? undefined : 'A',
  selfRating: status === 'draft' ? undefined : 4.0,
  selfComment:
    status === 'draft'
      ? undefined
      : '目標を達成し、期待以上の成果を出すことができました。',
  status,
  submittedAt: status !== 'draft' ? '2024-12-15T10:00:00Z' : undefined,
  createdAt: '2024-12-01T09:00:00Z',
  updatedAt: '2024-12-15T10:00:00Z',
  ...overrides,
});

/**
 * Available scenarios for testing
 */
export const selfAssessmentScenarios: Record<
  ScenarioName,
  SelfAssessmentScenario
> = {
  /**
   * Default scenario: Mixed states
   */
  default: {
    name: 'default',
    description: 'Mixed states - draft, submitted, approved',
    assessments: [
      createBaseAssessment('sa-001', 'goal-001', 'approved', {
        selfRatingCode: 'A+',
        selfRating: 5.0,
      }),
      createBaseAssessment('sa-002', 'goal-002', 'submitted'),
      createBaseAssessment('sa-003', 'goal-003', 'draft'),
    ],
  },

  /**
   * Only drafts scenario
   */
  onlyDrafts: {
    name: 'onlyDrafts',
    description: 'User has only draft assessments',
    assessments: [
      createBaseAssessment('sa-001', 'goal-001', 'draft'),
      createBaseAssessment('sa-002', 'goal-002', 'draft'),
      createBaseAssessment('sa-003', 'goal-003', 'draft', {
        selfRatingCode: 'B',
        selfRating: 2.0,
        selfComment: '作業中...',
      }),
    ],
  },

  /**
   * Has submitted assessments scenario
   */
  hasSubmitted: {
    name: 'hasSubmitted',
    description: 'User has submitted assessments awaiting review',
    assessments: [
      createBaseAssessment('sa-001', 'goal-001', 'submitted', {
        selfRatingCode: 'A',
        selfRating: 4.0,
      }),
      createBaseAssessment('sa-002', 'goal-002', 'submitted', {
        selfRatingCode: 'A+',
        selfRating: 5.0,
      }),
      createBaseAssessment('sa-003', 'goal-003', 'draft'),
    ],
  },

  /**
   * Has approved assessments scenario
   */
  hasApproved: {
    name: 'hasApproved',
    description: 'User has approved assessments',
    assessments: [
      createBaseAssessment('sa-001', 'goal-001', 'approved', {
        selfRatingCode: 'S',
        selfRating: 6.0,
        selfComment: '卓越した成果を達成しました。',
      }),
      createBaseAssessment('sa-002', 'goal-002', 'approved', {
        selfRatingCode: 'A+',
        selfRating: 5.0,
      }),
    ],
  },

  /**
   * Has rejected assessments scenario
   */
  hasRejected: {
    name: 'hasRejected',
    description: 'User has rejected assessments that need revision',
    assessments: [
      createBaseAssessment('sa-001', 'goal-001', 'rejected', {
        selfRatingCode: 'C',
        selfRating: 1.0,
        selfComment: '技術的な課題により遅延しました。',
      }),
      createBaseAssessment('sa-002', 'goal-001', 'draft', {
        previousSelfAssessmentId: 'sa-001',
        selfRatingCode: 'B',
        selfRating: 2.0,
        selfComment: 'フィードバックを反映して改善しました。',
      }),
    ],
  },

  /**
   * Empty scenario
   */
  empty: {
    name: 'empty',
    description: 'New user with no assessments',
    assessments: [],
  },

  /**
   * All states scenario - for comprehensive testing
   */
  allStates: {
    name: 'allStates',
    description: 'All possible assessment states',
    assessments: [
      createBaseAssessment('sa-001', 'goal-001', 'draft'),
      createBaseAssessment('sa-002', 'goal-002', 'submitted', {
        selfRatingCode: 'A',
        selfRating: 4.0,
      }),
      createBaseAssessment('sa-003', 'goal-003', 'approved', {
        selfRatingCode: 'S',
        selfRating: 6.0,
      }),
      createBaseAssessment('sa-004', 'goal-004', 'rejected', {
        selfRatingCode: 'C',
        selfRating: 1.0,
      }),
      createBaseAssessment('sa-005', 'goal-005', 'draft', {
        previousSelfAssessmentId: 'sa-004',
        selfRatingCode: 'B',
        selfRating: 2.0,
      }),
    ],
  },

  /**
   * Error scenario - for error handling testing
   */
  error: {
    name: 'error',
    description: 'Triggers API error responses',
    assessments: [], // Will be handled by mock service to return errors
  },
};

/**
 * Get scenario by name
 */
export const getScenario = (name: ScenarioName): SelfAssessmentScenario => {
  return selfAssessmentScenarios[name] || selfAssessmentScenarios.default;
};

/**
 * Get all available scenario names
 */
export const getScenarioNames = (): ScenarioName[] => {
  return Object.keys(selfAssessmentScenarios) as ScenarioName[];
};
