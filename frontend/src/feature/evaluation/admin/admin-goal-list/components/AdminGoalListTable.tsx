import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GoalStatusBadge } from '@/components/evaluation/GoalStatusBadge';
import { GoalCard } from '@/feature/evaluation/employee/goal-list/components/GoalCard';
import type { GoalResponse, SupervisorReview } from '@/api/types';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

/**
 * Extended GoalResponse with optional supervisorReview
 */
type GoalWithReview = GoalResponse & {
  supervisorReview?: SupervisorReview | null;
  rejectionHistory?: SupervisorReview[];
};

/**
 * Props for AdminGoalListTable component
 */
interface AdminGoalListTableProps {
  /** Array of goals to display */
  goals: GoalWithReview[];
  /** User data map (userId -> userName) for quick lookup */
  userMap?: Map<string, { name: string; departmentName?: string; supervisorName?: string }>;
  /** Loading state */
  isLoading?: boolean;
  /** Optional custom className */
  className?: string;
}

/**
 * Admin goal list table component.
 *
 * Features:
 * - Table layout optimized for admin system-wide view
 * - Shows: status, owner, department, title, category, weight, date
 * - Read-only (no action buttons)
 * - Uses GoalStatusBadge for consistent status display
 * - Hover effect on rows
 * - Responsive design
 *
 * Component Reuse:
 * - GoalStatusBadge: Existing component (use as-is)
 * - shadcn/ui Table components: Existing components
 *
 * @param props - Component props
 * @returns JSX element containing the goals table
 *
 * @example
 * ```tsx
 * <AdminGoalListTable
 *   goals={paginatedGoals}
 *   userMap={userNameMap}
 *   isLoading={false}
 * />
 * ```
 */
export const AdminGoalListTable = React.memo<AdminGoalListTableProps>(
  function AdminGoalListTable({ goals, userMap, isLoading, className }: AdminGoalListTableProps) {
    const [selectedGoal, setSelectedGoal] = useState<GoalWithReview | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    /**
     * Handle row click to open goal details dialog
     */
    const handleRowClick = (goal: GoalWithReview) => {
      setSelectedGoal(goal);
      setIsDialogOpen(true);
    };

    /**
     * Format date for display
     */
    const formatDate = (date: string | Date | null | undefined): string => {
      if (!date) return '-';
      try {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        return format(dateObj, 'MM/dd', { locale: ja });
      } catch {
        return '-';
      }
    };

    /**
     * Get user display name
     */
    const getUserName = (userId: string): string => {
      return userMap?.get(userId)?.name || 'Unknown';
    };

    /**
     * Get department name
     */
    const getDepartmentName = (userId: string): string => {
      return userMap?.get(userId)?.departmentName || '-';
    };

    /**
     * Get supervisor name
     */
    const getSupervisorName = (userId: string): string => {
      return userMap?.get(userId)?.supervisorName || '-';
    };

    /**
     * Get goal title from target_data
     */
    const getGoalTitle = (goal: GoalWithReview): string => {
      // Performance goals have "title" field
      if ('title' in goal && goal.title) {
        return goal.title as string;
      }
      // Competency goals might have competency names
      if (goal.goalCategory === 'コンピテンシー') {
        return 'コンピテンシー目標';
      }
      // Core value goals
      if (goal.goalCategory === 'コアバリュー') {
        return 'コアバリュー目標';
      }
      return '目標';
    };

    if (isLoading) {
      return (
        <div className={className}>
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-muted-foreground">読み込み中...</p>
          </div>
        </div>
      );
    }

    if (goals.length === 0) {
      return (
        <div className={className}>
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-muted-foreground">
              表示する目標がありません
            </p>
          </div>
        </div>
      );
    }

    return (
      <>
        <div className={className}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">ステータス</TableHead>
                <TableHead className="w-[120px]">所有者</TableHead>
                <TableHead className="w-[120px]">部署</TableHead>
                <TableHead className="w-[120px]">上司</TableHead>
                <TableHead className="min-w-[200px]">目標タイトル</TableHead>
                <TableHead className="w-[120px]">カテゴリ</TableHead>
                <TableHead className="w-[80px] text-right">重み</TableHead>
                <TableHead className="w-[80px]">日付</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {goals.map((goal) => (
                <TableRow
                  key={goal.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleRowClick(goal)}
                >
                  {/* Status */}
                  <TableCell>
                    <GoalStatusBadge status={goal.status} />
                  </TableCell>

                  {/* Owner (User Name) */}
                  <TableCell className="font-medium">
                    {getUserName(goal.userId)}
                  </TableCell>

                  {/* Department */}
                  <TableCell className="text-muted-foreground">
                    {getDepartmentName(goal.userId)}
                  </TableCell>

                  {/* Supervisor */}
                  <TableCell className="text-muted-foreground">
                    {getSupervisorName(goal.userId)}
                  </TableCell>

                  {/* Goal Title */}
                  <TableCell className="max-w-[300px] truncate">
                    {getGoalTitle(goal)}
                  </TableCell>

                  {/* Goal Category */}
                  <TableCell className="text-sm">
                    {goal.goalCategory}
                  </TableCell>

                  {/* Weight */}
                  <TableCell className="text-right font-medium">
                    {goal.weight}%
                  </TableCell>

                  {/* Date (Created At) */}
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(goal.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Goal Details Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-6xl max-w-6xl max-h-[70vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>目標詳細</DialogTitle>
            </DialogHeader>
            {selectedGoal && (
              <GoalCard
                goal={selectedGoal}
                currentUserId={undefined}
              />
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  }
);
