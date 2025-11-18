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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, Send } from 'lucide-react';

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

  useEffect(() => {
    const loadContext = async () => {
      setLoading(true);
      const result = await getSelfAssessmentContextAction();
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

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!context) {
    return null;
  }

  const getBucketWeight = (bucket: string) => {
    return stageWeights[bucket as keyof typeof stageWeights] ?? 0;
  };

  const bucketDisabled = (bucket: string) => getBucketWeight(bucket) === 0 || readOnly;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">自己評価</h1>
          <p className="text-sm text-muted-foreground">
            ステージ配分: Q{stageWeights.quantitative}% / Qa{stageWeights.qualitative}% / C{stageWeights.competency}%
          </p>
          {lastSavedAt && (
            <p className="text-xs text-muted-foreground mt-1">下書き保存: {lastSavedAt}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSaveDraft} disabled={saving || submitting || readOnly}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} <Save className="h-4 w-4 mr-1" /> 下書き保存
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || readOnly}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} <Send className="h-4 w-4 mr-1" /> 提出
          </Button>
        </div>
      </div>

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

      <div className="grid gap-4">
        {context.goals.map(goal => {
          const entry = entries.find(e => e.goalId === goal.id);
          const weight = getBucketWeight(goal.goalCategory);
          return (
            <Card key={goal.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{goal.goalCategory}</span>
                  <span className="text-sm text-muted-foreground">重み {weight}%</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-48">
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
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
