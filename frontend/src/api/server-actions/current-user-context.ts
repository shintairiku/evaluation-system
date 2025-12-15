'use server';
import { auth } from '@clerk/nextjs/server';
import { getCurrentOrgContext } from '../utils/jwt-parser';
import { getCategorizedEvaluationPeriodsAction } from './evaluation-periods';
import { getCurrentUserAction } from './users';
import type { CurrentUserContextPayload } from '../types/current-user-context';

export async function getCurrentUserContextAction(): Promise<CurrentUserContextPayload> {
  const { userId: clerkUserId, orgId: clerkOrgId } = await auth();
  const orgContext = await getCurrentOrgContext();

  let user = null;
  if (clerkUserId) {
    try {
      const userResult = await getCurrentUserAction();
      if (userResult.success) {
        user = userResult.data ?? null;
      }
    } catch (error) {
      console.warn('Failed to load current user context:', error);
    }
  }

  const periodsResult = await getCategorizedEvaluationPeriodsAction();

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
}
