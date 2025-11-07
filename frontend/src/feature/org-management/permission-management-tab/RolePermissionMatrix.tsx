'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Copy,
  Loader2,
  RefreshCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  getAllRolePermissionsAction,
  cloneRolePermissionsAction,
  getPermissionCatalogGroupedAction,
  getRolePermissionsAction,
  replaceRolePermissionsAction,
} from '@/api/server-actions/permissions';
import type {
  PermissionGroup,
  PermissionCatalogItem,
  RoleDetail,
  RolePermissionResponse,
} from '@/api/types';

type RolePermissionDraft = {
  role: RoleDetail;
  base: Set<string>;
  draft: Set<string>;
  version: string;
};

type ConflictState = {
  roleId: string;
  message: string;
};

type SaveResultSummary = {
  successCount: number;
  failureCount: number;
};

const CONFLICT_KEYWORDS = ['409', 'conflict', '競合', 'refresh'];

function isConflictError(message: string | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return CONFLICT_KEYWORDS.some((keyword) => lower.includes(keyword));
}

// Permission group labeling
const PERMISSION_GROUP_FALLBACK = 'その他';
const PERMISSION_GROUP_LABELS: Record<string, string> = {
  user: 'ユーザー',
  department: '部署',
  role: 'ロール',
  goal: '目標',
  evaluation: '評価',
};

function inferPermissionGroup(code: string | undefined, provided?: string): string {
  if (provided && provided.trim().length > 0) {
    return provided;
  }
  if (!code) {
    return PERMISSION_GROUP_FALLBACK;
  }
  const prefix = code.split(':')[0] ?? '';
  return PERMISSION_GROUP_LABELS[prefix] ?? PERMISSION_GROUP_FALLBACK;
}

function normalizeCatalogItem(item: Partial<PermissionCatalogItem> | undefined): PermissionCatalogItem | null {
  if (!item || !item.code) {
    return null;
  }
  return {
    code: item.code,
    description: item.description ?? '',
    permission_group: inferPermissionGroup(item.code, item.permission_group),
  };
}

function normalizePermissionItems(
  items: (PermissionCatalogItem | Partial<PermissionCatalogItem>)[] | undefined,
): PermissionCatalogItem[] {
  if (!items || !items.length) {
    return [];
  }
  return items
    .map((item) => normalizeCatalogItem(item))
    .filter((item): item is PermissionCatalogItem => Boolean(item));
}

function normalizeRolePermissionResponse(
  response: RolePermissionResponse | undefined,
  fallbackRoleId: string,
): { roleId: string; permissions: PermissionCatalogItem[]; version: string } {
  if (!response) {
    return {
      roleId: fallbackRoleId,
      permissions: [],
      version: '0',
    };
  }

  const roleId = response.roleId ?? response.role_id ?? fallbackRoleId;
  const permissions = normalizePermissionItems(response.permissions);
  const version = response.version ?? '0';

  return { roleId, permissions, version };
}

function dedupeCatalog(items: PermissionCatalogItem[]): PermissionCatalogItem[] {
  const map = new Map<string, PermissionCatalogItem>();
  items.forEach((item) => {
    const normalized = normalizeCatalogItem(item);
    if (!normalized) {
      return;
    }
    const existing = map.get(normalized.code);
    if (!existing) {
      map.set(normalized.code, normalized);
      return;
    }
    map.set(normalized.code, {
      code: normalized.code,
      description: normalized.description || existing.description,
      permission_group: normalized.permission_group || existing.permission_group,
    });
  });
  return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
}

function flattenPermissionGroups(groups: PermissionGroup[] | undefined): PermissionCatalogItem[] {
  if (!groups || !groups.length) {
    return [];
  }
  return groups.flatMap((group) =>
    group.permissions.map((permission) => ({
      ...permission,
      permission_group: group.permission_group ?? inferPermissionGroup(permission.code, permission.permission_group),
    })),
  );
}

