'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertTriangle,
  Clock,
  AlertCircle,
  Bell,
  Target,
  FileText,
  MessageSquare,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';

import type { DeadlineAlertsData, DeadlineAlert } from '@/api/types';

export interface DeadlineAlertsCardProps {
  data: DeadlineAlertsData;
  isLoading?: boolean;
  className?: string;
  onAlertClick?: (alert: DeadlineAlert) => void;
}

/**
 * DeadlineAlertsCard component for displaying deadline warnings
 *
 * Displays:
 * - Upcoming deadlines with urgency indicators
 * - Days remaining countdown
 * - Color-coded urgency levels (critical/warning/normal)
 * - Overdue deadline alerts
 */
export default function DeadlineAlertsCard({
  data,
  isLoading = false,
  className = '',
  onAlertClick
}: DeadlineAlertsCardProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            期限アラート
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="p-4 border rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div className="h-4 bg-muted animate-pulse rounded w-48" />
                  <div className="h-5 bg-muted animate-pulse rounded w-20" />
                </div>
                <div className="h-3 bg-muted animate-pulse rounded w-full mb-2" />
                <div className="h-3 bg-muted animate-pulse rounded w-32" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getUrgencyConfig = (urgency: DeadlineAlert['urgency'], isOverdue: boolean) => {
    if (isOverdue) {
      return {
        icon: <AlertTriangle className="w-5 h-5 text-red-600" />,
        borderColor: 'border-red-300 bg-red-50',
        badgeVariant: 'destructive' as const,
        badgeLabel: '期限超過',
        textColor: 'text-red-700'
      };
    }

    switch (urgency) {
      case 'critical':
        return {
          icon: <AlertTriangle className="w-5 h-5 text-red-500" />,
          borderColor: 'border-red-200 bg-red-50',
          badgeVariant: 'destructive' as const,
          badgeLabel: '至急',
          textColor: 'text-red-600'
        };
      case 'warning':
        return {
          icon: <AlertCircle className="w-5 h-5 text-yellow-500" />,
          borderColor: 'border-yellow-200 bg-yellow-50',
          badgeVariant: 'secondary' as const,
          badgeLabel: '注意',
          textColor: 'text-yellow-700'
        };
      case 'normal':
        return {
          icon: <Clock className="w-5 h-5 text-blue-500" />,
          borderColor: 'border-blue-200 bg-blue-50',
          badgeVariant: 'outline' as const,
          badgeLabel: '通常',
          textColor: 'text-blue-600'
        };
    }
  };

  const getTypeIcon = (type: DeadlineAlert['type']) => {
    switch (type) {
      case 'goal_submission':
        return <Target className="w-4 h-4" />;
      case 'evaluation_deadline':
        return <FileText className="w-4 h-4" />;
      case 'feedback_review':
        return <MessageSquare className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getDaysRemainingText = (alert: DeadlineAlert) => {
    if (alert.isOverdue) {
      return `${Math.abs(alert.daysRemaining)}日超過`;
    } else if (alert.daysRemaining === 0) {
      return '本日';
    } else if (alert.daysRemaining === 1) {
      return '明日';
    } else {
      return `${alert.daysRemaining}日後`;
    }
  };

  // Sort alerts: overdue first, then by urgency, then by days remaining
  const sortedAlerts = [...data.alerts].sort((a, b) => {
    // First sort by overdue
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;

    // Then by urgency
    const urgencyOrder = { critical: 0, warning: 1, normal: 2 };
    const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    if (urgencyDiff !== 0) return urgencyDiff;

    // Then by days remaining
    return a.daysRemaining - b.daysRemaining;
  });

  // Empty state
  if (data.totalAlerts === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            期限アラート
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              期限は十分です
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              現在、注意が必要な期限はありません
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            期限アラート
          </div>
          <div className="flex items-center gap-2">
            {data.overdueCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                超過: {data.overdueCount}件
              </Badge>
            )}
            {data.criticalCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                至急: {data.criticalCount}件
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sortedAlerts.slice(0, 5).map((alert) => {
            const config = getUrgencyConfig(alert.urgency, alert.isOverdue);

            return (
              <div
                key={alert.id}
                className={`p-4 border rounded-lg transition-colors ${config.borderColor}`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{config.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{alert.title}</span>
                      <Badge variant={config.badgeVariant} className="text-xs">
                        {config.badgeLabel}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{alert.description}</p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs">
                        <div className="flex items-center gap-1">
                          {getTypeIcon(alert.type)}
                          <Clock className="w-3 h-3" />
                        </div>
                        <span className={config.textColor}>
                          期限: {new Date(alert.deadline).toLocaleDateString('ja-JP')}
                        </span>
                        <span className={`font-semibold ${config.textColor}`}>
                          ({getDaysRemainingText(alert)})
                        </span>
                      </div>

                      {alert.actionUrl && (
                        <Link href={alert.actionUrl}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => onAlertClick?.(alert)}
                          >
                            確認
                            <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Show more message if there are additional alerts */}
          {data.totalAlerts > 5 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                他に{data.totalAlerts - 5}件のアラートがあります
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>

      {/* Last Updated */}
      {data.lastUpdated && (
        <CardFooter className="text-xs text-muted-foreground text-center border-t pt-3">
          最終更新: {new Date(data.lastUpdated).toLocaleString('ja-JP')}
        </CardFooter>
      )}
    </Card>
  );
}

/**
 * Skeleton component for loading state
 */
export function DeadlineAlertsCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="w-5 h-5 bg-muted animate-pulse rounded" />
          <div className="h-5 bg-muted animate-pulse rounded w-32" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-4 border rounded-lg">
              <div className="flex items-start justify-between mb-2">
                <div className="h-4 bg-muted animate-pulse rounded w-48" />
                <div className="h-5 bg-muted animate-pulse rounded w-20" />
              </div>
              <div className="h-3 bg-muted animate-pulse rounded w-full mb-2" />
              <div className="h-3 bg-muted animate-pulse rounded w-32" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}