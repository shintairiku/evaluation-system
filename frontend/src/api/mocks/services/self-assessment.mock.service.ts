import type {
  SelfAssessment,
  SelfAssessmentDetail,
  SelfAssessmentUpdate,
  SelfAssessmentList,
  ApiResponse,
  UUID,
} from '../../types';
import {
  selfAssessmentScenarios,
  type ScenarioName,
} from '../scenarios/self-assessment.scenarios';
import mockData from '../data/self-assessment-data.json';

/**
 * Mock service for Self-Assessment API endpoints
 * Simulates backend behavior with realistic delays and validation
 */
class SelfAssessmentMockService {
  private currentScenario: ScenarioName = 'default';
  private mockDelay = 500; // Simulate network latency (ms)

  /**
   * Switch to a different scenario for testing
   */
  setScenario(scenario: ScenarioName): void {
    this.currentScenario = scenario;
    console.log(`[Mock] Switched to scenario: ${scenario}`);
  }

  /**
   * Set mock API delay
   */
  setDelay(ms: number): void {
    this.mockDelay = ms;
  }

  /**
   * Simulate network delay
   */
  private async delay(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, this.mockDelay));
  }

  /**
   * Get assessments from current scenario or mock data
   */
  private getAssessments(): SelfAssessment[] {
    if (this.currentScenario === 'error') {
      return [];
    }

    const scenario = selfAssessmentScenarios[this.currentScenario];
    return scenario?.assessments || mockData.selfAssessments as SelfAssessment[];
  }

  /**
   * Get self-assessments with optional filters
   */
  async getSelfAssessments(params?: {
    periodId?: UUID;
    userId?: UUID;
    status?: string;
  }): Promise<ApiResponse<SelfAssessmentList>> {
    await this.delay();

    if (this.currentScenario === 'error') {
      return {
        success: false,
        errorMessage: 'Mock error: Failed to fetch self-assessments',
      };
    }

    let assessments = this.getAssessments();

    // Apply filters
    if (params?.periodId) {
      assessments = assessments.filter((a) => a.periodId === params.periodId);
    }
    if (params?.status) {
      assessments = assessments.filter((a) => a.status === params.status);
    }

    return {
      success: true,
      data: {
        items: assessments,
        total: assessments.length,
        page: 1,
        limit: 10,
        hasMore: false,
      },
    };
  }

  /**
   * Get self-assessments by period
   */
  async getSelfAssessmentsByPeriod(
    periodId: UUID,
  ): Promise<ApiResponse<SelfAssessmentList>> {
    return this.getSelfAssessments({ periodId });
  }

  /**
   * Get self-assessments by user
   */
  async getSelfAssessmentsByUser(
    userId: UUID,
  ): Promise<ApiResponse<SelfAssessmentList>> {
    return this.getSelfAssessments({ userId });
  }

  /**
   * Get self-assessment by goal
   */
  async getSelfAssessmentByGoal(
    goalId: UUID,
  ): Promise<ApiResponse<SelfAssessment | null>> {
    await this.delay();

    if (this.currentScenario === 'error') {
      return {
        success: false,
        errorMessage: 'Mock error: Failed to fetch self-assessment',
      };
    }

    const assessments = this.getAssessments();
    const assessment = assessments.find((a) => a.goalId === goalId) || null;

    return {
      success: true,
      data: assessment,
    };
  }

  /**
   * Get self-assessment by ID with detailed information
   */
  async getSelfAssessmentById(
    assessmentId: UUID,
  ): Promise<ApiResponse<SelfAssessmentDetail>> {
    await this.delay();

    if (this.currentScenario === 'error') {
      return {
        success: false,
        errorMessage: 'Mock error: Failed to fetch self-assessment',
      };
    }

    const assessments = this.getAssessments();
    const assessment = assessments.find((a) => a.id === assessmentId);

    if (!assessment) {
      return {
        success: false,
        errorMessage: 'Self-assessment not found',
      };
    }

    // Enhance with detail fields
    const detail: SelfAssessmentDetail = {
      ...assessment,
      isEditable: assessment.status === 'draft',
      isOverdue: false,
      daysUntilDeadline: 15,
      goalCategory: 'Performance',
      goalStatus: 'approved',
    };

    return {
      success: true,
      data: detail,
    };
  }

  /**
   * Update an existing self-assessment
   */
  async updateSelfAssessment(
    assessmentId: UUID,
    data: SelfAssessmentUpdate,
  ): Promise<ApiResponse<SelfAssessment>> {
    await this.delay();

    if (this.currentScenario === 'error') {
      return {
        success: false,
        errorMessage: 'Mock error: Failed to update self-assessment',
      };
    }

    const assessments = this.getAssessments();
    const assessment = assessments.find((a) => a.id === assessmentId);

    if (!assessment) {
      return {
        success: false,
        errorMessage: 'Self-assessment not found',
      };
    }

    // Validate: can only update drafts
    if (assessment.status !== 'draft') {
      return {
        success: false,
        errorMessage: 'Cannot update non-draft self-assessment',
      };
    }

    // Update assessment
    const updated: SelfAssessment = {
      ...assessment,
      ...data,
      selfRating: data.selfRatingCode
        ? this.ratingCodeToValue(data.selfRatingCode)
        : assessment.selfRating,
      updatedAt: new Date().toISOString(),
    };

    return {
      success: true,
      data: updated,
    };
  }

  /**
   * Submit a self-assessment
   */
  async submitSelfAssessment(
    assessmentId: UUID,
  ): Promise<ApiResponse<SelfAssessment>> {
    await this.delay();

    if (this.currentScenario === 'error') {
      return {
        success: false,
        errorMessage: 'Mock error: Failed to submit self-assessment',
      };
    }

    const assessments = this.getAssessments();
    const assessment = assessments.find((a) => a.id === assessmentId);

    if (!assessment) {
      return {
        success: false,
        errorMessage: 'Self-assessment not found',
      };
    }

    // Validate: can only submit drafts
    if (assessment.status !== 'draft') {
      return {
        success: false,
        errorMessage: 'Self-assessment is not in draft status',
      };
    }

    // Validate: must have rating and comment
    if (!assessment.selfRatingCode || !assessment.selfComment) {
      return {
        success: false,
        errorMessage: 'Rating and comment are required for submission',
      };
    }

    // Update status to submitted
    const submitted: SelfAssessment = {
      ...assessment,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return {
      success: true,
      data: submitted,
    };
  }

  /**
   * Delete a self-assessment
   */
  async deleteSelfAssessment(assessmentId: UUID): Promise<ApiResponse<void>> {
    await this.delay();

    if (this.currentScenario === 'error') {
      return {
        success: false,
        errorMessage: 'Mock error: Failed to delete self-assessment',
      };
    }

    const assessments = this.getAssessments();
    const assessment = assessments.find((a) => a.id === assessmentId);

    if (!assessment) {
      return {
        success: false,
        errorMessage: 'Self-assessment not found',
      };
    }

    // Validate: can only delete drafts
    if (assessment.status !== 'draft') {
      return {
        success: false,
        errorMessage: 'Cannot delete non-draft self-assessment',
      };
    }

    return {
      success: true,
    };
  }

  /**
   * Helper: Convert rating code to numeric value
   */
  private ratingCodeToValue(code: string): number {
    const mapping: Record<string, number> = {
      SS: 7.0,
      S: 6.0,
      'A+': 5.0,
      A: 4.0,
      'A-': 3.0,
      B: 2.0,
      C: 1.0,
      D: 0.0,
    };
    return mapping[code] ?? 0.0;
  }
}

// Export singleton instance
export const selfAssessmentMockService = new SelfAssessmentMockService();

// Expose to window for browser console debugging
if (typeof window !== 'undefined') {
  (window as any).mockSelfAssessmentService = selfAssessmentMockService;
}
