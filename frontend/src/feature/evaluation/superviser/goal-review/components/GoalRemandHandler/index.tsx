'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { rejectGoalAction } from '@/api/server-actions/goals';
import type { GoalResponse } from '@/api/types';

interface GoalRemandHandlerProps {
  goal: GoalResponse;
  employeeName?: string;
  onSuccess?: () => void;
}

export function GoalRemandHandler({ goal, employeeName, onSuccess }: GoalRemandHandlerProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [isProcessing, setIsProcessing] = React.useState(false);

  const canSubmit = reason.trim().length > 0 && !isProcessing;

  const handleOpen = () => {
    setReason('');
    setOpen(true);
  };

  const handleClose = (nextOpen: boolean) => {
    if (isProcessing) return;
    setOpen(nextOpen);
  };

  const handleConfirm = async () => {
    if (!reason.trim()) {
      toast.error('差戻し理由を入力してください');
      return;
    }

    setIsProcessing(true);

    try {
      const result = await rejectGoalAction(goal.id, reason.trim());
      if (!result.success) {
        toast.error('差戻しに失敗しました', {
          description: result.error || '不明なエラーが発生しました。',
        });
        return;
      }

      toast.success('目標を差し戻しました', {
        description: employeeName ? `${employeeName}の目標を差し戻しました。` : undefined,
      });

      setOpen(false);
      setReason('');
      if (onSuccess) {
        onSuccess();
      } else {
        router.refresh();
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') console.error('Remand goal error:', error);
      toast.error('差戻しに失敗しました', {
        description: '予期しないエラーが発生しました。',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <Button variant="destructive" onClick={handleOpen} disabled={isProcessing}>
        差戻し
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>目標を差し戻しますか？</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              差戻し理由を入力してください。差戻し後、従業員は目標を修正して再提出できます。
            </p>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="差戻し理由"
              rows={5}
              disabled={isProcessing}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isProcessing}>
              キャンセル
            </Button>
            <Button variant="destructive" onClick={handleConfirm} disabled={!canSubmit}>
              差戻しする
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
