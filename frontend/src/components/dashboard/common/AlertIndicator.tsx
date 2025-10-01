'use client';

import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface AlertIndicatorProps {
  /** Alert severity level */
  severity: AlertSeverity;
  /** Optional count to display */
  count?: number;
  /** Enable pulse animation */
  pulse?: boolean;
  /** Size variant */
  size?: 'sm' | 'default' | 'lg';
  /** Custom styling */
  className?: string;
  /** Show text label */
  showLabel?: boolean;
}

/**
 * AlertIndicator - Visual indicator for alerts with animation
 *
 * Features:
 * - Color-coded by severity (critical=red, warning=yellow, info=blue)
 * - Optional pulse animation
 * - Shows icon + optional count
 * - Multiple size variants
 *
 * Usage:
 * <AlertIndicator severity="critical" count={5} pulse />
 * <AlertIndicator severity="warning" />
 */
export default function AlertIndicator({
  severity,
  count,
  pulse = false,
  size = 'default',
  className = '',
  showLabel = false
}: AlertIndicatorProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    default: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const iconSizeClasses = {
    sm: 'w-3 h-3',
    default: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  const textSizeClasses = {
    sm: 'text-xs',
    default: 'text-sm',
    lg: 'text-base'
  };

  const severityConfig = {
    critical: {
      icon: AlertCircle,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-100 dark:bg-red-900/30',
      borderColor: 'border-red-300 dark:border-red-800',
      pulseColor: 'bg-red-600',
      label: '緊急'
    },
    warning: {
      icon: AlertTriangle,
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
      borderColor: 'border-yellow-300 dark:border-yellow-800',
      pulseColor: 'bg-yellow-600',
      label: '警告'
    },
    info: {
      icon: Info,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      borderColor: 'border-blue-300 dark:border-blue-800',
      pulseColor: 'bg-blue-600',
      label: '情報'
    }
  };

  const config = severityConfig[severity];
  const Icon = config.icon;

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <div className="relative">
        <div
          className={cn(
            'flex items-center justify-center rounded-full border-2',
            sizeClasses[size],
            config.bgColor,
            config.borderColor
          )}
        >
          <Icon className={cn(iconSizeClasses[size], config.color)} />
        </div>

        {/* Pulse animation */}
        {pulse && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span
              className={cn(
                'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
                config.pulseColor
              )}
            />
          </span>
        )}

        {/* Count badge */}
        {count !== undefined && count > 0 && (
          <span
            className={cn(
              'absolute -top-1 -right-1 flex items-center justify-center',
              'min-w-[1.25rem] h-5 px-1 rounded-full',
              'bg-red-600 text-white text-xs font-bold',
              'ring-2 ring-background'
            )}
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </div>

      {/* Label */}
      {showLabel && (
        <span className={cn('font-medium', config.color, textSizeClasses[size])}>
          {config.label}
          {count !== undefined && count > 0 && ` (${count})`}
        </span>
      )}
    </div>
  );
}

/**
 * AlertIndicatorGroup - Groups multiple alert indicators
 */
export interface AlertIndicatorGroupProps {
  alerts: Array<{
    severity: AlertSeverity;
    count?: number;
  }>;
  size?: AlertIndicatorProps['size'];
  className?: string;
}

export function AlertIndicatorGroup({
  alerts,
  size = 'default',
  className = ''
}: AlertIndicatorGroupProps) {
  // Filter out alerts with 0 count
  const visibleAlerts = alerts.filter(alert => !alert.count || alert.count > 0);

  if (visibleAlerts.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {visibleAlerts.map((alert, index) => (
        <AlertIndicator
          key={index}
          severity={alert.severity}
          count={alert.count}
          size={size}
          pulse={alert.severity === 'critical' && (alert.count ?? 0) > 0}
          showLabel
        />
      ))}
    </div>
  );
}