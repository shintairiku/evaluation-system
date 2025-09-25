'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle } from 'lucide-react';

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  type: 'approve' | 'reject';
  goalTitle: string;
  employeeName: string;
  comment?: string;
  isProcessing?: boolean;
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  type,
  goalTitle,
  employeeName,
  comment,
  isProcessing = false
}: ConfirmationDialogProps) {
  const isApproval = type === 'approve';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isApproval ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            {isApproval ? '目標を承認しますか？' : '目標を差し戻しますか？'}
          </DialogTitle>
          <DialogDescription className="space-y-3">
            <div>
              <p className="font-medium text-foreground">従業員: {employeeName}</p>
              <p className="text-sm mt-1">目標: {goalTitle}</p>
            </div>

            {comment && (
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm font-medium mb-1">コメント:</p>
                <p className="text-sm whitespace-pre-wrap">{comment}</p>
              </div>
            )}

            <p className="text-sm">
              {isApproval
                ? 'この目標を承認します。この操作は取り消すことができません。'
                : 'この目標を差し戻します。従業員は修正して再提出する必要があります。'
              }
            </p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            キャンセル
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isProcessing}
            className={isApproval
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-red-600 hover:bg-red-700'
            }
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                {isApproval ? '承認中...' : '差し戻し中...'}
              </>
            ) : (
              <>
                {isApproval ? (
                  <CheckCircle className="h-4 w-4 mr-2" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                {isApproval ? '承認する' : '差し戻す'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}