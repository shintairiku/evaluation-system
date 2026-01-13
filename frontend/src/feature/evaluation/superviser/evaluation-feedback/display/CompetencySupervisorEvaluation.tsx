"use client";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Target, ChevronDown, ChevronUp } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

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
