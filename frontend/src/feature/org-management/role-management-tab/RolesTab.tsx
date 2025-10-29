'use client';

import { useState, useMemo, useCallback, useTransition } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Users } from 'lucide-react';
import { updateUserAction } from '@/api/server-actions/users';
import type { RoleDetail, UserDetailResponse } from '@/api/types';

interface RolesTabProps {
  roles: RoleDetail[];
  users: UserDetailResponse[];
  onUsersStateSync: (nextUsers: UserDetailResponse[]) => void;
}

export function RolesTab({
  roles,
  users,
  onUsersStateSync,
}: RolesTabProps) {
  const [roleDialogRole, setRoleDialogRole] = useState<RoleDetail | null>(null);
  const [selectedRoleUserIds, setSelectedRoleUserIds] = useState<string[]>([]);
  const [isDialogPending, startDialogTransition] = useTransition();

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

  const openRoleDialog = (role: RoleDetail) => {
    setRoleDialogRole(role);
    const currentMembers = users
      .filter((user) => user.roles.some((item) => item.id === role.id))
      .map((user) => user.id);
    setSelectedRoleUserIds(currentMembers);
  };

  const closeRoleDialog = () => {
    setRoleDialogRole(null);
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
    if (!roleDialogRole) return;

    const roleId = roleDialogRole.id;
    const currentMembers = users
      .filter((user) => user.roles.some((role) => role.id === roleId))
      .map((user) => user.id);

    const currentSet = new Set(currentMembers);
    const selectedSet = new Set(selectedRoleUserIds);

    const toAdd = selectedRoleUserIds.filter((id) => !currentSet.has(id));
    const toRemove = currentMembers.filter((id) => !selectedSet.has(id));

    if (!toAdd.length && !toRemove.length) {
      toast.info('変更はありません');
      closeRoleDialog();
      return;
    }

    startDialogTransition(async () => {
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
        toast.success(`ロール割り当てを更新しました（成功 ${updatedUsersMap.size} 件${failures ? ` / 失敗 ${failures} 件` : ''}）`);
      } else {
        toast.error('ロール割り当ての更新に失敗しました');
      }

      closeRoleDialog();
    });
  }, [roleDialogRole, selectedRoleUserIds, users, onUsersStateSync]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">ロール管理</h3>
        <p className="text-sm text-muted-foreground">
          ロールごとのユーザー割り当てを管理します。ロール自体の作成・削除は別画面で行います。
        </p>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>ロール名</TableHead>
              <TableHead>説明</TableHead>
              <TableHead className="w-32 text-center">ユーザー数</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((role) => (
              <TableRow key={role.id}>
                <TableCell className="font-medium">{role.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {role.description || '—'}
                </TableCell>
                <TableCell className="text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mx-auto flex items-center gap-2"
                    onClick={() => openRoleDialog(role)}
                  >
                    <Badge variant="secondary">{roleUserMap.get(role.id) ?? 0}</Badge>
                    <Users className="size-4 text-muted-foreground" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {roles.length === 0 && (
              <TableRow>
                <TableCell colSpan={3}>
                  <div className="py-16 text-center text-sm text-muted-foreground">
                    表示できるロールがありません。
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!roleDialogRole} onOpenChange={(open) => !open && closeRoleDialog()}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{roleDialogRole?.name} のユーザー割り当て</DialogTitle>
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
                  const hasRole = user.roles.some((role) => role.id === roleDialogRole?.id);
                  return (
                    <label
                      key={user.id}
                      className="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm hover:bg-muted/40"
                    >
                      <Checkbox
                        checked={selectedRoleUserIds.includes(user.id)}
                        onCheckedChange={(checked) => handleToggleRoleUser(user.id, Boolean(checked))}
                        disabled={isDialogPending}
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
                    .filter((user) => user.roles.some((role) => role.id === roleDialogRole?.id))
                    .map((user) => (
                      <li key={user.id}>{user.name}</li>
                    ))}
                  {users.filter((user) => user.roles.some((role) => role.id === roleDialogRole?.id)).length === 0 && (
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
              onClick={closeRoleDialog}
              disabled={isDialogPending}
            >
              キャンセル
            </Button>
            <Button onClick={handleRoleAssignmentsSave} disabled={isDialogPending}>
              {isDialogPending ? '更新中...' : '保存する'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
