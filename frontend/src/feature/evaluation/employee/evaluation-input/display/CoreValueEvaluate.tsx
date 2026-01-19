import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";

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
              <p className="text-xs text-gray-500 mt-1">コアバリュー評価は期末のみ表示される</p>
            </div>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
