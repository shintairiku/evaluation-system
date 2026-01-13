"use client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";
import { Label } from "@/components/ui/label";

// Rating types
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

const mockPerformanceEvaluations: SelfAssessment[] = [
  {
    id: "perf-1",
    type: "quantitative",
    weight: 60,
    specificGoal: "売上を前年比120%にする",
    achievementCriteria: "売上が前年比120%を超えた場合達成",
    methods: "母集団形成の最大化\nほげほげほげほげ\n\n採用オペレーションの最適化\nほげおげほげほげ\nほげほげほげほげ",
    ratingCode: "SS",
    comment: "目標を大幅に超過達成しました。新規顧客開拓により売上130%を実現できました。"
  },
  {
    id: "perf-2",
    type: "qualitative",
    weight: 40,
    specificGoal: "顧客アンケートで満足度90%以上を獲得",
    achievementCriteria: "アンケート結果で90%以上の満足度を得る",
    methods: "定期的なフォローアップと迅速な対応\nお客様の声を積極的に収集",
    ratingCode: "S",
    comment: "顧客満足度調査で92%を達成しました。特にアフターサービスの改善が評価されました。"
  }
];

export default function PerformanceGoalsSelfAssessment() {
  return (
    <Card className="shadow-xl border-0 bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-blue-100 text-blue-700">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold tracking-tight">業績目標評価</CardTitle>
                <p className="text-xs text-gray-500 mt-1">自己評価（参照のみ）</p>
              </div>

              {/* Overall Rating Display */}
              <div className="flex items-center gap-2 px-3 py-1 rounded-md border border-gray-200 bg-white">
                <span className="text-xs text-gray-500">総合評価</span>
                <div className="text-xl font-bold text-blue-700">
                  SS
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-2">
        {mockPerformanceEvaluations.map((evalItem) => (
          <div
            key={evalItem.id}
            className="bg-slate-50 border border-slate-200 rounded-2xl shadow-sm px-6 py-5 space-y-5"
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

              {/* 評価基準 Section - Display only */}
              <div>
                <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                  自己評価
                </Label>
                <div className="flex items-center gap-2">
                  <div className="text-3xl font-bold text-blue-700">
                    {evalItem.ratingCode || '−'}
                  </div>
                </div>
              </div>
            </div>

            {/* Comment Section - Read only */}
            <div className="mt-5">
              <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                自己評価コメント
              </Label>
              <div className="mt-1 text-sm text-gray-700 bg-white rounded-md border border-gray-300 p-3 min-h-[100px]">
                {evalItem.comment}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
