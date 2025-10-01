'use client';

import React, { useEffect } from 'react';
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
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation';
import { useResponsiveBreakpoint } from '@/hooks/useResponsiveBreakpoint';
import { generateAccessibilityId, announceToScreenReader } from '@/utils/accessibility';

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

  // Accessibility and responsive hooks
  const { containerRef } = useKeyboardNavigation({
    enableArrowKeys: true,
    enableTabNavigation: true,
    enableEscapeKey: true,
    onEscape: () => {
      if (!isProcessing) {
        onOpenChange(false);
        announceToScreenReader('確認ダイアログがキャンセルされました', 'polite');
      }
    },
    onEnter: () => {
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement?.tagName === 'BUTTON') {
        activeElement.click();
      }
    }
  });
  const { isMobile } = useResponsiveBreakpoint();

  // Generate unique ID for content region
  const contentId = React.useMemo(() => generateAccessibilityId('dialog-content'), []);

  // Announce dialog opening to screen readers
  useEffect(() => {
    if (open) {
      announceToScreenReader(
        `${isApproval ? '承認' : '差し戻し'}確認ダイアログが開きました`,
        'polite'
      );
    }
  }, [open, isApproval]);

  const handleCancel = () => {
    if (!isProcessing) {
      onOpenChange(false);
      announceToScreenReader('操作がキャンセルされました', 'polite');
    }
  };

  const handleConfirm = () => {
    announceToScreenReader(
      `${isApproval ? '承認' : '差し戻し'}処理を開始します`,
      'assertive'
    );
    onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={containerRef as React.Ref<HTMLDivElement>}
        showCloseButton={false}
        className={`max-w-md ${isMobile ? 'mx-4 max-w-sm' : 'max-w-md'}`}
        onEscapeKeyDown={(e) => {
          if (!isProcessing) {
            handleCancel();
          } else {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isApproval ? (
              <CheckCircle className="h-5 w-5 text-green-600" aria-hidden="true" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" aria-hidden="true" />
            )}
            {isApproval ? '目標を承認しますか？' : '目標を差し戻しますか？'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            この操作を実行しますか？確認してください。
          </DialogDescription>
        </DialogHeader>
        <div
          id={contentId}
          className={`space-y-3 pb-4 ${isMobile ? 'px-4 pb-3' : 'px-6 pb-4'}`}
          role="region"
          aria-label="確認内容"
        >
          <div className="space-y-2">
            <div role="group" aria-label="対象情報">
              <p className="font-medium text-foreground" aria-label={`従業員名: ${employeeName}`}>
                従業員: {employeeName}
              </p>
              <p className="text-sm mt-1" aria-label={`目標タイトル: ${goalTitle}`}>
                目標: {goalTitle}
              </p>
            </div>

            {comment && (
              <div
                className="p-3 bg-muted rounded-md"
                role="region"
                aria-label="入力されたコメント"
              >
                <p className="text-sm font-medium mb-1" role="heading" aria-level={3}>
                  コメント:
                </p>
                <p className="text-sm whitespace-pre-wrap" aria-label={`コメント内容: ${comment}`}>
                  {comment}
                </p>
              </div>
            )}

            <div
              className="p-3 rounded-md border-l-4 bg-muted/50"
              style={{
                borderLeftColor: isApproval ? '#16a34a' : '#dc2626'
              }}
              role="alert"
              aria-live="polite"
            >
              <p className={`text-sm font-medium ${isApproval ? 'text-green-700' : 'text-red-700'}`}>
                重要な注意事項:
              </p>
              <p className="text-sm mt-1">
                {isApproval
                  ? 'この目標を承認します。この操作は取り消すことができません。'
                  : 'この目標を差し戻します。従業員は修正して再提出する必要があります。'
                }
              </p>
            </div>
          </div>
        </div>
        <DialogFooter className={isMobile ? 'flex-col-reverse gap-2 pt-4' : 'gap-3 pt-4'}>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isProcessing}
            className={`focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all ${isMobile ? 'w-full h-12 text-base touch-manipulation' : ''}`}
            aria-label="操作をキャンセルしてダイアログを閉じます"
            tabIndex={0}
          >
            キャンセル
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isProcessing}
            className={`focus:ring-2 focus:ring-offset-2 transition-all ${
              isApproval
                ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                : 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
            } ${isMobile ? 'w-full h-12 text-base touch-manipulation' : ''}`}
            aria-label={`${isApproval ? '目標を承認' : '目標を差し戻し'}します。この操作は${isApproval ? '取り消すことができません' : '従業員に修正を求めます'}。`}
            tabIndex={0}
          >
            {isProcessing ? (
              <>
                <div
                  className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"
                  aria-hidden="true"
                />
                <span aria-live="polite">
                  {isApproval ? '承認中...' : '差し戻し中...'}
                </span>
              </>
            ) : (
              <>
                {isApproval ? (
                  <CheckCircle className="h-4 w-4 mr-2" aria-hidden="true" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" aria-hidden="true" />
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