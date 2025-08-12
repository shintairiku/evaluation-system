import IndexPage from "@/feature/goal-input/display/index";
import { getCurrentEvaluationPeriodId } from "@/api/server-actions";

export default async function Page() {
  const res = await getCurrentEvaluationPeriodId();
  const periodId = res.success ? res.data?.periodId : undefined;
  return <IndexPage periodId={periodId} />;
}