"use client";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Target, ChevronDown, ChevronUp } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type RatingCode = 'SS' | 'S' | 'A' | 'B' | 'C' | 'D';

interface CompetencyItem {
  id: number;
  description: string;
  rating: RatingCode | undefined;
}

interface CompetencyEvaluation {
  name: string;
  items: CompetencyItem[];
  comment: string;
}

const RATINGS: RatingCode[] = ['SS', 'S', 'A', 'B', 'C', 'D'];

const initialCompetencyEvaluation: CompetencyEvaluation = {
  name: "責任感",
  items: [
    {
      id: 1,
      description: "他メンバーの業務状況を把握し、必要に応じてサポートしている",
      rating: undefined
    },
    {
      id: 2,
      description: "締切や約束を守り、期日までに業務を完遂している",
      rating: undefined
    },
    {
      id: 3,
      description: "問題が発生した際に、自ら解決策を考え実行している",
      rating: undefined
    },
    {
      id: 4,
      description: "業務の優先順位を適切に判断し、効率的に進めている",
      rating: undefined
    },
    {
      id: 5,
      description: "チーム目標達成のために、積極的に貢献している",
      rating: undefined
    }
  ],
  comment: ""
};

export default function CompetencySupervisorEvaluation() {
  const [competencyEvaluation, setCompetencyEvaluation] = useState<CompetencyEvaluation>(initialCompetencyEvaluation);
  const [isExpanded, setIsExpanded] = useState(true);

  const updateItemRating = (itemId: number, rating: RatingCode) => {
    setCompetencyEvaluation(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === itemId ? { ...item, rating } : item
      )
    }));
  };

  const updateComment = (comment: string) => {
    setCompetencyEvaluation(prev => ({
      ...prev,
      comment
    }));
  };

  return (
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
                <p className="text-xs text-gray-500 mt-1">上長による評価入力</p>
              </div>

              <div className="flex items-center gap-2">
                {/* Overall Rating Display */}
                <div className="flex items-center gap-2 px-3 py-1 rounded-md border border-gray-200 bg-white">
                  <span className="text-xs text-gray-500">総合評価</span>
                  <div className="text-xl font-bold text-gray-300">
                    −
                  </div>
                </div>

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
        <div className="grid grid-cols-[auto_1fr] gap-16">
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

        <div className="bg-green-50 border border-green-200 rounded-2xl shadow-sm px-6 py-5 space-y-5">
          {/* Competency Header with Rating */}
          <div className="flex items-center justify-between mb-4">
            <div className="text-xl font-bold text-green-800">
              {competencyEvaluation.name}
            </div>

            {/* Individual Competency Rating Display */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-md border border-gray-200 bg-white">
              <span className="text-xs text-gray-500">評価</span>
              <div className="text-xl font-bold text-gray-300">
                −
              </div>
            </div>
          </div>

          {/* Competency Items - Editable */}
          <div className="space-y-4">
            {competencyEvaluation.items.map((item) => (
              <div key={item.id} className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-gray-700">{item.description}</p>

                  {/* Rating Selector */}
                  <div className="flex items-center gap-3 flex-wrap">
                    {RATINGS.map((rating) => {
                      const isSelected = item.rating === rating;
                      return (
                        <div
                          key={rating}
                          className="flex items-center gap-2 cursor-pointer"
                          onClick={() => updateItemRating(item.id, rating)}
                        >
                          <div className="w-6 h-6 rounded-full border-2 border-gray-400 flex items-center justify-center transition-all">
                            {isSelected && <div className="w-3 h-3 rounded-full bg-gray-800"></div>}
                          </div>
                          <span className="text-sm text-gray-700">{rating}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Comment Section */}
          <div className="mt-5">
            <Label className="text-sm font-semibold text-gray-700 mb-2 block">
              上長評価コメント {competencyEvaluation.comment.trim() === "" && <span className="text-red-500">*</span>}
            </Label>
            <Textarea
              value={competencyEvaluation.comment}
              onChange={(e) => updateComment(e.target.value)}
              placeholder="上長としてのフィードバックを記入してください..."
              className="mt-1 text-sm rounded-md border-gray-300 focus:ring-2 focus:ring-green-200 min-h-[100px]"
              maxLength={5000}
            />
            <div className="flex justify-between items-center mt-1">
              <p className="text-xs text-gray-400">具体的なフィードバックを記載してください</p>
              <p className="text-xs text-gray-400">{competencyEvaluation.comment.length} / 5000</p>
            </div>
          </div>
        </div>
        </CardContent>
      )}
    </Card>
  );
}
