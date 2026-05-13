import { redirect } from "next/navigation";
import { getCurrentUserContextAction } from "@/api/server-actions/current-user-context";
import { ComprehensiveEvaluationPage } from "@/feature/evaluation/admin/comprehensive-evaluation";

export default async function Page() {
  const currentUserContext = await getCurrentUserContextAction();
  const roles = currentUserContext?.user?.roles?.map((r) => r.name) ?? [];
  if (!roles.some((r) => r === "admin" || r === "eval_admin")) {
    redirect("/access-denied");
  }
  return <ComprehensiveEvaluationPage />;
}
