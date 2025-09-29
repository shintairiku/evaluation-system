'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import PeriodCard from './PeriodCard';
import type { EvaluationPeriodListViewProps } from '../types';

export default function EvaluationPeriodListView({
  categorizedPeriods,
  onEditPeriod,
  onDeletePeriod,
  onViewGoalStats
}: EvaluationPeriodListViewProps) {
  const { all } = categorizedPeriods;

  // Categorize periods by status
  const activePeriods = all.filter(p => p.status === 'active');
  const draftPeriods = all.filter(p => p.status === 'draft');
  const completedPeriods = all.filter(p => p.status === 'completed');
  const cancelledPeriods = all.filter(p => p.status === 'cancelled');

  return (
    <div className="space-y-8">
      {/* Current/Active Periods */}
      {activePeriods.length > 0 && (
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-green-700 mb-2">
              現在 ({activePeriods.length})
            </h2>
            <Separator />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activePeriods.map(period => (
              <PeriodCard
                key={period.id}
                period={period}
                onEdit={onEditPeriod}
                onDelete={onDeletePeriod}
                onViewGoalStats={onViewGoalStats}
              />
            ))}
          </div>
        </section>
      )}

      {/* Draft/Upcoming Periods */}
      {draftPeriods.length > 0 && (
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-blue-700 mb-2">
              予定 ({draftPeriods.length})
            </h2>
            <Separator />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {draftPeriods.map(period => (
              <PeriodCard
                key={period.id}
                period={period}
                onEdit={onEditPeriod}
                onDelete={onDeletePeriod}
                onViewGoalStats={onViewGoalStats}
              />
            ))}
          </div>
        </section>
      )}

      {/* Completed Periods */}
      {completedPeriods.length > 0 && (
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-700 mb-2">
              完了 ({completedPeriods.length})
            </h2>
            <Separator />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {completedPeriods.map(period => (
              <PeriodCard
                key={period.id}
                period={period}
                onEdit={onEditPeriod}
                onDelete={onDeletePeriod}
                onViewGoalStats={onViewGoalStats}
              />
            ))}
          </div>
        </section>
      )}

      {/* Cancelled Periods */}
      {cancelledPeriods.length > 0 && (
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-red-700 mb-2">
              キャンセル ({cancelledPeriods.length})
            </h2>
            <Separator />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {cancelledPeriods.map(period => (
              <PeriodCard
                key={period.id}
                period={period}
                onEdit={onEditPeriod}
                onDelete={onDeletePeriod}
                onViewGoalStats={onViewGoalStats}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {all.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <div className="text-gray-500 space-y-2">
              <p className="text-lg">評価期間がありません</p>
              <p className="text-sm">「新規作成」ボタンから最初の評価期間を作成してください</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}