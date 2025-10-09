'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Circle, AlertCircle, Target } from 'lucide-react';

import type { PersonalProgressData } from '@/api/types';

export interface PersonalProgressCardProps {
  data?: PersonalProgressData;
  isLoading?: boolean;
  className?: string;
}

/**
 * PersonalProgressCard component for displaying individual evaluation progress
 *
 * Displays:
 * - Step-by-step progress through evaluation stages
 * - Goal setting status with approval counts
 * - Self-assessment completion status
 * - Feedback reception status
 * - Overall completion percentage
 */
export default function PersonalProgressCard({
  data,
  isLoading = false,
  className = ''
}: PersonalProgressCardProps) {
  // Handle undefined or null data
  if (!data || isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            評価進捗状況
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-muted animate-pulse rounded-full" />
                  <div className="flex-1">
                    <div className="h-4 bg-muted animate-pulse rounded w-32 mb-2" />
                    <div className="h-3 bg-muted animate-pulse rounded w-48" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStageIcon = (stage: 'goals' | 'assessment' | 'feedback') => {
    const isGoalsComplete = data.hasSetGoals && data.goalsApproved > 0;
    const isAssessmentComplete = data.hasCompletedSelfAssessment;
    const isFeedbackComplete = data.hasReceivedFeedback;

    let isComplete = false;
    let isActive = false;

    switch (stage) {
      case 'goals':
        isComplete = isGoalsComplete;
        isActive = data.currentStage === 'goals_setting' || (!isComplete && data.currentStage !== 'not_started');
        break;
      case 'assessment':
        isComplete = isAssessmentComplete;
        isActive = data.currentStage === 'self_assessment';
        break;
      case 'feedback':
        isComplete = isFeedbackComplete;
        isActive = data.currentStage === 'feedback';
        break;
    }

    if (isComplete) {
      return <CheckCircle2 className="w-6 h-6 text-green-500" />;
    } else if (isActive) {
      return <AlertCircle className="w-6 h-6 text-yellow-500 animate-pulse" />;
    } else {
      return <Circle className="w-6 h-6 text-gray-300" />;
    }
  };

  const getStageStatus = (stage: 'goals' | 'assessment' | 'feedback') => {
    switch (stage) {
      case 'goals':
        if (data.hasSetGoals && data.goalsApproved > 0) {
          return { label: '完了', variant: 'default' as const, bgColor: 'bg-green-500' };
        } else if (data.hasSetGoals) {
          return { label: '承認待ち', variant: 'secondary' as const, bgColor: 'bg-yellow-500' };
        } else {
          return { label: '未設定', variant: 'outline' as const, bgColor: 'bg-gray-300' };
        }
      case 'assessment':
        if (data.hasCompletedSelfAssessment) {
          return { label: '完了', variant: 'default' as const, bgColor: 'bg-green-500' };
        } else if (data.selfAssessmentsCount > 0) {
          return { label: '入力中', variant: 'secondary' as const, bgColor: 'bg-yellow-500' };
        } else {
          return { label: '未入力', variant: 'outline' as const, bgColor: 'bg-gray-300' };
        }
      case 'feedback':
        if (data.hasReceivedFeedback) {
          return { label: '完了', variant: 'default' as const, bgColor: 'bg-green-500' };
        } else {
          return { label: '未受領', variant: 'outline' as const, bgColor: 'bg-gray-300' };
        }
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            評価進捗状況
          </div>
          {data?.periodName && (
            <Badge variant="secondary" className="text-xs">
              {data.periodName}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Overall Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">全体進捗</span>
              <span className="text-muted-foreground font-semibold">
                {data.overallCompletionPercentage}%
              </span>
            </div>
            <Progress
              value={data.overallCompletionPercentage}
              className="h-2 [&>[data-slot=progress-indicator]]:bg-primary"
            />
          </div>

          <div className="border-t pt-4" />

          {/* Step 1: Goal Setting */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              {getStageIcon('goals')}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">目標設定</span>
                  <Badge variant={getStageStatus('goals').variant} className="text-xs">
                    {getStageStatus('goals').label}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  設定済み: {data.goalsCount}件
                  {data.goalsApproved > 0 && ` (承認: ${data.goalsApproved}件)`}
                  {data.goalsPending > 0 && ` (承認待ち: ${data.goalsPending}件)`}
                  {data.goalsRejected > 0 && ` (却下: ${data.goalsRejected}件)`}
                </div>
              </div>
            </div>
          </div>

          {/* Step 2: Self Assessment */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              {getStageIcon('assessment')}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">自己評価</span>
                  <Badge variant={getStageStatus('assessment').variant} className="text-xs">
                    {getStageStatus('assessment').label}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  完了: {data.selfAssessmentsCompleted}/{data.goalsCount}件
                  {data.selfAssessmentsPending > 0 && ` (未完了: ${data.selfAssessmentsPending}件)`}
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: Feedback Reception */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              {getStageIcon('feedback')}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">フィードバック受領</span>
                  <Badge variant={getStageStatus('feedback').variant} className="text-xs">
                    {getStageStatus('feedback').label}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  受領済み: {data.feedbacksReceived}件
                  {data.feedbacksPending > 0 && ` (未受領: ${data.feedbacksPending}件)`}
                </div>
              </div>
            </div>
          </div>

          {/* Last Updated */}
          {data.lastUpdated && (
            <div className="text-xs text-muted-foreground text-center pt-2 border-t">
              最終更新: {new Date(data.lastUpdated).toLocaleString('ja-JP')}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton component for loading state
 */
export function PersonalProgressCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="w-5 h-5 bg-muted animate-pulse rounded" />
          <div className="h-5 bg-muted animate-pulse rounded w-32" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Progress bar skeleton */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="h-4 bg-muted animate-pulse rounded w-24" />
              <div className="h-4 bg-muted animate-pulse rounded w-12" />
            </div>
            <div className="h-2 bg-muted animate-pulse rounded w-full" />
          </div>

          <div className="border-t pt-4" />

          {/* Steps skeleton */}
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-muted animate-pulse rounded-full" />
                <div className="flex-1">
                  <div className="h-4 bg-muted animate-pulse rounded w-32 mb-2" />
                  <div className="h-3 bg-muted animate-pulse rounded w-48" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}