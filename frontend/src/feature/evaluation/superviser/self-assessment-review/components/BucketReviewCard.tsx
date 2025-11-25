'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import type { BucketDecision } from '@/api/types';
import { SELF_ASSESSMENT_RATING_OPTIONS, SUPERVISOR_REVIEW_UI } from '@/feature/evaluation/employee/self-assessment/constants';

interface BucketReviewCardProps {
  bucket: BucketDecision;
  bucketLabel: string;
  onUpdate: (updatedBucket: BucketDecision) => void;
  readonly?: boolean;
  onAutoSave?: (updatedBucket: BucketDecision) => Promise<boolean>;
}

export function BucketReviewCard({
  bucket,
  bucketLabel,
  onUpdate,
  readonly = false,
  onAutoSave
}: BucketReviewCardProps) {
  const [localBucket, setLocalBucket] = useState<BucketDecision>(bucket);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const savedIndicatorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setLocalBucket(bucket);
  }, [bucket]);

  // Auto-save with debounce
  const triggerAutoSave = useCallback(async (updatedBucket: BucketDecision) => {
    if (!onAutoSave) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Clear saved indicator timeout
    if (savedIndicatorTimeoutRef.current) {
      clearTimeout(savedIndicatorTimeoutRef.current);
    }

    setSaveStatus('saving');

    // Debounce auto-save
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const success = await onAutoSave(updatedBucket);
        if (success) {
          setSaveStatus('saved');
          // Hide saved indicator
          savedIndicatorTimeoutRef.current = setTimeout(() => {
            setSaveStatus('idle');
          }, SUPERVISOR_REVIEW_UI.SAVE_INDICATOR_DURATION_MS);
        } else {
          setSaveStatus('error');
        }
      } catch (error) {
        console.error('Auto-save failed:', error);
        setSaveStatus('error');
      }
    }, SUPERVISOR_REVIEW_UI.AUTO_SAVE_DEBOUNCE_MS);
  }, [onAutoSave]);

  const handleSupervisorRatingChange = (rating: string | undefined) => {
    const updated = { ...localBucket, supervisorRating: rating || null };
    setLocalBucket(updated);
    onUpdate(updated);
    triggerAutoSave(updated);
  };

  const handleCommentChange = (comment: string) => {
    const updated = { ...localBucket, comment: comment || null };
    setLocalBucket(updated);
    onUpdate(updated);
    // Trigger auto-save with debounce
    triggerAutoSave(updated);
  };

  const handleCommentBlur = () => {
    // Force immediate save on blur by canceling debounce and saving
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    if (onAutoSave && localBucket) {
      setSaveStatus('saving');
      onAutoSave(localBucket).then(success => {
        if (success) {
          setSaveStatus('saved');
          savedIndicatorTimeoutRef.current = setTimeout(() => {
            setSaveStatus('idle');
          }, SUPERVISOR_REVIEW_UI.SAVE_INDICATOR_DURATION_MS);
        } else {
          setSaveStatus('error');
        }
      }).catch(() => {
        setSaveStatus('error');
      });
    }
  };

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (savedIndicatorTimeoutRef.current) {
        clearTimeout(savedIndicatorTimeoutRef.current);
      }
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{bucketLabel}</CardTitle>
          <Badge variant="outline">
            {localBucket.status === 'approved'
              ? '承認済み'
              : localBucket.status === 'rejected'
                ? '却下'
                : '保留中'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Employee Assessment Info */}
        <div className="bg-gray-50 p-4 rounded-lg space-y-2">
          <h4 className="font-semibold text-sm text-gray-700">従業員の自己評価</h4>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">評価:</span>
              <span className="ml-2 font-semibold">{bucket.employeeRating}</span>
            </div>
            <div>
              <span className="text-gray-600">ウェイト:</span>
              <span className="ml-2 font-semibold">{bucket.employeeWeight.toFixed(2)}%</span>
            </div>
            <div>
              <span className="text-gray-600">貢献度:</span>
              <span className="ml-2 font-semibold">{bucket.employeeContribution.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Supervisor Review */}
        {!readonly && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={`supervisor-rating-${bucket.bucket}`}>
                  上司評価 <span className="text-gray-500 text-xs">(任意)</span>
                </Label>
                {/* Auto-save status indicator */}
                {saveStatus === 'saving' && (
                  <span className="text-xs text-blue-500 flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
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
              </div>
              <Select
                value={localBucket.supervisorRating || 'none'}
                onValueChange={(value) =>
                  handleSupervisorRatingChange(value === 'none' ? undefined : value)
                }
              >
                <SelectTrigger id={`supervisor-rating-${bucket.bucket}`}>
                  <SelectValue placeholder="評価を選択（任意）" />
                </SelectTrigger>
                <SelectContent
                  side="bottom"
                  align="start"
                  sideOffset={4}
                  position="popper"
                  avoidCollisions={false}
                >
                  <SelectItem value="none">評価なし</SelectItem>
                  {SELF_ASSESSMENT_RATING_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                ※ 評価を変更しない場合は「評価なし」を選択してください
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`comment-${bucket.bucket}`}>コメント</Label>
              <Textarea
                id={`comment-${bucket.bucket}`}
                value={localBucket.comment || ''}
                onChange={(e) => handleCommentChange(e.target.value)}
                onBlur={handleCommentBlur}
                placeholder="フィードバックを入力してください..."
                rows={4}
                className="resize-none"
              />
            </div>
          </>
        )}

        {/* Readonly View */}
        {readonly && (
          <div className="space-y-3">
            {localBucket.supervisorRating && (
              <div>
                <span className="text-sm text-gray-600">上司評価:</span>
                <span className="ml-2 font-semibold">{localBucket.supervisorRating}</span>
              </div>
            )}
            {localBucket.comment && (
              <div>
                <span className="text-sm text-gray-600 block mb-1">コメント:</span>
                <p className="text-sm bg-gray-50 p-3 rounded">{localBucket.comment}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