function buildRoleStateMap(
  roles: RoleDetail[],
  snapshot: RolePermissionResponse[],
): Record<string, RolePermissionDraft> {
  const roleById = new Map<string, RoleDetail>();
  roles.forEach((role) => {
    roleById.set(role.id, role);
  });

  const states: Record<string, RolePermissionDraft> = {};
  snapshot.forEach((entry) => {
    const roleId = entry.roleId ?? entry.role_id;
    if (!roleId) return;
    const role = roleById.get(roleId);
    if (!role) return;

    const permissions = normalizePermissionItems(entry.permissions);
    const codes = new Set(permissions.map((permission) => permission.code));
    states[roleId] = {
      role,
      base: codes,
      draft: new Set(codes),
      version: entry.version ?? '0',
    };
  });

  roles.forEach((role) => {
    if (!states[role.id]) {
      states[role.id] = {
        role,
        base: new Set<string>(),
        draft: new Set<string>(),
        version: '0',
      };
    }
  });

  return states;
}

function combineCatalog(
  catalog: PermissionCatalogItem[],
  snapshot: RolePermissionResponse[],
): PermissionCatalogItem[] {
  const combined = [...catalog];
  snapshot.forEach((entry) => {
    combined.push(...normalizePermissionItems(entry.permissions));
  });
  return dedupeCatalog(combined);
}

function groupCatalogByPermissionGroup(
  catalog: PermissionCatalogItem[],
  order: string[],
): PermissionGroup[] {
  const groupsMap = new Map<string, PermissionCatalogItem[]>();
  catalog.forEach((item) => {
    const group = inferPermissionGroup(item.code, item.permission_group);
    const bucket = groupsMap.get(group);
    if (bucket) {
      bucket.push(item);
    } else {
      groupsMap.set(group, [item]);
    }
  });

  const ordered = order.filter((group) => groupsMap.has(group));
  const remaining = Array.from(groupsMap.keys()).filter((group) => !ordered.includes(group));
  remaining.sort((a, b) => a.localeCompare(b, 'ja'));

  return [...ordered, ...remaining].map((group) => ({
    permission_group: group,
    permissions: (groupsMap.get(group) ?? []).sort((a, b) => a.code.localeCompare(b.code)),
  }));
}

function computeDraftDiff(state: RolePermissionDraft | undefined): { added: string[]; removed: string[] } {
  if (!state) {
    return { added: [], removed: [] };
  }
  const added = Array.from(state.draft).filter((code) => !state.base.has(code));
  const removed = Array.from(state.base).filter((code) => !state.draft.has(code));
  return { added, removed };
}

export interface RolePermissionMatrixProps {
  roles: RoleDetail[];
  isAdmin: boolean;
  initialAssignments: RolePermissionResponse[];
  initialCatalog: PermissionCatalogItem[];
  initialGroupedCatalog?: PermissionGroup[];
}

