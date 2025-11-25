'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertCircle,
  Loader2,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  Users,
  UserPlus,
} from 'lucide-react';

import {
  getViewerVisibilityAction,
  patchViewerVisibilityAction,
} from '@/api/server-actions/viewers';
import type {
  Department,
  UserDetailResponse,
  ViewerResourceType,
  ViewerSubjectType,
  ViewerVisibilityGrantItem,
  ViewerVisibilityResponse,
} from '@/api/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const RESOURCE_OPTIONS: { value: ViewerResourceType; label: string; description: string }[] = [
  { value: 'goal', label: '目標 (Goal)', description: '個別/指定対象の目標データへの参照を許可' },
  { value: 'evaluation', label: '評価 (Evaluation)', description: '評価シート・結果の参照を許可' },
  { value: 'assessment', label: '自己評価 (Assessment)', description: '自己評価データを閲覧可能にする' },
  { value: 'user', label: 'ユーザー (Profile)', description: 'プロフィール・基本情報の閲覧' },
  { value: 'department', label: '部門 (Dept)', description: '部門メタデータの閲覧' },
  { value: 'stage', label: 'ステージ (Stage)', description: 'キャリアステージ関連データを閲覧' },
];

const SUBJECT_TYPE_OPTIONS: { value: ViewerSubjectType; label: string; description: string }[] = [
  { value: 'user', label: 'ユーザー', description: '個別ユーザーを指名して付与' },
  { value: 'department', label: '部門', description: '部門単位ですべてのメンバーを付与' },
  { value: 'supervisor_team', label: 'チーム (上長)', description: '指定上長 + その配下をまとめて付与' },
];

