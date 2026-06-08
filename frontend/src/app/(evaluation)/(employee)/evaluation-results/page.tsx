import { getCategorizedEvaluationPeriodsAction } from "@/api/server-actions/evaluation-periods";
import { getCurrentUserAction } from "@/api/server-actions/users";
import EvaluationResultsDisplay from "@/feature/evaluation/employee/evaluation-results/display";
import {
  fetchMyEvaluationData,
  pickDefaultFinalizedPeriod,
  type MyEvaluationRawData,
} from "@/feature/evaluation/employee/evaluation-results/display/utils";
import type { EvaluationPeriod } from "@/api/types";

export default async function Page() {
  const [periodsResult, userResult] = await Promise.all([
    getCategorizedEvaluationPeriodsAction(),
    getCurrentUserAction(),
  ]);

  const periods: EvaluationPeriod[] =
    periodsResult.success && periodsResult.data ? periodsResult.data.all || [] : [];
  const user = userResult.success && userResult.data ? userResult.data : null;

  // Default to the most recent finalized (完了) period.
  const defaultPeriod = pickDefaultFinalizedPeriod(periods);
  const initialPeriodId = defaultPeriod?.id ?? "";

  // SSR-first: resolve the default period's data on the server for a no-flash first paint.
  let initialData: MyEvaluationRawData | null = null;
  if (defaultPeriod && user) {
    initialData = await fetchMyEvaluationData(defaultPeriod.id, user.id);
  }

  return (
    <EvaluationResultsDisplay
      initialUser={user}
      initialPeriods={periods}
      initialPeriodId={initialPeriodId}
      initialData={initialData}
    />
  );
}
