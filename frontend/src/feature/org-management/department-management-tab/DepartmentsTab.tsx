'use client';

import { useState, useMemo, useCallback, useTransition, FormEvent } from 'react';
import { toast } from 'sonner';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';
import {
  createDepartmentAction,
  updateDepartmentAction,
  deleteDepartmentAction,
} from '@/api/server-actions/departments';
import { updateUserAction } from '@/api/server-actions/users';
import type {
  Department,
  UserDetailResponse,
  DepartmentCreate,
  DepartmentUpdate,
} from '@/api/types';

interface DepartmentsTabProps {
  departments: Department[];
  users: UserDetailResponse[];
  onDepartmentCreated: (department: Department) => void;
  onDepartmentUpdated: (department: Department) => void;
  onDepartmentDeleted: (departmentId: string) => void;
  onUsersStateSync: (nextUsers: UserDetailResponse[]) => void;
}

type DepartmentFormMode = 'create' | 'edit';

export function DepartmentsTab({
  departments,
  users,
  onDepartmentCreated,
  onDepartmentUpdated,
  onDepartmentDeleted,
  onUsersStateSync,
}: DepartmentsTabProps) {
  const [formState, setFormState] = useState<{ mode: DepartmentFormMode; department?: Department } | null>(null);
  const [usersDialogDepartment, setUsersDialogDepartment] = useState<Department | null>(null);
  const [deleteDialogDepartment, setDeleteDialogDepartment] = useState<Department | null>(null);
  const [isFormPending, startFormTransition] = useTransition();
  const [isUsersPending, startUsersTransition] = useTransition();
  const [isDeletePending, startDeleteTransition] = useTransition();
  const [selectedDepartmentUserIds, setSelectedDepartmentUserIds] = useState<string[]>([]);

  const departmentUserMap = useMemo(() => {
    const map = new Map<string, { total: number; active: number }>();
    departments.forEach((department) => {
      map.set(department.id, { total: 0, active: 0 });
    });

    users.forEach((user) => {
      const departmentId = user.department?.id;
      if (!departmentId) return;
      const stats = map.get(departmentId);
      if (!stats) {
        map.set(departmentId, {
          total: 1,
          active: user.status === 'active' ? 1 : 0,
        });
        return;
      }
      stats.total += 1;
      if (user.status === 'active') {
        stats.active += 1;
      }
    });

    return map;
  }, [departments, users]);

  const openCreateModal = () => setFormState({ mode: 'create' });

  const openEditModal = (department: Department) => setFormState({ mode: 'edit', department });

  const openUsersModal = (department: Department) => {
    setUsersDialogDepartment(department);
    const currentMembers = users
      .filter((user) => user.department?.id === department.id)
      .map((user) => user.id);
    setSelectedDepartmentUserIds(currentMembers);
  };

  const openDeleteModal = (department: Department) => setDeleteDialogDepartment(department);

  const closeFormModal = () => setFormState(null);
  const closeUsersModal = () => {
    setUsersDialogDepartment(null);
    setSelectedDepartmentUserIds([]);
  };
  const closeDeleteModal = () => setDeleteDialogDepartment(null);

  const handleDepartmentFormSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!formState) return;

      const formData = new FormData(event.currentTarget);
      const name = (formData.get('name') as string).trim();
      const description = (formData.get('description') as string).trim();

      if (!name) {
        toast.error('部門名は必須です');
        return;
      }

      const payload: DepartmentCreate & DepartmentUpdate = {
        name,
        description: description || undefined,
      };

      startFormTransition(async () => {
        if (formState.mode === 'create') {
          const result = await createDepartmentAction(payload);
          if (!result.success || !result.data) {
            toast.error(result.error || '部門の作成に失敗しました');
            return;
          }
          onDepartmentCreated(result.data);
          toast.success('部門を作成しました');
        } else if (formState.department) {
          const result = await updateDepartmentAction(formState.department.id, payload);
          if (!result.success || !result.data) {
            toast.error(result.error || '部門の更新に失敗しました');
            return;
          }
          onDepartmentUpdated(result.data);
          toast.success('部門を更新しました');
        }
        closeFormModal();
      });
    },
    [formState, onDepartmentCreated, onDepartmentUpdated],
  );

  const handleToggleDepartmentUser = (userId: string, checked: boolean) => {
    setSelectedDepartmentUserIds((prev) => {
      if (checked) {
        return prev.includes(userId) ? prev : [...prev, userId];
      }
      return prev.filter((id) => id !== userId);
    });
  };

  const handleDepartmentUsersSave = useCallback(() => {
    if (!usersDialogDepartment) return;

    const departmentId = usersDialogDepartment.id;
    const currentMembers = users
      .filter((user) => user.department?.id === departmentId)
      .map((user) => user.id);

    const currentSet = new Set(currentMembers);
    const selectedSet = new Set(selectedDepartmentUserIds);

    const toAdd = selectedDepartmentUserIds.filter((id) => !currentSet.has(id));
    const toRemove = currentMembers.filter((id) => !selectedSet.has(id));

    if (toAdd.length === 0 && toRemove.length === 0) {
      toast.info('変更はありません');
      closeUsersModal();
      return;
    }

    startUsersTransition(async () => {
      const updatedUsersMap = new Map<string, UserDetailResponse>();
      let failures = 0;

      const processUpdate = async (userId: string, nextDepartmentId: string | null) => {
        const result = await updateUserAction(userId, { department_id: nextDepartmentId });
        if (!result.success || !result.data) {
          failures += 1;
          return;
        }
        updatedUsersMap.set(userId, result.data);
      };

      await Promise.all([
        ...toAdd.map((id) => processUpdate(id, departmentId)),
        ...toRemove.map((id) => processUpdate(id, null)),
      ]);

      if (updatedUsersMap.size > 0) {
        const nextUsers = users.map((user) =>
          updatedUsersMap.has(user.id) ? updatedUsersMap.get(user.id)! : user,
        );
        onUsersStateSync(nextUsers);
        toast.success(`部門メンバーを更新しました（成功 ${updatedUsersMap.size} 件${failures ? ` / 失敗 ${failures} 件` : ''}）`);
      } else {
        toast.error('部門メンバーの更新に失敗しました');
      }

      closeUsersModal();
    });
  }, [selectedDepartmentUserIds, usersDialogDepartment, users, onUsersStateSync]);

  const handleDepartmentDelete = useCallback(() => {
    if (!deleteDialogDepartment) return;

    const departmentId = deleteDialogDepartment.id;
    const activeMembers = users.filter(
      (user) => user.department?.id === departmentId && user.status === 'active',
    );

    if (activeMembers.length > 0) {
      toast.error('アクティブユーザーが存在するため削除できません。先に他の部門へ移動してください。');
      return;
    }

    startDeleteTransition(async () => {
      const result = await deleteDepartmentAction(departmentId);
      if (!result.success) {
        toast.error(result.error || '部門の削除に失敗しました');
        return;
      }
      onDepartmentDeleted(departmentId);
      toast.success('部門を削除しました');
      closeDeleteModal();
    });
  }, [deleteDialogDepartment, onDepartmentDeleted, users]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">部門管理</h3>
          <p className="text-sm text-muted-foreground">
            部門の作成・編集・削除、および所属ユーザーの管理を行います。
          </p>
        </div>
        <Button onClick={openCreateModal} className="w-full sm:w-auto">
          <Plus className="mr-2 size-4" />
          新規部門を作成
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>部門名</TableHead>
              <TableHead>説明</TableHead>
              <TableHead className="w-32 text-center">ユーザー数</TableHead>
              <TableHead className="w-32 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {departments.map((department) => {
              const stats = departmentUserMap.get(department.id) ?? { total: 0, active: 0 };
              return (
                <TableRow key={department.id}>
                  <TableCell className="font-medium">{department.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {department.description || '—'}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mx-auto flex items-center gap-2"
                      onClick={() => openUsersModal(department)}
                    >
                      <Badge variant="secondary">{stats.total}</Badge>
                      <Users className="size-4 text-muted-foreground" />
                    </Button>
                    <p className="text-[11px] text-muted-foreground">
                      アクティブ {stats.active}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditModal(department)}
                      >
                        <Pencil className="mr-2 size-4" />
                        編集
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => openDeleteModal(department)}
                      >
                        <Trash2 className="mr-2 size-4" />
                        削除
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {departments.length === 0 && (
              <TableRow>
                <TableCell colSpan={4}>
                  <div className="py-16 text-center text-sm text-muted-foreground">
                    登録されている部門がありません。右上の「新規部門を作成」から追加してください。
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create / Edit Modal */}
      <Dialog open={!!formState} onOpenChange={(open) => !open && closeFormModal()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {formState?.mode === 'create' ? '新規部門を作成' : '部門を編集'}
            </DialogTitle>
            <DialogDescription>
              部門名と説明を入力してください。説明は任意です。
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleDepartmentFormSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="department-name">部門名</Label>
              <Input
                id="department-name"
                name="name"
                defaultValue={formState?.department?.name ?? ''}
                placeholder="例: 営業部"
                required
                disabled={isFormPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department-description">説明</Label>
              <Textarea
                id="department-description"
                name="description"
                defaultValue={formState?.department?.description ?? ''}
                placeholder="部門の役割や概要を入力してください"
                disabled={isFormPending}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={closeFormModal}
                disabled={isFormPending}
              >
                キャンセル
              </Button>
              <Button type="submit" disabled={isFormPending}>
                {isFormPending ? '保存中...' : '保存'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Department Users Modal */}
      <Dialog open={!!usersDialogDepartment} onOpenChange={(open) => !open && closeUsersModal()}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {usersDialogDepartment?.name} の所属ユーザー
            </DialogTitle>
            <DialogDescription>
              部門に所属させたいユーザーにチェックを入れてください。保存時に一括で反映されます。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
            <div className="max-h-[420px] overflow-y-auto rounded-md border">
              <div className="sticky top-0 z-10 bg-muted px-4 py-2 text-sm font-medium">
                全ユーザー（{users.length} 名）
              </div>
              <div className="divide-y">
                {users.map((user) => (
                  <label
                    key={user.id}
                    className="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm hover:bg-muted/40"
                  >
                    <Checkbox
                      checked={selectedDepartmentUserIds.includes(user.id)}
                      onCheckedChange={(checked) => handleToggleDepartmentUser(user.id, Boolean(checked))}
                      disabled={isUsersPending}
                    />
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <div className="ml-auto text-xs text-muted-foreground">
                      {user.department?.id === usersDialogDepartment?.id ? '所属中' : user.department?.name ?? '未所属'}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold">選択状況</h4>
                <p className="text-xs text-muted-foreground">
                  選択中: {selectedDepartmentUserIds.length} 名
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-semibold">現在の所属</h4>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  {users
                    .filter((user) => user.department?.id === usersDialogDepartment?.id)
                    .map((user) => (
                      <li key={user.id}>{user.name}</li>
                    ))}
                  {users.filter((user) => user.department?.id === usersDialogDepartment?.id).length === 0 && (
                    <li>所属ユーザーがいません</li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={closeUsersModal}
              disabled={isUsersPending}
            >
              キャンセル
            </Button>
            <Button onClick={handleDepartmentUsersSave} disabled={isUsersPending}>
              {isUsersPending ? '更新中...' : '保存する'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteDialogDepartment} onOpenChange={(open) => !open && closeDeleteModal()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>部門を削除しますか？</DialogTitle>
            <DialogDescription>
              この操作は取り消せません。部門に所属するアクティブユーザーがいる場合は削除できません。
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md bg-muted/50 p-4 text-sm">
            <p className="font-medium">{deleteDialogDepartment?.name}</p>
            <p className="text-muted-foreground">{deleteDialogDepartment?.description || '説明なし'}</p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={closeDeleteModal}
              disabled={isDeletePending}
            >
              キャンセル
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDepartmentDelete}
              disabled={isDeletePending}
            >
              {isDeletePending ? '削除中...' : '削除する'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