export function RolePermissionMatrix({
  roles,
  isAdmin,
  initialAssignments,
  initialCatalog,
  initialGroupedCatalog,
}: RolePermissionMatrixProps) {
  const safeInitialGroupedCatalog = initialGroupedCatalog ?? [];
  const [catalog, setCatalog] = useState<PermissionCatalogItem[]>(() => {
    const groupedSeeds = flattenPermissionGroups(safeInitialGroupedCatalog);
    const baseCatalog = dedupeCatalog([...initialCatalog, ...groupedSeeds]);
    return combineCatalog(baseCatalog, initialAssignments);
  });
  const [groupOrder, setGroupOrder] = useState<string[]>(() => {
    if (safeInitialGroupedCatalog.length) {
      return safeInitialGroupedCatalog.map((group) => group.permission_group);
    }
    const groupedSeeds = flattenPermissionGroups(safeInitialGroupedCatalog);
    const baseCatalog = dedupeCatalog([...initialCatalog, ...groupedSeeds]);
    return Array.from(new Set(baseCatalog.map((item) => item.permission_group)));
  });
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [roleStates, setRoleStates] = useState<Record<string, RolePermissionDraft>>(() =>
    buildRoleStateMap(roles, initialAssignments),
  );
  const roleStatesRef = useRef(roleStates);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | string>('all');
  const [savingRoleIds, setSavingRoleIds] = useState<Set<string>>(new Set());
  const [refreshingRoleIds, setRefreshingRoleIds] = useState<Set<string>>(new Set());
  const [conflictState, setConflictState] = useState<ConflictState | null>(null);
  const [cloneTargetRoleId, setCloneTargetRoleId] = useState<string | null>(null);
  const [cloneSourceRoleId, setCloneSourceRoleId] = useState<string | null>(null);
  const [isClonePending, setIsClonePending] = useState(false);

  const groupedCatalog = useMemo(
    () => groupCatalogByPermissionGroup(catalog, groupOrder),
    [catalog, groupOrder],
  );

  useEffect(() => {
    setRoleStates((prev) => {
      const next: Record<string, RolePermissionDraft> = { ...prev };
      let changed = false;
      const incomingIds = new Set(roles.map((role) => role.id));

      roles.forEach((role) => {
        const existing = next[role.id];
        if (!existing) {
          next[role.id] = {
            role,
            base: new Set<string>(),
            draft: new Set<string>(),
            version: '0',
          };
          changed = true;
        } else if (existing.role !== role) {
          next[role.id] = {
            ...existing,
            role,
          };
        }
      });

      Object.keys(next).forEach((roleId) => {
        if (!incomingIds.has(roleId)) {
          delete next[roleId];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [roles]);

  useEffect(() => {
    roleStatesRef.current = roleStates;
  }, [roleStates]);

  useEffect(() => {
    if (!isAdmin) {
      toast.info('権限マトリクスは閲覧モードです。編集するには管理者ロールが必要です。');
    }
  }, [isAdmin]);

  useEffect(() => {
    if (roleFilter !== 'all' && !roles.some((role) => role.id === roleFilter)) {
      setRoleFilter('all');
    }
  }, [roleFilter, roles]);

  const upsertCatalog = useCallback((items: PermissionCatalogItem[]) => {
    if (!items.length) return;
    setCatalog((prev) => dedupeCatalog([...prev, ...items]));
    setGroupOrder((prev) => {
      const seen = new Set(prev);
      let next = prev;
      items.forEach((item) => {
        const normalized = normalizeCatalogItem(item);
        if (!normalized) {
          return;
        }
        if (!seen.has(normalized.permission_group)) {
          seen.add(normalized.permission_group);
          next = [...next, normalized.permission_group];
        }
      });
      return next;
    });
  }, []);

  const handlePermissionChange = useCallback((roleId: string, permissionCode: string, nextChecked: boolean) => {
    setRoleStates((prev) => {
      const current = prev[roleId];
      if (!current) return prev;
      const draft = new Set(current.draft);
      if (nextChecked) {
        draft.add(permissionCode);
      } else {
        draft.delete(permissionCode);
      }
      return {
        ...prev,
        [roleId]: {
          ...current,
          draft,
        },
      };
    });
  }, []);

  const dirtyStates = useMemo(() => {
    return Object.values(roleStates).filter((state) => {
      if (state.base.size !== state.draft.size) return true;
      for (const code of state.base) {
        if (!state.draft.has(code)) return true;
      }
      return false;
    });
  }, [roleStates]);

  const visibleRoles = useMemo(() => {
    if (roleFilter === 'all') {
      return roles.filter((role) => roleStates[role.id]);
    }
    return roles.filter((role) => role.id === roleFilter && roleStates[role.id]);
  }, [roleFilter, roleStates, roles]);

  const filteredGroups = useMemo(() => {
    if (!filterQuery.trim()) {
      return groupedCatalog;
    }
    const needle = filterQuery.trim().toLowerCase();
    return groupedCatalog
      .map((group) => ({
        permission_group: group.permission_group,
        permissions: group.permissions.filter((item) => {
          const haystack = `${item.code} ${item.description ?? ''}`.toLowerCase();
          return haystack.includes(needle);
        }),
      }))
      .filter((group) => group.permissions.length > 0);
  }, [groupedCatalog, filterQuery]);

  useEffect(() => {
    const available = groupedCatalog.map((group) => group.permission_group);
    setExpandedGroups((prev) => {
      const filteredPrev = prev.filter((group) => available.includes(group));
      const sameAsPrev =
        filteredPrev.length === prev.length &&
        filteredPrev.every((value, index) => value === prev[index]);
      const baseResult = sameAsPrev ? prev : filteredPrev;

      if (!filterQuery.trim()) {
        return baseResult;
      }

      const matches = filteredGroups.map((group) => group.permission_group);
      const sameAsMatches =
        baseResult.length === matches.length &&
        baseResult.every((value, index) => value === matches[index]);
      return sameAsMatches ? baseResult : matches;
    });
  }, [groupedCatalog, filteredGroups, filterQuery]);

  const isRoleSaving = useCallback((roleId: string) => savingRoleIds.has(roleId), [savingRoleIds]);
  const isRoleRefreshing = useCallback((roleId: string) => refreshingRoleIds.has(roleId), [refreshingRoleIds]);
  const hasDirtyChanges = dirtyStates.length > 0;
  const cloneTargetState = cloneTargetRoleId ? roleStates[cloneTargetRoleId] : undefined;
  const cloneSourceState = cloneSourceRoleId ? roleStates[cloneSourceRoleId] : undefined;

  const cloneDiff = useMemo(() => {
    if (!cloneTargetState || !cloneSourceState) {
      return { additions: [] as string[], removals: [] as string[] };
    }
    const additions = Array.from(cloneSourceState.base).filter((code) => !cloneTargetState.base.has(code));
    const removals = Array.from(cloneTargetState.base).filter((code) => !cloneSourceState.base.has(code));
    return { additions, removals };
  }, [cloneTargetState, cloneSourceState]);

  const openCloneDialog = useCallback(
    (roleId: string) => {
      if (!isAdmin) return;
      setCloneTargetRoleId(roleId);
      setCloneSourceRoleId((current) => {
        if (current && current !== roleId && roles.some((role) => role.id === current)) {
          return current;
        }
        const fallback = roles.find((role) => role.id !== roleId)?.id ?? null;
        return fallback;
      });
    },
    [isAdmin, roles],
  );

  const closeCloneDialog = useCallback(() => {
    setCloneTargetRoleId(null);
    setCloneSourceRoleId(null);
    setIsClonePending(false);
  }, []);

  const refreshRole = useCallback(async (roleId: string, preserveDraft = false) => {
    const baseState = roleStatesRef.current[roleId];
    if (!baseState) return;

    setRefreshingRoleIds((prev) => {
      const next = new Set(prev);
      next.add(roleId);
      return next;
    });

    try {
      const result = await getRolePermissionsAction(roleId);
      if (!result.success || !result.data) {
        throw new Error(result.error || `${baseState.role.name} の権限情報を取得できませんでした。`);
      }
      const payload = normalizeRolePermissionResponse(result.data, roleId);

      upsertCatalog(payload.permissions);
      setRoleStates((prev) => {
        const next = { ...prev };
        const base = new Set(payload.permissions.map((item) => item.code));
        const draft = preserveDraft ? new Set(baseState.draft) : new Set(base);
        next[roleId] = {
          role: baseState.role,
          base,
          draft,
          version: payload.version,
        };
        return next;
      });
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : '最新データの取得に失敗しました。';
      toast.error(message);
    } finally {
      setRefreshingRoleIds((prev) => {
        const next = new Set(prev);
        next.delete(roleId);
        return next;
      });
    }
  }, [upsertCatalog]);

  const handleReloadAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [catalogGroupedResult, permissionsResult] = await Promise.all([
        getPermissionCatalogGroupedAction(),
        getAllRolePermissionsAction(),
      ]);

      if (!catalogGroupedResult.success || !catalogGroupedResult.data) {
        const message = catalogGroupedResult.error || '権限カタログの読み込みに失敗しました。';
        setError(message);
        toast.error(message);
        return;
      }

      if (!permissionsResult.success || !permissionsResult.data) {
        const message = permissionsResult.error || '権限割り当ての読み込みに失敗しました。';
        setError(message);
        toast.error(message);
        return;
      }

      const nextGroupOrder = catalogGroupedResult.data.groups.map((group) => group.permission_group);
      const flattened = dedupeCatalog(flattenPermissionGroups(catalogGroupedResult.data.groups));
      setGroupOrder(nextGroupOrder);
      setCatalog(combineCatalog(flattened, permissionsResult.data));
      setRoleStates(buildRoleStateMap(roles, permissionsResult.data));
      setExpandedGroups([]);
      toast.success('最新の権限情報を読み込みました。');
    } catch (reloadError) {
      const message = reloadError instanceof Error ? reloadError.message : '権限情報の再読み込みに失敗しました。';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [roles]);

  const handleCancel = useCallback(() => {
    if (!hasDirtyChanges) {
      toast.info('保存されている権限と同じ状態です。');
      return;
    }
    setRoleStates((prev) => {
      const next: Record<string, RolePermissionDraft> = {};
      Object.entries(prev).forEach(([roleId, state]) => {
        next[roleId] = {
          ...state,
          draft: new Set(state.base),
        };
      });
      return next;
    });
    setConflictState(null);
    toast.info('変更を破棄しました。');
  }, [hasDirtyChanges]);

  const applySaveResult = useCallback((roleId: string, payload: RolePermissionResponse) => {
    const { permissions, version } = normalizeRolePermissionResponse(payload, roleId);
    upsertCatalog(permissions);
    const nextBase = new Set(permissions.map((item) => item.code));
    setRoleStates((prev) => ({
      ...prev,
      [roleId]: {
        ...prev[roleId],
        base: nextBase,
        draft: new Set(nextBase),
        version,
      },
    }));
  }, [upsertCatalog]);

  const handleSave = useCallback(async () => {
    if (!isAdmin) {
      toast.error('管理者のみ保存できます。');
      return;
    }
    if (!dirtyStates.length) {
      toast.info('保存する変更はありません。');
      return;
    }

    const roleIds = dirtyStates.map((state) => state.role.id);
    setSavingRoleIds(new Set(roleIds));
    setConflictState(null);

    const summary: SaveResultSummary = {
      successCount: 0,
      failureCount: 0,
    };

    await Promise.all(roleIds.map(async (roleId) => {
      const state = roleStatesRef.current[roleId];
      if (!state) {
        summary.failureCount += 1;
        return;
      }
      const payload = {
        permissions: Array.from(state.draft),
        version: state.version,
      };

      const result = await replaceRolePermissionsAction(roleId, payload);
      if (!result.success || !result.data) {
        summary.failureCount += 1;
        const message = result.error || '権限の保存に失敗しました。';
        toast.error(`${state.role.name}: ${message}`);
        if (isConflictError(message)) {
          setConflictState({
            roleId,
            message,
          });
          await refreshRole(roleId, true);
        }
        return;
      }

      summary.successCount += 1;
      applySaveResult(roleId, result.data);
      toast.success(`${state.role.name} の権限を更新しました。`);
    }));

    setSavingRoleIds(new Set());

    if (summary.successCount && summary.failureCount) {
      toast.warning(`一部の権限が更新されました（成功 ${summary.successCount} 件 / 失敗 ${summary.failureCount} 件）`);
    } else if (summary.successCount) {
      toast.success(`権限を更新しました（${summary.successCount} 件）`);
    }
  }, [applySaveResult, dirtyStates, isAdmin, refreshRole]);

  const handleApplyLatest = useCallback(async () => {
    if (!conflictState) return;
    await refreshRole(conflictState.roleId, true);
    setConflictState(null);
  }, [conflictState, refreshRole]);

  const handleClonePermissions = useCallback(async () => {
    if (!cloneTargetRoleId || !cloneSourceRoleId) return;
    setIsClonePending(true);
    setConflictState(null);

    try {
      const result = await cloneRolePermissionsAction(cloneTargetRoleId, { fromRoleId: cloneSourceRoleId });
      if (!result.success || !result.data) {
        const message = result.error || '権限の複製に失敗しました。';
        toast.error(message);
        if (isConflictError(message)) {
          setConflictState({
            roleId: cloneTargetRoleId,
            message,
          });
          await refreshRole(cloneTargetRoleId, true);
        }
        return;
      }

      applySaveResult(cloneTargetRoleId, result.data);
      toast.success('権限を複製しました。');
      closeCloneDialog();
    } catch (error) {
      console.error('cloneRolePermissions error', error);
      toast.error('権限の複製中に予期せぬエラーが発生しました。');
    } finally {
      setIsClonePending(false);
    }
  }, [cloneTargetRoleId, cloneSourceRoleId, applySaveResult, closeCloneDialog, refreshRole]);

  if (!roles.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>権限管理</CardTitle>
          <CardDescription>表示できるロールがありません。</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            新しいロールを作成すると権限マトリクスが表示されます。
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="overflow-hidden border-t-[3px] border-primary/40 shadow-sm">
      <CardHeader className="space-y-2">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              権限マトリクス
              <Badge variant="outline" className="uppercase tracking-wide">
                Beta
              </Badge>
            </CardTitle>
            <CardDescription>
              ロールごとの権限を一覧表示し、管理者はチェックを切り替えて保存できます。
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void handleReloadAll();
              }}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <RefreshCcw className="mr-2 size-4" />
              )}
              再読み込み
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={!hasDirtyChanges || !isAdmin}
            >
              変更を破棄
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                void handleSave();
              }}
              disabled={!hasDirtyChanges || !isAdmin}
            >
              {hasDirtyChanges ? '変更を保存' : '保存'}
            </Button>
          </div>
        </div>
        {error && (
          <Alert variant="destructive">
            <ShieldAlert className="size-4" />
            <AlertTitle>権限データの読み込みに失敗しました</AlertTitle>
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        )}
        {conflictState && (
          <Alert variant="destructive" className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <AlertTitle>他の管理者による更新が検出されました</AlertTitle>
              <AlertDescription>
                {conflictState.message} 「最新を取得」ボタンで現在の権限を再読み込みできます。
              </AlertDescription>
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                void handleApplyLatest();
              }}
              disabled={isRoleRefreshing(conflictState.roleId)}
            >
              {isRoleRefreshing(conflictState.roleId) && <Loader2 className="mr-2 size-4 animate-spin" />}
              最新を取得
            </Button>
          </Alert>
        )}
        {!isAdmin && (
          <Alert className="border-amber-200 bg-amber-50 text-amber-700">
            <ShieldCheck className="size-4" />
            <AlertTitle>閲覧モード</AlertTitle>
            <AlertDescription>
              権限の変更は管理者のみ可能です。現在は権限マトリクスを確認することができます。
            </AlertDescription>
          </Alert>
        )}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filterQuery}
              onChange={(event) => setFilterQuery(event.target.value)}
              placeholder="権限コード・説明で検索"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as 'all' | string)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="ロールを選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべてのロール</SelectItem>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasDirtyChanges && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">
                未保存 {dirtyStates.length} 件
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-card">
          {filteredGroups.length > 0 ? (
              <Accordion
                type="multiple"
                value={expandedGroups}
                onValueChange={(value) => {
                  const nextValue = Array.isArray(value) ? value : [value];
                  setExpandedGroups(nextValue);
                }}
              >
                {filteredGroups.map((group) => {
                  const groupCodes = new Set(group.permissions.map((permission) => permission.code));
                  const groupChangeCount = visibleRoles.reduce((count, role) => {
                    const state = roleStates[role.id];
                    if (!state) return count;
                    const diff = computeDraftDiff(state);
                    const added = diff.added.filter((code) => groupCodes.has(code)).length;
                    const removed = diff.removed.filter((code) => groupCodes.has(code)).length;
                    return count + added + removed;
                  }, 0);

                  return (
                    <AccordionItem key={group.permission_group} value={group.permission_group}>
                      <AccordionTrigger className="px-6">
                        <div className="flex flex-1 flex-col gap-1 text-left">
                          <span className="text-sm font-semibold">{group.permission_group}</span>
                          <span className="text-xs text-muted-foreground">
                            {group.permissions.length} 件の権限
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {groupChangeCount > 0 && (
                            <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-700">
                              未保存 {groupChangeCount}
                            </Badge>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-6">
                        <div className="overflow-x-auto pb-6">
                          <Table className="w-full min-w-full lg:min-w-[960px]">
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[220px] whitespace-nowrap text-left">権限コード</TableHead>
                                <TableHead className="w-[320px] whitespace-nowrap text-left">説明</TableHead>
                                {visibleRoles.map((role) => {
                                  const state = roleStates[role.id];
                                  const diff = computeDraftDiff(state);
                                  const changeCount = state
                                    ? diff.added.filter((code) => groupCodes.has(code)).length +
                                      diff.removed.filter((code) => groupCodes.has(code)).length
                                    : 0;
                                  const assignedCount = state
                                    ? Array.from(state.draft).filter((code) => groupCodes.has(code)).length
                                    : 0;
                                  const saving = isRoleSaving(role.id);
                                  const refreshing = isRoleRefreshing(role.id);
                                  return (
                                    <TableHead key={role.id} className="min-w-[140px] whitespace-nowrap text-center">
                                      <div className="flex min-w-[120px] flex-col items-center gap-1 text-xs font-medium uppercase tracking-wide">
                                        <span className="text-sm font-semibold leading-tight">{role.name}</span>
                                        <span className="text-muted-foreground">{assignedCount} 件</span>
                                        {changeCount > 0 && (
                                          <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-700">
                                            未保存 {changeCount}
                                          </Badge>
                                        )}
                                        {(saving || refreshing) && (
                                          <Loader2 className="size-4 animate-spin text-muted-foreground" />
                                        )}
                                        {isAdmin && roles.length > 1 && (
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-auto px-2 py-1 text-[11px]"
                                            onClick={() => openCloneDialog(role.id)}
                                          >
                                            <Copy className="mr-1 size-3" /> 複製
                                          </Button>
                                        )}
                                      </div>
                                    </TableHead>
                                  );
                                })}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {group.permissions.map((permission) => (
                                <TableRow key={permission.code} className="align-top hover:bg-muted/30">
                                  <TableCell className="align-top">
                                    <div className="flex flex-col gap-1">
                                      <span className="font-medium text-sm leading-5">{permission.code}</span>
                                      <Badge variant="outline" className="w-fit text-[10px] tracking-wider">
                                        {permission.permission_group}
                                      </Badge>
                                    </div>
                                  </TableCell>
                                  <TableCell className="align-top text-sm leading-5 text-muted-foreground">
                                    {permission.description || '説明が登録されていません'}
                                  </TableCell>
                                  {visibleRoles.map((role) => {
                                    const state = roleStates[role.id];
                                    const checked = state ? state.draft.has(permission.code) : false;
                                    return (
                                      <TableCell key={role.id} className="align-top text-center">
                                        <div className="flex min-h-[42px] items-center justify-center">
                                          <Checkbox
                                            checked={checked}
                                            disabled={!isAdmin || isRoleSaving(role.id) || isRoleRefreshing(role.id)}
                                            onCheckedChange={(value) => {
                                              if (!state) return;
                                              const nextValue = value === 'indeterminate' ? !checked : value === true;
                                              handlePermissionChange(role.id, permission.code, nextValue);
                                            }}
                                            aria-label={`${role.name} に ${permission.code} を割り当て`}
                                          />
                                        </div>
                                      </TableCell>
                                    );
                                  })}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            ) : (
              <div className="flex min-h-[240px] items-center justify-center px-6 py-12 text-sm text-muted-foreground">
                該当する権限が見つかりませんでした。検索条件を変更してください。
              </div>
            )}
        </div>
      </CardContent>
      </Card>
      {cloneTargetRoleId && (
        <Dialog open onOpenChange={(open) => { if (!open) closeCloneDialog(); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>権限を複製</DialogTitle>
              <DialogDescription>
                選択したロールへ別のロールの権限セットをコピーします。保存済みの権限だけが複製対象です。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  対象ロール:{' '}
                  <span className="font-medium text-foreground">
                    {roles.find((role) => role.id === cloneTargetRoleId)?.name ?? ''}
                  </span>
                </p>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="clone-source-role">
                    コピー元ロール
                  </label>
                  <Select
                    value={cloneSourceRoleId ?? undefined}
                    onValueChange={(value) => setCloneSourceRoleId(value)}
                    disabled={isClonePending}
                  >
                    <SelectTrigger id="clone-source-role">
                      <SelectValue placeholder="コピー元ロールを選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles
                        .filter((role) => role.id !== cloneTargetRoleId)
                        .map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-md border bg-muted/30 p-4 text-sm">
                <p className="font-medium">変更予定の概要</p>
                <div className="mt-2 grid gap-1">
                  <span>追加される権限: {cloneDiff.additions.length} 件</span>
                  <span>削除される権限: {cloneDiff.removals.length} 件</span>
                  {(cloneDiff.additions.length > 0 || cloneDiff.removals.length > 0) && (
                    <div className="mt-2 grid gap-2 text-xs text-muted-foreground">
                      {cloneDiff.additions.length > 0 && (
                        <div>
                          <p className="font-medium text-foreground">追加される権限</p>
                          <ul className="list-disc space-y-1 pl-4">
                            {cloneDiff.additions.slice(0, 5).map((code) => (
                              <li key={`add-${code}`}>{code}</li>
                            ))}
                            {cloneDiff.additions.length > 5 && <li>他 {cloneDiff.additions.length - 5} 件…</li>}
                          </ul>
                        </div>
                      )}
                      {cloneDiff.removals.length > 0 && (
                        <div>
                          <p className="font-medium text-foreground">削除される権限</p>
                          <ul className="list-disc space-y-1 pl-4">
                            {cloneDiff.removals.slice(0, 5).map((code) => (
                              <li key={`remove-${code}`}>{code}</li>
                            ))}
                            {cloneDiff.removals.length > 5 && <li>他 {cloneDiff.removals.length - 5} 件…</li>}
                          </ul>
                        </div>
                      )}
                      {cloneDiff.additions.length === 0 && cloneDiff.removals.length === 0 && (
                        <p>差分はありません。保存済みの権限は同一です。</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={closeCloneDialog} disabled={isClonePending}>
                キャンセル
              </Button>
              <Button type="button" onClick={handleClonePermissions} disabled={isClonePending || !cloneSourceRoleId}>
                {isClonePending && <Loader2 className="mr-2 size-4 animate-spin" />}複製する
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
