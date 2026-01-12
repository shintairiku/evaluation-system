"use client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Target, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState } from "react";

const competencyEvaluation = {
  name: "チームワーク・協調性",
  score: 85,
  comment: "チーム内での連携が良かった"
};

export default function CompetencyEvaluate() {
  const [isExpanded, setIsExpanded] = useState(true);

  // Mock overall rating - será calculado dinamicamente no futuro
  const overallRating = null; // null para mostrar "−"

  return (
    <div className="max-w-3xl mx-auto py-6">
      <Card className="shadow-xl border-0 bg-white">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-green-100 text-green-700">
              <Target className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold tracking-tight">コンピテンシー評価</CardTitle>
                  <p className="text-xs text-gray-500 mt-1">各コンピテンシーごとに自己評価を入力してください</p>
                </div>

                {/* Overall Rating Display with Tooltip */}
                <div className="flex items-center gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2 px-3 py-1 rounded-md border border-gray-200 bg-white cursor-help transition-colors hover:bg-gray-50">
                          <span className="text-xs text-gray-500">総合評価</span>
                          <div className={`text-xl font-bold ${
                            overallRating ? 'text-green-700' : 'text-gray-300'
                          }`}>
                            {overallRating || '−'}
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p className="text-xs">
                          ※すべてのコンピテンシー評価を入力すると総合評価が表示されます。
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {/* Expand/Collapse Button */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-2 hover:bg-green-50"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-600" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-600" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="space-y-6 pt-2">
            <div>
              <p className="text-sm text-gray-600">対象コンピテンシー: {competencyEvaluation.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">自己評価点: {competencyEvaluation.score}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">コメント: {competencyEvaluation.comment}</p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
