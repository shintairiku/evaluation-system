import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Target } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const competencyEvaluation = {
  name: "チームワーク・協調性",
  score: 85,
  comment: "チーム内での連携が良かった"
};

export default function CompetencyEvaluate() {
  return (
    <div className="max-w-3xl mx-auto py-6">
      <Card className="shadow-xl border-0 bg-white">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-green-100 text-green-700">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold tracking-tight">コンピテンシー評価</CardTitle>
              <p className="text-xs text-gray-500 mt-1">ステージ連動・自己評価</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-2">
          <div>
            <Label className="text-xs text-gray-500">対象コンピテンシー</Label>
            <Input
              value={competencyEvaluation.name}
              readOnly
              className="mt-1 text-sm rounded-md border-gray-300 bg-gray-100 focus:ring-2 focus:ring-green-200"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500">自己評価点（0-100）</Label>
            <Input
              type="number"
              value={competencyEvaluation.score}
              readOnly
              className="mt-1 text-sm rounded-md border-gray-300 bg-gray-100 focus:ring-2 focus:ring-green-200"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500">自己評価コメント</Label>
            <Textarea
              value={competencyEvaluation.comment}
              readOnly
              className="mt-1 text-sm rounded-md border-gray-300 bg-gray-100 focus:ring-2 focus:ring-green-200"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
