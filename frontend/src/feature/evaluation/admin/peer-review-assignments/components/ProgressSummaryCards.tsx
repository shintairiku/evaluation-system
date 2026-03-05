import { Users, CheckCircle, Clock, XCircle } from 'lucide-react';
import type { ProgressStats } from '../hooks/useEvaluationProgressData';

interface ProgressSummaryCardsProps {
  stats: ProgressStats;
}

export function ProgressSummaryCards({ stats }: ProgressSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-card border rounded-lg p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Users className="h-4 w-4" />
          対象者数
        </div>
        <p className="text-2xl font-bold mt-1">{stats.total}</p>
      </div>
      <div className="bg-card border rounded-lg p-4">
        <div className="flex items-center gap-2 text-green-600 text-sm">
          <CheckCircle className="h-4 w-4" />
          全評価完了
        </div>
        <p className="text-2xl font-bold mt-1">{stats.allComplete}</p>
      </div>
      <div className="bg-card border rounded-lg p-4">
        <div className="flex items-center gap-2 text-yellow-600 text-sm">
          <Clock className="h-4 w-4" />
          進行中
        </div>
        <p className="text-2xl font-bold mt-1">{stats.inProgress}</p>
      </div>
      <div className="bg-card border rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-600 text-sm">
          <XCircle className="h-4 w-4" />
          未着手
        </div>
        <p className="text-2xl font-bold mt-1">{stats.notStarted}</p>
      </div>
    </div>
  );
}
