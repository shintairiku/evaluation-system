"use client";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Plus, Minus, AlertTriangle } from "lucide-react";

type GoalType = "quantitative" | "qualitative";

interface PerformanceGoal {
  id: string;
  type: GoalType;
  weight: number;
  specificGoal: string;
  achievementCriteria: string;
  methods: string;
}

export default function PerformanceGoals() {
  const [performanceGoals, setPerformanceGoals] = useState<PerformanceGoal[]>([]);

  const totalPerformanceWeight = performanceGoals.reduce((sum, goal) => sum + goal.weight, 0);
  const isWeightValid = totalPerformanceWeight === 100;

  const addGoal = (type: GoalType) => {
    const newGoal: PerformanceGoal = {
      id: `perf-${Date.now()}-${Math.random()}`,
      type,
      weight: 0,
      specificGoal: "",
      achievementCriteria: "",
      methods: ""
    };
    setPerformanceGoals([...performanceGoals, newGoal]);
  };

  const removeGoal = (id: string) => {
    setPerformanceGoals(performanceGoals.filter(goal => goal.id !== id));
  };

  const updateGoal = (id: string, field: keyof PerformanceGoal, value: any) => {
    setPerformanceGoals(performanceGoals.map(goal =>
      goal.id === id ? { ...goal, [field]: value } : goal
    ));
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
              <CardTitle className="text-lg font-bold tracking-tight">業績目標</CardTitle>
              <p className="text-xs text-gray-500 mt-1">定量・定性目標の組み合わせ（合計100%）</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-2">
          {performanceGoals.length === 0 && (
            <div className="text-gray-400 text-sm text-center py-10">
              目標がありません。<br />
              <span className="inline-block mt-2">「定量目標追加」または「定性目標追加」ボタンで目標を追加してください。</span>
            </div>
          )}
          {performanceGoals.map((goal, index) => (
            <div
              key={goal.id}
              className="bg-slate-50 border border-slate-200 rounded-2xl shadow-sm px-6 py-5 space-y-5 transition hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge
                    className={
                      goal.type === "quantitative"
                        ? "bg-blue-600 text-white font-semibold px-3 py-1"
                        : "bg-purple-600 text-white font-semibold px-3 py-1"
                    }
                  >
                    {goal.type === "quantitative" ? "定量" : "定性"}
                  </Badge>
                  <span className="text-base font-medium text-gray-700">
                    目標 {index + 1}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={goal.type}
                    onChange={e => updateGoal(goal.id, "type", e.target.value as GoalType)}
                    className="text-xs border-gray-300 rounded-md px-2 py-1 focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="quantitative">定量目標</option>
                    <option value="qualitative">定性目標</option>
                  </select>
                  {performanceGoals.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeGoal(goal.id)}
                      className="text-red-500 hover:bg-red-50"
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label htmlFor={`weight-${goal.id}`} className="text-xs text-gray-500">
                    ウエイト (%)
                  </Label>
                  <Input
                    id={`weight-${goal.id}`}
                    type="number"
                    min="0"
                    max="100"
                    value={goal.weight}
                    onChange={e => updateGoal(goal.id, "weight", parseInt(e.target.value) || 0)}
                    className="mt-1 text-sm rounded-md border-gray-300 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div className="col-span-3">
                  <Label htmlFor={`specific-${goal.id}`} className="text-xs text-gray-500">
                    具体的目標 <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id={`specific-${goal.id}`}
                    value={goal.specificGoal}
                    onChange={e => updateGoal(goal.id, "specificGoal", e.target.value)}
                    placeholder="例: 売上を前年比120%に"
                    className="mt-1 text-sm rounded-md border-gray-300 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={`criteria-${goal.id}`} className="text-xs text-gray-500">
                    達成基準 <span className="text-red-400">*</span>
                  </Label>
                  <Textarea
                    id={`criteria-${goal.id}`}
                    value={goal.achievementCriteria}
                    onChange={e => updateGoal(goal.id, "achievementCriteria", e.target.value)}
                    placeholder="達成とみなす具体的な基準"
                    className="mt-1 text-sm rounded-md border-gray-300 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div>
                  <Label htmlFor={`methods-${goal.id}`} className="text-xs text-gray-500">
                    手段・手法 <span className="text-red-400">*</span>
                  </Label>
                  <Textarea
                    id={`methods-${goal.id}`}
                    value={goal.methods}
                    onChange={e => updateGoal(goal.id, "methods", e.target.value)}
                    placeholder="目標達成のための具体的な手段"
                    className="mt-1 text-sm rounded-md border-gray-300 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 px-8 pb-7 pt-3 border-t border-slate-100">
          <div className="w-full md:w-2/3 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">ウエイト配分進捗</span>
              <span className={isWeightValid ? "text-blue-600 font-bold" : "text-red-600 font-bold"}>
                {totalPerformanceWeight}/100%
              </span>
            </div>
            <Progress
              value={totalPerformanceWeight}
              className={`h-2 rounded-full ${totalPerformanceWeight > 100 ? 'bg-red-100' : 'bg-blue-100'}`}
            />
            {!isWeightValid && (
              <p className="text-xs text-red-500 flex items-center mt-1">
                <AlertTriangle className="w-4 h-4 mr-1" />
                ウエイト合計が100%になるよう調整してください
              </p>
            )}
          </div>
          <div className="flex gap-2 w-full md:w-auto justify-end">
            <Button
              variant="default"
              size="sm"
              onClick={() => addGoal("quantitative")}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md px-4 py-2"
            >
              <Plus className="w-4 h-4 mr-1" />
              定量目標追加
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => addGoal("qualitative")}
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-md px-4 py-2"
            >
              <Plus className="w-4 h-4 mr-1" />
              定性目標追加
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
