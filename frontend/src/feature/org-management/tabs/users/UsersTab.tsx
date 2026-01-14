'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Users2, ChevronDown, Pencil } from 'lucide-react';
import { UserBulkStatusBar } from './UserBulkStatusBar';
import { StatusBadge } from './StatusBadge';
import {
  updateUserAction,
  updateUserStageAction,
  bulkUpdateUserStatusesAction,
  updateUserGoalWeightsAction,
  resetUserGoalWeightsAction,
  getUserGoalWeightHistoryAction,
} from '@/api/server-actions/users';
import { Input } from '@/components/ui/input';
import { useUserRoles } from '@/hooks/useUserRoles';
import type {
  UserDetailResponse,
  Department,
  RoleDetail,
  Stage,
  BulkUserStatusUpdateResponse,
  UserUpdate,
  UserGoalWeightHistoryEntry,
} from '@/api/types';
import { UserStatus } from '@/api/types';

interface UsersTabProps {
  users: UserDetailResponse[];
  departments: Department[];
  roles: RoleDetail[];
  stages: Stage[];
  selectedUserIds: string[];
  onToggleUserSelection: (userId: string, checked?: boolean) => void;
  onSelectAll: (selectAll: boolean) => void;
  onClearSelection: () => void;
  onUserUpdated: (user: UserDetailResponse) => void;
  onBulkStatusComplete: (result: BulkUserStatusUpdateResponse | null) => void;
  onUsersStateSync: (users: UserDetailResponse[]) => void;
}

