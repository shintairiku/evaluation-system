import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Eye, Loader2, Search } from 'lucide-react';
import { ProgressStatusBadge } from './ProgressStatusBadge';
import { ProgressSummaryCards } from './ProgressSummaryCards';
import { EvaluationDetailSheet } from './EvaluationDetailSheet';
import type { EvaluationProgressEntry, EvaluationProgressSource } from '@/api/types';
import type { ProgressFilter, ProgressStats } from '../hooks/useEvaluationProgressData';

interface ProgressTableProps {
  entries: EvaluationProgressEntry[];
  isLoading: boolean;
  error: string | null;
  stats: ProgressStats;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filter: ProgressFilter;
  setFilter: (f: ProgressFilter) => void;
  refetch: () => Promise<void>;
  periodId: string;
}

const FILTER_TABS: { value: ProgressFilter; label: string }[] = [
  { value: 'all', label: 'すべて' },
  { value: 'submitted', label: '提出済' },
  { value: 'in_progress', label: '保存中' },
  { value: 'not_started', label: '未着手' },
];

function SourceCell({ source }: { source: EvaluationProgressSource }) {
  const hasEvaluator = source.evaluatorName !== null;
  return (
    <div className="space-y-0.5">
      {hasEvaluator && (
        <p className="text-xs text-muted-foreground truncate max-w-[140px]">
          {source.evaluatorName}
        </p>
      )}
      <ProgressStatusBadge status={source.status} hasEvaluator={hasEvaluator} />
    </div>
  );
}

export function ProgressTable({
  entries,
  isLoading,
  error,
  stats,
  searchQuery,
  setSearchQuery,
  filter,
  setFilter,
  refetch,
  periodId,
}: ProgressTableProps) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {!isLoading && !error && <ProgressSummaryCards stats={stats} />}

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center p-4 bg-card rounded-lg border">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="社員名・部署で検索..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-1">
          {FILTER_TABS.map(tab => (
            <Button
              key={tab.value}
              variant={filter === tab.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(tab.value)}
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={refetch}>
              再読み込み
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Table */}
      {!error && (
        <div className="bg-card border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">被評価者</TableHead>
                <TableHead className="w-[120px]">部署</TableHead>
                <TableHead className="w-[160px]">自己評価</TableHead>
                <TableHead className="w-[160px]">同僚評価者1</TableHead>
                <TableHead className="w-[160px]">同僚評価者2</TableHead>
                <TableHead className="w-[160px]">上長評価</TableHead>
                <TableHead className="w-[60px]">詳細</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mt-2">読み込み中...</p>
                  </TableCell>
                </TableRow>
              ) : entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    該当するユーザーがいません
                  </TableCell>
                </TableRow>
              ) : (
                entries.map(entry => (
                  <TableRow key={entry.userId}>
                    <TableCell className="font-medium">{entry.userName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {entry.departmentName ?? '-'}
                    </TableCell>
                    <TableCell>
                      <SourceCell source={entry.selfAssessment} />
                    </TableCell>
                    <TableCell>
                      <SourceCell source={entry.peerReviewer1} />
                    </TableCell>
                    <TableCell>
                      <SourceCell source={entry.peerReviewer2} />
                    </TableCell>
                    <TableCell>
                      <SourceCell source={entry.supervisor} />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setSelectedUserId(entry.userId)}
                      >
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail Sheet */}
      {selectedUserId && (
        <EvaluationDetailSheet
          open={!!selectedUserId}
          onClose={() => setSelectedUserId(null)}
          periodId={periodId}
          userId={selectedUserId}
        />
      )}
    </div>
  );
}
