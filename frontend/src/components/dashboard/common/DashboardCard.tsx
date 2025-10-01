'use client';

import { ReactNode } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LucideIcon } from 'lucide-react';

export interface DashboardCardProps {
  /** Card title */
  title: string;
  /** Optional card description/subtitle */
  description?: string;
  /** Optional icon component */
  icon?: LucideIcon;
  /** Card content */
  children: ReactNode;
  /** Optional actions in header (buttons, etc.) */
  actions?: ReactNode;
  /** Optional footer content */
  footer?: ReactNode;
  /** Loading state */
  isLoading?: boolean;
  /** Custom styling */
  className?: string;
  /** Custom header styling */
  headerClassName?: string;
  /** Custom content styling */
  contentClassName?: string;
}

/**
 * DashboardCard - Unified card component for dashboard content
 *
 * Features:
 * - Consistent layout across all dashboard cards
 * - Built on shadcn/ui Card components
 * - Optional icon, actions, and footer
 * - Loading state with skeleton
 * - Flexible styling options
 *
 * Usage:
 * <DashboardCard
 *   title="System Statistics"
 *   icon={BarChart}
 *   actions={<Button size="sm">View All</Button>}
 * >
 *   <p>Card content here</p>
 * </DashboardCard>
 */
export default function DashboardCard({
  title,
  description,
  icon: Icon,
  children,
  actions,
  footer,
  isLoading = false,
  className = '',
  headerClassName = '',
  contentClassName = ''
}: DashboardCardProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className={headerClassName}>
          <div className="flex items-center justify-between">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-6 w-3/4" />
              {description && <Skeleton className="h-4 w-1/2" />}
            </div>
            {actions && <Skeleton className="h-9 w-20" />}
          </div>
        </CardHeader>
        <CardContent className={contentClassName}>
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        </CardContent>
        {footer && (
          <CardFooter>
            <Skeleton className="h-4 w-full" />
          </CardFooter>
        )}
      </Card>
    );
  }

  return (
    <Card className={`transition-shadow hover:shadow-md ${className}`}>
      <CardHeader className={headerClassName}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            {Icon && (
              <div className="p-2 rounded-lg bg-primary/10">
                <Icon className="w-5 h-5 text-primary" />
              </div>
            )}
            <div className="space-y-1">
              <CardTitle className="text-lg font-semibold">{title}</CardTitle>
              {description && (
                <CardDescription className="text-sm">
                  {description}
                </CardDescription>
              )}
            </div>
          </div>
          {actions && (
            <div className="flex items-center gap-2">
              {actions}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className={contentClassName}>
        {children}
      </CardContent>
      {footer && (
        <CardFooter className="border-t pt-4">
          {footer}
        </CardFooter>
      )}
    </Card>
  );
}

/**
 * Skeleton version of DashboardCard for loading states
 */
export function DashboardCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
      </CardContent>
    </Card>
  );
}