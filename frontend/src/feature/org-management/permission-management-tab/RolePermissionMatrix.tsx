'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  LayoutGrid,
  List,
  ListFilter,
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  getAllRolePermissionsAction,
  getPermissionCatalogGroupedAction,
  getRolePermissionsAction,
  replaceRolePermissionsAction,
} from '@/api/server-actions/permissions';
import { cn } from '@/lib/utils';
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

type RoleSummary = {
  role: RoleDetail;
  assignedCount: number;
  changedCount: number;
  coverage: number;
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

const PERMISSION_CODE_COLUMN_WIDTH = 220;
const PERMISSION_DESCRIPTION_COLUMN_OFFSET = PERMISSION_CODE_COLUMN_WIDTH;

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
  const [showChangedOnly, setShowChangedOnly] = useState(false);
  const [matrixDensity, setMatrixDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [didPrimeGroups, setDidPrimeGroups] = useState(false);

  const groupedCatalog = useMemo(
    () => groupCatalogByPermissionGroup(catalog, groupOrder),
    [catalog, groupOrder],
  );
  const totalPermissionCount = catalog.length;
  const changedPermissionCodes = useMemo(() => {
    const changed = new Set<string>();
    Object.values(roleStates).forEach((state) => {
      if (!state) return;
      state.base.forEach((code) => {
        if (!state.draft.has(code)) {
          changed.add(code);
        }
      });
      state.draft.forEach((code) => {
        if (!state.base.has(code)) {
          changed.add(code);
        }
      });
    });
    return changed;
  }, [roleStates]);
  const totalChangedCount = changedPermissionCodes.size;

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
  const toggleRoleFilter = useCallback((roleId: string) => {
    setRoleFilter((prev) => (prev === roleId ? 'all' : roleId));
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
  const roleSummaries = useMemo<RoleSummary[]>(() => {
    const denominator = Math.max(totalPermissionCount, 1);
    return visibleRoles.map((role) => {
      const state = roleStates[role.id];
      const diff = computeDraftDiff(state);
      const assignedCount = state ? state.draft.size : 0;
      const changedCount = diff.added.length + diff.removed.length;
      const coverage = Math.round((assignedCount / denominator) * 100);
      return {
        role,
        assignedCount,
        changedCount,
        coverage,
      };
    });
  }, [roleStates, visibleRoles, totalPermissionCount]);
  const roleSummaryMap = useMemo(() => {
    const map = new Map<string, RoleSummary>();
    roleSummaries.forEach((summary) => {
      map.set(summary.role.id, summary);
    });
    return map;
  }, [roleSummaries]);
  const matrixDensityConfig = useMemo(
    () => ({
      cellPadding: matrixDensity === 'compact' ? 'py-2' : 'py-4',
      checkboxMinHeight: matrixDensity === 'compact' ? 'min-h-[32px]' : 'min-h-[44px]',
      descriptionText: matrixDensity === 'compact' ? 'text-xs' : 'text-sm',
      codeText: matrixDensity === 'compact' ? 'text-sm' : 'text-base',
    }),
    [matrixDensity],
  );

  const filteredGroups = useMemo(() => {
    const trimmed = filterQuery.trim().toLowerCase();
    if (!trimmed && !showChangedOnly) {
      return groupedCatalog;
    }
    return groupedCatalog
      .map((group) => ({
        permission_group: group.permission_group,
        permissions: group.permissions.filter((item) => {
          const matchesQuery =
            !trimmed || `${item.code} ${item.description ?? ''}`.toLowerCase().includes(trimmed);
          if (!matchesQuery) {
            return false;
          }
          if (showChangedOnly) {
            return changedPermissionCodes.has(item.code);
          }
          return true;
        }),
      }))
      .filter((group) => group.permissions.length > 0);
  }, [changedPermissionCodes, groupedCatalog, filterQuery, showChangedOnly]);

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
  useEffect(() => {
    if (didPrimeGroups) return;
    if (!groupedCatalog.length) return;
    if (filterQuery.trim()) return;
    setExpandedGroups(groupedCatalog.slice(0, Math.min(2, groupedCatalog.length)).map((group) => group.permission_group));
    setDidPrimeGroups(true);
  }, [didPrimeGroups, groupedCatalog, filterQuery]);

  const isRoleSaving = useCallback((roleId: string) => savingRoleIds.has(roleId), [savingRoleIds]);
  const isRoleRefreshing = useCallback((roleId: string) => refreshingRoleIds.has(roleId), [refreshingRoleIds]);
  const hasDirtyChanges = dirtyStates.length > 0;
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
  const { cellPadding, checkboxMinHeight, descriptionText, codeText } = matrixDensityConfig;

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
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                権限マトリクス
                <Badge variant="outline" className="uppercase tracking-wide">
                  Beta
                </Badge>
              </CardTitle>
              <CardDescription>
                直感的なグリッドでロールごとの権限を比較し、差分をハイライトしながら安全に更新できます。
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
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {conflictState && (
            <Alert className="border-amber-200 bg-amber-50 text-amber-900">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <AlertTitle>他の管理者による更新が検出されました</AlertTitle>
                  <AlertDescription>
                    {conflictState.message} 「最新を取得」ボタンで現在の権限を再読み込みしてください。
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
              </div>
            </Alert>
          )}
          {!isAdmin && (
            <Alert className="border-amber-200 bg-amber-50 text-amber-800">
              <ShieldCheck className="size-4" />
              <AlertTitle>閲覧モード</AlertTitle>
              <AlertDescription>権限の変更は管理者のみ可能です。現在は権限マトリクスを確認できます。</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-muted/40 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">対象ロール</p>
              <p className="text-2xl font-semibold">
                {visibleRoles.length}
                <span className="text-sm text-muted-foreground"> / {roles.length}</span>
              </p>
              <p className="text-xs text-muted-foreground">表示中</p>
            </div>
            <div className="rounded-xl border bg-muted/40 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">権限項目</p>
              <p className="text-2xl font-semibold">{totalPermissionCount}</p>
              <p className="text-xs text-muted-foreground">カタログに含まれる総数</p>
            </div>
            <div className="rounded-xl border bg-muted/40 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">未保存の権限</p>
              <p className={cn('text-2xl font-semibold', totalChangedCount ? 'text-blue-600' : 'text-foreground')}>
                {totalChangedCount}
              </p>
              <p className="text-xs text-muted-foreground">
                {totalChangedCount ? '保存して反映します' : 'すべて最新です'}
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="relative w-full md:w-[320px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={filterQuery}
                    onChange={(event) => setFilterQuery(event.target.value)}
                    placeholder="権限コードや説明で検索"
                    className="pl-9"
                  />
                </div>
                <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as 'all' | string)}>
                  <SelectTrigger className="w-full md:w-[220px]">
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
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <div className="flex items-center gap-1 rounded-full border px-3 py-2 text-xs text-muted-foreground">
                  <span className="font-medium tracking-wide">表示密度</span>
                  <Button
                    type="button"
                    variant={matrixDensity === 'comfortable' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 gap-1"
                    onClick={() => setMatrixDensity('comfortable')}
                    aria-pressed={matrixDensity === 'comfortable'}
                  >
                    <LayoutGrid className="size-3.5" />
                    標準
                  </Button>
                  <Button
                    type="button"
                    variant={matrixDensity === 'compact' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 gap-1"
                    onClick={() => setMatrixDensity('compact')}
                    aria-pressed={matrixDensity === 'compact'}
                  >
                    <List className="size-3.5" />
                    コンパクト
                  </Button>
                </div>
                <div className="flex items-center gap-2 rounded-full border px-3 py-2">
                  <ListFilter className="size-3.5 text-muted-foreground" />
                  <Checkbox
                    id="show-changed-only"
                    checked={showChangedOnly}
                    onCheckedChange={(value) => setShowChangedOnly(value === true)}
                    disabled={!totalChangedCount}
                  />
                  <label
                    htmlFor="show-changed-only"
                    className={cn(
                      'select-none text-sm',
                      totalChangedCount ? 'cursor-pointer text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    未保存のみ表示
                  </label>
                </div>
                {hasDirtyChanges && (
                  <Badge variant="secondary" className="border-blue-200 bg-blue-100 text-blue-800">
                    変更中 {dirtyStates.length} ロール
                  </Badge>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
                <span>ロールサマリー</span>
                <span>{hasDirtyChanges ? '未保存の差分があります' : 'すべて保存済み'}</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {roleSummaries.length ? (
                  roleSummaries.map((summary) => {
                    const isActive = roleFilter === summary.role.id;
                    return (
                      <Button
                        key={summary.role.id}
                        type="button"
                        variant={isActive ? 'default' : 'outline'}
                        size="sm"
                        className={cn(
                          'h-auto min-w-[180px] flex-1 flex-col items-start justify-start gap-1 rounded-xl border text-left',
                          isActive ? 'bg-primary/10 border-primary/60 shadow-sm' : 'bg-background',
                        )}
                        onClick={() => toggleRoleFilter(summary.role.id)}
                        aria-pressed={isActive}
                      >
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {summary.role.name}
                        </span>
                        <span className="text-lg font-semibold leading-tight">
                          {summary.assignedCount}
                          <span className="text-xs text-muted-foreground"> / {totalPermissionCount}</span>
                        </span>
                        <div className="flex w-full items-center justify-between text-[11px] text-muted-foreground">
                          <span>カバレッジ {summary.coverage}%</span>
                          {summary.changedCount > 0 ? (
                            <Badge variant="secondary" className="border-blue-200 bg-blue-100 text-blue-800">
                              未保存 {summary.changedCount}
                            </Badge>
                          ) : (
                            <span className="text-emerald-600">最新</span>
                          )}
                        </div>
                      </Button>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">表示するロールがありません。</p>
                )}
              </div>
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
                            <Badge variant="outline" className="border-blue-300 bg-blue-100 text-blue-700">
                              未保存 {groupChangeCount}
                            </Badge>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-6">
                        <div className="relative isolate overflow-x-auto pb-6">
                          <Table className="w-full min-w-full lg:min-w-[960px]" aria-label={`${group.permission_group} の権限テーブル`}>
                            <TableHeader>
                              <TableRow className="bg-background">
                                <TableHead className="sticky left-0 z-20 w-[220px] whitespace-nowrap border-r-2 border-border bg-background text-left shadow-[4px_0_6px_rgba(0,0,0,0.12)]">
                                  権限コード
                                </TableHead>
                                <TableHead
                                  className="sticky z-20 w-[320px] whitespace-nowrap border-r-2 border-border bg-background text-left shadow-[4px_0_6px_rgba(0,0,0,0.12)]"
                                  style={{ left: PERMISSION_DESCRIPTION_COLUMN_OFFSET }}
                                >
                                  説明
                                </TableHead>
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
                                  const summary = roleSummaryMap.get(role.id);
                                  const isFocused = roleFilter !== 'all' && roleFilter === role.id;
                                  return (
                                    <TableHead
                                      key={role.id}
                                      className={cn(
                                        'min-w-[160px] whitespace-nowrap border-l border-border text-center align-middle transition-colors',
                                        isFocused ? 'bg-primary/5' : 'bg-background',
                                      )}
                                    >
                                      <div className="flex min-w-[140px] flex-col items-center gap-1 rounded-lg border border-dashed border-border/60 px-2 py-2 text-xs font-medium uppercase tracking-wide">
                                        <span className="text-sm font-semibold leading-tight">{role.name}</span>
                                        <span className="text-[11px] text-muted-foreground">このグループ {assignedCount} 件</span>
                                        <span className="text-[11px] text-muted-foreground">
                                          全体 {summary?.assignedCount ?? 0} / {totalPermissionCount}（
                                          {summary?.coverage ?? 0}
                                          %）
                                        </span>
                                        {changeCount > 0 && (
                                          <Badge variant="outline" className="border-blue-300 bg-blue-100 text-blue-700">
                                            未保存 {changeCount}
                                          </Badge>
                                        )}
                                        {(saving || refreshing) && (
                                          <Loader2 className="size-4 animate-spin text-muted-foreground" />
                                        )}
                                      </div>
                                    </TableHead>
                                  );
                                })}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {group.permissions.map((permission) => {
                                const rowIsDirty = changedPermissionCodes.has(permission.code);
                                return (
                                  <TableRow
                                    key={permission.code}
                                    className={cn(
                                      'group/permission-row align-top transition-colors',
                                      rowIsDirty ? 'bg-blue-50/30 hover:bg-blue-50/50' : 'bg-white hover:bg-gray-50',
                                    )}
                                  >
                                    <TableCell
                                      className={cn(
                                        'sticky left-0 z-10 border-r-2 border-border align-top shadow-[4px_0_6px_rgba(0,0,0,0.12)] transition-all',
                                        rowIsDirty ? 'bg-blue-50 group-hover/permission-row:bg-blue-100' : 'bg-white group-hover/permission-row:bg-gray-50',
                                        cellPadding,
                                      )}
                                    >
                                      <div className="flex flex-col gap-1">
                                        <span className={cn('font-medium leading-5', codeText)}>{permission.code}</span>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <Badge variant="outline" className="w-fit text-[10px] tracking-wider">
                                            {permission.permission_group}
                                          </Badge>
                                          {rowIsDirty && (
                                            <Badge variant="secondary" className="border-blue-300 bg-blue-100 text-blue-700">
                                              未保存
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell
                                      className={cn(
                                        'sticky z-10 border-r-2 border-border align-top text-muted-foreground shadow-[4px_0_6px_rgba(0,0,0,0.12)] transition-all',
                                        rowIsDirty ? 'bg-blue-50 group-hover/permission-row:bg-blue-100' : 'bg-white group-hover/permission-row:bg-gray-50',
                                        cellPadding,
                                        descriptionText,
                                      )}
                                      style={{ left: PERMISSION_DESCRIPTION_COLUMN_OFFSET }}
                                    >
                                      <p className="leading-relaxed">
                                        {permission.description || '説明が登録されていません'}
                                      </p>
                                    </TableCell>
                                    {visibleRoles.map((role) => {
                                      const state = roleStates[role.id];
                                      const checked = state ? state.draft.has(permission.code) : false;
                                      return (
                                        <TableCell
                                          key={role.id}
                                          className={cn(
                                            'align-top text-center transition-colors',
                                            rowIsDirty ? 'bg-blue-50/30 group-hover/permission-row:bg-blue-50/50' : 'bg-white group-hover/permission-row:bg-gray-50',
                                            cellPadding,
                                          )}
                                        >
                                          <div className={cn('flex items-center justify-center', checkboxMinHeight)}>
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
                                );
                              })}
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
    </>
  );
}
