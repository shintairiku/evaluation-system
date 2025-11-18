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

type DraftEntryState = SelfAssessmentDraftEntry;

const ratingOptions = ['SS', 'S', 'A+', 'A', 'A-', 'B', 'C', 'D'];

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
      setLoading(false);
    };

    loadContext();
  }, []);

  const stageWeights = useMemo(() => context?.stageWeights ?? { quantitative: 0, qualitative: 0, competency: 0 }, [context]);
  const readOnly = Boolean(summary);

  const handleRatingChange = (goalId: string, bucket: string, ratingCode?: string) => {
    setEntries(prev =>
      prev.map(entry =>
        entry.goalId === goalId
          ? {
              ...entry,
              bucket,
              ratingCode,
            }
          : entry
      )
    );
  };

  const handleCommentChange = (goalId: string, comment: string) => {
    setEntries(prev =>
      prev.map(entry => (entry.goalId === goalId ? { ...entry, comment } : entry))
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
          <Button variant="outline" onClick={handleSaveDraft} disabled={saving || submitting || readOnly || !hasContext}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} <Save className="h-4 w-4 mr-1" /> 下書き保存
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || readOnly || !hasContext}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} <Send className="h-4 w-4 mr-1" /> 提出
          </Button>
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
                {context.goals.filter(g => g.goalCategory === '業績目標').map(goal => {
                  const entry = entries.find(e => e.goalId === goal.id);
                  const goalWeight = goal.weight ?? 0;
                  const goalTitle = (goal as any).targetData?.title || goal.goalCategory;
                  return (
                    <div key={goal.id} className="rounded-lg border px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium text-primary-foreground/80">
                          {goalTitle}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Weight className="h-3 w-3" />
                          {goalWeight}%
                        </div>
                      </div>
                      <div className="flex flex-col gap-3 md:flex-row md:items-start">
                        <div className="w-full md:w-48">
                          <Select
                            value={entry?.ratingCode || ''}
                            onValueChange={value => handleRatingChange(goal.id, goal.goalCategory, value)}
                            disabled={bucketDisabled(goal.goalCategory)}
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
                        <div className="flex-1">
                          <Textarea
                            placeholder="コメント (任意、500文字まで)"
                            value={entry?.comment || ''}
                            onChange={e => handleCommentChange(goal.id, e.target.value)}
                            disabled={readOnly}
                            maxLength={500}
                            className="min-h-[100px]"
                          />
                          <div className="text-right text-xs text-muted-foreground">
                            {(entry?.comment?.length ?? 0)}/500
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
                {context.goals.filter(g => g.goalCategory === 'コンピテンシー').map(goal => {
                  const entry = entries.find(e => e.goalId === goal.id);
                  const goalWeight = goal.weight ?? 0;
                  const goalTitle = (goal as any).targetData?.title || goal.goalCategory;
                  return (
                    <div key={goal.id} className="rounded-lg border px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium text-primary-foreground/80">
                          {goalTitle}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Weight className="h-3 w-3" />
                          {goalWeight}%
                        </div>
                      </div>
                      <div className="flex flex-col gap-3 md:flex-row md:items-start">
                        <div className="w-full md:w-48">
                          <Select
                            value={entry?.ratingCode || ''}
                            onValueChange={value => handleRatingChange(goal.id, goal.goalCategory, value)}
                            disabled={bucketDisabled(goal.goalCategory)}
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
                        <div className="flex-1">
                          <Textarea
                            placeholder="コメント (任意、500文字まで)"
                            value={entry?.comment || ''}
                            onChange={e => handleCommentChange(goal.id, e.target.value)}
                            disabled={readOnly}
                            maxLength={500}
                            className="min-h-[100px]"
                          />
                          <div className="text-right text-xs text-muted-foreground">
                            {(entry?.comment?.length ?? 0)}/500
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
    </div>
  );
}
