import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, AlertCircle, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function ApprovalGuidelinesPanel() {
  const [isExpanded, setIsExpanded] = useState(true); // Start expanded
  return (
    <Card className="mb-6">
      <CardHeader
        className="cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            目標承認チェックポイント
          </div>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </CardTitle>
      </CardHeader>
      {isExpanded && (
        <CardContent className="animate-in slide-in-from-top-2 duration-200">
        <div className="grid md:grid-cols-2 gap-6">
          {/* 承認基準 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <h4 className="font-medium text-green-900">承認基準</h4>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 mt-0.5">
                  SMART
                </Badge>
                <span>具体的、測定可能、達成可能、関連性、期限が明確</span>
              </li>
              <li className="flex items-start gap-2">
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 mt-0.5">
                  適正
                </Badge>
                <span>従業員のスキルレベルと職責に適している</span>
              </li>
              <li className="flex items-start gap-2">
                <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200 mt-0.5">
                  整合
                </Badge>
                <span>部門・組織の目標との整合性がある</span>
              </li>
            </ul>
          </div>

          {/* 差し戻し基準 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <h4 className="font-medium text-red-900">差し戻し基準</h4>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <AlertCircle className="h-3 w-3 text-red-500 mt-1" />
                <span>目標が曖昧で測定できない</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="h-3 w-3 text-red-500 mt-1" />
                <span>達成期限が不明確または非現実的</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="h-3 w-3 text-red-500 mt-1" />
                <span>目標達成のための具体的な行動が示されていない</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="h-3 w-3 text-red-500 mt-1" />
                <span>組織戦略との整合性がない</span>
              </li>
            </ul>
          </div>
        </div>

        {/* 重要事項 */}
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-md">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium text-amber-900 text-sm">重要事項</p>
              <p className="text-amber-800 text-sm">
                差し戻し時は、従業員が改善できるよう具体的で建設的なフィードバックをコメントに記載してください。
                単に「不十分」ではなく、どの点をどのように改善すべきかを明確に示しましょう。
              </p>
            </div>
          </div>
        </div>
        </CardContent>
      )}
    </Card>
  );
}