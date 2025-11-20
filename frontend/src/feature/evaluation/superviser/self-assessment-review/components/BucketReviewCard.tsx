'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import type { BucketDecision } from '@/api/types';

interface BucketReviewCardProps {
  bucket: BucketDecision;
  bucketLabel: string;
  onUpdate: (updatedBucket: BucketDecision) => void;
  readonly?: boolean;
}

const RATING_OPTIONS = [
  { value: 'S', label: 'S - 優秀 (Excellent)' },
  { value: 'A', label: 'A - 良好 (Good)' },
  { value: 'B', label: 'B - 普通 (Average)' },
  { value: 'C', label: 'C - 要改善 (Needs Improvement)' },
  { value: 'D', label: 'D - 不十分 (Insufficient)' },
];

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const STATUS_LABELS = {
  pending: '保留中',
  approved: '承認済み',
  rejected: '却下',
};

export function BucketReviewCard({
  bucket,
  bucketLabel,
  onUpdate,
  readonly = false
}: BucketReviewCardProps) {
  const [localBucket, setLocalBucket] = useState<BucketDecision>(bucket);

  const handleStatusChange = (status: 'pending' | 'approved' | 'rejected') => {
    const updated = { ...localBucket, status };
    setLocalBucket(updated);
    onUpdate(updated);
  };

  const handleSupervisorRatingChange = (rating: string | undefined) => {
    const updated = { ...localBucket, supervisorRating: rating || null };
    setLocalBucket(updated);
    onUpdate(updated);
  };

  const handleCommentChange = (comment: string) => {
    const updated = { ...localBucket, comment: comment || null };
    setLocalBucket(updated);
    onUpdate(updated);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{bucketLabel}</CardTitle>
          <Badge className={STATUS_COLORS[localBucket.status as keyof typeof STATUS_COLORS]}>
            {STATUS_LABELS[localBucket.status as keyof typeof STATUS_LABELS]}
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
              <Label htmlFor={`status-${bucket.bucket}`}>承認ステータス</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={localBucket.status === 'rejected' ? 'destructive' : 'outline'}
                  onClick={() => handleStatusChange('rejected')}
                  className="w-full"
                >
                  差し戻し
                </Button>
                <Button
                  type="button"
                  variant={localBucket.status === 'approved' ? 'default' : 'outline'}
                  onClick={() => handleStatusChange('approved')}
                  className="w-full"
                >
                  承認
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`supervisor-rating-${bucket.bucket}`}>
                上司評価 <span className="text-gray-500 text-xs">(任意)</span>
              </Label>
              <Select
                value={localBucket.supervisorRating || 'none'}
                onValueChange={(value) =>
                  handleSupervisorRatingChange(value === 'none' ? undefined : value)
                }
              >
                <SelectTrigger id={`supervisor-rating-${bucket.bucket}`}>
                  <SelectValue placeholder="評価を選択（任意）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">評価なし</SelectItem>
                  {RATING_OPTIONS.map((option) => (
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
