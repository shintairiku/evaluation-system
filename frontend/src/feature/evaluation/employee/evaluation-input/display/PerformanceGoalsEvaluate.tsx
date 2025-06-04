"use client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { useState } from "react";

interface SelfAssessment {
  id: string;
  type: "quantitative" | "qualitative";
  weight: number;
  specificGoal: string;
  achievementCriteria: string;
  methods: string;
  score: number;
  comment: string;
}

const initialPerformanceEvaluations: SelfAssessment[] = [
  {
    id: "perf-1",
    type: "quantitative",
    weight: 60,
    specificGoal: "売上を前年比120%にする",
    achievementCriteria: "売上が前年比120%を超えた場合達成",
    methods: "新規顧客の開拓と既存顧客への提案強化",
    score: 80,
    comment: "目標達成に向けてよく頑張った"
  },
  {
    id: "perf-2",
    type: "qualitative",
    weight: 40,
    specificGoal: "顧客アンケートで満足度90%以上を獲得",
    achievementCriteria: "アンケート結果で90%以上の満足度を得る",
    methods: "定期的なフォローアップと迅速な対応",
    score: 90,
    comment: "顧客対応が丁寧で高評価"
  }
];

export default function PerformanceGoalsEvaluate() {
  const [performanceEvaluations, setPerformanceEvaluations] = useState<SelfAssessment[]>(initialPerformanceEvaluations);
  const updateAssessment = (index: number, field: keyof SelfAssessment, value: string | number) => {
    const updatedPerformanceEvaluations = [...performanceEvaluations];
    updatedPerformanceEvaluations[index] = { ...updatedPerformanceEvaluations[index], [field]: value };
    setPerformanceEvaluations(updatedPerformanceEvaluations);
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
          {performanceEvaluations.map((evalItem, idx) => (
            <div
              key={evalItem.id}
              className="bg-slate-50 border border-slate-200 rounded-2xl shadow-sm px-6 py-5 space-y-5 transition hover:shadow-md"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="text-xl font-bold text-blue-800 flex-1">{evalItem.specificGoal}</div>
                <Badge className="bg-blue-600 text-white text-sm px-3 py-1">
                  ウエイト {evalItem.weight}%
                </Badge>
                <span className="text-xs font-medium px-2 py-1 rounded-full"
                  style={{
                    background: evalItem.type === "quantitative" ? "#2563eb22" : "#a21caf22",
                    color: evalItem.type === "quantitative" ? "#2563eb" : "#a21caf"
                  }}
                >
                  {evalItem.type === "quantitative" ? "定量目標" : "定性目標"}
                </span>
              </div>
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
              <div>
                <Label className="text-xs text-gray-500">自己評価スコア</Label>
                <div className="flex flex-col items-center mt-1">
                  <Slider
                    value={[evalItem.score]}
                    onValueChange={(value) => updateAssessment(idx, "score", value[0])}
                    max={100}
                    min={0}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-2 w-full">
                    <span>0</span>
                    <span>20</span>
                    <span>40</span>
                    <span>60</span>
                    <span>80</span>
                    <span>100</span>
                  </div>
                </div>
              </div>
              <div>
                <Label className="text-xs text-gray-500">自己評価コメント</Label>
                <Textarea
                  value={evalItem.comment}
                  readOnly
                  className="mt-1 text-sm rounded-md border-gray-300 bg-gray-100 focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
