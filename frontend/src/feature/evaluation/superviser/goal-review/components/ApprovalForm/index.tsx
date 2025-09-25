'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { CheckCircle, XCircle, MessageSquare } from 'lucide-react';
import type { GoalResponse } from '@/api/types';

// Validation schema
const approvalFormSchema = z.object({
  comment: z.string()
    .max(500, '500文字以内で入力してください')
    .optional()
});

type ApprovalFormData = z.infer<typeof approvalFormSchema>;

interface ApprovalFormProps {
  goal: GoalResponse;
  onApprove: (goalId: string, comment?: string) => Promise<void>;
  onReject: (goalId: string, comment: string) => Promise<void>;
  isProcessing?: boolean;
}

export function ApprovalForm({ goal, onApprove, onReject, isProcessing = false }: ApprovalFormProps) {
  const [pendingAction, setPendingAction] = useState<'approve' | 'reject' | null>(null);

  const form = useForm<ApprovalFormData>({
    resolver: zodResolver(approvalFormSchema),
    defaultValues: {
      comment: ''
    }
  });

  const comment = form.watch('comment') || '';
  const commentLength = comment.length;

  const handleApprove = async () => {
    const isValid = await form.trigger();
    if (!isValid) return;

    setPendingAction('approve');
    try {
      const formData = form.getValues();
      await onApprove(goal.id, formData.comment);
      form.reset();
    } catch (error) {
      console.error('Approval error:', error);
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
      return;
    }

    const isValid = await form.trigger();
    if (!isValid) return;

    setPendingAction('reject');
    try {
      await onReject(goal.id, rejectionComment);
      form.reset();
    } catch (error) {
      console.error('Rejection error:', error);
    } finally {
      setPendingAction(null);
    }
  };

  const isDisabled = isProcessing || pendingAction !== null;
  const isApproving = pendingAction === 'approve';
  const isRejecting = pendingAction === 'reject';

  return (
    <Card className="mt-4 border-t-0 rounded-t-none">
      <CardContent className="pt-4">
        <Form {...form}>
          <form className="space-y-4">
            <FormField
              control={form.control}
              name="comment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    コメント
                    <span className="text-sm text-muted-foreground font-normal">
                      (差し戻し時は必須)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="目標に対するフィードバックやコメントを入力してください..."
                      className="min-h-[100px] resize-none"
                      disabled={isDisabled}
                    />
                  </FormControl>
                  <div className="flex justify-between items-start">
                    <FormMessage />
                    <div className={`text-xs ${commentLength > 450 ? 'text-red-500' : 'text-muted-foreground'}`}>
                      {commentLength}/500
                    </div>
                  </div>
                </FormItem>
              )}
            />
          </form>
        </Form>
      </CardContent>

      <CardFooter className="bg-gray-50 gap-3 justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleReject}
          disabled={isDisabled}
          className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
        >
          {isRejecting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600 mr-2" />
              差し戻し中...
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4 mr-2" />
              差し戻し
            </>
          )}
        </Button>

        <Button
          type="button"
          size="sm"
          onClick={handleApprove}
          disabled={isDisabled}
          className="bg-green-600 hover:bg-green-700"
        >
          {isApproving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              承認中...
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              承認
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}