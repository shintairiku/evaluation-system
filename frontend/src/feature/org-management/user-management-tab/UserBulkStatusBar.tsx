'use client';

import { useState, useMemo } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import type { UserStatus, BulkUserStatusUpdateResponse } from '@/api/types';

const STATUS_OPTIONS: { value: UserStatus; label: string }[] = [
  { value: 'active', label: 'アクティブ' },
  { value: 'inactive', label: '無効' },
  { value: 'pending_approval', label: '承認待ち' },
];

interface UserBulkStatusBarProps {
  selectedCount: number;
  isProcessing: boolean;
  lastResult?: BulkUserStatusUpdateResponse | null;
  onSubmit: (status: UserStatus) => void;
  onClearSelection: () => void;
}

export function UserBulkStatusBar({
  selectedCount,
  isProcessing,
  lastResult,
  onSubmit,
  onClearSelection,
}: UserBulkStatusBarProps) {
  const [targetStatus, setTargetStatus] = useState<UserStatus>('active');

  const progressValue = useMemo(() => {
    if (isProcessing) {
      return selectedCount ? Math.min(95, Math.max(10, selectedCount ? 60 : 30)) : 50;
    }
    if (lastResult && selectedCount) {
      return Math.round((lastResult.successCount / selectedCount) * 100);
    }
    return 0;
  }, [isProcessing, lastResult, selectedCount]);

  const summaryText = useMemo(() => {
    if (!lastResult || !selectedCount) return null;
    return `成功 ${lastResult.successCount} / 失敗 ${lastResult.failureCount}`;
  }, [lastResult, selectedCount]);

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {selectedCount} 件のユーザーを選択中
          </p>
          {summaryText && (
            <p className="text-xs text-muted-foreground">
              {summaryText}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            value={targetStatus}
            onValueChange={(value) => setTargetStatus(value as UserStatus)}
            disabled={isProcessing}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="ステータスを選択" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            disabled={isProcessing || selectedCount === 0}
            onClick={() => onSubmit(targetStatus)}
            className="min-w-[140px]"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                更新中...
              </>
            ) : (
              '一括ステータス更新'
            )}
          </Button>
          <Button
            variant="ghost"
            onClick={onClearSelection}
            disabled={isProcessing}
            className="text-muted-foreground"
          >
            <RotateCcw className="mr-2 size-4" />
            選択をクリア
          </Button>
        </div>
      </div>

      {(isProcessing || (lastResult && selectedCount)) && (
        <div className="flex items-center gap-3">
          <Progress value={progressValue} className="h-2 flex-1" />
          <span className="text-xs text-muted-foreground">
            {isProcessing ? '処理中...' : '完了'}
          </span>
        </div>
      )}
    </div>
  );
}
