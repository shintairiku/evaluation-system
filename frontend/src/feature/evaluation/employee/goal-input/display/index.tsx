import PerformanceGoals from "./PerformanceGoals";
import Competency from "./Competency";
import SaveDraftButton from "../components/SaveDraftButton";
import SubmitButton from "../components/SubmitButton";

export default function IndexPage() {
  return (
    <div>
      <div className="space-y-5">
        <PerformanceGoals />
        <Competency />

        {/* アクションボタン（ダミー） */}
        <div className="flex justify-center space-x-3">
          <SaveDraftButton />
          <SubmitButton />
        </div>
      </div>
    </div>
  );
}
