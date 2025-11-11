'use client';

import type { Stage, StageWeightHistoryEntry } from '@/api/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Loader2, History as HistoryIcon } from 'lucide-react';

interface StageWeightHistoryDrawerProps {
  stage: Stage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: StageWeightHistoryEntry[];
  isLoading: boolean;
  error?: string | null;
}

export default function StageWeightHistoryDrawer({
  stage,
  open,
  onOpenChange,
  entries,
  isLoading,
  error,
}: StageWeightHistoryDrawerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HistoryIcon className="h-4 w-4" />
            ウェイト変更履歴
          </DialogTitle>
          <DialogDescription>
            {stage ? `${stage.name} の最近の変更履歴を表示します。` : 'ステージを選択してください。'}
          </DialogDescription>
        </DialogHeader>

        <div className="border rounded-md bg-muted/20">
          <ScrollArea className="h-80">
            <div className="p-4 space-y-4">
              {isLoading && (
                <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>履歴を読み込んでいます...</span>
                </div>
              )}

              {!isLoading && error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              {!isLoading && !error && entries.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  まだウェイトの変更履歴がありません。
                </p>
              )}

              {!isLoading && !error && entries.length > 0 && (
                entries.map((entry) => (
                  <div key={entry.id} className="space-y-3">
                    <div>
                      <div className="text-sm font-medium mb-1">
                        <span>{new Date(entry.changedAt).toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">変更者:</span>{' '}
                        {entry.actorName ? (
                          <>
                            {entry.actorName}
                            {entry.actorEmployeeCode && ` (${entry.actorEmployeeCode})`}
                          </>
                        ) : (
                          <span className="font-mono">{shortenId(entry.actorUserId)}</span>
                        )}
                      </p>
                    </div>

                    <div className="grid gap-2 text-sm">
                      <HistoryRow
                        label="定量"
                        before={entry.quantitativeWeightBefore}
                        after={entry.quantitativeWeightAfter}
                      />
                      <HistoryRow
                        label="定性"
                        before={entry.qualitativeWeightBefore}
                        after={entry.qualitativeWeightAfter}
                      />
                      <HistoryRow
                        label="コンピテンシー"
                        before={entry.competencyWeightBefore}
                        after={entry.competencyWeightAfter}
                      />
                    </div>

                    <Separator />
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface HistoryRowProps {
  label: string;
  before?: number | null;
  after?: number | null;
}

function HistoryRow({ label, before, after }: HistoryRowProps) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="font-mono flex items-center gap-1">
        <span>{formatWeight(before)}</span>
        <span className="text-muted-foreground">→</span>
        <span>{formatWeight(after)}</span>
      </div>
    </div>
  );
}

function formatWeight(value?: number | null): string {
  if (value === undefined || value === null) {
    return '-';
  }
  const normalized = Number(value);
  const fixed = normalized % 1 === 0 ? normalized.toFixed(0) : normalized.toFixed(1);
  return `${fixed}%`;
}

function shortenId(id: string): string {
  if (!id) return '';
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}
