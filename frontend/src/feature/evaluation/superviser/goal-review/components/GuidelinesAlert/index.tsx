import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';

export function GuidelinesAlert() {
  return (
    <Alert className="mb-6 border-blue-200 bg-blue-50">
      <Info className="h-4 w-4 text-blue-600" />
      <AlertDescription className="text-blue-900">
        <div className="space-y-2">
          <p className="font-medium">目標承認ガイドライン</p>
          <ul className="text-sm space-y-1 ml-4 list-disc">
            <li>目標が具体的で測定可能かを確認してください</li>
            <li>達成期限が明確に設定されているかを確認してください</li>
            <li>目標に対して達成可能な道筋が設定されているか確認してください</li>
            <li>差し戻し時は具体的な改善点をコメントに記載してください</li>
          </ul>
        </div>
      </AlertDescription>
    </Alert>
  );
}
