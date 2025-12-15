import type { EvaluationPeriod, CategorizedEvaluationPeriods, UserDetailResponse } from './index';

export interface CurrentUserOrgInfo {
  id: string | null;
  slug: string | null;
  name: string | null;
}

export interface CurrentUserContextPayload {
  user: UserDetailResponse | null;
  org: CurrentUserOrgInfo;
  currentPeriod: EvaluationPeriod | null;
  periods: CategorizedEvaluationPeriods | null;
}
