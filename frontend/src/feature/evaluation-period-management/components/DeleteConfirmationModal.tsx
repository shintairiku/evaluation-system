'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle, Calendar, Clock, Target, ClipboardCheck } from 'lucide-react';
import { PERIOD_TYPE_LABELS } from '@/api/types/evaluation-period';
import {
  getStatusLabel,
  getStatusColor,
  formatDateRangeForDisplay,
  formatDateForDisplay,
  getDaysRemaining
} from '@/lib/evaluation-period-utils';
import type { DeleteConfirmationModalProps } from '../types';

export default function DeleteConfirmationModal({
  isOpen,
  onClose,
  period,
  onConfirm,
  isDeleting = false
}: DeleteConfirmationModalProps) {
  const [confirmationText, setConfirmationText] = useState('');
  const [hasDoubleConfirmed, setHasDoubleConfirmed] = useState(false);
  const [step, setStep] = useState<'warning' | 'confirmation'>('warning');

  const statusLabel = getStatusLabel(period.status);
  const statusColor = getStatusColor(period.status);
  const periodTypeLabel = PERIOD_TYPE_LABELS[period.period_type] || period.period_type;
  const daysRemaining = period.status === 'active' ? getDaysRemaining(period.end_date) : null;
  const canDelete = period.status === 'draft';

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setConfirmationText('');
      setHasDoubleConfirmed(false);
      setStep('warning');
    }
  }, [isOpen]);

  // Check if confirmation text matches period name
  const isConfirmationValid = confirmationText.trim() === period.name.trim();

  // Handle first confirmation (proceed to delete confirmation)
  const handleFirstConfirm = () => {
    setStep('confirmation');
  };

  // Handle final deletion
  const handleFinalDelete = async () => {
    if (!isConfirmationValid || !hasDoubleConfirmed) return;

    try {
      await onConfirm();
    } catch (error) {
      console.error('Delete confirmation error:', error);
    }
  };

  // Get warning message based on period status
  const getWarningMessage = () => {
    switch (period.status) {
      case 'active':
        return '実施中の評価期間を削除しようとしています。この操作により、関連する目標や評価データがすべて失われます。';
      case 'completed':
        return '完了済みの評価期間を削除しようとしています。この操作により、過去の評価記録が失われます。';
      case 'draft':
        return '下書きの評価期間を削除しようとしています。';
      default:
        return '評価期間を削除しようとしています。';
    }
  };

  const isHighRisk = period.status === 'active' || period.status === 'completed';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle size={20} />
            評価期間の削除確認
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Period Information Card */}
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="space-y-3">
                {/* Period Name and Type */}
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-gray-900">{period.name}</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {periodTypeLabel}
                      </Badge>
                      <Badge className={`text-xs ${statusColor}`}>
                        {statusLabel}
                      </Badge>
                    </div>
                  </div>
                  {daysRemaining !== null && (
                    <div className="flex items-center gap-1 text-sm text-red-600 font-medium">
                      <Clock size={14} />
                      <span>
                        {daysRemaining > 0
                          ? `残り${daysRemaining}日`
                          : daysRemaining === 0
                            ? '本日終了'
                            : '期間終了'
                        }
                      </span>
                    </div>
                  )}
                </div>

                {/* Date Information */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
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
              </div>
            </CardContent>
          </Card>

          {step === 'warning' && (
            <>
              {/* Warning Message */}
              <Alert variant={!canDelete || isHighRisk ? "destructive" : "default"}>
                <AlertTriangle size={16} />
                <AlertDescription className="space-y-2">
                  {!canDelete && (
                    <p className="font-medium">
                      この評価期間は削除できません（削除できるのは「下書き」の評価期間のみです）。
                    </p>
                  )}
                  <p className="font-medium">
                    {getWarningMessage()}
                  </p>
                  {isHighRisk && (
                    <p className="text-sm">
                      この操作は元に戻すことができません。続行する前に、本当に削除してよいか慎重に確認してください。
                    </p>
                  )}
                </AlertDescription>
              </Alert>

              {/* Risk Factors */}
              {isHighRisk && (
                <Card className="border-orange-200 bg-orange-50">
                  <CardContent className="p-4">
                    <h4 className="font-medium text-orange-800 mb-2">削除による影響:</h4>
                    <ul className="text-sm text-orange-700 space-y-1 list-disc list-inside">
                      <li>この評価期間に関連するすべての目標が削除されます</li>
                      <li>従業員の自己評価データが失われます</li>
                      <li>上司からのフィードバックデータが削除されます</li>
                      <li>評価履歴から完全に除外されます</li>
                      {period.status === 'active' && (
                        <li className="font-medium">現在進行中の評価プロセスが中断されます</li>
                      )}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {step === 'confirmation' && (
            <>
              {/* Final Confirmation */}
              <Alert variant="destructive">
                <AlertTriangle size={16} />
                <AlertDescription>
                  <p className="font-medium mb-2">最終確認</p>
                  <p className="text-sm">
                    削除を確定するには、以下の期間名を正確に入力し、チェックボックスにチェックを入れてください。
                  </p>
                </AlertDescription>
              </Alert>

              {/* Confirmation Input */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="confirmationText" className="text-sm font-medium">
                    期間名を入力してください: <span className="font-bold text-red-600">「{period.name}」</span>
                  </Label>
                  <Input
                    id="confirmationText"
                    value={confirmationText}
                    onChange={(e) => setConfirmationText(e.target.value)}
                    placeholder="期間名を正確に入力してください"
                    className={`${
                      confirmationText && !isConfirmationValid
                        ? 'border-red-500 focus:border-red-500'
                        : ''
                    }`}
                  />
                  {confirmationText && !isConfirmationValid && (
                    <p className="text-sm text-red-500">
                      入力された期間名が一致しません
                    </p>
                  )}
                </div>

                {/* Double Confirmation Checkbox */}
                <div className="flex items-start gap-3 p-3 border border-red-200 rounded-lg bg-red-50">
                  <input
                    type="checkbox"
                    id="doubleConfirm"
                    checked={hasDoubleConfirmed}
                    onChange={(e) => setHasDoubleConfirmed(e.target.checked)}
                    className="mt-0.5"
                  />
                  <label htmlFor="doubleConfirm" className="text-sm text-gray-700">
                    この評価期間を完全に削除することを理解し、同意します。
                    この操作は元に戻すことができないことを承知しています。
                  </label>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isDeleting}>
            キャンセル
          </Button>

          {step === 'warning' && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleFirstConfirm}
              disabled={isDeleting || !canDelete}
            >
              続行
            </Button>
          )}

          {step === 'confirmation' && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleFinalDelete}
              disabled={isDeleting || !isConfirmationValid || !hasDoubleConfirmed}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              完全に削除
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
