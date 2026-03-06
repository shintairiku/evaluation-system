import { getCategorizedEvaluationPeriodsAction } from "@/api/server-actions/evaluation-periods";
import IndexPage from "@/feature/evaluation/employee/evaluation-input/display/index";

export default async function Page() {
  const result = await getCategorizedEvaluationPeriodsAction();
  const periods = result.success && result.data ? result.data.all || [] : [];
  const activePeriod = periods.find(p => p.status === 'active') || periods[0];

  return (
    <IndexPage
      initialPeriods={periods}
      initialPeriodId={activePeriod?.id ?? ""}
    />
  );
}
