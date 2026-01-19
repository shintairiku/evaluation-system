"use client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState } from "react";

// Rating types based on new specification
type QuantitativeRatingCode = 'SS' | 'S' | 'A' | 'B' | 'C' | 'D';
type QualitativeRatingCode = 'SS' | 'S' | 'A' | 'B' | 'C';
type RatingCode = QuantitativeRatingCode | QualitativeRatingCode;

interface SelfAssessment {
  id: string;
  type: "quantitative" | "qualitative";
  weight: number;
  specificGoal: string;
  achievementCriteria: string;
  methods: string;
  ratingCode?: RatingCode;
  comment: string;
}

const QUANTITATIVE_RATINGS: QuantitativeRatingCode[] = ['SS', 'S', 'A', 'B', 'C', 'D'];
const QUALITATIVE_RATINGS: QualitativeRatingCode[] = ['SS', 'S', 'A', 'B', 'C'];

const initialPerformanceEvaluations: SelfAssessment[] = [
  {
    id: "perf-1",
    type: "quantitative",
    weight: 60,
    specificGoal: "売上を前年比120%にする",
    achievementCriteria: "売上が前年比120%を超えた場合達成",
    methods: "母集団形成の最大化\nほげほげほげほげ\n\n採用オペレーションの最適化\nほげおげほげほげ\nほげほげほげほげ",
    ratingCode: undefined,
    comment: ""
  },
  {
    id: "perf-2",
    type: "qualitative",
    weight: 40,
    specificGoal: "顧客アンケートで満足度90%以上を獲得",
    achievementCriteria: "アンケート結果で90%以上の満足度を得る",
    methods: "定期的なフォローアップと迅速な対応\nお客様の声を積極的に収集",
    ratingCode: undefined,
    comment: ""
  }
];

