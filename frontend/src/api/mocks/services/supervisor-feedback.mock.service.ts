import type {
  SupervisorFeedback,
  SupervisorFeedbackDetail,
  SupervisorFeedbackCreate,
  SupervisorFeedbackUpdate,
  SupervisorFeedbackSubmit,
  SupervisorFeedbackList,
  ApiResponse,
  UUID,
} from '../../types';
import {
  supervisorFeedbackScenarios,
  type FeedbackScenarioName,
} from '../scenarios/supervisor-feedback.scenarios';
import mockData from '../data/supervisor-feedback-data.json';

/**
 * Mock service for Supervisor Feedback API endpoints
 * Simulates backend behavior with realistic delays and validation
 */
class SupervisorFeedbackMockService {
  private currentScenario: FeedbackScenarioName = 'default';
  private mockDelay = 500; // Simulate network latency (ms)

  /**
   * Switch to a different scenario for testing
   */
  setScenario(scenario: FeedbackScenarioName): void {
    this.currentScenario = scenario;
    console.log(`[Mock] Switched to supervisor feedback scenario: ${scenario}`);
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
   * Get feedbacks from current scenario or mock data
   */
  private getFeedbacks(): SupervisorFeedback[] {
    if (this.currentScenario === 'error') {
      return [];
    }

    const scenario = supervisorFeedbackScenarios[this.currentScenario];
    return scenario?.feedbacks || mockData.supervisorFeedbacks as SupervisorFeedback[];
  }

  /**
   * Get supervisor feedbacks with optional filters
   */
  async getSupervisorFeedbacks(params?: {
    periodId?: UUID;
    supervisorId?: UUID;
    subordinateId?: UUID;
    status?: string;
    action?: string;
  }): Promise<ApiResponse<SupervisorFeedbackList>> {
    await this.delay();

    if (this.currentScenario === 'error') {
      return {
        success: false,
        errorMessage: 'Mock error: Failed to fetch supervisor feedbacks',
      };
    }

    let feedbacks = this.getFeedbacks();

    // Apply filters
    if (params?.periodId) {
      feedbacks = feedbacks.filter((f) => f.periodId === params.periodId);
    }
    if (params?.supervisorId) {
      feedbacks = feedbacks.filter((f) => f.supervisorId === params.supervisorId);
    }
    if (params?.subordinateId) {
      feedbacks = feedbacks.filter((f) => f.subordinateId === params.subordinateId);
    }
    if (params?.status) {
      feedbacks = feedbacks.filter((f) => f.status === params.status);
    }
    if (params?.action) {
      feedbacks = feedbacks.filter((f) => f.action === params.action);
    }

    return {
      success: true,
      data: {
        items: feedbacks,
        total: feedbacks.length,
        page: 1,
        limit: 10,
        hasMore: false,
      },
    };
  }

  /**
   * Get supervisor feedbacks by supervisor
   */
  async getSupervisorFeedbacksBySupervisor(
    supervisorId: UUID,
  ): Promise<ApiResponse<SupervisorFeedbackList>> {
    return this.getSupervisorFeedbacks({ supervisorId });
  }

  /**
   * Get supervisor feedbacks by employee
   */
  async getSupervisorFeedbacksByEmployee(
    employeeId: UUID,
  ): Promise<ApiResponse<SupervisorFeedbackList>> {
    return this.getSupervisorFeedbacks({ subordinateId: employeeId });
  }

  /**
   * Get supervisor feedback by assessment
   */
  async getSupervisorFeedbackByAssessment(
    assessmentId: UUID,
  ): Promise<ApiResponse<SupervisorFeedback | null>> {
    await this.delay();

    if (this.currentScenario === 'error') {
      return {
        success: false,
        errorMessage: 'Mock error: Failed to fetch supervisor feedback',
      };
    }

    const feedbacks = this.getFeedbacks();
    const feedback = feedbacks.find((f) => f.selfAssessmentId === assessmentId) || null;

    return {
      success: true,
      data: feedback,
    };
  }

  /**
   * Get supervisor feedback by ID with detailed information
   */
  async getSupervisorFeedbackById(
    feedbackId: UUID,
  ): Promise<ApiResponse<SupervisorFeedbackDetail>> {
    await this.delay();

    if (this.currentScenario === 'error') {
      return {
        success: false,
        errorMessage: 'Mock error: Failed to fetch supervisor feedback',
      };
    }

    const feedbacks = this.getFeedbacks();
    const feedback = feedbacks.find((f) => f.id === feedbackId);

    if (!feedback) {
      return {
        success: false,
        errorMessage: 'Supervisor feedback not found',
      };
    }

    // Enhance with detail fields
    const detail: SupervisorFeedbackDetail = {
      ...feedback,
      isEditable: feedback.status !== 'submitted',
      isOverdue: false,
      daysUntilDeadline: 10,
    };

    return {
      success: true,
      data: detail,
    };
  }

  /**
   * Create a new supervisor feedback
   */
  async createSupervisorFeedback(
    data: SupervisorFeedbackCreate,
  ): Promise<ApiResponse<SupervisorFeedback>> {
    await this.delay();

    if (this.currentScenario === 'error') {
      return {
        success: false,
        errorMessage: 'Mock error: Failed to create supervisor feedback',
      };
    }

    // Create new feedback
    const newFeedback: SupervisorFeedback = {
      id: `sf-${Date.now()}`,
      ...data,
      supervisorRating: data.supervisorRatingCode
        ? this.ratingCodeToValue(data.supervisorRatingCode)
        : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return {
      success: true,
      data: newFeedback,
    };
  }

  /**
   * Update an existing supervisor feedback
   */
  async updateSupervisorFeedback(
    feedbackId: UUID,
    data: SupervisorFeedbackUpdate,
  ): Promise<ApiResponse<SupervisorFeedback>> {
    await this.delay();

    if (this.currentScenario === 'error') {
      return {
        success: false,
        errorMessage: 'Mock error: Failed to update supervisor feedback',
      };
    }

    const feedbacks = this.getFeedbacks();
    const feedback = feedbacks.find((f) => f.id === feedbackId);

    if (!feedback) {
      return {
        success: false,
        errorMessage: 'Supervisor feedback not found',
      };
    }

    // Validate: can only update non-submitted feedbacks
    if (feedback.status === 'submitted') {
      return {
        success: false,
        errorMessage: 'Cannot update submitted supervisor feedback',
      };
    }

    // Update feedback
    const updated: SupervisorFeedback = {
      ...feedback,
      ...data,
      supervisorRating: data.supervisorRatingCode
        ? this.ratingCodeToValue(data.supervisorRatingCode)
        : feedback.supervisorRating,
      updatedAt: new Date().toISOString(),
    };

    return {
      success: true,
      data: updated,
    };
  }

  /**
   * Save supervisor feedback as draft
   */
  async saveSupervisorFeedbackDraft(
    feedbackId: UUID,
    data: SupervisorFeedbackUpdate,
  ): Promise<ApiResponse<SupervisorFeedback>> {
    await this.delay();

    const feedbacks = this.getFeedbacks();
    const feedback = feedbacks.find((f) => f.id === feedbackId);

    if (!feedback) {
      return {
        success: false,
        errorMessage: 'Supervisor feedback not found',
      };
    }

    const updated: SupervisorFeedback = {
      ...feedback,
      ...data,
      supervisorRating: data.supervisorRatingCode
        ? this.ratingCodeToValue(data.supervisorRatingCode)
        : feedback.supervisorRating,
      status: 'draft',
      updatedAt: new Date().toISOString(),
    };

    return {
      success: true,
      data: updated,
    };
  }

  /**
   * Submit a supervisor feedback (approve or reject)
   */
  async submitSupervisorFeedback(
    feedbackId: UUID,
    data: SupervisorFeedbackSubmit,
  ): Promise<ApiResponse<SupervisorFeedback>> {
    await this.delay();

    if (this.currentScenario === 'error') {
      return {
        success: false,
        errorMessage: 'Mock error: Failed to submit supervisor feedback',
      };
    }

    const feedbacks = this.getFeedbacks();
    const feedback = feedbacks.find((f) => f.id === feedbackId);

    if (!feedback) {
      return {
        success: false,
        errorMessage: 'Supervisor feedback not found',
      };
    }

    // Validate: APPROVED requires rating code
    if (data.action === 'APPROVED' && !data.supervisorRatingCode) {
      return {
        success: false,
        errorMessage: 'Rating code is required for approval',
      };
    }

    // Validate: REJECTED requires comment
    if (data.action === 'REJECTED' && !data.supervisorComment) {
      return {
        success: false,
        errorMessage: 'Comment is required for rejection',
      };
    }

    // Update feedback with submission
    const submitted: SupervisorFeedback = {
      ...feedback,
      supervisorRatingCode: data.supervisorRatingCode,
      supervisorRating: data.supervisorRatingCode
        ? this.ratingCodeToValue(data.supervisorRatingCode)
        : undefined,
      supervisorComment: data.supervisorComment,
      action: data.action,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return {
      success: true,
      data: submitted,
    };
  }

  /**
   * Delete a supervisor feedback
   */
  async deleteSupervisorFeedback(feedbackId: UUID): Promise<ApiResponse<void>> {
    await this.delay();

    if (this.currentScenario === 'error') {
      return {
        success: false,
        errorMessage: 'Mock error: Failed to delete supervisor feedback',
      };
    }

    const feedbacks = this.getFeedbacks();
    const feedback = feedbacks.find((f) => f.id === feedbackId);

    if (!feedback) {
      return {
        success: false,
        errorMessage: 'Supervisor feedback not found',
      };
    }

    // Validate: can only delete non-submitted feedbacks
    if (feedback.status === 'submitted') {
      return {
        success: false,
        errorMessage: 'Cannot delete submitted supervisor feedback',
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
export const supervisorFeedbackMockService = new SupervisorFeedbackMockService();

// Expose to window for browser console debugging
if (typeof window !== 'undefined') {
  (window as any).mockSupervisorFeedbackService = supervisorFeedbackMockService;
}
