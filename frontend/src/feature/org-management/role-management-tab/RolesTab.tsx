'use client';

import { useState, useMemo, useCallback, useTransition } from 'react';
import { toast } from 'sonner';
import {
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Users as UsersIcon,
} from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { createRoleAction, updateRoleAction, deleteRoleAction } from '@/api/server-actions/roles';
import { updateUserAction } from '@/api/server-actions/users';
import type { RoleDetail, UserDetailResponse } from '@/api/types';

interface RolesTabProps {
  roles: RoleDetail[];
  users: UserDetailResponse[];
  onUsersStateSync: (nextUsers: UserDetailResponse[]) => void;
  onRoleCreated: (role: RoleDetail) => void;
  onRoleUpdated: (role: RoleDetail) => void;
  onRoleDeleted: (roleId: string) => void;
}

type RoleFormState = {
  name: string;
  description: string;
};

export function RolesTab({
  roles,
  users,
  onUsersStateSync,
  onRoleCreated,
  onRoleUpdated,
  onRoleDeleted,
}: RolesTabProps) {
  const [assignmentRole, setAssignmentRole] = useState<RoleDetail | null>(null);
  const [selectedRoleUserIds, setSelectedRoleUserIds] = useState<string[]>([]);
  const [isAssignmentPending, startAssignmentTransition] = useTransition();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState<RoleFormState>({ name: '', description: '' });
  const [isCreatePending, startCreateTransition] = useTransition();

  const [editTargetRole, setEditTargetRole] = useState<RoleDetail | null>(null);
  const [editForm, setEditForm] = useState<RoleFormState>({ name: '', description: '' });
  const [isEditPending, startEditTransition] = useTransition();

  const [deleteTargetRole, setDeleteTargetRole] = useState<RoleDetail | null>(null);
  const [isDeletePending, startDeleteTransition] = useTransition();

  const roleUserMap = useMemo(() => {
    const map = new Map<string, number>();
    roles.forEach((role) => map.set(role.id, 0));

    users.forEach((user) => {
      user.roles.forEach((role) => {
        map.set(role.id, (map.get(role.id) ?? 0) + 1);
      });
    });

    return map;
  }, [roles, users]);

  const openAssignmentDialog = (role: RoleDetail) => {
    setAssignmentRole(role);
    const currentMembers = users
      .filter((user) => user.roles.some((item) => item.id === role.id))
      .map((user) => user.id);
    setSelectedRoleUserIds(currentMembers);
  };

  const closeAssignmentDialog = () => {
    setAssignmentRole(null);
    setSelectedRoleUserIds([]);
  };

  const handleToggleRoleUser = (userId: string, checked: boolean) => {
    setSelectedRoleUserIds((prev) => {
      if (checked) {
        return prev.includes(userId) ? prev : [...prev, userId];
      }
      return prev.filter((id) => id !== userId);
    });
  };

  const handleRoleAssignmentsSave = useCallback(() => {
    if (!assignmentRole) return;

    const roleId = assignmentRole.id;
    const currentMembers = users
      .filter((user) => user.roles.some((role) => role.id === roleId))
      .map((user) => user.id);

    const currentSet = new Set(currentMembers);
    const selectedSet = new Set(selectedRoleUserIds);

    const toAdd = selectedRoleUserIds.filter((id) => !currentSet.has(id));
    const toRemove = currentMembers.filter((id) => !selectedSet.has(id));

    if (!toAdd.length && !toRemove.length) {
      toast.info('変更はありません');
      closeAssignmentDialog();
      return;
    }

    startAssignmentTransition(async () => {
      const updatedUsersMap = new Map<string, UserDetailResponse>();
      let failures = 0;

      const processUpdate = async (userId: string, add: boolean) => {
        const user = users.find((item) => item.id === userId);
        if (!user) return;

        const currentRoleIds = user.roles.map((role) => role.id);
        const nextRoleIds = add
          ? Array.from(new Set([...currentRoleIds, roleId]))
          : currentRoleIds.filter((id) => id !== roleId);

        const result = await updateUserAction(userId, { role_ids: nextRoleIds });
        if (!result.success || !result.data) {
          failures += 1;
          return;
        }
        updatedUsersMap.set(userId, result.data);
      };

      await Promise.all([
        ...toAdd.map((id) => processUpdate(id, true)),
        ...toRemove.map((id) => processUpdate(id, false)),
      ]);

      if (updatedUsersMap.size > 0) {
        const nextUsers = users.map((user) =>
          updatedUsersMap.has(user.id) ? updatedUsersMap.get(user.id)! : user,
        );
        onUsersStateSync(nextUsers);
        const failureSuffix = failures ? ` / 失敗 ${failures} 件` : '';
        toast.success(`ロール割り当てを更新しました（成功 ${updatedUsersMap.size} 件${failureSuffix}）`);
      } else {
        toast.error('ロール割り当ての更新に失敗しました');
      }

      closeAssignmentDialog();
    });
  }, [assignmentRole, selectedRoleUserIds, users, onUsersStateSync]);

  const resetCreateForm = () => {
    setCreateForm({ name: '', description: '' });
  };

  const handleOpenCreateDialog = () => {
    resetCreateForm();
    setIsCreateDialogOpen(true);
  };

  const handleCreateRole = () => {
    const name = createForm.name.trim();
    const description = createForm.description.trim();
    if (!name || !description) {
      toast.error('ロール名と説明を入力してください');
      return;
    }

    startCreateTransition(async () => {
      const result = await createRoleAction({ name, description });
      if (!result.success || !result.data) {
        toast.error(result.error || 'ロールの作成に失敗しました');
        return;
      }

      onRoleCreated(result.data);
      toast.success('ロールを作成しました');
      setIsCreateDialogOpen(false);
      resetCreateForm();
    });
  };

  const openEditDialog = (role: RoleDetail) => {
    setEditTargetRole(role);
    setEditForm({ name: role.name, description: role.description || '' });
  };

  const handleEditRoleSave = () => {
    if (!editTargetRole) return;
    const name = editForm.name.trim();
    const description = editForm.description.trim();

    if (!name || !description) {
      toast.error('ロール名と説明を入力してください');
      return;
    }

    startEditTransition(async () => {
      const result = await updateRoleAction(editTargetRole.id, { name, description });
      if (!result.success || !result.data) {
        toast.error(result.error || 'ロールの更新に失敗しました');
        return;
      }

      onRoleUpdated(result.data);
      toast.success('ロールを更新しました');
      setEditTargetRole(null);
    });
  };

  const handleDeleteRequest = (role: RoleDetail) => {
    const userCount = roleUserMap.get(role.id) ?? 0;
    if (userCount > 0) {
      toast.error(`ロール「${role.name}」は ${userCount} 名に割り当てられているため削除できません`);
      return;
    }
    setDeleteTargetRole(role);
  };

  const handleConfirmDelete = () => {
    if (!deleteTargetRole) return;

    startDeleteTransition(async () => {
      const result = await deleteRoleAction(deleteTargetRole.id);
      if (!result.success) {
        toast.error(result.error || 'ロールの削除に失敗しました');
        return;
      }

      onRoleDeleted(deleteTargetRole.id);
      toast.success('ロールを削除しました');
      setDeleteTargetRole(null);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">ロール管理</h3>
          <p className="text-sm text-muted-foreground">
            ロールの作成・編集・削除と、ユーザー割り当てをまとめて管理します。
          </p>
        </div>
        <Button type="button" size="sm" className="self-start" onClick={handleOpenCreateDialog}>
          <Plus className="mr-2 size-4" /> 新しいロールを作成
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>ロール名</TableHead>
              <TableHead>説明</TableHead>
              <TableHead className="w-32 text-center">ユーザー数</TableHead>
              <TableHead className="w-[240px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((role) => {
              const userCount = roleUserMap.get(role.id) ?? 0;
              return (
                <TableRow key={role.id}>
                  <TableCell className="font-medium">{role.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {role.description || '—'}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{userCount}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                        onClick={() => openAssignmentDialog(role)}
                      >
                        <UsersIcon className="size-4" /> 割り当て
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(role)}
                        aria-label={`${role.name} を編集`}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteRequest(role)}
                        aria-label={`${role.name} を削除`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {roles.length === 0 && (
              <TableRow>
                <TableCell colSpan={4}>
                  <div className="py-16 text-center text-sm text-muted-foreground">
                    表示できるロールがありません。まずはロールを作成してください。
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
        setIsCreateDialogOpen(open);
        if (!open) {
          resetCreateForm();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新しいロールを作成</DialogTitle>
            <DialogDescription>
              ロール名と説明を入力してください。作成後に権限やユーザーを割り当てできます。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-role-name">ロール名</Label>
              <Input
                id="create-role-name"
                value={createForm.name}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="例: コンサルタント"
                disabled={isCreatePending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-role-description">説明</Label>
              <Textarea
                id="create-role-description"
                value={createForm.description}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="ロールの役割や権限の説明を入力してください"
                disabled={isCreatePending}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsCreateDialogOpen(false)}
              disabled={isCreatePending}
            >
              キャンセル
            </Button>
            <Button type="button" onClick={handleCreateRole} disabled={isCreatePending}>
              {isCreatePending && <Loader2 className="mr-2 size-4 animate-spin" />}作成する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTargetRole} onOpenChange={(open) => !open && setEditTargetRole(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ロールを編集</DialogTitle>
            <DialogDescription>
              ロール名や説明を更新できます。変更は保存後に反映されます。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-role-name">ロール名</Label>
              <Input
                id="edit-role-name"
                value={editForm.name}
                onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                disabled={isEditPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role-description">説明</Label>
              <Textarea
                id="edit-role-description"
                value={editForm.description}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, description: event.target.value }))
                }
                disabled={isEditPending}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEditTargetRole(null)}
              disabled={isEditPending}
            >
              キャンセル
            </Button>
            <Button type="button" onClick={handleEditRoleSave} disabled={isEditPending}>
              {isEditPending && <Loader2 className="mr-2 size-4 animate-spin" />}保存する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTargetRole} onOpenChange={(open) => !open && setDeleteTargetRole(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ロールを削除</DialogTitle>
            <DialogDescription>
              この操作は取り消せません。削除してよろしいですか？
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ロール「{deleteTargetRole?.name ?? ''}」を削除します。割り当て済みユーザーがいないことを確認済みです。
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteTargetRole(null)}
              disabled={isDeletePending}
            >
              キャンセル
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeletePending}
            >
              {isDeletePending && <Loader2 className="mr-2 size-4 animate-spin" />}削除する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!assignmentRole} onOpenChange={(open) => !open && closeAssignmentDialog()}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{assignmentRole?.description || assignmentRole?.name} のユーザー割り当て</DialogTitle>
            <DialogDescription>
              このロールに割り当てたいユーザーにチェックを入れてください。保存時に一括で反映されます。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
            <div className="max-h-[420px] overflow-y-auto rounded-md border">
              <div className="sticky top-0 z-10 bg-muted px-4 py-2 text-sm font-medium">
                全ユーザー（{users.length} 名）
              </div>
              <div className="divide-y">
                {users.map((user) => {
                  const hasRole = user.roles.some((role) => role.id === assignmentRole?.id);
                  return (
                    <label
                      key={user.id}
                      className="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm hover:bg-muted/40"
                    >
                      <Checkbox
                        checked={selectedRoleUserIds.includes(user.id)}
                        onCheckedChange={(checked) => handleToggleRoleUser(user.id, Boolean(checked))}
                        disabled={isAssignmentPending}
                      />
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                      <div className="ml-auto text-xs text-muted-foreground">
                        {hasRole ? '割当済み' : '未割当'}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold">選択状況</h4>
                <p className="text-xs text-muted-foreground">
                  選択中: {selectedRoleUserIds.length} 名
                </p>
              </div>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold">現在の割り当て</h4>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  {users
                    .filter((user) => user.roles.some((role) => role.id === assignmentRole?.id))
                    .map((user) => (
                      <li key={user.id}>{user.name}</li>
                    ))}
                  {users.filter((user) => user.roles.some((role) => role.id === assignmentRole?.id)).length === 0 && (
                    <li>割り当てられているユーザーはいません</li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={closeAssignmentDialog}
              disabled={isAssignmentPending}
            >
              キャンセル
            </Button>
            <Button onClick={handleRoleAssignmentsSave} disabled={isAssignmentPending}>
              {isAssignmentPending ? '更新中...' : '保存する'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