export default function PerformanceGoalsEvaluate() {
  const [performanceEvaluations, setPerformanceEvaluations] = useState<SelfAssessment[]>(initialPerformanceEvaluations);
  const [isExpanded, setIsExpanded] = useState(true);

  const updateAssessment = (index: number, field: keyof SelfAssessment, value: string | RatingCode | undefined) => {
    const updatedPerformanceEvaluations = [...performanceEvaluations];
    updatedPerformanceEvaluations[index] = { ...updatedPerformanceEvaluations[index], [field]: value };
    setPerformanceEvaluations(updatedPerformanceEvaluations);
  };

  const getRatingsForType = (type: "quantitative" | "qualitative"): RatingCode[] => {
    return type === "quantitative" ? QUANTITATIVE_RATINGS : QUALITATIVE_RATINGS;
  };

  // Calculate overall rating based on weighted average
  const calculateOverallRating = (): string | null => {
    const allCompleted = performanceEvaluations.every(
      (item) => item.ratingCode && item.comment.trim() !== ""
    );

    if (!allCompleted) return null;

    const RATING_VALUES: Record<RatingCode, number> = {
      'SS': 7.0,
      'S': 6.0,
      'A': 4.0,
      'B': 2.0,
      'C': 1.0,
      'D': 0.0,
    };

    let totalWeightedScore = 0;
    let totalWeight = 0;

    performanceEvaluations.forEach((item) => {
      if (item.ratingCode) {
        const value = RATING_VALUES[item.ratingCode];
        totalWeightedScore += value * item.weight;
        totalWeight += item.weight;
      }
    });

    const averageScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;

    // Map average score to rating code
    if (averageScore >= 6.5) return 'SS';
    if (averageScore >= 5.5) return 'S';
    if (averageScore >= 3.5) return 'A';
    if (averageScore >= 1.5) return 'B';
    if (averageScore >= 0.5) return 'C';
    return 'D';
  };

  const overallRating = calculateOverallRating();

  return (
    <div className="max-w-3xl mx-auto py-6">
      <Card className="shadow-xl border-0 bg-white">
        <CardHeader className="pb-3">
          {/* First Row: Icon, Title, Overall Rating, and Expand Button */}
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-blue-100 text-blue-700">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold tracking-tight">業績目標評価</CardTitle>
                  <p className="text-xs text-gray-500 mt-1">各目標ごとに自己評価を入力してください</p>
                </div>

                {/* Overall Rating Display */}
                <div className="flex items-center gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2 px-3 py-1 rounded-md border border-gray-200 bg-white cursor-help transition-colors hover:bg-gray-50">
                          <span className="text-xs text-gray-500">総合評価</span>
                          <div className={`text-xl font-bold ${
                            overallRating
                              ? 'text-blue-700'
                              : 'text-gray-300'
                          }`}>
                            {overallRating || '−'}
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p className="text-xs">
                          ※すべての業績目標評価を入力すると総合評価が表示されます。
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
                    className="p-2 hover:bg-blue-50"
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
          {performanceEvaluations.map((evalItem, idx) => {
            const availableRatings = getRatingsForType(evalItem.type);

            return (
              <div
                key={evalItem.id}
                className="bg-slate-50 border border-slate-200 rounded-2xl shadow-sm px-6 py-5 space-y-5 transition hover:shadow-md"
              >
                {/* Goal Header */}
                <div className="flex items-center gap-3 mb-2">
                  <div className="text-xl font-bold text-blue-800 flex-1">{evalItem.specificGoal}</div>
                  <Badge className="bg-blue-600 text-white text-sm px-3 py-1">
                    ウエイト {evalItem.weight}%
                  </Badge>
                  <span
                    className="text-xs font-medium px-2 py-1 rounded-full"
                    style={{
                      background: evalItem.type === "quantitative" ? "#2563eb22" : "#a21caf22",
                      color: evalItem.type === "quantitative" ? "#2563eb" : "#a21caf"
                    }}
                  >
                    {evalItem.type === "quantitative" ? "定量目標" : "定性目標"}
                  </span>
                </div>

                {/* Goal Details */}
                <div className="flex flex-col gap-5 mb-2">
                  {/* 手段・手法 Section */}
                  <div>
                    <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                      手段・手法
                    </Label>
                    <div className="text-xs text-gray-500 leading-relaxed space-y-0.5">
                      {evalItem.methods.split('\n').map((line, i) => (
                        <div key={i}>{line || '\u00A0'}</div>
                      ))}
                    </div>
                  </div>

                  {/* 評価基準 Section with Radio Buttons */}
                  <div>
                    <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                      評価基準 {!evalItem.ratingCode && <span className="text-red-500">*</span>}
                    </Label>

                    {/* Rating descriptions */}
                    <div className="text-xs text-gray-500 space-y-0.5 mb-3">
                      {availableRatings.map((rating) => (
                        <div key={rating}>
                          <span className="font-semibold">{rating}</span>
                          <span className="mx-1">：</span>
                          <span>上位3%以内に入っている</span>
                        </div>
                      ))}
                    </div>

                    {/* Radio button style selectors */}
                    <div className="flex items-center gap-3 flex-wrap">
                      {availableRatings.map((rating) => {
                        const isSelected = evalItem.ratingCode === rating;
                        return (
                          <div
                            key={rating}
                            className="flex items-center gap-2 cursor-pointer"
                            onClick={() => updateAssessment(idx, "ratingCode", rating)}
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

                {/* Comment Section */}
                <div className="mt-5">
                  <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                    自己評価コメント {evalItem.comment.trim() === "" && <span className="text-red-500">*</span>}
                  </Label>
                  <Textarea
                    value={evalItem.comment}
                    onChange={(e) => updateAssessment(idx, "comment", e.target.value)}
                    placeholder="目標の達成状況や具体的な成果について記入してください..."
                    className="mt-1 text-sm rounded-md border-gray-300 focus:ring-2 focus:ring-blue-200 min-h-[100px]"
                    maxLength={5000}
                  />
                  <div className="flex justify-between items-center mt-1">
                    <p className="text-xs text-gray-400">具体的な成果や改善点を記載してください</p>
                    <p className="text-xs text-gray-400">{evalItem.comment.length} / 5000</p>
                  </div>
                </div>
              </div>
            );
          })}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
