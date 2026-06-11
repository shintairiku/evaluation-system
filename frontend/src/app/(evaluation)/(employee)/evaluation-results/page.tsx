import { getCategorizedEvaluationPeriodsAction } from "@/api/server-actions/evaluation-periods";
import { getCurrentUserAction } from "@/api/server-actions/users";
import { getMyComprehensiveEvaluationAction } from "@/api/server-actions/comprehensive-evaluation";
import EvaluationResultsDisplay from "@/feature/evaluation/employee/evaluation-results/display";
import {
  fetchMyEvaluationData,
  pickDefaultFinalizedPeriod,
  type MyEvaluationRawData,
} from "@/feature/evaluation/employee/evaluation-results/display/utils";
import type { EvaluationPeriod, ComprehensiveEvaluationRank } from "@/api/types";

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
  // The (heavier) comprehensive rank is fetched in parallel and kept separate so it
  // never blocks rendering of the main sections.
  let initialData: MyEvaluationRawData | null = null;
  let initialComprehensiveRank: ComprehensiveEvaluationRank | null = null;
  if (defaultPeriod && user) {
    const [data, comprehensive] = await Promise.all([
      fetchMyEvaluationData(defaultPeriod.id, user.id),
      getMyComprehensiveEvaluationAction(defaultPeriod.id),
    ]);
    initialData = data;
    initialComprehensiveRank =
      comprehensive.success && comprehensive.data ? comprehensive.data.overallRank : null;
  }

  return (
    <EvaluationResultsDisplay
      initialUser={user}
      initialPeriods={periods}
      initialPeriodId={initialPeriodId}
      initialData={initialData}
      initialComprehensiveRank={initialComprehensiveRank}
    />
  );
}
