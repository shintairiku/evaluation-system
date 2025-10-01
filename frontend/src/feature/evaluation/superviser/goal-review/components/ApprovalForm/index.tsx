'use client';

import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { CheckCircle, XCircle, MessageSquare } from 'lucide-react';
import type { GoalResponse } from '@/api/types';
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation';
import { useResponsiveBreakpoint } from '@/hooks/useResponsiveBreakpoint';
import { createAriaLabel, createAriaValidation, generateAccessibilityId, announceToScreenReader } from '@/utils/accessibility';

// Validation schema
const approvalFormSchema = z.object({
  comment: z.string()
    .min(1, 'コメントの入力が必要です')
    .max(500, '500文字以内で入力してください')
    .trim()
});

type ApprovalFormData = z.infer<typeof approvalFormSchema>;

interface ApprovalFormProps {
  goal: GoalResponse;
  onApprove: (comment: string) => Promise<void>;
  onReject: (comment: string) => Promise<void>;
  isProcessing?: boolean;
  onCommentChange?: (comment: string) => void;
  onCommentBlur?: (comment: string) => void;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
}

export interface ApprovalFormRef {
  resetForm: () => void;
  setComment: (comment: string) => void;
  getComment: () => string;
}

export const ApprovalForm = forwardRef<ApprovalFormRef, ApprovalFormProps>(
  function ApprovalForm({ 
    goal, 
    onApprove, 
    onReject, 
    isProcessing = false,
    onCommentChange,
    onCommentBlur,
    saveStatus = 'idle'
  }, ref) {
    const [pendingAction, setPendingAction] = useState<'approve' | 'reject' | null>(null);

    // Accessibility and responsive hooks
    const { containerRef, focusNext, focusPrevious } = useKeyboardNavigation({
      enableArrowKeys: true,
      enableTabNavigation: true,
      enableEscapeKey: true,
      onNavigate: (direction) => {
        if (direction === 'down' || direction === 'right') focusNext();
        if (direction === 'up' || direction === 'left') focusPrevious();
      },
      onEnter: () => {
        // Allow default enter behavior in textarea, but handle in buttons
        const activeElement = document.activeElement as HTMLElement;
        if (activeElement?.tagName === 'BUTTON') {
          activeElement.click();
        }
      }
    });
    const { isMobile } = useResponsiveBreakpoint();

    // Generate unique IDs for accessibility
    const formId = React.useMemo(() => generateAccessibilityId('approval-form'), []);
    const commentFieldId = React.useMemo(() => generateAccessibilityId('comment-field'), []);
    const errorId = React.useMemo(() => generateAccessibilityId('comment-error'), []);
    const charCountId = React.useMemo(() => generateAccessibilityId('char-count'), []);

    const form = useForm<ApprovalFormData>({
      resolver: zodResolver(approvalFormSchema),
      defaultValues: {
        comment: ''
      },
      mode: 'onChange'
    });

    useImperativeHandle(ref, () => ({
      resetForm: () => {
        form.reset();
      },
      setComment: (comment: string) => {
        form.setValue('comment', comment);
      },
      getComment: () => {
        return form.getValues('comment') || '';
      }
    }));

  const comment = form.watch('comment') || '';
  const commentLength = comment.length;

  // Auto-save on comment change (debounced in parent)
  React.useEffect(() => {
    if (onCommentChange && comment) {
      onCommentChange(comment);
    }
  }, [comment, onCommentChange]);

  const handleApprove = async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      announceToScreenReader('フォームにエラーがあります。修正してください。', 'assertive');
      return;
    }

    const formData = form.getValues();
    const approvalComment = formData.comment?.trim();

    if (!approvalComment) {
      form.setError('comment', {
        type: 'manual',
        message: '承認時はコメントの入力が必要です'
      });
      announceToScreenReader('承認時はコメントの入力が必要です', 'assertive');
      return;
    }

    setPendingAction('approve');
    announceToScreenReader('目標を承認しています...', 'polite');
    try {
      await onApprove(approvalComment);
      announceToScreenReader('目標が正常に承認されました', 'polite');
    } catch (error) {
      console.error('Approval error:', error);
      announceToScreenReader('承認処理でエラーが発生しました', 'assertive');
    } finally {
      setPendingAction(null);
    }
  };

  const handleReject = async () => {
    const formData = form.getValues();
    const rejectionComment = formData.comment?.trim();

    // Validation for rejection - comment is required
    if (!rejectionComment) {
      form.setError('comment', {
        type: 'manual',
        message: '差し戻し時はコメントの入力が必要です'
      });
      announceToScreenReader('差し戻し時はコメントの入力が必要です', 'assertive');
      return;
    }

    const isValid = await form.trigger();
    if (!isValid) {
      announceToScreenReader('フォームにエラーがあります。修正してください。', 'assertive');
      return;
    }

    setPendingAction('reject');
    announceToScreenReader('目標を差し戻ししています...', 'polite');
    try {
      await onReject(rejectionComment);
      announceToScreenReader('目標が正常に差し戻しされました', 'polite');
    } catch (error) {
      console.error('Rejection error:', error);
      announceToScreenReader('差し戻し処理でエラーが発生しました', 'assertive');
    } finally {
      setPendingAction(null);
    }
  };

  const isDisabled = isProcessing || pendingAction !== null;
  const isApproving = pendingAction === 'approve';
  const isRejecting = pendingAction === 'reject';

  return (
    <div
      ref={containerRef as React.Ref<HTMLDivElement>}
      className="space-y-4"
      role="form"
      aria-labelledby={`${formId}-title`}
      aria-describedby={`${formId}-description`}
    >
      <div id={`${formId}-title`} className="sr-only">
        目標承認フォーム
      </div>
      <div id={`${formId}-description`} className="sr-only">
        コメントを入力して目標を承認または差し戻しできます
      </div>
      <Form {...form}>
        <form className="space-y-4" noValidate>
          <FormField
            control={form.control}
            name="comment"
            render={({ field }) => (
              <FormItem>
                <FormLabel
                  className="flex items-center gap-2 justify-between w-full"
                  htmlFor={commentFieldId}
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" aria-hidden="true" />
                    コメント
                    <span className="text-sm text-red-500 font-normal" aria-label="必須項目">
                      (必須)
                    </span>
                  </div>
                  
                  {/* Auto-save status indicator */}
                  {saveStatus === 'saving' && (
                    <span className="text-xs text-blue-500 flex items-center gap-1 animate-pulse">
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500" aria-hidden="true" />
                      保存中...
                    </span>
                  )}
                  {saveStatus === 'saved' && (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      <span aria-hidden="true">✓</span> 一時保存済み
                    </span>
                  )}
                  {saveStatus === 'error' && (
                    <span className="text-xs text-red-500 flex items-center gap-1">
                      <span aria-hidden="true">⚠</span> 保存失敗
                    </span>
                  )}
                </FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    id={commentFieldId}
                    placeholder="目標に対するフィードバックやコメントを入力してください..."
                    className={`min-h-[100px] resize-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all ${isMobile ? 'min-h-[80px] text-base' : 'min-h-[100px]'}`}
                    disabled={isDisabled}
                    {...createAriaValidation(
                      !!form.formState.errors.comment,
                      form.formState.errors.comment ? errorId : undefined,
                      true
                    )}
                    aria-describedby={`${charCountId} ${form.formState.errors.comment ? errorId : ''}`}
                    maxLength={500}
                    style={{ minHeight: isMobile ? '80px' : '100px', fontSize: isMobile ? '16px' : 'inherit' }}
                    onBlur={(e) => {
                      field.onBlur(e);
                      // Auto-save on blur
                      if (onCommentBlur && e.target.value) {
                        onCommentBlur(e.target.value);
                      }
                    }}
                  />
                </FormControl>
                <div className="flex justify-between items-start">
                  <div id={errorId} role="alert" aria-live="polite">
                    <FormMessage />
                  </div>
                  <div
                    id={charCountId}
                    className={`text-xs ${commentLength > 450 ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}
                    aria-label={`文字数: ${commentLength}文字 / 500文字まで`}
                    aria-live="polite"
                  >
                    {commentLength}/500
                  </div>
                </div>
              </FormItem>
            )}
          />
        </form>
      </Form>

      <div
        className={`flex gap-3 justify-end pt-2 ${isMobile ? 'flex-col-reverse gap-2' : 'flex-row gap-3'}`}
        role="group"
        aria-label="目標承認操作ボタン"
      >
        <Button
          type="button"
          variant="outline"
          size={isMobile ? "default" : "sm"}
          onClick={handleReject}
          disabled={isDisabled}
          className={`text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all ${isMobile ? 'h-12 text-base touch-manipulation' : ''}`}
          {...createAriaLabel(
            '目標を差し戻し',
            isRejecting
              ? '差し戻し処理を実行中です'
              : 'コメントと共に目標を差し戻しします'
          )}
        >
          {isRejecting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600 mr-2" aria-hidden="true" />
              <span aria-live="polite">差し戻し中...</span>
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4 mr-2" aria-hidden="true" />
              差し戻し
            </>
          )}
        </Button>

        <Button
          type="button"
          size={isMobile ? "default" : "sm"}
          onClick={handleApprove}
          disabled={isDisabled}
          className={`bg-green-600 hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all ${isMobile ? 'h-12 text-base touch-manipulation' : ''}`}
          {...createAriaLabel(
            '目標を承認',
            isApproving
              ? '承認処理を実行中です'
              : 'コメントと共に目標を承認します'
          )}
        >
          {isApproving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" aria-hidden="true" />
              <span aria-live="polite">承認中...</span>
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" aria-hidden="true" />
              承認
            </>
          )}
        </Button>
      </div>
    </div>
  );
});