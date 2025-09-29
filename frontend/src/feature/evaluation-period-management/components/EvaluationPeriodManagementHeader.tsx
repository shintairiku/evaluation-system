'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Calendar, List, Plus } from 'lucide-react';
import type { EvaluationPeriodManagementHeaderProps } from '../types';

export default function EvaluationPeriodManagementHeader({
  view,
  onViewChange,
  onCreatePeriod
}: EvaluationPeriodManagementHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">評価期間設定</h1>
        <p className="text-sm text-gray-500 mt-1">
          評価期間の作成、編集、削除を行います
        </p>
      </div>

      <div className="flex items-center gap-3">
        {/* View Toggle */}
        <Card className="p-1">
          <div className="flex items-center">
            <Button
              variant={view === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewChange('list')}
              className="flex items-center gap-2"
            >
              <List size={16} />
              リスト表示
            </Button>
            <Button
              variant={view === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewChange('calendar')}
              className="flex items-center gap-2"
            >
              <Calendar size={16} />
              カレンダー表示
            </Button>
          </div>
        </Card>

        {/* Create Button */}
        <Button onClick={onCreatePeriod} className="flex items-center gap-2">
          <Plus size={16} />
          新規作成
        </Button>
      </div>
    </div>
  );
}