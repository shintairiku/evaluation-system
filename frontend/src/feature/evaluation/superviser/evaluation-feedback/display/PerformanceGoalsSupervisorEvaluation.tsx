"use client";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Rating types
type QuantitativeRatingCode = 'SS' | 'S' | 'A' | 'B' | 'C' | 'D';
type QualitativeRatingCode = 'SS' | 'S' | 'A' | 'B' | 'C';
type RatingCode = QuantitativeRatingCode | QualitativeRatingCode;

interface SupervisorEvaluation {
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

const initialSupervisorEvaluations: SupervisorEvaluation[] = [
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

export default function PerformanceGoalsSupervisorEvaluation() {
  const [supervisorEvaluations, setSupervisorEvaluations] = useState<SupervisorEvaluation[]>(initialSupervisorEvaluations);

  const updateEvaluation = (index: number, field: keyof SupervisorEvaluation, value: string | RatingCode | undefined) => {
    const updated = [...supervisorEvaluations];
    updated[index] = { ...updated[index], [field]: value };
    setSupervisorEvaluations(updated);
  };

  const getRatingsForType = (type: "quantitative" | "qualitative"): RatingCode[] => {
    return type === "quantitative" ? QUANTITATIVE_RATINGS : QUALITATIVE_RATINGS;
  };

  return (
    <Card className="shadow-xl border-0 bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-green-100 text-green-700">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold tracking-tight">業績目標評価</CardTitle>
                <p className="text-xs text-gray-500 mt-1">上長による評価入力</p>
              </div>

              {/* Overall Rating Display */}
              <div className="flex items-center gap-2 px-3 py-1 rounded-md border border-gray-200 bg-white">
                <span className="text-xs text-gray-500">総合評価</span>
                <div className="text-xl font-bold text-gray-300">
                  −
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-2">
        {supervisorEvaluations.map((evalItem, idx) => {
          const availableRatings = getRatingsForType(evalItem.type);

          return (
            <div
              key={evalItem.id}
              className="bg-green-50 border border-green-200 rounded-2xl shadow-sm px-6 py-5 space-y-5"
            >
              {/* Goal Header */}
              <div className="flex items-center gap-3 mb-2">
                <div className="text-xl font-bold text-green-800 flex-1">{evalItem.specificGoal}</div>
                <Badge className="bg-green-600 text-white text-sm px-3 py-1">
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
                    上長評価 {!evalItem.ratingCode && <span className="text-red-500">*</span>}
                  </Label>

                  {/* Radio button style selectors */}
                  <div className="flex items-center gap-3 flex-wrap">
                    {availableRatings.map((rating) => {
                      const isSelected = evalItem.ratingCode === rating;
                      return (
                        <div
                          key={rating}
                          className="flex items-center gap-2 cursor-pointer"
                          onClick={() => updateEvaluation(idx, "ratingCode", rating)}
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
                  上長評価コメント {evalItem.comment.trim() === "" && <span className="text-red-500">*</span>}
                </Label>
                <Textarea
                  value={evalItem.comment}
                  onChange={(e) => updateEvaluation(idx, "comment", e.target.value)}
                  placeholder="上長としてのフィードバックを記入してください..."
                  className="mt-1 text-sm rounded-md border-gray-300 focus:ring-2 focus:ring-green-200 min-h-[100px]"
                  maxLength={5000}
                />
                <div className="flex justify-between items-center mt-1">
                  <p className="text-xs text-gray-400">具体的なフィードバックを記載してください</p>
                  <p className="text-xs text-gray-400">{evalItem.comment.length} / 5000</p>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
