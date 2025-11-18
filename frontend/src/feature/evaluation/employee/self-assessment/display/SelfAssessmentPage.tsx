'use client';

import { useEffect, useMemo, useState } from 'react';
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

      // derive bucket-level rating/comment from the first goal of each bucket
      const ratings: Record<string, string> = {};
      const comments: Record<string, string> = {};
      for (const goal of result.data.goals) {
        const bucket = goal.goalCategory;
        const entry = initialDraft.find(e => e.goalId === goal.id);
        if (entry?.ratingCode && !ratings[bucket]) {
          ratings[bucket] = entry.ratingCode;
        }
        if (entry?.comment && !comments[bucket]) {
          comments[bucket] = entry.comment;
        }
      }
      setBucketRatings(ratings);
      setBucketComments(comments);
      setLoading(false);
    };

    loadContext();
  }, []);

  const stageWeights = useMemo(() => context?.stageWeights ?? { quantitative: 0, qualitative: 0, competency: 0 }, [context]);
  const readOnly = Boolean(summary);

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

  const handleSaveDraft = async () => {
    setSaving(true);
    const result = await saveSelfAssessmentDraftAction(entries);
    if (!result.success) {
      setError(result.error || '下書き保存に失敗しました');
    } else {
      setError(null);
      setLastSavedAt(result.updatedAt);
    }
    setSaving(false);
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

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>読み込み中...</span>
        </div>
      </div>
    );
  }

  // Render base layout even when error/context missing so the period selector appears
  const hasContext = Boolean(context);
  const activePeriod = periods.find(p => p.id === selectedPeriodId) || null;

  const mapCategoryToBucket = (category: string) => {
    if (category === '業績目標') return 'quantitative'; // default performance goals as quantitative
    if (category === 'コンピテンシー') return 'competency';
    return category;
  };

  const getBucketWeight = (category: string) => {
    const bucket = mapCategoryToBucket(category);
    return stageWeights[bucket as keyof typeof stageWeights] ?? 0;
  };

  const bucketDisabled = (bucket: string) => getBucketWeight(bucket) === 0 || readOnly;

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
            <p className="text-xs text-muted-foreground mt-1">下書き保存: {lastSavedAt}</p>
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

      {summary && (
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle>提出済みサマリー</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>総合評価: <strong>{summary.finalRating}</strong> （{summary.weightedTotal.toFixed(2)} 点）</p>
            <p>フラグ: {summary.flags?.fail ? 'Fail (MBO D)' : 'なし'}</p>
            {summary.levelAdjustmentPreview && (
              <p>レベル調整: {summary.levelAdjustmentPreview.delta ?? 0}</p>
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
                  <span>業績目標（定量＋定性）</span>
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Weight className="h-4 w-4" />
                    {stageWeights.quantitative + stageWeights.qualitative}%
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  {context.goals
                    .filter(g => g.goalCategory === '業績目標')
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
                    <span className="text-[11px] rounded bg-primary/10 px-2 py-1 text-primary">必須</span>
                  </div>
                  <div className="w-full md:w-64">
                    <Select
                      value={bucketRatings['業績目標'] || ''}
                      onValueChange={value => applyBucketRating('業績目標', value)}
                      disabled={bucketDisabled('業績目標')}
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
                      value={bucketComments['業績目標'] || ''}
                      onChange={e => applyBucketComment('業績目標', e.target.value)}
                      disabled={readOnly}
                      maxLength={500}
                      className="min-h-[100px]"
                    />
                    <div className="text-right text-[11px] text-muted-foreground">
                      {(bucketComments['業績目標']?.length ?? 0)}/500
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Competency bucket */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>コンピテンシー</span>
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Weight className="h-4 w-4" />
                    {stageWeights.competency}%
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  {context.goals
                    .filter(g => g.goalCategory === 'コンピテンシー')
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
                    <span className="text-[11px] rounded bg-primary/10 px-2 py-1 text-primary">必須</span>
                  </div>
                  <div className="w-full md:w-64">
                    <Select
                      value={bucketRatings['コンピテンシー'] || ''}
                      onValueChange={value => applyBucketRating('コンピテンシー', value)}
                      disabled={bucketDisabled('コンピテンシー')}
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
                      value={bucketComments['コンピテンシー'] || ''}
                      onChange={e => applyBucketComment('コンピテンシー', e.target.value)}
                      disabled={readOnly}
                      maxLength={500}
                      className="min-h-[100px]"
                    />
                    <div className="text-right text-[11px] text-muted-foreground">
                      {(bucketComments['コンピテンシー']?.length ?? 0)}/500
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
        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={handleSaveDraft}
            disabled={saving || submitting || readOnly || !hasContext}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} <Save className="h-4 w-4 mr-1" /> 下書き保存
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || readOnly || !hasContext}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} <Send className="h-4 w-4 mr-1" /> 提出
          </Button>
        </div>
      )}
    </div>
  );
}
