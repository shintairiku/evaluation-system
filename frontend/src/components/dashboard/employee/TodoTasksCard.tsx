'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckSquare,
  AlertCircle,
  ArrowRight,
  Target,
  FileText,
  MessageSquare,
  Clock,
  CheckCircle2
} from 'lucide-react';

import type { TodoTasksData, TodoTask } from '@/api/types';

export interface TodoTasksCardProps {
  data?: TodoTasksData;
  isLoading?: boolean;
  className?: string;
  onTaskClick?: (task: TodoTask) => void;
}

/**
 * TodoTasksCard component for displaying pending tasks
 *
 * Displays:
 * - List of action items requiring user attention
 * - Priority-based sorting and color coding
 * - Quick action buttons for each task
 * - Deadline information and overdue status
 */
export default function TodoTasksCard({
  data,
  isLoading = false,
  className = '',
  onTaskClick
}: TodoTasksCardProps) {
  if (!data || isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-primary" />
            実行タスク
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="p-4 border rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div className="h-4 bg-muted animate-pulse rounded w-48" />
                  <div className="h-5 bg-muted animate-pulse rounded w-16" />
                </div>
                <div className="h-3 bg-muted animate-pulse rounded w-full mb-2" />
                <div className="h-3 bg-muted animate-pulse rounded w-24" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getPriorityBadgeVariant = (priority: TodoTask['priority']) => {
    switch (priority) {
      case 'high':
        return 'destructive' as const;
      case 'medium':
        return 'secondary' as const;
      case 'low':
        return 'outline' as const;
    }
  };

  const getPriorityLabel = (priority: TodoTask['priority']) => {
    switch (priority) {
      case 'high':
        return '高';
      case 'medium':
        return '中';
      case 'low':
        return '低';
    }
  };

  const getTaskIcon = (type: TodoTask['type']) => {
    switch (type) {
      case 'set_goals':
      case 'submit_goals':
      case 'revise_goals':
        return <Target className="w-4 h-4" />;
      case 'complete_self_assessment':
        return <FileText className="w-4 h-4" />;
      case 'review_feedback':
      case 'acknowledge_feedback':
        return <MessageSquare className="w-4 h-4" />;
      default:
        return <CheckSquare className="w-4 h-4" />;
    }
  };

  const getPriorityBorderColor = (priority: TodoTask['priority']) => {
    switch (priority) {
      case 'high':
        return 'border-red-200 bg-red-50 hover:bg-red-100';
      case 'medium':
        return 'border-yellow-200 bg-yellow-50 hover:bg-yellow-100';
      case 'low':
        return 'border-gray-200 bg-gray-50 hover:bg-gray-100';
    }
  };

  // Sort tasks: high priority first, then by deadline, then overdue
  const sortedTasks = [...data.tasks].sort((a, b) => {
    // First sort by overdue
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;

    // Then by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    // Then by days remaining
    if (a.daysRemaining !== undefined && b.daysRemaining !== undefined) {
      return a.daysRemaining - b.daysRemaining;
    }

    return 0;
  });

  // Empty state
  if (data.totalTasks === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-primary" />
            実行タスク
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              完了しました!
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              現在、実行すべきタスクはありません
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
            <CheckSquare className="w-5 h-5 text-primary" />
            実行タスク
          </div>
          <div className="flex items-center gap-2">
            {data.overdueCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                遅延: {data.overdueCount}件
              </Badge>
            )}
            {data.highPriorityCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                重要: {data.highPriorityCount}件
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sortedTasks.slice(0, 5).map((task) => (
            <div
              key={task.id}
              className={`p-4 border rounded-lg transition-colors ${getPriorityBorderColor(task.priority)}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-start gap-2 flex-1">
                  <div className="mt-0.5">{getTaskIcon(task.type)}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{task.title}</span>
                      <Badge variant={getPriorityBadgeVariant(task.priority)} className="text-xs">
                        {getPriorityLabel(task.priority)}
                      </Badge>
                      {task.isOverdue && (
                        <Badge variant="destructive" className="text-xs">
                          期限超過
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{task.description}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {task.deadline && (
                    <>
                      <Clock className="w-3 h-3" />
                      <span>
                        期限: {new Date(task.deadline).toLocaleDateString('ja-JP')}
                        {task.daysRemaining !== undefined && (
                          <span className={task.daysRemaining <= 3 ? 'text-red-500 font-semibold ml-1' : 'ml-1'}>
                            ({task.daysRemaining}日後)
                          </span>
                        )}
                      </span>
                    </>
                  )}
                </div>

                {task.actionUrl && (
                  <Link href={task.actionUrl}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => onTaskClick?.(task)}
                    >
                      実行
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          ))}

          {/* Show more message if there are additional tasks */}
          {data.totalTasks > 5 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                他に{data.totalTasks - 5}件のタスクがあります
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
export function TodoTasksCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="w-5 h-5 bg-muted animate-pulse rounded" />
          <div className="h-5 bg-muted animate-pulse rounded w-24" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-4 border rounded-lg">
              <div className="flex items-start justify-between mb-2">
                <div className="h-4 bg-muted animate-pulse rounded w-48" />
                <div className="h-5 bg-muted animate-pulse rounded w-16" />
              </div>
              <div className="h-3 bg-muted animate-pulse rounded w-full mb-2" />
              <div className="h-3 bg-muted animate-pulse rounded w-24" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}