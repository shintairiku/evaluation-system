'use client';

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, AlertTriangle, Calendar, Target, ClipboardCheck } from 'lucide-react';
import { PERIOD_TYPE_LABELS } from '@/api/types/evaluation-period';
import {
  getStatusLabel,
  getStatusColor,
  formatDateRangeForDisplay,
  formatDateForDisplay,
} from '@/lib/evaluation-period-utils';
import type { EvaluationPeriodStatus } from '@/api/types/evaluation-period';
import type { StatusChangeConfirmationModalProps } from '../types';

type StatusChangeContent = {
  title: string;
  description: string;
  actionLabel: string;
  checkboxLabel: string;
  impacts: string[];
};

function getStatusChangeContent(nextStatus: EvaluationPeriodStatus): StatusChangeContent {
  if (nextStatus === 'completed') {
    return {
      title: '評価期間を終了にしますか？',
      description:
        'この操作は、評価期間のステータスを「終了」に変更するだけです。自動で昇進・降格を確定したり、レベルを一括反映したりはしません。',
      actionLabel: '終了にする',
      checkboxLabel:
        '終了後にできなくなる操作と、個別判断だけは継続できることを確認しました。',
      impacts: [
        'この期間の自己評価・上司評価のスコア変更はできなくなります。',
        '総合評価画面で、未処理ユーザーを「処理する」ことはできなくなります。',
        'すでに処理済みのユーザーに対する昇進・降格の個別判断は継続できます。',
      ],
    };
  }

  return {
    title: '評価期間をキャンセルしますか？',
    description:
      'この操作は、評価期間のステータスを「キャンセル」に変更します。キャンセル後は、この期間の評価作業を続けられません。',
    actionLabel: 'キャンセルにする',
    checkboxLabel:
      'キャンセル後にこの期間の評価作業を続けられないことを確認しました。',
    impacts: [
      'この期間の自己評価・上司評価のスコア変更はできなくなります。',
      '総合評価画面での処理や個別判断はできなくなります。',
    ],
  };
}

export default function StatusChangeConfirmationModal({
  isOpen,
  onClose,
  period,
  nextStatus,
  onConfirm,
  isSubmitting = false,
}: StatusChangeConfirmationModalProps) {
  const [hasConfirmed, setHasConfirmed] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setHasConfirmed(false);
    }
  }, [isOpen]);

  const statusLabel = getStatusLabel(period.status);
  const statusColor = getStatusColor(period.status);
  const nextStatusLabel = nextStatus === 'completed' ? '終了' : 'キャンセル';
  const periodTypeLabel = PERIOD_TYPE_LABELS[period.period_type] || period.period_type;
  const content = getStatusChangeContent(nextStatus);

  const handleConfirm = async () => {
    if (!hasConfirmed) return;
    await onConfirm();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle size={20} />
            {content.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="font-semibold text-gray-900">{period.name}</h3>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {periodTypeLabel}
                    </Badge>
                    <Badge className={`text-xs ${statusColor}`}>
                      {statusLabel}
                    </Badge>
                    <span className="text-sm text-muted-foreground">→</span>
                    <Badge variant="outline" className="text-xs">
                      {nextStatusLabel}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar size={14} />
                  <span>期間: {formatDateRangeForDisplay(period.start_date, period.end_date)}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Target size={14} />
                  <span>目標期限: {formatDateForDisplay(period.goal_submission_deadline)}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 sm:col-span-2">
                  <ClipboardCheck size={14} />
                  <span>評価期限: {formatDateForDisplay(period.evaluation_deadline)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Alert variant={nextStatus === 'cancelled' ? 'destructive' : 'default'}>
            <AlertTriangle size={16} />
            <AlertDescription className="space-y-2">
              <p className="font-medium">{content.description}</p>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {content.impacts.map((impact) => (
                  <li key={impact}>{impact}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>

          <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
            <Checkbox
              id="status-change-confirmation"
              checked={hasConfirmed}
              onCheckedChange={(checked) => setHasConfirmed(checked === true)}
              className="mt-0.5"
            />
            <label
              htmlFor="status-change-confirmation"
              className="text-sm text-gray-700"
            >
              {content.checkboxLabel}
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            戻る
          </Button>
          <Button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={!hasConfirmed || isSubmitting}
            variant={nextStatus === 'cancelled' ? 'destructive' : 'default'}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {content.actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
