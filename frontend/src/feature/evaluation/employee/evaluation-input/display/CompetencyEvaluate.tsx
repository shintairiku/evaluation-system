"use client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Target, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState } from "react";

const competencyEvaluation = {
  name: "責任感",
  items: [
    {
      id: 1,
      description: "他メンバーの業務状況を把握し、必要に応じてサポートしている",
      rating: "A"
    },
    {
      id: 2,
      description: "自分の意見だけでなく、他者の意見を尊重して意思決定している",
      rating: "B"
    },
    {
      id: 3,
      description: "チームの目標を個人目標より優先して行動している",
      rating: "A"
    },
    {
      id: 4,
      description: "困っているメンバーに対して自発的に声をかけている",
      rating: "A"
    },
    {
      id: 5,
      description: "チーム内の情報共有を積極的に行っている",
      rating: "A"
    }
  ],
  comment: ""
};

export default function CompetencyEvaluate() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [itemRatings, setItemRatings] = useState<{[key: number]: string}>(
    competencyEvaluation.items.reduce((acc, item) => ({
      ...acc,
      [item.id]: item.rating
    }), {})
  );
  const [comment, setComment] = useState<string>(competencyEvaluation.comment);

  const updateItemRating = (itemId: number, rating: string) => {
    setItemRatings(prev => ({
      ...prev,
      [itemId]: rating
    }));
  };

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
            {/* Rating Criteria Descriptions - Two Column Layout with Sticky Position */}
            <div className="sticky top-4 z-10 bg-white pb-4 pt-10 -mt-8 border-b border-gray-200 mb-2">
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
            </div>

            {/* Competency Evaluation Section */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl shadow-sm px-6 py-5 space-y-5">
              {/* Competency Name Display with Rating */}
              <div className="flex items-center justify-between mb-4">
                <div className="text-xl font-bold text-green-800">
                  {competencyEvaluation.name}
                </div>

                {/* Rating Display with Tooltip */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2 px-3 py-1 rounded-md border border-gray-200 bg-white cursor-help transition-colors hover:bg-gray-50">
                        <span className="text-xs text-gray-500">評価</span>
                        <div className="text-xl font-bold text-gray-300">
                          −
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p className="text-xs">
                        ※すべての責任感評価を入力すると表示されます。
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Competency Items */}
              <div className="space-y-6">
                {competencyEvaluation.items.map((item) => (
                  <div key={item.id}>
                    {/* Item Description */}
                    <div className="text-sm text-gray-800 mb-3">
                      {item.description}
                    </div>

                    {/* Rating Buttons for this item */}
                    <div className="flex items-center gap-3">
                      {['SS', 'S', 'A', 'B', 'C', 'D'].map((rating) => (
                        <div
                          key={rating}
                          className="flex items-center gap-2 cursor-pointer"
                          onClick={() => updateItemRating(item.id, rating)}
                        >
                          <div className="w-6 h-6 rounded-full border-2 border-gray-400 flex items-center justify-center transition-all">
                            {rating === itemRatings[item.id] && <div className="w-3 h-3 rounded-full bg-gray-800"></div>}
                          </div>
                          <span className="text-sm text-gray-700">{rating}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Comment Section - Outside competency card */}
            <div className="mt-6">
              <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                自己評価コメント
              </Label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="各コンピテンシーの発揮状況や具体的なエピソードについて記入してください..."
                className="mt-1 text-sm rounded-md border-gray-300 bg-white focus:ring-2 focus:ring-green-200 min-h-[100px]"
                maxLength={5000}
              />
              <div className="flex justify-end items-center mt-1">
                <p className="text-xs text-gray-400">{comment.length} / 5000</p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
