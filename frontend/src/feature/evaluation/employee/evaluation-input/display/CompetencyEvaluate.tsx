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
            {/* Rating Criteria Descriptions - Two Column Layout */}
            <div className="grid grid-cols-2 gap-4">
              {/* Left Column: Rating descriptions */}
              <div className="text-xs text-gray-500 space-y-0.5">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-help hover:bg-gray-50 py-1 px-2 rounded transition-colors">
                        <span className="font-semibold">SS</span>
                        <span className="mx-1">：</span>
                        <span>全社でも圧倒的なレベルで体現できている</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={10} className="max-w-sm">
                      <p className="text-xs">社内でもごく少数のレベルに達しており、あらゆる状況下で圧倒的に高い水準でスキルを発揮し、全社から高い信頼を得ると共に大きな影響力を与えている。</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-help hover:bg-gray-50 py-1 px-2 rounded transition-colors">
                        <span className="font-semibold">S</span>
                        <span className="mx-1">：</span>
                        <span>全社的な模範人材として常に体現できている</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={10} className="max-w-sm">
                      <p className="text-xs">高いレベルで一貫してスキルを発揮しており、他者の模範として難易度の高い場面でも安定して体現できている。</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-help hover:bg-gray-50 py-1 px-2 rounded transition-colors">
                        <span className="font-semibold">A+</span>
                        <span className="mx-1">：</span>
                        <span>周囲の手本となっている</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={10} className="max-w-sm">
                      <p className="text-xs">チーム内外から信頼されるレベルの安定したスキルを常に発揮しており、手本となる場面が多いと周囲からも認識されている。</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-help hover:bg-gray-50 py-1 px-2 rounded transition-colors">
                        <span className="font-semibold">A</span>
                        <span className="mx-1">：</span>
                        <span>十分に身についている</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={10} className="max-w-sm">
                      <p className="text-xs">どのような場面や状況においても自立してスキルを実践できており、常に安定して日常業務の中で発揮できている。</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-help hover:bg-gray-50 py-1 px-2 rounded transition-colors">
                        <span className="font-semibold">A-</span>
                        <span className="mx-1">：</span>
                        <span>おおむね身についている</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={10} className="max-w-sm">
                      <p className="text-xs">おおむねスキルは身についているが、場面や状況によって再現性にばらつきがあり、安定性に一部課題が見られる。</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-help hover:bg-gray-50 py-1 px-2 rounded transition-colors">
                        <span className="font-semibold">B</span>
                        <span className="mx-1">：</span>
                        <span>もうひと頑張り</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={10} className="max-w-sm">
                      <p className="text-xs">スキルの基礎的な行動や姿勢は一部に見られるが、実務においてまだ安定して発揮されておらず、意識的な取り組みやフィードバックを通じた成長が求められる状態。</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-help hover:bg-gray-50 py-1 px-2 rounded transition-colors">
                        <span className="font-semibold">C</span>
                        <span className="mx-1">：</span>
                        <span>不十分</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={10} className="max-w-sm">
                      <p className="text-xs">スキルの発揮が不十分であり、職務やチームへの影響が懸念される状態。本人の自覚と明確な改善行動が求められる。</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Right Column: Empty space for tooltips */}
              <div></div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
