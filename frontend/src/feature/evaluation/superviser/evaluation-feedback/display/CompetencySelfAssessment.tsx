"use client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Target } from "lucide-react";
import { Label } from "@/components/ui/label";

type RatingCode = 'SS' | 'S' | 'A' | 'B' | 'C' | 'D';

interface CompetencyItem {
  id: number;
  description: string;
  rating: RatingCode;
}

interface CompetencyEvaluation {
  name: string;
  items: CompetencyItem[];
  comment: string;
}

const mockCompetencyEvaluation: CompetencyEvaluation = {
  name: "責任感",
  items: [
    {
      id: 1,
      description: "他メンバーの業務状況を把握し、必要に応じてサポートしている",
      rating: "SS"
    },
    {
      id: 2,
      description: "締切や約束を守り、期日までに業務を完遂している",
      rating: "S"
    },
    {
      id: 3,
      description: "問題が発生した際に、自ら解決策を考え実行している",
      rating: "A"
    },
    {
      id: 4,
      description: "業務の優先順位を適切に判断し、効率的に進めている",
      rating: "A"
    },
    {
      id: 5,
      description: "チーム目標達成のために、積極的に貢献している",
      rating: "S"
    }
  ],
  comment: "責任感を持って業務に取り組みました。特にチームメンバーのサポートと期日管理に注力しました。"
};

export default function CompetencySelfAssessment() {
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
                <p className="text-xs text-gray-500 mt-1">自己評価（参照のみ）</p>
              </div>

              {/* Overall Rating Display */}
              <div className="flex items-center gap-2 px-3 py-1 rounded-md border border-gray-200 bg-white">
                <span className="text-xs text-gray-500">総合評価</span>
                <div className="text-xl font-bold text-blue-700">
                  S
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-2">
        <div className="bg-slate-50 border border-slate-200 rounded-2xl shadow-sm px-6 py-5 space-y-5">
          {/* Competency Header with Rating */}
          <div className="flex items-center justify-between mb-4">
            <div className="text-xl font-bold text-green-800">
              {mockCompetencyEvaluation.name}
            </div>

            {/* Individual Competency Rating Display */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-md border border-gray-200 bg-white">
              <span className="text-xs text-gray-500">評価</span>
              <div className="text-xl font-bold text-blue-700">
                S
              </div>
            </div>
          </div>

          {/* Competency Items - Read only */}
          <div className="space-y-4">
            {mockCompetencyEvaluation.items.map((item) => (
              <div key={item.id} className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-gray-700">{item.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-bold text-blue-700">
                      {item.rating}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Comment Section - Read only */}
          <div className="mt-5">
            <Label className="text-sm font-semibold text-gray-700 mb-2 block">
              自己評価コメント
            </Label>
            <div className="mt-1 text-sm text-gray-700 bg-white rounded-md border border-gray-300 p-3 min-h-[100px]">
              {mockCompetencyEvaluation.comment}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
