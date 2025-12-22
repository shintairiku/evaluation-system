import type {
  CategorizedEvaluationPeriods,
  EvaluationPeriod,
  GoalResponse,
  SupervisorReview,
  UserDetailResponse,
  UserListPageFilters,
  UserListPageMeta,
  UUID,
} from './index';
import type { CurrentUserContextPayload } from './current-user-context';

export interface EmployeeGoalListPageData {
  currentUserContext: CurrentUserContextPayload;
  periods: CategorizedEvaluationPeriods | null;
  goals: GoalResponse[];
  selectedPeriod: EvaluationPeriod | null;
  rejectedGoalsCount: number;
}

export interface SupervisorGoalReviewGroup {
  employee: UserDetailResponse;
  goals: GoalResponse[];
  reviewsByGoalId: Record<string, SupervisorReview>;
}

export interface SupervisorGoalReviewPageData {
  currentUserContext: CurrentUserContextPayload;
  periods: CategorizedEvaluationPeriods | null;
  selectedPeriod: EvaluationPeriod | null;
  grouped: SupervisorGoalReviewGroup[];
  totalPendingCount: number;
}

export interface UserDirectoryBasePageData {
  users: UserDetailResponse[];
  meta: UserListPageMeta;
  filters: UserListPageFilters;
}

export type LoaderUUID = UUID;
export type LoaderSupervisorReview = SupervisorReview;
