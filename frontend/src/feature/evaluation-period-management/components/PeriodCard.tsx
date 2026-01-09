'use client';

import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Edit, Trash2, BarChart3, Clock, Calendar, Target, ClipboardCheck } from 'lucide-react';
import { PERIOD_TYPE_LABELS } from '@/api/types/evaluation-period';
import {
  getStatusLabel,
  getStatusColor,
  formatDateRangeForDisplay,
  formatDateForDisplay,
  getDaysRemaining
} from '@/lib/evaluation-period-utils';
import type { PeriodCardProps } from '../types';

export default function PeriodCard({
  period,
  onEdit,
  onDelete,
  onViewGoalStats
}: PeriodCardProps) {
  const statusLabel = getStatusLabel(period.status);
  const statusColor = getStatusColor(period.status);
  const daysRemaining = period.status === 'active' ? getDaysRemaining(period.end_date) : null;
  const periodTypeLabel = PERIOD_TYPE_LABELS[period.period_type] || period.period_type;
  const canDelete = period.status === 'draft';

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="font-semibold text-gray-900 line-clamp-2">
              {period.name}
            </h3>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {periodTypeLabel}
              </Badge>
              <Badge className={`text-xs ${statusColor}`}>
                {statusLabel}
              </Badge>
            </div>
          </div>
        </div>

        {/* Days remaining for active periods */}
        {daysRemaining !== null && (
          <div className="flex items-center gap-1 text-sm text-gray-600">
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
      </CardHeader>

      <CardContent className="pt-0 space-y-4">
        {/* Date Information */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <Calendar size={14} />
            <span>期間:</span>
          </div>
          <div className="text-gray-900 text-xs pl-5">
            {formatDateRangeForDisplay(period.start_date, period.end_date)}
          </div>

          <div className="flex items-center gap-2 text-gray-600">
            <Target size={14} />
            <span>目標提出期限:</span>
          </div>
          <div className="text-gray-900 text-xs pl-5">
            {formatDateForDisplay(period.goal_submission_deadline)}
          </div>

          <div className="flex items-center gap-2 text-gray-600">
            <ClipboardCheck size={14} />
            <span>評価期限:</span>
          </div>
          <div className="text-gray-900 text-xs pl-5">
            {formatDateForDisplay(period.evaluation_deadline)}
          </div>
        </div>

        <Separator />

        {/* Action Buttons */}
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewGoalStats(period)}
            className="w-full justify-start"
          >
            <BarChart3 size={16} className="mr-2" />
            目標統計を表示
          </Button>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(period)}
              className="flex-1"
            >
              <Edit size={14} className="mr-1" />
              編集
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(period)}
              disabled={!canDelete}
              title={!canDelete ? '削除できるのは「下書き」の評価期間のみです' : undefined}
              className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 disabled:text-gray-400 disabled:hover:bg-transparent"
            >
              <Trash2 size={14} className="mr-1" />
              削除
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
