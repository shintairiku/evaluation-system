'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  Clock,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';

import type { SystemAlert, SystemAlertsData } from '@/api/types';

export interface SystemAlertsCardProps {
  data: SystemAlertsData;
  isLoading?: boolean;
  className?: string;
  onAlertClick?: (alert: SystemAlert) => void;
  onDismissAlert?: (alertId: string) => void;
}

/**
 * SystemAlertsCard component for displaying system alerts and notifications
 *
 * Displays:
 * - Critical system alerts requiring immediate attention
 * - Warning alerts for potential issues
 * - Informational notifications
 * - Success confirmations
 */
export default function SystemAlertsCard({
  data,
  isLoading = false,
  className = '',
  onAlertClick,
  onDismissAlert
}: SystemAlertsCardProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-primary" />
            システムアラート
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="p-3 border rounded-lg">
                <div className="flex items-start gap-2">
                  <div className="w-4 h-4 bg-muted animate-pulse rounded mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                    <div className="h-3 bg-muted animate-pulse rounded w-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getAlertIcon = (type: SystemAlert['type']) => {
    switch (type) {
      case 'critical':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'info':
        return <Info className="w-4 h-4 text-blue-500" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      default:
        return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  const getAlertBgColor = (type: SystemAlert['type']) => {
    switch (type) {
      case 'critical':
        return 'border-red-200 bg-red-50';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50';
      case 'info':
        return 'border-blue-200 bg-blue-50';
      case 'success':
        return 'border-green-200 bg-green-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const getTypeLabel = (type: SystemAlert['type']) => {
    switch (type) {
      case 'critical':
        return '緊急';
      case 'warning':
        return '警告';
      case 'info':
        return '情報';
      case 'success':
        return '完了';
      default:
        return '通知';
    }
  };

  const handleAlertClick = (alert: SystemAlert) => {
    if (onAlertClick) {
      onAlertClick(alert);
    }
  };

  const handleDismissAlert = (alertId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDismissAlert) {
      onDismissAlert(alertId);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) {
      return '1時間未満前';
    } else if (diffInHours < 24) {
      return `${diffInHours}時間前`;
    } else {
      return date.toLocaleDateString('ja-JP', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  const visibleAlerts = data.alerts.filter(alert => !alert.dismissed).slice(0, 5);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-primary" />
            システムアラート
          </div>
          <div className="flex gap-1">
            {data.criticalCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                緊急 {data.criticalCount}
              </Badge>
            )}
            {data.warningCount > 0 && (
              <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">
                警告 {data.warningCount}
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {visibleAlerts.length === 0 ? (
          <div className="text-center py-6">
            <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">システムは正常に動作しています</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`
                  p-3 border rounded-lg cursor-pointer transition-colors duration-200
                  hover:shadow-sm ${getAlertBgColor(alert.type)}
                `}
                onClick={() => handleAlertClick(alert)}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {getAlertIcon(alert.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant={alert.type === 'critical' ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {getTypeLabel(alert.type)}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimestamp(alert.timestamp)}
                      </span>
                    </div>
                    <h4 className="text-sm font-medium mb-1 line-clamp-1">
                      {alert.title}
                    </h4>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {alert.message}
                    </p>
                    {alert.actionUrl && alert.actionLabel && (
                      <div className="mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7"
                          asChild
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link href={alert.actionUrl} className="flex items-center gap-1">
                            {alert.actionLabel}
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>
                  {onDismissAlert && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                      onClick={(e) => handleDismissAlert(alert.id, e)}
                      title="アラートを閉じる"
                    >
                      ×
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {data.alerts.length > visibleAlerts.length && (
          <div className="mt-4 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              asChild
            >
              <Link href="/admin/alerts">
                すべてのアラートを表示 ({data.alerts.length}件)
              </Link>
            </Button>
          </div>
        )}

        {/* Last Updated */}
        {data.lastUpdated && (
          <div className="text-xs text-muted-foreground text-center mt-3">
            最終更新: {new Date(data.lastUpdated).toLocaleString('ja-JP')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton component for loading state
 */
export function SystemAlertsCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="w-5 h-5 bg-muted animate-pulse rounded" />
          <div className="h-5 bg-muted animate-pulse rounded w-28" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-3 border rounded-lg">
              <div className="flex items-start gap-2">
                <div className="w-4 h-4 bg-muted animate-pulse rounded mt-0.5" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                  <div className="h-3 bg-muted animate-pulse rounded w-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}