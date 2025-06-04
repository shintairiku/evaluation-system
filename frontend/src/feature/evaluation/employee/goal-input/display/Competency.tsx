import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Target } from "lucide-react";

const competencyGoal = {
  competencyName: "チームワーク・協調性",
  actionPlan: "週1回のチームミーティングを主導する",
  weight: 100,
};
const employeeStage = "中堅社員";

export default function Competency() {
  return (
    <div className="max-w-3xl mx-auto py-6">
      <Card className="shadow-xl border-0 bg-white">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-green-100 text-green-700">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold tracking-tight">コンピテンシー</CardTitle>
              <p className="text-xs text-gray-500 mt-1">ステージ連動・固定ウエイト</p>
            </div>
            <Badge className="bg-green-600 text-white font-semibold px-3 py-1 ml-auto">
              ウエイト: {competencyGoal.weight}%（固定）
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-2">
          <div className="bg-green-50 border border-green-100 rounded-2xl px-6 py-5">
            <h4 className="font-medium text-green-800 mb-1 text-base">対象コンピテンシー</h4>
            <p className="text-green-700 text-lg font-semibold">{competencyGoal.competencyName}</p>
            <p className="text-xs text-green-600 mt-1">
              ※ あなたのステージ「{employeeStage}」に応じて自動選択されました
            </p>
          </div>
          <div>
            <Label htmlFor="action-plan" className="text-xs text-gray-500">
              アクションプラン <span className="text-red-400">*</span>
            </Label>
            <Textarea
              id="action-plan"
              value={competencyGoal.actionPlan}
              readOnly
              placeholder="このコンピテンシーを向上させるための具体的なアクションプランを記載してください"
              className="mt-1 min-h-[100px] text-sm rounded-md border-gray-300 bg-gray-100 focus:ring-2 focus:ring-green-200"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