const SUBJECT_BADGE_VARIANT: Record<ViewerSubjectType, string> = {
  user: 'bg-sky-100 text-sky-800 border-sky-200',
  department: 'bg-amber-100 text-amber-800 border-amber-200',
  supervisor_team: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

const RESOURCE_BADGE_VARIANT: Record<ViewerResourceType, string> = {
  goal: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  evaluation: 'bg-purple-100 text-purple-800 border-purple-200',
  assessment: 'bg-teal-100 text-teal-800 border-teal-200',
  user: 'bg-blue-100 text-blue-800 border-blue-200',
  department: 'bg-amber-100 text-amber-800 border-amber-200',
  stage: 'bg-rose-100 text-rose-800 border-rose-200',
};

const RESOURCE_TYPE_STORAGE_KEY = 'viewer-visibility-panel:resource-type';

const getStoredResourceType = (): ViewerResourceType => {
  if (typeof window === 'undefined') {
    return 'user';
  }
  const stored = window.localStorage.getItem(RESOURCE_TYPE_STORAGE_KEY) as ViewerResourceType | null;
  if (stored && RESOURCE_OPTIONS.some((option) => option.value === stored)) {
    return stored;
  }
  return 'user';
};

interface ViewerVisibilityPanelProps {
  users: UserDetailResponse[];
  departments: Department[];
  canEdit: boolean;
  guardError?: string;
}

type TargetOption = {
  id: string;
  label: string;
  description?: string;
};

export function ViewerVisibilityPanel({ users, departments, canEdit, guardError }: ViewerVisibilityPanelProps) {
  const viewerUsers = useMemo(
    () =>
      users
        .filter((user) => user.roles.some((role) => role.name?.toLowerCase() === 'viewer'))
        .sort((a, b) => a.name.localeCompare(b.name, 'ja')),
    [users],
  );

  const [selectedViewerId, setSelectedViewerId] = useState<string | null>(viewerUsers[0]?.id ?? null);
  const [resourceType, setResourceType] = useState<ViewerResourceType>(() => getStoredResourceType());
  const [subjectType, setSubjectType] = useState<ViewerSubjectType>('user');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<ViewerVisibilityResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);

  const userMap = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const departmentMap = useMemo(() => new Map(departments.map((dept) => [dept.id, dept])), [departments]);

  const supervisorCandidates = useMemo(() => {
    const preferredRoles = new Set(['manager', 'supervisor']);
    const scoped = users.filter((user) => user.roles.some((role) => preferredRoles.has(role.name.toLowerCase())));
    if (scoped.length > 0) {
      return scoped;
    }
    return users;
  }, [users]);

  const targetOptions: TargetOption[] = useMemo(() => {
    switch (subjectType) {
      case 'department':
        return departments.map((dept) => ({
          id: dept.id,
          label: dept.name,
          description: dept.description,
        }));
      case 'supervisor_team':
        return supervisorCandidates.map((user) => ({
          id: user.id,
          label: user.name,
          description: user.job_title || user.email,
        }));
      case 'user':
      default:
        return users.map((user) => ({
          id: user.id,
          label: user.name,
          description: user.email,
        }));
    }
  }, [subjectType, departments, supervisorCandidates, users]);

  const filteredTargetOptions = useMemo(() => {
    if (!searchQuery.trim()) {
      return targetOptions;
    }
    const lowered = searchQuery.toLowerCase();
    return targetOptions.filter(
      (option) =>
        option.label.toLowerCase().includes(lowered) ||
        option.description?.toLowerCase().includes(lowered),
    );
  }, [targetOptions, searchQuery]);

  const currentResourceGrants = useMemo(() => {
    if (!visibility) {
      return [] as ViewerVisibilityGrantItem[];
    }
    return visibility.grants.filter((grant) => grant.resource_type === resourceType);
  }, [visibility, resourceType]);

  const refreshViewerVisibility = useCallback(async () => {
    if (!selectedViewerId) {
      setVisibility(null);
      return;
    }
    setIsLoading(true);
    setPanelError(null);
    try {
      const response = await getViewerVisibilityAction(selectedViewerId);
      if (!response.success || !response.data) {
        setVisibility(null);
        setPanelError(response.error || '可視性情報の取得に失敗しました。');
        return;
      }
      setVisibility(response.data);
    } catch (error) {
      console.error('Failed to load viewer visibility', error);
      setPanelError('可視性情報の取得中にエラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  }, [selectedViewerId]);

  useEffect(() => {
    setSelectedTargets([]);
    setSearchQuery('');
  }, [subjectType, resourceType, selectedViewerId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(RESOURCE_TYPE_STORAGE_KEY, resourceType);
  }, [resourceType]);

  useEffect(() => {
    if (viewerUsers.length === 0) {
      setVisibility(null);
      setSelectedViewerId(null);
      return;
    }

    const exists = selectedViewerId && viewerUsers.some((viewer) => viewer.id === selectedViewerId);
    if (!selectedViewerId || !exists) {
      setSelectedViewerId(viewerUsers[0].id);
      return;
    }

    refreshViewerVisibility();
  }, [selectedViewerId, viewerUsers, refreshViewerVisibility]);

  const toggleTarget = useCallback((targetId: string) => {
    setSelectedTargets((prev) => (prev.includes(targetId) ? prev.filter((id) => id !== targetId) : [...prev, targetId]));
  }, []);

  const handleAddTargets = useCallback(async () => {
    if (!selectedViewerId || !visibility || selectedTargets.length === 0) {
      return;
    }
    setIsMutating(true);
    setPanelError(null);
    try {
      const response = await patchViewerVisibilityAction(selectedViewerId, {
        add: selectedTargets.map((targetId) => ({
          subject_type: subjectType,
          subject_id: targetId,
          resource_type: resourceType,
        })),
        version: visibility.version,
      });

      if (!response.success || !response.data) {
        const errorMessage = response.error || '付与の更新に失敗しました。';
        setPanelError(errorMessage);
        toast.error(errorMessage);
        if (errorMessage.toLowerCase().includes('409')) {
          await refreshViewerVisibility();
        }
        return;
      }

      toast.success('ビューアーの可視性を更新しました。');
      setVisibility(response.data);
      setSelectedTargets([]);
    } catch (error) {
      console.error('Failed to add viewer overrides', error);
      const errorMessage = '付与の更新中にエラーが発生しました。';
      setPanelError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsMutating(false);
    }
  }, [selectedViewerId, visibility, selectedTargets, subjectType, resourceType, refreshViewerVisibility]);

  const handleRemoveGrant = useCallback(
    async (grant: ViewerVisibilityGrantItem) => {
      if (!selectedViewerId || !visibility) {
        return;
      }
      setIsMutating(true);
      setPanelError(null);
      try {
        const response = await patchViewerVisibilityAction(selectedViewerId, {
          remove: [
            {
              subject_type: grant.subject_type,
              subject_id: grant.subject_id,
              resource_type: grant.resource_type,
            },
          ],
          version: visibility.version,
        });

        if (!response.success || !response.data) {
          const errorMessage = response.error || '削除に失敗しました。';
          setPanelError(errorMessage);
          toast.error(errorMessage);
          if (errorMessage.toLowerCase().includes('409')) {
            await refreshViewerVisibility();
          }
          return;
        }

        toast.success('対象から削除しました。');
        setVisibility(response.data);
      } catch (error) {
        console.error('Failed to remove viewer override', error);
        const errorMessage = '削除中にエラーが発生しました。';
        setPanelError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsMutating(false);
      }
    },
    [selectedViewerId, visibility, refreshViewerVisibility],
  );

  const resolveTargetLabel = useCallback(
    (grant: ViewerVisibilityGrantItem): string => {
      switch (grant.subject_type) {
        case 'user':
          return userMap.get(grant.subject_id)?.name ?? `ユーザー (${grant.subject_id.slice(0, 6)}…)`;
        case 'department':
          return departmentMap.get(grant.subject_id)?.name ?? `部門 (${grant.subject_id.slice(0, 6)}…)`;
        case 'supervisor_team':
          return `${userMap.get(grant.subject_id)?.name ?? '上長'} のチーム`;
        default:
          return grant.subject_id;
      }
    },
    [userMap, departmentMap],
  );

  const canModify = canEdit && !guardError;
  const viewerUnavailable = viewerUsers.length === 0;

  return (
    <Card className="border-primary/30 shadow-sm">
      <CardHeader className="space-y-2 border-b border-border/60">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Users className="h-5 w-5 text-primary" />
              Viewer 可視性上書き
            </CardTitle>
            <CardDescription>Viewer ロールに対して、追加で閲覧可能な対象とデータ種別を設定します。</CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={selectedViewerId ?? ''} onValueChange={(value) => setSelectedViewerId(value || null)}>
              <SelectTrigger className="w-56" disabled={viewerUnavailable}>
                <SelectValue placeholder={viewerUnavailable ? 'Viewer ユーザーが存在しません' : 'Viewer を選択'} />
              </SelectTrigger>
              <SelectContent>
                {viewerUsers.map((viewer) => (
                  <SelectItem key={viewer.id} value={viewer.id}>
                    {viewer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={refreshViewerVisibility} disabled={!selectedViewerId || isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              再読込
            </Button>
          </div>
        </div>
        {!canModify && (
          <Alert variant="default" className="border-primary/30 bg-primary/5 text-primary">
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>読み取り専用モード</AlertTitle>
            <AlertDescription>
              {guardError ?? '管理者権限を持つユーザーのみ Viewer 可視性を更新できます。'}
            </AlertDescription>
          </Alert>
        )}
        {panelError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>エラー</AlertTitle>
            <AlertDescription>{panelError}</AlertDescription>
          </Alert>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {viewerUnavailable ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 py-10 text-center text-sm">
            <ShieldAlert className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-semibold">Viewer ロールのユーザーが見つかりません</p>
              <p className="text-muted-foreground">Viewer を作成すると、このパネルで可視性を細かく制御できます。</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3 rounded-lg border border-border/60 p-4">
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">データ種別</p>
                  <p className="text-xs text-muted-foreground">
                    付与対象はリソースごとに分かれます。リソースを切り替えると対象リストが切り替わります。
                  </p>
                </div>
                <Select value={resourceType} onValueChange={(value) => setResourceType(value as ViewerResourceType)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESOURCE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex flex-col">
                          <span>{option.label}</span>
                          <span className="text-xs text-muted-foreground">{option.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3 rounded-lg border border-border/60 p-4">
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">対象タイプ</p>
                  <p className="text-xs text-muted-foreground">ユーザー / 部門 / 上長チームから対象をまとめて選択できます。</p>
                </div>
                <Select value={subjectType} onValueChange={(value) => setSubjectType(value as ViewerSubjectType)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBJECT_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex flex-col">
                          <span>{option.label}</span>
                          <span className="text-xs text-muted-foreground">{option.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-border/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">対象を検索して追加</p>
                  <p className="text-xs text-muted-foreground">チェックした対象に {RESOURCE_OPTIONS.find((item) => item.value === resourceType)?.label ?? resourceType} の閲覧権限を付与します。</p>
                </div>
                <Button
                  size="sm"
                  disabled={!canModify || selectedTargets.length === 0 || !selectedViewerId || isMutating}
                  onClick={handleAddTargets}
                >
                  {isMutating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                  追加する ({selectedTargets.length})
                </Button>
              </div>
              <Input
                placeholder="名前・メール・コードで検索"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="h-9"
              />
              <ScrollArea className="h-56 rounded-md border border-dashed border-border/60">
                <div className="divide-y">
                  {filteredTargetOptions.length === 0 ? (
                    <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
                      該当する候補がありません。
                    </div>
                  ) : (
                    filteredTargetOptions.map((option) => (
                      <label
                        key={option.id}
                        className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/40"
                      >
                        <Checkbox
                          checked={selectedTargets.includes(option.id)}
                          onCheckedChange={() => toggleTarget(option.id)}
                          disabled={!canModify}
                        />
                        <div className="flex flex-col">
                          <span className="font-medium">{option.label}</span>
                          {option.description && (
                            <span className="text-xs text-muted-foreground">{option.description}</span>
                          )}
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>

            <div className="rounded-lg border border-border/60">
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">現在の付与対象</p>
                  <p className="text-xs text-muted-foreground">{RESOURCE_OPTIONS.find((item) => item.value === resourceType)?.label ?? resourceType}</p>
                </div>
                <Badge className={cn('border', RESOURCE_BADGE_VARIANT[resourceType])}>対象 {currentResourceGrants.length}</Badge>
              </div>
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  読み込み中...
                </div>
              ) : currentResourceGrants.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <ShieldAlert className="h-6 w-6" />
                  <p>このリソースには追加の可視性が設定されていません。</p>
                </div>
              ) : (
                <div className="divide-y">
                  {currentResourceGrants.map((grant) => (
                    <div key={`${grant.subject_type}-${grant.subject_id}`} className="flex items-center justify-between px-4 py-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={cn('border px-2 py-0', SUBJECT_BADGE_VARIANT[grant.subject_type])}>
                            {SUBJECT_TYPE_OPTIONS.find((item) => item.value === grant.subject_type)?.label ?? grant.subject_type}
                          </Badge>
                          <span className="text-sm font-medium">{resolveTargetLabel(grant)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          付与日 {new Date(grant.created_at).toLocaleString('ja-JP')} / ID {grant.subject_id.slice(0, 8)}...
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!canModify || isMutating}
                        onClick={() => handleRemoveGrant(grant)}
                        className="text-destructive hover:text-destructive"
                      >
                        削除
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              ※ 変更は即時反映され、キャッシュは 5 秒以内に自動的に無効化されます。
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