export function UsersTab({
  users,
  departments,
  roles,
  stages,
  selectedUserIds,
  onToggleUserSelection,
  onSelectAll,
  onClearSelection,
  onUserUpdated,
  onBulkStatusComplete,
  onUsersStateSync,
}: UsersTabProps) {
  const { hasRole } = useUserRoles();
  const isAdmin = hasRole('admin');
  const canEditRoles = isAdmin;
  const roleEditDisabledMessage = 'ロールの編集は管理者のみ可能です。';
  const [pendingFieldKey, setPendingFieldKey] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkUserStatusUpdateResponse | null>(null);
  const [bulkPending, setBulkPending] = useState(false);
  const [subordinateSearch, setSubordinateSearch] = useState<Record<string, string>>({});

  const selectedCount = selectedUserIds.length;
  const allSelected = users.length > 0 && selectedCount === users.length;
  const indeterminate = selectedCount > 0 && !allSelected;

  const fieldKey = useCallback(
    (userId: string, field: string) => `${userId}:${field}`,
    [],
  );

  const isFieldPending = useCallback(
    (userId: string, field: string) => pendingFieldKey === fieldKey(userId, field),
    [pendingFieldKey, fieldKey],
  );

  const supervisorOptions = useMemo(
    () =>
      users.map((user) => ({
        id: user.id,
        label: `${user.name} (${user.employee_code})`,
      })),
    [users],
  );

  const subordinateOptions = supervisorOptions;

  const getSubordinateSearch = useCallback(
    (userId: string) => subordinateSearch[userId] ?? '',
    [subordinateSearch],
  );

  const setSubordinateSearchFor = useCallback((userId: string, value: string) => {
    setSubordinateSearch((prev) => ({ ...prev, [userId]: value }));
  }, []);

  const syncUser = useCallback(
    (updatedUser: UserDetailResponse) => {
      onUserUpdated(updatedUser);
      setBulkResult(null);
    },
    [onUserUpdated],
  );

  const runUserUpdate = useCallback(
    async (
      userId: string,
      field: string,
      updater: () => Promise<{ success: boolean; data?: UserDetailResponse; error?: string }>,
      successMessage: string,
    ) => {
      const key = fieldKey(userId, field);
      setPendingFieldKey(key);
      try {
        const result = await updater();
        if (!result.success || !result.data) {
          toast.error(result.error || '更新に失敗しました');
          return;
        }
        syncUser(result.data);
        toast.success(successMessage);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '更新に失敗しました';
        toast.error(errorMessage);
      } finally {
        setPendingFieldKey((current) => (current === key ? null : current));
      }
    },
    [fieldKey, syncUser],
  );

  const handleDepartmentChange = async (user: UserDetailResponse, departmentId: string) => {
    const newDepartmentId = departmentId === 'unset' ? null : departmentId;
    if ((user.department?.id ?? null) === newDepartmentId) {
      return;
    }

    await runUserUpdate(
      user.id,
      'department',
      () =>
        updateUserAction(user.id, {
          department_id: newDepartmentId,
        } as UserUpdate),
      '部門を更新しました',
    );
  };

  const handleStageChange = async (user: UserDetailResponse, stageId: string) => {
    if (stageId === 'unset') {
      toast.info('ステージを選択してください');
      return;
    }

    if ((user.stage?.id ?? null) === stageId) {
      return;
    }

    await runUserUpdate(
      user.id,
      'stage',
      () => updateUserStageAction(user.id, stageId),
      'ステージを更新しました',
    );
  };

  const handleRolesToggle = async (user: UserDetailResponse, roleId: string, checked: boolean) => {
    if (!canEditRoles) {
      toast.error(roleEditDisabledMessage);
      return;
    }
    const currentIds = user.roles.map((role) => role.id);
    const nextIds = checked
      ? Array.from(new Set([...currentIds, roleId]))
      : currentIds.filter((id) => id !== roleId);

    const currentKey = currentIds.slice().sort().join(',');
    const nextKey = nextIds.slice().sort().join(',');
    if (currentKey === nextKey) {
      return;
    }

    await runUserUpdate(
      user.id,
      'roles',
      () =>
        updateUserAction(user.id, {
          role_ids: nextIds,
        }),
      'ロールを更新しました',
    );
  };

  const handleSupervisorChange = async (user: UserDetailResponse, supervisorId: string) => {
    const newSupervisorId = supervisorId === 'unset' ? null : supervisorId;
    if ((user.supervisor?.id ?? null) === newSupervisorId) {
      return;
    }

    await runUserUpdate(
      user.id,
      'supervisor',
      () =>
        updateUserAction(user.id, {
          supervisor_id: newSupervisorId,
        } as UserUpdate),
      '上長を更新しました',
    );
  };

  const handleSubordinateToggle = async (user: UserDetailResponse, subordinateId: string, checked: boolean) => {
    const currentIds = user.subordinates?.map((sub) => sub.id) ?? [];
    const nextIds = checked
      ? Array.from(new Set([...currentIds, subordinateId]))
      : currentIds.filter((id) => id !== subordinateId);

    const currentKey = currentIds.slice().sort().join(',');
    const nextKey = nextIds.slice().sort().join(',');
    if (currentKey === nextKey) {
      return;
    }

    await runUserUpdate(
      user.id,
      'subordinates',
      () =>
        updateUserAction(user.id, {
          subordinate_ids: nextIds,
        }),
      '部下を更新しました',
    );
  };

  const handleStatusChange = async (user: UserDetailResponse, status: UserStatus) => {
    if (user.status === status) {
      return;
    }

    if (user.status === 'active' && status === 'inactive') {
      const confirmed = window.confirm(`${user.name} さんを無効化しますか？`);
      if (!confirmed) {
        return;
      }
    }

    await runUserUpdate(
      user.id,
      'status',
      () =>
        updateUserAction(user.id, {
          status,
        }),
      'ステータスを更新しました',
    );
  };

  const handleBulkStatusSubmit = (status: UserStatus) => {
    if (selectedUserIds.length === 0) return;
    setBulkPending(true);
    setBulkResult(null);

    const payload = selectedUserIds.map((userId) => ({
      userId,
      newStatus: status,
    }));

    bulkUpdateUserStatusesAction(payload).then((result) => {
      if (!result.success || !result.data) {
        toast.error(result.error || '一括更新に失敗しました');
        setBulkPending(false);
        onBulkStatusComplete(null);
        return;
      }

      const successIds = new Set(
        result.data.results.filter((item) => item.success).map((item) => item.userId),
      );

      if (successIds.size) {
        const updatedUsers = users.map((user) =>
          successIds.has(user.id)
            ? {
                ...user,
                status,
              }
            : user,
        );
        onUsersStateSync(updatedUsers);
      }

      if (result.data.failureCount > 0) {
        toast.warning(`一部のユーザーで失敗しました（${result.data.failureCount}件）`);
      } else {
        toast.success('ステータスを一括更新しました');
      }

      onBulkStatusComplete(result.data);
      setBulkResult(result.data);
      onClearSelection();
      setBulkPending(false);
    }).catch((error) => {
      const message = error instanceof Error ? error.message : '一括更新に失敗しました';
      toast.error(message);
      setBulkPending(false);
      onBulkStatusComplete(null);
    });
  };

  const renderRoles = (user: UserDetailResponse) => {
    if (!user.roles.length) {
      return <span className="text-xs text-muted-foreground">未設定</span>;
    }
    return (
      <div className="flex flex-wrap gap-1">
        {user.roles.map((role) => (
          <Badge key={role.id} variant="secondary">
            {role.description || role.name}
          </Badge>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Users2 className="size-5 text-primary" />
            ユーザー管理
          </h2>
          <p className="text-sm text-muted-foreground">
            部門・ロール・ステージ・階層・ステータスをインラインで編集し、最大100件まで一括更新できます。
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          表示件数: {users.length} 名
        </div>
      </header>

      {(bulkPending || bulkResult || selectedCount > 0) && (
        <UserBulkStatusBar
          selectedCount={selectedCount}
          isProcessing={bulkPending}
          lastResult={bulkResult}
          onSubmit={handleBulkStatusSubmit}
          onClearSelection={onClearSelection}
        />
      )}

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected ? true : indeterminate ? 'indeterminate' : false}
                  onCheckedChange={(checked) => onSelectAll(Boolean(checked))}
                  aria-label="Select all users"
                />
              </TableHead>
              <TableHead>氏名 / メール</TableHead>
              <TableHead>部門</TableHead>
              <TableHead className="w-[260px]">ロール</TableHead>
              <TableHead>ステージ</TableHead>
              <TableHead>上長</TableHead>
              <TableHead>部下</TableHead>
              <TableHead>ステータス</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const isSelected = selectedUserIds.includes(user.id);
              const currentRoleIds = new Set(user.roles.map((role) => role.id));
              const currentSubordinateIds = new Set(
                user.subordinates?.map((sub) => sub.id) ?? [],
              );

              return (
                <TableRow key={user.id} data-state={isSelected ? 'selected' : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => onToggleUserSelection(user.id, Boolean(checked))}
                      aria-label={`${user.name} を選択`}
                      disabled={bulkPending}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <p className="font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={user.department?.id ?? 'unset'}
                      onValueChange={(value) => handleDepartmentChange(user, value)}
                      disabled={isFieldPending(user.id, 'department')}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="未設定" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unset">未設定</SelectItem>
                        {departments.map((department) => (
                          <SelectItem key={department.id} value={department.id}>
                            {department.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-muted-foreground">割り当てロール</span>
                        {canEditRoles ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                aria-label="ロールを編集"
                                disabled={isFieldPending(user.id, 'roles')}
                              >
                                {isFieldPending(user.id, 'roles') ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <Pencil className="size-4" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-64">
                              <DropdownMenuLabel>ロールを選択</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {roles.map((role) => (
                                <DropdownMenuCheckboxItem
                                  key={role.id}
                                  checked={currentRoleIds.has(role.id)}
                                  onCheckedChange={(checked) => handleRolesToggle(user, role.id, Boolean(checked))}
                                  disabled={isFieldPending(user.id, 'roles')}
                                >
                                  {role.description || role.name}
                                </DropdownMenuCheckboxItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    aria-label="ロールを閲覧"
                                    disabled
                                  >
                                    <Pencil className="size-4" />
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="bottom">
                                {roleEditDisabledMessage}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      <div
                        className={`max-w-[260px] max-h-24 overflow-y-auto pr-1 ${
                          isFieldPending(user.id, 'roles') ? 'opacity-60' : ''
                        }`}
                        aria-busy={isFieldPending(user.id, 'roles')}
                        aria-live="polite"
                      >
                        {isFieldPending(user.id, 'roles') ? (
                          <div className="flex flex-wrap gap-2">
                            {[0, 1, 2].map((idx) => (
                              <Skeleton key={idx} className="h-5 w-16" />
                            ))}
                          </div>
                        ) : (
                          renderRoles(user)
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={user.stage?.id ?? 'unset'}
                      onValueChange={(value) => handleStageChange(user, value)}
                      disabled={isFieldPending(user.id, 'stage')}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="未設定" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unset" disabled>
                          未設定
                        </SelectItem>
                        {stages.map((stage) => (
                          <SelectItem key={stage.id} value={stage.id}>
                            {stage.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={user.supervisor?.id ?? 'unset'}
                      onValueChange={(value) => handleSupervisorChange(user, value)}
                      disabled={isFieldPending(user.id, 'supervisor')}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="未設定" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unset">未設定</SelectItem>
                        {supervisorOptions
                          .filter((option) => option.id !== user.id)
                          .map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                              {option.label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-w-[200px] justify-between"
                          disabled={isFieldPending(user.id, 'subordinates')}
                        >
                          <span className="truncate">
                            {currentSubordinateIds.size ? `${currentSubordinateIds.size} 名選択中` : '部下を選択'}
                          </span>
                          {isFieldPending(user.id, 'subordinates') ? (
                            <Loader2 className="ml-2 size-4 animate-spin" />
                          ) : (
                            <ChevronDown className="ml-2 size-4" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-64 max-h-72 overflow-y-auto">
                        <DropdownMenuLabel>部下を選択</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                    <div className="px-2 pb-2">
                      <Input
                        placeholder="キーワードで検索"
                        value={getSubordinateSearch(user.id)}
                        onChange={(e) => setSubordinateSearchFor(user.id, e.target.value)}
                      />
                    </div>
                    {subordinateOptions
                      .filter((option) => option.id !== user.id)
                      .filter((option) => {
                        const q = getSubordinateSearch(user.id).trim().toLowerCase();
                        if (!q) return true;
                        return option.label.toLowerCase().includes(q);
                      })
                      .sort((a, b) => {
                        const aSel = currentSubordinateIds.has(a.id) ? 1 : 0;
                        const bSel = currentSubordinateIds.has(b.id) ? 1 : 0;
                        return bSel - aSel; // selected first
                      })
                      .map((option) => (
                        <DropdownMenuCheckboxItem
                          key={option.id}
                          checked={currentSubordinateIds.has(option.id)}
                          onCheckedChange={(checked) => handleSubordinateToggle(user, option.id, Boolean(checked))}
                        >
                          {option.label}
                        </DropdownMenuCheckboxItem>
                      ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-2"
                          disabled={isFieldPending(user.id, 'status')}
                        >
                          <StatusBadge status={user.status} />
                          {isFieldPending(user.id, 'status') ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <ChevronDown className="size-4 text-muted-foreground" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>ステータス変更</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={() => handleStatusChange(user, UserStatus.PENDING_APPROVAL)}
                          disabled={user.status === 'pending_approval'}
                        >
                          承認待ち
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => handleStatusChange(user, UserStatus.ACTIVE)}
                          disabled={user.status === 'active'}
                        >
                          アクティブ
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => handleStatusChange(user, UserStatus.INACTIVE)}
                          disabled={user.status === 'inactive'}
                        >
                          無効
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={8}>
                  <div className="py-16 text-center text-sm text-muted-foreground">
                    表示可能なユーザーがありません。
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
