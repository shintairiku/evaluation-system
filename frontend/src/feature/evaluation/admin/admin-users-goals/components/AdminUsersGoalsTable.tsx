import { useState } from 'react';
import { UserGoalSummary } from '../types';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, Users } from 'lucide-react';
import { AdminGoalListTable } from '../../admin-goal-list/components/AdminGoalListTable';
import { EmployeeInfoCard } from '@/components/evaluation/EmployeeInfoCard';
import type { UserDetailResponse } from '@/api/types';

interface AdminUsersGoalsTableProps {
  userSummaries: UserGoalSummary[];
  isLoading: boolean;
  users: UserDetailResponse[];
}

/**
 * Table component for user-centric admin goals view
 * Displays one row per user with aggregated goal counts and status
 */
export function AdminUsersGoalsTable({ userSummaries, isLoading, users }: AdminUsersGoalsTableProps) {
  const [selectedSummary, setSelectedSummary] = useState<UserGoalSummary | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  if (isLoading) {
    return <TableSkeleton />;
  }

  if (userSummaries.length === 0) {
    return <EmptyState />;
  }

  const handleUserClick = (summary: UserGoalSummary) => {
    setSelectedSummary(summary);
    setIsDialogOpen(true);
  };

  // Get selected user details
  const selectedUser = selectedSummary
    ? users.find(u => u.id === selectedSummary.userId) || null
    : null;

  // Create user map for AdminGoalListTable
  const userMap = selectedUser
    ? new Map([
        [
          selectedUser.id,
          {
            name: selectedUser.name,
            departmentName: selectedUser.department?.name,
            supervisorName: selectedUser.supervisor?.name,
          },
        ],
      ])
    : new Map();

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ユーザー</TableHead>
            <TableHead>部署</TableHead>
            <TableHead>上司</TableHead>
            <TableHead>ステージ</TableHead>
            <TableHead>目標数</TableHead>
            <TableHead>ステータス</TableHead>
            <TableHead>最終更新</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {userSummaries.map(summary => (
            <TableRow
              key={summary.userId}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => handleUserClick(summary)}
            >
              {/* User Name */}
              <TableCell className="font-medium">{summary.userName}</TableCell>

              {/* Department */}
              <TableCell>{summary.department?.name || '-'}</TableCell>

              {/* Supervisor */}
              <TableCell>{summary.supervisor?.name || '-'}</TableCell>

              {/* Stage */}
              <TableCell>{summary.stage?.name || '-'}</TableCell>

              {/* Goal Counts */}
              <TableCell>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold">合計: {summary.counts.total}</span>
                  <span className="text-xs text-muted-foreground">
                    コンピテンシー: {summary.counts.competency} / チーム: {summary.counts.team} /
                    個人: {summary.counts.individual}
                  </span>
                </div>
              </TableCell>

              {/* Status Summary */}
              <TableCell>
                <StatusSummary statusCounts={summary.statusCounts} totalGoals={summary.counts.total} />
              </TableCell>

              {/* Last Activity */}
              <TableCell>
                {summary.lastActivity ? formatDate(summary.lastActivity) : '-'}
              </TableCell>

              {/* Actions */}
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={e => {
                    e.stopPropagation();
                    handleUserClick(summary);
                  }}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  詳細
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* User Goals Detail Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="!max-w-[90vw] w-[90vw] max-h-[85vh] h-[85vh] overflow-hidden flex flex-col p-6">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-xl">{selectedSummary?.userName}の目標一覧</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
          {selectedUser && selectedSummary && (
            <div className="space-y-4">
              {/* Employee Info Card */}
              <EmployeeInfoCard employee={selectedUser} />

              {/* Goals Table */}
              <div className="bg-card border rounded-lg">
                <div className="p-4 border-b">
                  <h3 className="text-lg font-semibold">目標詳細</h3>
                  <div className="flex gap-4 text-sm text-muted-foreground mt-2">
                    <span>合計: {selectedSummary.counts.total}</span>
                    <span>コンピテンシー: {selectedSummary.counts.competency}</span>
                    <span>チーム: {selectedSummary.counts.team}</span>
                    <span>個人: {selectedSummary.counts.individual}</span>
                  </div>
                </div>
                <AdminGoalListTable
                  goals={selectedSummary.goals}
                  userMap={userMap}
                  isLoading={false}
                />
              </div>
            </div>
          )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Status summary component with color-coded badges
 */
function StatusSummary({
  statusCounts,
  totalGoals,
}: {
  statusCounts: UserGoalSummary['statusCounts'];
  totalGoals: number;
}) {
  const { draft, submitted, approved, rejected } = statusCounts;

  // No goals case
  if (totalGoals === 0) {
    return <span className="text-muted-foreground text-sm">目標なし</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      {approved > 0 && (
        <Badge variant="default" className="bg-green-500 hover:bg-green-600">
          承認済み: {approved}
        </Badge>
      )}
      {submitted > 0 && <Badge variant="default">提出済み: {submitted}</Badge>}
      {draft > 0 && (
        <Badge variant="outline" className="border-yellow-500 text-yellow-700">
          下書き: {draft}
        </Badge>
      )}
      {rejected > 0 && <Badge variant="destructive">差し戻し: {rejected}</Badge>}
    </div>
  );
}

/**
 * Loading skeleton for table
 */
function TableSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ユーザー</TableHead>
          <TableHead>部署</TableHead>
          <TableHead>上司</TableHead>
          <TableHead>ステージ</TableHead>
          <TableHead>目標数</TableHead>
          <TableHead>ステータス</TableHead>
          <TableHead>最終更新</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 10 }).map((_, i) => (
          <TableRow key={i}>
            <TableCell>
              <Skeleton className="h-4 w-32" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-24" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-24" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-20" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-28" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-32" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-24" />
            </TableCell>
            <TableCell className="text-right">
              <Skeleton className="h-8 w-16 ml-auto" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * Empty state when no users match filters
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <Users className="h-16 w-16 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">ユーザーが見つかりません</h3>
      <p className="text-sm text-muted-foreground mb-4">
        フィルター条件に一致するユーザーがいません。
        <br />
        フィルターをクリアして再度お試しください。
      </p>
    </div>
  );
}

/**
 * Format date to Japanese locale string
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
