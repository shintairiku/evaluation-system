'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Save, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useResponsiveBreakpoint } from '@/hooks/useResponsiveBreakpoint';
import type { AssignmentRow } from '../hooks/usePeerReviewAssignmentsData';
import type { UserDetailResponse, BulkAssignReviewersResponse } from '@/api/types';

type DialogState = 'confirm' | 'saving' | 'result';

interface BulkSaveConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dirtyRows: AssignmentRow[];
  users: UserDetailResponse[];
  onConfirm: () => Promise<BulkAssignReviewersResponse | null>;
  onComplete: () => void;
}

export function BulkSaveConfirmDialog({
  open,
  onOpenChange,
  dirtyRows,
  users,
  onConfirm,
  onComplete,
}: BulkSaveConfirmDialogProps) {
  const [state, setState] = useState<DialogState>('confirm');
  const [result, setResult] = useState<BulkAssignReviewersResponse | null>(null);
  const { isMobile } = useResponsiveBreakpoint();

  // Only rows with both reviewers assigned
  const validRows = useMemo(
    () => dirtyRows.filter(r => r.local.reviewer1Id && r.local.reviewer2Id),
    [dirtyRows],
  );

  const getUserName = (userId: string | null) => {
    if (!userId) return '未選択';
    return users.find(u => u.id === userId)?.name ?? '不明';
  };

  const handleConfirm = async () => {
    setState('saving');
    const response = await onConfirm();
    setResult(response);
    setState('result');
  };

  const handleClose = () => {
    if (state === 'saving') return;
    onOpenChange(false);
    if (state === 'result') {
      onComplete();
    }
    // Reset state after close animation
    setTimeout(() => {
      setState('confirm');
      setResult(null);
    }, 200);
  };

  const isAllSuccess = result && result.failureCount === 0;
  const totalCount = result ? result.successCount + result.failureCount : validRows.length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        showCloseButton={false}
        className={isMobile ? 'mx-4 max-w-sm' : 'max-w-lg'}
        onEscapeKeyDown={(e) => {
          if (state === 'saving') e.preventDefault();
        }}
      >
        {/* ===== State 1: Confirm ===== */}
        {state === 'confirm' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Save className="h-5 w-5 text-blue-600" />
                評価者の割当を保存しますか？
              </DialogTitle>
              <DialogDescription>
                保存内容を確認してください。
              </DialogDescription>
            </DialogHeader>

            <div className={`space-y-3 ${isMobile ? 'px-4 pb-3' : 'px-6 pb-4'}`}>
              <div className="p-3 rounded-md border-l-4 bg-muted/50 border-blue-500">
                <p className="text-sm font-medium text-foreground">
                  保存対象: {validRows.length}名の評価者割当
                </p>
              </div>

              <div className="max-h-[50vh] overflow-y-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">被評価者</th>
                      <th className="text-left px-3 py-2 font-medium">評価者1</th>
                      <th className="text-left px-3 py-2 font-medium">評価者2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validRows.map(row => (
                      <tr key={row.user.id} className="border-t">
                        <td className="px-3 py-2 font-medium">{row.user.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {getUserName(row.local.reviewer1Id)}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {getUserName(row.local.reviewer2Id)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <DialogFooter className={isMobile ? 'flex-col-reverse gap-2 pt-4' : 'gap-3 pt-4'}>
              <Button
                variant="outline"
                onClick={handleClose}
                className={isMobile ? 'w-full h-12 text-base' : ''}
              >
                キャンセル
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={validRows.length === 0}
                className={`bg-blue-600 hover:bg-blue-700 text-white ${isMobile ? 'w-full h-12 text-base' : ''}`}
              >
                <Save className="h-4 w-4 mr-2" />
                保存する
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ===== State 2: Saving ===== */}
        {state === 'saving' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                保存中...
              </DialogTitle>
              <DialogDescription>
                {validRows.length}名の評価者割当を保存しています。
              </DialogDescription>
            </DialogHeader>
            <div className={`flex items-center justify-center py-8 ${isMobile ? 'px-4' : 'px-6'}`}>
              <div className="text-center space-y-2">
                <Loader2 className="h-8 w-8 text-blue-600 animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground">しばらくお待ちください...</p>
              </div>
            </div>
            <DialogFooter className={isMobile ? 'flex-col-reverse gap-2 pt-4' : 'gap-3 pt-4'}>
              <Button variant="outline" disabled className={isMobile ? 'w-full h-12 text-base' : ''}>
                キャンセル
              </Button>
              <Button disabled className={`bg-blue-600 ${isMobile ? 'w-full h-12 text-base' : ''}`}>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                保存中...
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ===== State 3: Result ===== */}
        {state === 'result' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {isAllSuccess ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                )}
                {isAllSuccess ? '保存が完了しました' : '一部の保存に失敗しました'}
              </DialogTitle>
              <DialogDescription>
                {result
                  ? `${result.successCount}/${totalCount}名の割当が正常に保存されました`
                  : '保存処理でエラーが発生しました'}
              </DialogDescription>
            </DialogHeader>

            <div className={`space-y-3 ${isMobile ? 'px-4 pb-3' : 'px-6 pb-4'}`}>
              {isAllSuccess ? (
                <div className="p-3 rounded-md border-l-4 bg-green-50 border-green-500">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                    <p className="text-sm font-medium text-green-700">
                      {result!.successCount}/{totalCount}名の評価者割当が正常に保存されました
                    </p>
                  </div>
                </div>
              ) : result ? (
                <>
                  <div className="p-3 rounded-md border-l-4 bg-amber-50 border-amber-500">
                    <p className="text-sm font-medium text-amber-700">
                      {result.successCount}/{totalCount}名が保存されました
                    </p>
                  </div>
                  {result.results.some(r => !r.success) && (
                    <div className="max-h-[30vh] overflow-y-auto rounded-md border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted sticky top-0">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium">被評価者</th>
                            <th className="text-left px-3 py-2 font-medium">エラー</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.results
                            .filter(r => !r.success)
                            .map(r => (
                              <tr key={r.revieweeId} className="border-t">
                                <td className="px-3 py-2 font-medium">
                                  {getUserName(r.revieweeId)}
                                </td>
                                <td className="px-3 py-2 text-red-600">
                                  {r.error || '保存に失敗しました'}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-3 rounded-md border-l-4 bg-red-50 border-red-500">
                  <p className="text-sm font-medium text-red-700">
                    保存処理でエラーが発生しました。再度お試しください。
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className={isMobile ? 'flex-col-reverse gap-2 pt-4' : 'gap-3 pt-4'}>
              <Button
                onClick={handleClose}
                className={`bg-blue-600 hover:bg-blue-700 text-white ${isMobile ? 'w-full h-12 text-base' : ''}`}
              >
                閉じる
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
