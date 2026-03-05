'use client';

import { useState } from 'react';
import { EvaluationPeriodSelector } from '@/components/evaluation/EvaluationPeriodSelector';
import { usePeerReviewAssignmentsData } from '../hooks/usePeerReviewAssignmentsData';
import { useEvaluationProgressData } from '../hooks/useEvaluationProgressData';
import { ReviewerSelector } from '../components/ReviewerSelector';
import { AssignmentStatusBadge } from '../components/AssignmentStatusBadge';
import { ProgressTable } from '../components/ProgressTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Save,
  Search,
  Shuffle,
  Undo2,
  Users,
  CheckCircle,
  Clock,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface PeerReviewAssignmentsPageProps {
  selectedPeriodId?: string;
}

export default function PeerReviewAssignmentsPage({
  selectedPeriodId,
}: PeerReviewAssignmentsPageProps) {
  const [internalSelectedPeriodId, setInternalSelectedPeriodId] = useState<string>(
    selectedPeriodId || ''
  );
  const {
    paginatedRows,
    filteredRows,
    isLoading,
    isSaving,
    error,
    saveError,
    searchQuery,
    setSearchQuery,
    selectedDepartmentId,
    setSelectedDepartmentId,
    currentPeriod,
    allPeriods,
    resolvedPeriodId,
    users,
    departments,
    currentPage,
    itemsPerPage,
    totalPages,
    dirtyCount,
    stats,
    setCurrentPage,
    setReviewerForRow,
    saveAllChanges,
    isRandomAssigned,
    toggleRandomAssign,
    refetch,
  } = usePeerReviewAssignmentsData({
    selectedPeriodId: internalSelectedPeriodId || undefined,
  });

  const [activeTab, setActiveTab] = useState('assignments');

  // Progress data (only loaded when tab is active)
  const progress = useEvaluationProgressData(
    activeTab === 'progress' ? (resolvedPeriodId || internalSelectedPeriodId || null) : null
  );

  const handlePeriodChange = (periodId: string) => {
    setInternalSelectedPeriodId(periodId);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSaveAll = async () => {
    const success = await saveAllChanges();
    if (success) {
      toast.success('評価者の割当を保存しました。');
    } else {
      toast.error('一部の割当の保存に失敗しました。詳細を確認してください。');
    }
  };

  const activeSelectorPeriodId =
    internalSelectedPeriodId || resolvedPeriodId || allPeriods[0]?.id || '';

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">同僚評価進捗管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            各社員に対して同僚評価者を2名割り当てます
          </p>
        </div>

        {allPeriods.length > 0 && (
          <EvaluationPeriodSelector
            periods={allPeriods}
            selectedPeriodId={activeSelectorPeriodId}
            currentPeriodId={currentPeriod?.id || null}
            onPeriodChange={handlePeriodChange}
            isLoading={isLoading}
          />
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="assignments">評価者割当</TabsTrigger>
          <TabsTrigger value="progress">評価進捗</TabsTrigger>
        </TabsList>

        {/* Tab 1: 評価者割当 (existing content) */}
        <TabsContent value="assignments" className="space-y-6 mt-4">
          {/* Stats Cards */}
          {!isLoading && !error && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-card border rounded-lg p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Users className="h-4 w-4" />
                  対象者
                </div>
                <p className="text-2xl font-bold mt-1">{stats.total}</p>
              </div>
              <div className="bg-card border rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-600 text-sm">
                  <CheckCircle className="h-4 w-4" />
                  割当済
                </div>
                <p className="text-2xl font-bold mt-1">{stats.assigned}</p>
              </div>
              <div className="bg-card border rounded-lg p-4">
                <div className="flex items-center gap-2 text-yellow-600 text-sm">
                  <Clock className="h-4 w-4" />
                  一部割当
                </div>
                <p className="text-2xl font-bold mt-1">{stats.partial}</p>
              </div>
              <div className="bg-card border rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <XCircle className="h-4 w-4" />
                  未割当
                </div>
                <p className="text-2xl font-bold mt-1">{stats.unassigned}</p>
              </div>
            </div>
          )}

          {/* Filters + Bulk Save */}
          <div className="flex flex-wrap gap-4 items-center p-4 bg-card rounded-lg border">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="社員名・部署で検索..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="部署" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべての部署</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant={isRandomAssigned ? 'destructive' : 'outline'}
              onClick={() => {
                const count = toggleRandomAssign();
                if (isRandomAssigned) {
                  toast.info(`${count}名のランダム割当を取り消しました。`);
                } else if (count > 0) {
                  toast.success(`${count}名にランダムで評価者を割り当てました。内容を確認して一括保存してください。`);
                } else {
                  toast.info('ランダム割当の対象者がいません（全員割当済みか、ユーザーが3名未満です）。');
                }
              }}
              disabled={isSaving || (!isRandomAssigned && stats.unassigned === 0)}
            >
              {isRandomAssigned ? (
                <Undo2 className="mr-2 h-4 w-4" />
              ) : (
                <Shuffle className="mr-2 h-4 w-4" />
              )}
              {isRandomAssigned ? 'ランダム割当を取消' : 'ランダム割当'}
            </Button>

            <Button onClick={handleSaveAll} disabled={isSaving || dirtyCount === 0}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              一括保存
              {dirtyCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {dirtyCount}
                </Badge>
              )}
            </Button>
          </div>

          {/* Error States */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>{error}</span>
                <Button variant="outline" size="sm" onClick={refetch}>
                  再読み込み
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {saveError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium">保存エラー:</p>
                {saveError.split('\n').map((line, i) => (
                  <p key={i} className="text-sm">{line}</p>
                ))}
              </AlertDescription>
            </Alert>
          )}

          {/* Table */}
          {!error && (
            <div className="bg-card border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">被評価者</TableHead>
                    <TableHead className="w-[120px]">部署</TableHead>
                    <TableHead className="w-[120px]">上長</TableHead>
                    <TableHead className="w-[220px]">同僚評価者 1</TableHead>
                    <TableHead className="w-[220px]">同僚評価者 2</TableHead>
                    <TableHead className="w-[100px]">状態</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                        <p className="text-sm text-muted-foreground mt-2">読み込み中...</p>
                      </TableCell>
                    </TableRow>
                  ) : paginatedRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        該当するユーザーがいません
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedRows.map(row => {
                      const excludeForSlot1 = [
                        row.user.id,
                        ...(row.local.reviewer2Id ? [row.local.reviewer2Id] : []),
                      ];
                      const excludeForSlot2 = [
                        row.user.id,
                        ...(row.local.reviewer1Id ? [row.local.reviewer1Id] : []),
                      ];

                      return (
                        <TableRow
                          key={row.user.id}
                          className={row.isDirty ? 'bg-blue-50/50' : undefined}
                        >
                          <TableCell className="font-medium">{row.user.name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {row.user.department?.name ?? '-'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {row.user.supervisor?.name ?? '-'}
                          </TableCell>
                          <TableCell>
                            <ReviewerSelector
                              users={users}
                              selectedId={row.local.reviewer1Id}
                              excludeIds={excludeForSlot1}
                              onChange={id => setReviewerForRow(row.user.id, 1, id)}
                            />
                          </TableCell>
                          <TableCell>
                            <ReviewerSelector
                              users={users}
                              selectedId={row.local.reviewer2Id}
                              excludeIds={excludeForSlot2}
                              onChange={id => setReviewerForRow(row.user.id, 2, id)}
                            />
                          </TableCell>
                          <TableCell>
                            <AssignmentStatusBadge
                              reviewer1Id={row.local.reviewer1Id}
                              reviewer2Id={row.local.reviewer2Id}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {!isLoading && !error && totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                全{filteredRows.length}件中 {(currentPage - 1) * itemsPerPage + 1}-
                {Math.min(currentPage * itemsPerPage, filteredRows.length)}件を表示
              </p>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  前へ
                </Button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                        className="w-9 h-9"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  次へ
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Tab 2: 評価進捗 */}
        <TabsContent value="progress" className="mt-4">
          <ProgressTable
            entries={progress.filteredEntries}
            isLoading={progress.isLoading}
            error={progress.error}
            stats={progress.stats}
            searchQuery={progress.searchQuery}
            setSearchQuery={progress.setSearchQuery}
            filter={progress.filter}
            setFilter={progress.setFilter}
            refetch={progress.refetch}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
