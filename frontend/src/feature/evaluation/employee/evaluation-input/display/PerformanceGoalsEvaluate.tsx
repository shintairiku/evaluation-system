"use client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
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

const RATING_LABELS: Record<RatingCode, string> = {
  'SS': 'SS - 卓越',
  'S': 'S - 優秀',
  'A': 'A - 良好',
  'B': 'B - 標準',
  'C': 'C - 要改善',
  'D': 'D - 不十分',
};

const initialPerformanceEvaluations: SelfAssessment[] = [
  {
    id: "perf-1",
    type: "quantitative",
    weight: 60,
    specificGoal: "売上を前年比120%にする",
    achievementCriteria: "売上が前年比120%を超えた場合達成",
    methods: "新規顧客の開拓と既存顧客への提案強化",
    ratingCode: undefined,
    comment: ""
  },
  {
    id: "perf-2",
    type: "qualitative",
    weight: 40,
    specificGoal: "顧客アンケートで満足度90%以上を獲得",
    achievementCriteria: "アンケート結果で90%以上の満足度を得る",
    methods: "定期的なフォローアップと迅速な対応",
    ratingCode: undefined,
    comment: ""
  }
];

export default function PerformanceGoalsEvaluate() {
  const [performanceEvaluations, setPerformanceEvaluations] = useState<SelfAssessment[]>(initialPerformanceEvaluations);

  const updateAssessment = (index: number, field: keyof SelfAssessment, value: string | RatingCode | undefined) => {
    const updatedPerformanceEvaluations = [...performanceEvaluations];
    updatedPerformanceEvaluations[index] = { ...updatedPerformanceEvaluations[index], [field]: value };
    setPerformanceEvaluations(updatedPerformanceEvaluations);
  };

  const getRatingsForType = (type: "quantitative" | "qualitative"): RatingCode[] => {
    return type === "quantitative" ? QUANTITATIVE_RATINGS : QUALITATIVE_RATINGS;
  };

  return (
    <div className="max-w-3xl mx-auto py-6">
      <Card className="shadow-xl border-0 bg-white">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-blue-100 text-blue-700">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold tracking-tight">業績目標評価</CardTitle>
              <p className="text-xs text-gray-500 mt-1">各目標ごとに自己評価を入力してください</p>
            </div>
          </div>
        </CardHeader>
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
                <div className="flex flex-col gap-1 mb-2">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold text-gray-500">達成基準：</span>
                    {evalItem.achievementCriteria}
                  </p>
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold text-gray-500">手段・手法：</span>
                    {evalItem.methods}
                  </p>
                </div>

                {/* Rating Selection */}
                <div>
                  <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                    自己評価 {!evalItem.ratingCode && <span className="text-red-500">*</span>}
                  </Label>
                  <div className="flex gap-2 flex-wrap">
                    {availableRatings.map((rating) => {
                      const isSelected = evalItem.ratingCode === rating;
                      return (
                        <Button
                          key={rating}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateAssessment(idx, "ratingCode", rating)}
                          className={`
                            min-w-[60px] font-semibold transition-all
                            ${isSelected
                              ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
                              : 'bg-white hover:bg-blue-50 hover:border-blue-400'
                            }
                          `}
                        >
                          {rating}
                        </Button>
                      );
                    })}
                  </div>
                  {evalItem.ratingCode && (
                    <p className="text-xs text-gray-500 mt-2">
                      {RATING_LABELS[evalItem.ratingCode]}
                    </p>
                  )}
                </div>

                {/* Comment Section */}
                <div>
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
      </Card>
    </div>
  );
}
