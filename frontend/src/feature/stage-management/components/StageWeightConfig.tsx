'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { Stage, StageWeightHistoryEntry } from '@/api/types';
import { updateStageWeightsAction, getStageWeightHistoryAction } from '@/api/server-actions/stages';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Info, Pencil, History } from 'lucide-react';
import StageWeightEditDialog, { StageWeightFormValues } from './StageWeightEditDialog';
import StageWeightHistoryDrawer from './StageWeightHistoryDrawer';

interface StageWeightConfigProps {
  stages: Stage[];
  onStageUpdated: (stage: Stage) => void;
}

export default function StageWeightConfig({
  stages,
  onStageUpdated,
}: StageWeightConfigProps) {
  const [editingStage, setEditingStage] = useState<Stage | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [historyStage, setHistoryStage] = useState<Stage | null>(null);
  const [historyEntries, setHistoryEntries] = useState<StageWeightHistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const handleOpenEdit = (stage: Stage) => {
    setEditingStage(stage);
    setIsEditDialogOpen(true);
  };

  const handleSaveWeights = async (values: StageWeightFormValues) => {
    if (!editingStage) return;
    setIsSaving(true);

    const response = await updateStageWeightsAction(editingStage.id, values);
    setIsSaving(false);
    if (!response.success || !response.data) {
      toast.error(response.error || 'ウェイトの更新に失敗しました');
      return;
    }

    toast.success('ウェイトを更新しました');
    onStageUpdated(response.data);
    setIsEditDialogOpen(false);
  };

  const handleOpenHistory = async (stage: Stage) => {
    setHistoryStage(stage);
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryError(null);

    const response = await getStageWeightHistoryAction(stage.id);
    setHistoryLoading(false);

    if (!response.success || !response.data) {
      setHistoryEntries([]);
      setHistoryError(response.error || '履歴の取得に失敗しました');
      return;
    }

    setHistoryEntries(response.data);
  };

  return (
    <>
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-2">
            <CardTitle>ステージ別ウェイト設定</CardTitle>
            <Badge variant="outline">β</Badge>
          </div>
          <CardDescription className="space-y-2">
            <p>
              各ステージの評価比率（定量・定性・コンピテンシー）を設定できます。変更すると新しいゴール作成時に自動で適用されます。
            </p>
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <Info className="h-4 w-4" />
              Stage 6 以上では定性目標の比率を 0% に設定できます。
            </p>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">ステージ</TableHead>
                  <TableHead className="text-right">定量</TableHead>
                  <TableHead className="text-right">定性</TableHead>
                  <TableHead className="text-right">コンピテンシー</TableHead>
                  <TableHead className="w-40 text-right">アクション</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stages.map((stage) => (
                  <TableRow key={stage.id}>
                    <TableCell>
                      <div className="font-medium">{stage.name}</div>
                      {stage.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {stage.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{formatWeight(stage.quantitativeWeight)}</TableCell>
                    <TableCell className="text-right">{formatWeight(stage.qualitativeWeight)}</TableCell>
                    <TableCell className="text-right">{formatWeight(stage.competencyWeight)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenEdit(stage)}
                        >
                          <Pencil className="h-4 w-4 mr-1" />
                          編集
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenHistory(stage)}
                        >
                          <History className="h-4 w-4 mr-1" />
                          履歴
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <StageWeightEditDialog
        stage={editingStage}
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setEditingStage(null);
          }
        }}
        onSubmit={handleSaveWeights}
        isSubmitting={isSaving}
      />

      <StageWeightHistoryDrawer
        stage={historyStage}
        open={historyOpen}
        onOpenChange={(open) => {
          setHistoryOpen(open);
          if (!open) {
            setHistoryStage(null);
            setHistoryEntries([]);
            setHistoryError(null);
          }
        }}
        entries={historyEntries}
        isLoading={historyLoading}
        error={historyError}
      />
    </>
  );
}

function formatWeight(value: number) {
  const normalized = Number(value ?? 0);
  const fixed = normalized % 1 === 0 ? normalized.toFixed(0) : normalized.toFixed(1);
  return `${fixed}%`;
}
