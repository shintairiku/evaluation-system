import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const coreValueEvaluation = {
  comment: "会社のコアバリューを意識した行動ができていた"
};

export default function CoreValueEvaluate() {
  return (
    <div className="max-w-3xl mx-auto py-6">
      <Card className="shadow-xl border-0 bg-white">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-purple-100 text-purple-700">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold tracking-tight">コアバリュー評価</CardTitle>
              <p className="text-xs text-gray-500 mt-1">期末評価のみ実施</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-2">
          <div>
            <Label className="text-xs text-gray-500">自己評価コメント</Label>
            <Textarea
              value={coreValueEvaluation.comment}
              readOnly
              className="mt-1 text-sm rounded-md border-gray-300 bg-gray-100 focus:ring-2 focus:ring-purple-200"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
