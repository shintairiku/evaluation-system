'use server';
import { auth } from '@clerk/nextjs/server';
import { getCurrentOrgContext } from '../utils/jwt-parser';
import { getCategorizedEvaluationPeriodsAction } from './evaluation-periods';
import { getCurrentUserAction } from './users';
import type { CurrentUserContextPayload } from '../types/current-user-context';

interface CurrentUserContextOptions {
  includeUser?: boolean;
}

const getCurrentUserContext = async (
  includeUser: boolean,
): Promise<CurrentUserContextPayload> => {
  const { userId: clerkUserId, orgId: clerkOrgId } = await auth();
  const orgContext = await getCurrentOrgContext();

  const periodsPromise = getCategorizedEvaluationPeriodsAction();
  const userPromise = includeUser && clerkUserId
    ? getCurrentUserAction().catch((error) => {
      console.warn('Failed to load current user context:', error);
      return { success: false } as const;
    })
    : Promise.resolve(null);

  const [periodsResult, userResult] = await Promise.all([periodsPromise, userPromise]);

  const user = userResult && userResult.success ? userResult.data ?? null : null;

  return {
    user,
    org: {
      id: orgContext.orgId || clerkOrgId || null,
      slug: orgContext.orgSlug,
      name: orgContext.orgName,
    },
    currentPeriod: periodsResult.success ? periodsResult.data?.current ?? null : null,
    periods: periodsResult.success ? periodsResult.data ?? null : null,
  };
};

export async function getCurrentUserContextAction(
  options?: CurrentUserContextOptions,
): Promise<CurrentUserContextPayload> {
  const includeUser = options?.includeUser !== false;
  return getCurrentUserContext(includeUser);
}
