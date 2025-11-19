'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getSelfAssessmentContextAction,
  saveSelfAssessmentDraftAction,
  submitSelfAssessmentFormAction,
} from '@/api/server-actions/self-assessment-forms';
import type {
  SelfAssessmentContext,
  SelfAssessmentDraftEntry,
  SelfAssessmentSummary,
} from '@/api/types';
import { getCategorizedEvaluationPeriodsAction } from '@/api/server-actions/evaluation-periods';
import type { EvaluationPeriod } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, Send, Weight } from 'lucide-react';
import { EvaluationPeriodSelector } from '@/components/evaluation/EvaluationPeriodSelector';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCompetencyNames } from '@/hooks/evaluation/useCompetencyNames';
import { useIdealActionsResolver } from '@/hooks/evaluation/useIdealActionsResolver';
import { Label } from '@/components/ui/label';
import { GoalStatusBadge } from '@/components/evaluation/GoalStatusBadge';
import { useAutoSave } from '@/hooks/useAutoSave';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

type DraftEntryState = SelfAssessmentDraftEntry;

const ratingOptions = ['SS', 'S', 'A+', 'A', 'A-', 'B', 'C', 'D'];

interface GoalDetailsCardProps {
  goal: any;
}

const GoalDetailsCard = ({ goal }: GoalDetailsCardProps) => {
  const data = goal.targetData || {};
  const isCompetency = goal.goalCategory === 'コンピテンシー';

  const title = data.title || data.goal_title || goal.goalCategory;
  const content = data.means_methods_text || data.goal_description || data.goalDetail || '';
  const criteria = data.achievement_criteria_text || data.achievementCriteriaText || '';
  const method = data.action_plan || data.actionPlan || data.means_methods_text || '';

  const competencyIds = useMemo(() => {
    const ids =
      goal.competencyIds ||
      data.competency_ids ||
      data.competencyIds ||
      data.competency_ids_array ||
      [];
    return Array.isArray(ids) ? ids : [];
  }, [goal]);

  const idealActions = useMemo(() => {
    const raw =
      data.selected_ideal_actions || data.selectedIdealActions || data.ideal_actions || {};
    return raw && typeof raw === 'object' ? raw : {};
  }, [goal]);

  const { competencyNames, loading: competencyLoading } = useCompetencyNames(
    isCompetency ? competencyIds : null
  );
  const { resolvedActions, loading: idealActionsLoading } = useIdealActionsResolver(
    isCompetency ? idealActions : null,
    competencyIds
  );

  return (
    <div className="rounded-xl border px-4 py-4 bg-card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {goal.submittedAt && (
            <span className="text-xs text-muted-foreground">
              提出日: {new Date(goal.submittedAt).toLocaleDateString('ja-JP')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {goal.status === 'approved' && (
            <span className="rounded-full bg-primary/80 px-3 py-1 text-white">承認済み</span>
          )}
          <div className="flex items-center gap-1">
            <Weight className="h-4 w-4" />
            {goal.weight ?? 0}%
          </div>
        </div>
      </div>

      {isCompetency ? (
        <div className="grid gap-3 text-sm">
          <div className="rounded-md bg-muted px-3 py-2">
            <div className="text-xs font-semibold text-foreground">選択したコンピテンシー</div>
            <div className="text-muted-foreground">
              {competencyLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> 読み込み中...
                </div>
              ) : competencyNames.length > 0 ? (
                competencyNames.join(', ')
              ) : competencyIds.length > 0 ? (
                competencyIds.join(', ')
              ) : (
                '記載なし'
              )}
            </div>
          </div>
          <div className="rounded-md bg-muted px-3 py-2">
            <div className="text-xs font-semibold text-foreground">理想的な行動</div>
            <div className="text-muted-foreground">
              {idealActionsLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> 読み込み中...
                </div>
              ) : resolvedActions && resolvedActions.length > 0 ? (
                <ul className="list-disc list-inside space-y-1">
                  {resolvedActions.map((resolved, idx) => (
                    <li key={idx}>
                      <span className="font-medium">{resolved.competencyName}</span>
                      {resolved.actions.length > 0 && (
                        <ul className="list-disc list-inside ml-4">
                          {resolved.actions.map((action, actionIdx) => (
                            <li key={actionIdx}>{action}</li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              ) : idealActions && Object.keys(idealActions).length > 0 ? (
                <ul className="list-disc list-inside space-y-1">
                  {Object.entries(idealActions).map(([key, actions]) => (
                    <li key={key}>
                      <span className="font-medium">{key}</span>
                      {Array.isArray(actions) && actions.length > 0 && (
                        <ul className="list-disc list-inside ml-4">
                          {actions.map((action, idx) => (
                            <li key={idx}>{action}</li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                '記載なし'
              )}
            </div>
          </div>
          <div className="rounded-md bg-muted px-3 py-2">
            <div className="text-xs font-semibold text-foreground">行動計画</div>
            <div className="text-muted-foreground whitespace-pre-wrap">{method || '記載なし'}</div>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 text-sm">
          <div className="rounded-md bg-muted px-3 py-2">
            <div className="text-xs font-semibold text-foreground">目標タイトル</div>
            <div className="text-muted-foreground">{title || '記載なし'}</div>
          </div>
          <div className="rounded-md bg-muted px-3 py-2">
            <div className="text-xs font-semibold text-foreground">具体的な目標内容</div>
            <div className="text-muted-foreground">{content || '記載なし'}</div>
          </div>
          <div className="rounded-md bg-muted px-3 py-2">
            <div className="text-xs font-semibold text-foreground">達成基準</div>
            <div className="text-muted-foreground whitespace-pre-wrap">{criteria || '記載なし'}</div>
          </div>
          <div className="rounded-md bg-muted px-3 py-2">
            <div className="text-xs font-semibold text-foreground">方法</div>
            <div className="text-muted-foreground whitespace-pre-wrap">{method || '記載なし'}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function SelfAssessmentPage() {
  const [context, setContext] = useState<SelfAssessmentContext | null>(null);
  const [entries, setEntries] = useState<DraftEntryState[]>([]);
  const [summary, setSummary] = useState<SelfAssessmentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | undefined>(undefined);
  const [periods, setPeriods] = useState<EvaluationPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | undefined>(undefined);
  const [bucketRatings, setBucketRatings] = useState<Record<string, string>>({});
  const [bucketComments, setBucketComments] = useState<Record<string, string>>({});
  const [savedIndicatorVisible, setSavedIndicatorVisible] = useState(false);
  const saveIndicatorTimeout = useRef<NodeJS.Timeout | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    const loadContext = async (periodId?: string) => {
      setLoading(true);
      const periodResp = await getCategorizedEvaluationPeriodsAction();
      if (periodResp.success && periodResp.data) {
        const all = periodResp.data.all || [];
        setPeriods(all);
        if (!periodId) {
          const resolved = periodResp.data.current?.id || all[0]?.id;
          setSelectedPeriodId(resolved);
          periodId = resolved;
        }
      }

      const result = await getSelfAssessmentContextAction(periodId);
      if (!result.success || !result.data) {
        setError(result.error || '自己評価データの取得に失敗しました');
        setLoading(false);
        return;
      }
      setError(null);
      // Normalize draft entries (pydantic objects may expose snake_case)
      const normalizedDraft = (result.data.draft ?? [])
        .map(entry => ({
          goalId: `${entry.goalId ?? entry.goal_id ?? entry.goalid ?? ''}`,
          bucket: entry.bucket,
          ratingCode: entry.ratingCode ?? entry.rating_code,
          comment: entry.comment ?? '',
        }))
        .filter(entry => Boolean(entry.bucket));

      setContext(result.data);
      setSummary(result.data.summary ?? null);

      const initialDraft =
        normalizedDraft.length > 0
          ? normalizedDraft
          : result.data.goals.map(goal => ({
              goalId: goal.id,
              bucket: goal.goalCategory,
              ratingCode: undefined,
              comment: '',
            }));
      setEntries(initialDraft);

      const ratings: Record<string, string> = {};
      const comments: Record<string, string> = {};

      // Use draft entries directly for bucket values
      for (const entry of normalizedDraft) {
        if (!entry.bucket) continue;
        if (entry.ratingCode && !ratings[entry.bucket]) {
          ratings[entry.bucket] = entry.ratingCode;
        }
        if (!comments[entry.bucket]) {
          comments[entry.bucket] = entry.comment ?? '';
        }
      }

      // Fallback: if still empty, derive from goals/initialDraft
      if (Object.keys(ratings).length === 0 || Object.keys(comments).length === 0) {
        for (const goal of result.data.goals) {
          const bucket = goal.goalCategory;
          const entry = initialDraft.find(e => e.goalId === goal.id);
          if (entry?.ratingCode && !ratings[bucket]) {
            ratings[bucket] = entry.ratingCode;
          }
          if (entry && !comments[bucket]) {
            comments[bucket] = entry.comment ?? '';
          }
        }
      }

      setBucketRatings(ratings);
      setBucketComments(comments);
      setLoading(false);
    };

    loadContext();
  }, []);

  const stageWeights = useMemo(() => context?.stageWeights ?? { quantitative: 0, qualitative: 0, competency: 0 }, [context]);

  // Use context.summary as the source of truth for submitted status
  const currentSummary = summary || context?.summary || null;
  const readOnly = Boolean(currentSummary);

  // Debug logging
  console.log('🔍 Debug Self-Assessment Status:', {
    selectedPeriodId,
    hasLocalSummary: Boolean(summary),
    hasContextSummary: Boolean(context?.summary),
    currentSummary: currentSummary ? 'EXISTS' : 'NULL',
    readOnly,
    contextSummaryData: context?.summary,
    summaryPeriodId: context?.summary?.submittedAt, // Check if we can see the period
  });

  const applyBucketRating = (bucketCategory: string, ratingCode?: string) => {
    setBucketRatings(prev => ({ ...prev, [bucketCategory]: ratingCode || '' }));
    setEntries(prev =>
      prev.map(entry =>
        entry.bucket === bucketCategory
          ? {
              ...entry,
              ratingCode,
            }
          : entry
      )
    );
  };

  const applyBucketComment = (bucketCategory: string, comment: string) => {
    setBucketComments(prev => ({ ...prev, [bucketCategory]: comment }));
    setEntries(prev =>
      prev.map(entry =>
        entry.bucket === bucketCategory
          ? {
              ...entry,
              comment,
            }
          : entry
      )
    );
  };

  const persistDraft = async () => {
    const payload = entries.map(entry => ({
      goalId: entry.goalId,
      bucket: entry.bucket,
      ratingCode: entry.ratingCode,
      comment: entry.comment ?? null,
    }));

    setSaving(true);
    try {
      const result = await saveSelfAssessmentDraftAction(payload);
      if (!result.success) {
        setError(result.error || '下書き保存に失敗しました');
        return false;
      }
      setError(null);
      setLastSavedAt(result.updatedAt);
      if (saveIndicatorTimeout.current) {
        clearTimeout(saveIndicatorTimeout.current);
      }
      setSavedIndicatorVisible(true);
      saveIndicatorTimeout.current = setTimeout(() => setSavedIndicatorVisible(false), 3000);
      return true;
    } catch (err) {
      setError('下書き保存に失敗しました');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    await persistDraft();
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const result = await submitSelfAssessmentFormAction(entries);
    if (!result.success || !result.data) {
      setError(result.error || '提出に失敗しました');
      setSubmitting(false);
      return;
    }
    setError(null);
    setSummary(result.data);
    setSubmitting(false);
  };
  const handleRequestSubmit = () => {
    setConfirmOpen(true);
  };
  const handleConfirmSubmit = async () => {
    setConfirmOpen(false);
    await handleSubmit();
  };

  const hasContext = Boolean(context);
  const autoSaveEnabled = hasContext && !readOnly;
  const autoSaveReady = hasContext && !loading;

  // Derive bucket rating/comment from entries whenever they change (keeps UI in sync after reload).
  useEffect(() => {
    if (!entries || entries.length === 0) return;
    const ratings: Record<string, string> = {};
    const comments: Record<string, string> = {};
    for (const entry of entries) {
      if (entry.ratingCode && !ratings[entry.bucket]) {
        ratings[entry.bucket] = entry.ratingCode;
      }
      if (!comments[entry.bucket]) {
        comments[entry.bucket] = entry.comment ?? '';
      }
    }
    setBucketRatings(ratings);
    setBucketComments(comments);
  }, [entries]);

  useAutoSave({
    data: entries,
    dataKey: { period: selectedPeriodId, entries },
    onSave: persistDraft,
    delay: 2000,
    enabled: autoSaveEnabled,
    autoSaveReady,
  });

  useEffect(() => {
    return () => {
      if (saveIndicatorTimeout.current) {
        clearTimeout(saveIndicatorTimeout.current);
      }
    };
  }, []);

  const performanceCategory = useMemo(() => {
    const keys = Object.keys(bucketRatings);
    const byBucket = keys.find(k => k.includes('業績'));
    if (byBucket) return byBucket;
    return context?.goals.find(g => g.goalCategory?.includes('業績'))?.goalCategory || '業績目標';
  }, [bucketRatings, context]);

  const competencyCategory = useMemo(() => {
    const keys = Object.keys(bucketRatings);
    const byBucket = keys.find(k => k.includes('コンピテンシー'));
    if (byBucket) return byBucket;
    return context?.goals.find(g => g.goalCategory?.includes('コンピテンシー'))?.goalCategory || 'コンピテンシー';
  }, [bucketRatings, context]);

  const confirmItems = useMemo(
    () => [
      {
        title: performanceCategory,
        rating: bucketRatings[performanceCategory] || '未選択',
        comment: bucketComments[performanceCategory] || '—',
      },
      {
        title: competencyCategory,
        rating: bucketRatings[competencyCategory] || '未選択',
        comment: bucketComments[competencyCategory] || '—',
      },
    ],
    [performanceCategory, competencyCategory, bucketRatings, bucketComments]
  );

  const isSubmitted = Boolean(currentSummary);
  const bucketStatus = isSubmitted ? 'submitted' : 'draft';

  // Re-hydrate bucket ratings/comments if context.draft changes (e.g., after reload)
  useEffect(() => {
    if (!context?.draft || context.draft.length === 0) return;
    const ratings: Record<string, string> = {};
    const comments: Record<string, string> = {};
        for (const entry of context.draft) {
          const bucket = (entry as any).bucket;
          if (!bucket) continue;
          const ratingCode = (entry as any).ratingCode ?? (entry as any).rating_code;
          const comment = (entry as any).comment ?? '';
          if (ratingCode && !ratings[bucket]) ratings[bucket] = ratingCode;
          if (!comments[bucket]) comments[bucket] = comment;
        }
    setBucketRatings(prev => ({ ...ratings, ...prev }));
    setBucketComments(prev => ({ ...comments, ...prev }));
  }, [context?.draft]);

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-10 w-48" />
        </div>

        <div className="space-y-4">
          {[1, 2].map(idx => (
            <Card key={idx}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-5 w-16" />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-4 w-16 ml-auto" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Render base layout even when error/context missing so the period selector appears
  const activePeriod = periods.find(p => p.id === selectedPeriodId) || null;

  const getBucketWeight = (category: string) => {
    if (category.includes('業績')) {
      return (stageWeights.quantitative ?? 0) + (stageWeights.qualitative ?? 0);
    }
    if (category.includes('コンピテンシー')) {
      return stageWeights.competency ?? 0;
    }
    return 0;
  };

  const bucketDisabled = (category: string) => getBucketWeight(category) === 0 || readOnly;

  const handlePeriodChange = (nextPeriodId: string) => {
    setSelectedPeriodId(nextPeriodId);
    setContext(null);
    setEntries([]);
    setSummary(null);
    setError(null);
    setLoading(true);
    getSelfAssessmentContextAction(nextPeriodId).then(result => {
      if (!result.success || !result.data) {
        setError(result.error || '自己評価データの取得に失敗しました');
      } else {
        setContext(result.data);
        setSummary(result.data.summary ?? null);
        const initialDraft =
          result.data.draft && result.data.draft.length > 0
            ? result.data.draft
            : result.data.goals.map(goal => ({
                goalId: goal.id,
                bucket: goal.goalCategory,
                ratingCode: undefined,
                comment: undefined,
              }));
        setEntries(initialDraft);
      }
      setLoading(false);
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">自己評価</h1>
          {hasContext && (
            <p className="text-sm text-muted-foreground">
              ステージ配分: Q{stageWeights.quantitative}% / Qa{stageWeights.qualitative}% / C{stageWeights.competency}%
            </p>
          )}
          {lastSavedAt && (
            <p className="text-xs text-muted-foreground mt-1">
              下書き保存: {new Date(lastSavedAt).toLocaleString('ja-JP', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          )}
        </div>
        <div className="flex gap-2 items-center">
          <EvaluationPeriodSelector
            periods={periods}
            selectedPeriodId={selectedPeriodId || ''}
            currentPeriodId={activePeriod?.id || null}
            onPeriodChange={handlePeriodChange}
            isLoading={false}
          />
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {currentSummary && (
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle>提出済みサマリー</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>総合評価: <strong>{currentSummary.finalRating}</strong> （{currentSummary.weightedTotal.toFixed(2)} 点）</p>
            <p>フラグ: {currentSummary.flags?.fail ? 'Fail (MBO D)' : 'なし'}</p>
            {currentSummary.levelAdjustmentPreview && (
              <p>レベル調整: {currentSummary.levelAdjustmentPreview.delta ?? 0}</p>
            )}
          </CardContent>
        </Card>
      )}

      {hasContext ? (
        context.goals.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              承認済みの目標がありません。目標が承認されると自己評価を入力できます。
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Performance goals bucket (定量＋定性) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{performanceCategory}（定量＋定性）</span>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <GoalStatusBadge status={bucketStatus} />
                    <span className="flex items-center gap-1">
                      <Weight className="h-4 w-4" />
                      {stageWeights.quantitative + stageWeights.qualitative}%
                    </span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  {context.goals
                    .filter(g => g.goalCategory === performanceCategory)
                    .map(goal => (
                      <GoalDetailsCard key={goal.id} goal={goal} />
                    ))}
                </div>

                <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-sm font-semibold">このカテゴリの自己評価</Label>
                      <p className="text-xs text-muted-foreground">1つ選択してください。コメントは任意です。</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[11px] rounded bg-primary/10 px-2 py-1 text-primary">必須</span>
                      {saving ? (
                        <span className="text-[11px] text-blue-500 flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          保存中...
                        </span>
                      ) : savedIndicatorVisible ? (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <span aria-hidden="true">✓</span> 一時保存済み
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="w-full md:w-64">
                    <Select
                      value={bucketRatings[performanceCategory] || ''}
                      onValueChange={value => applyBucketRating(performanceCategory, value)}
                      disabled={bucketDisabled(performanceCategory)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="評価を選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {ratingOptions.map(option => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">コメント (任意、500文字まで)</Label>
                    <Textarea
                      placeholder="例）数値目標に対する自己評価の理由を記載"
                      value={bucketComments[performanceCategory] || ''}
                      onChange={e => applyBucketComment(performanceCategory, e.target.value)}
                      disabled={readOnly}
                      maxLength={500}
                      className="min-h-[100px]"
                    />
                    <div className="text-right text-[11px] text-muted-foreground">
                      {(bucketComments[performanceCategory]?.length ?? 0)}/500
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Competency bucket */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{competencyCategory}</span>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <GoalStatusBadge status={bucketStatus} />
                    <span className="flex items-center gap-1">
                      <Weight className="h-4 w-4" />
                      {stageWeights.competency}%
                    </span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  {context.goals
                    .filter(g => g.goalCategory === competencyCategory)
                    .map(goal => (
                      <GoalDetailsCard key={goal.id} goal={goal} />
                    ))}
                </div>

                <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-sm font-semibold">このカテゴリの自己評価</Label>
                      <p className="text-xs text-muted-foreground">1つ選択してください。コメントは任意です。</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[11px] rounded bg-primary/10 px-2 py-1 text-primary">必須</span>
                      {saving ? (
                        <span className="text-[11px] text-blue-500 flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          保存中...
                        </span>
                      ) : savedIndicatorVisible ? (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <span aria-hidden="true">✓</span> 一時保存済み
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="w-full md:w-64">
                    <Select
                      value={bucketRatings[competencyCategory] || ''}
                      onValueChange={value => applyBucketRating(competencyCategory, value)}
                      disabled={bucketDisabled(competencyCategory)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="評価を選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {ratingOptions.map(option => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">コメント (任意、500文字まで)</Label>
                    <Textarea
                      placeholder="例）行動事例や振り返りを記載"
                      value={bucketComments[competencyCategory] || ''}
                      onChange={e => applyBucketComment(competencyCategory, e.target.value)}
                      disabled={readOnly}
                      maxLength={500}
                      className="min-h-[100px]"
                    />
                    <div className="text-right text-[11px] text-muted-foreground">
                      {(bucketComments[competencyCategory]?.length ?? 0)}/500
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )
      ) : (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            評価期間を選択すると対象の目標と自己評価入力が表示されます。
          </CardContent>
        </Card>
      )}

      {hasContext && (
        <div className="flex flex-col items-end gap-1 pt-2">
          {saving ? (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              自動保存中...
            </div>
          ) : null}
          <Button onClick={handleRequestSubmit} disabled={submitting || readOnly || !hasContext}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} <Send className="h-4 w-4 mr-1" /> 提出
          </Button>
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>自己評価を提出しますか？</DialogTitle>
            <DialogDescription>選択した評価とコメントを確認してください。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {confirmItems.map(item => (
              <div key={item.title} className="rounded-md border bg-muted/40 p-3 space-y-1">
                <div className="text-sm font-semibold">{item.title}</div>
                <div className="text-sm">評価: <span className="font-medium">{item.rating}</span></div>
                <div className="text-sm">
                  コメント:
                  <div className="mt-1 whitespace-pre-wrap text-muted-foreground">{item.comment || '—'}</div>
                </div>
              </div>
            ))}
            <div className="text-xs text-red-600 border border-red-200 rounded-md bg-red-50 p-2">
              重要: 提出後は修正できません。内容を確認してください。
            </div>
          </div>
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleConfirmSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} 提出する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
