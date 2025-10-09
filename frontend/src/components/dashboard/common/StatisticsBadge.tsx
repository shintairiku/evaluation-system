'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface StatisticsBadgeProps {
  /** Numeric or text value to display */
  value: string | number;
  /** Optional label */
  label?: string;
  /** Badge variant affecting color */
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline';
  /** Size variant */
  size?: 'sm' | 'default' | 'lg';
  /** Custom styling */
  className?: string;
  /** Show as inline with label */
  inline?: boolean;
}

/**
 * StatisticsBadge - Displays statistics with color-coded badges
 *
 * Features:
 * - Color-coded by priority/status
 * - Multiple size variants
 * - Optional label
 * - Inline or block layout
 *
 * Usage:
 * <StatisticsBadge value={42} label="Total Users" variant="success" />
 * <StatisticsBadge value="15" variant="warning" />
 */
export default function StatisticsBadge({
  value,
  label,
  variant = 'default',
  size = 'default',
  className = '',
  inline = false
}: StatisticsBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    default: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  };

  // Custom variant styles extending shadcn/ui Badge
  const variantClasses = {
    default: '',
    secondary: '',
    success: 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400',
    warning: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400',
    destructive: '',
    outline: ''
  };

  const badge = (
    <Badge
      variant={variant === 'success' || variant === 'warning' ? 'secondary' : variant}
      className={cn(
        'font-semibold',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
    >
      {value}
    </Badge>
  );

  if (inline && label) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{label}:</span>
        {badge}
      </div>
    );
  }

  if (label) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        {badge}
      </div>
    );
  }

  return badge;
}

/**
 * StatisticsGroup - Groups multiple statistics badges
 */
export interface StatisticsGroupProps {
  statistics: Array<{
    value: string | number;
    label: string;
    variant?: StatisticsBadgeProps['variant'];
  }>;
  layout?: 'horizontal' | 'vertical' | 'grid';
  className?: string;
}

export function StatisticsGroup({
  statistics,
  layout = 'horizontal',
  className = ''
}: StatisticsGroupProps) {
  const layoutClasses = {
    horizontal: 'flex flex-wrap gap-3',
    vertical: 'flex flex-col gap-2',
    grid: 'grid grid-cols-2 gap-3'
  };

  return (
    <div className={cn(layoutClasses[layout], className)}>
      {statistics.map((stat, index) => (
        <StatisticsBadge
          key={index}
          value={stat.value}
          label={stat.label}
          variant={stat.variant}
        />
      ))}
    </div>
  );
}