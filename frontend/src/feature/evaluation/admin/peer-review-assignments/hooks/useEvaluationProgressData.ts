import { useState, useEffect, useMemo, useCallback } from 'react';
import { getProgressAction } from '@/api/server-actions/peer-reviews';
import type { EvaluationProgressEntry } from '@/api/types';

export type ProgressFilter = 'all' | 'submitted' | 'in_progress' | 'not_started';

export interface ProgressStats {
  total: number;
  allComplete: number;
  inProgress: number;
  notStarted: number;
}

function isSubmitted(status: string | null): boolean {
  return status === 'submitted' || status === 'approved';
}

function isInProgress(status: string | null): boolean {
  return status === 'draft' || status === 'incomplete';
}

export interface UseEvaluationProgressDataReturn {
  entries: EvaluationProgressEntry[];
  filteredEntries: EvaluationProgressEntry[];
  isLoading: boolean;
  error: string | null;
  stats: ProgressStats;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filter: ProgressFilter;
  setFilter: (f: ProgressFilter) => void;
  refetch: () => Promise<void>;
}

export function useEvaluationProgressData(
  periodId: string | null
): UseEvaluationProgressDataReturn {
  const [entries, setEntries] = useState<EvaluationProgressEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<ProgressFilter>('all');

  const loadData = useCallback(async () => {
    if (!periodId) return;
    try {
      setIsLoading(true);
      setError(null);
      const result = await getProgressAction(periodId);
      if (result.success && result.data) {
        setEntries(result.data);
      } else {
        setError(result.error || '評価進捗の取得に失敗しました');
      }
    } catch {
      setError('予期しないエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  }, [periodId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const stats = useMemo<ProgressStats>(() => {
    let allComplete = 0;
    let inProgress = 0;
    let notStarted = 0;

    for (const e of entries) {
      const sources = [e.selfAssessment, e.peerReviewer1, e.peerReviewer2, e.supervisor];
      const allSubmitted = sources.every(s => isSubmitted(s.status));
      const anyStarted = sources.some(s => s.status !== null);

      if (allSubmitted) allComplete++;
      else if (anyStarted) inProgress++;
      else notStarted++;
    }

    return { total: entries.length, allComplete, inProgress, notStarted };
  }, [entries]);

  const filteredEntries = useMemo(() => {
    let result = entries;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        e =>
          e.userName.toLowerCase().includes(q) ||
          e.departmentName?.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (filter !== 'all') {
      result = result.filter(e => {
        const sources = [e.selfAssessment, e.peerReviewer1, e.peerReviewer2, e.supervisor];
        const allSubmitted = sources.every(s => isSubmitted(s.status));
        const anyStarted = sources.some(s => s.status !== null);

        switch (filter) {
          case 'submitted':
            return allSubmitted;
          case 'in_progress':
            return anyStarted && !allSubmitted;
          case 'not_started':
            return !anyStarted;
          default:
            return true;
        }
      });
    }

    return result;
  }, [entries, searchQuery, filter]);

  return {
    entries,
    filteredEntries,
    isLoading,
    error,
    stats,
    searchQuery,
    setSearchQuery,
    filter,
    setFilter,
    refetch: loadData,
  };
}
