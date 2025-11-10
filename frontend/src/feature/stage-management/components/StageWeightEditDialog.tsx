'use client';

import { useEffect, useState } from 'react';
import type { Stage } from '@/api/types';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface StageWeightEditDialogProps {
  stage: Stage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: StageWeightFormValues) => Promise<void>;
  isSubmitting?: boolean;
}

export interface StageWeightFormValues {
  quantitativeWeight: number;
  qualitativeWeight: number;
  competencyWeight: number;
}

export default function StageWeightEditDialog({
  stage,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
}: StageWeightEditDialogProps) {
  const [form, setForm] = useState<StageWeightFormValues>({
    quantitativeWeight: 0,
    qualitativeWeight: 0,
    competencyWeight: 0,
  });

  useEffect(() => {
    if (stage && open) {
      setForm({
        quantitativeWeight: stage.quantitativeWeight,
        qualitativeWeight: stage.qualitativeWeight,
        competencyWeight: stage.competencyWeight,
      });
    }
  }, [stage, open]);

  const handleInputChange = (field: keyof StageWeightFormValues, value: string) => {
    const parsed = Number(value);
    setForm((prev) => ({
      ...prev,
      [field]: Number.isNaN(parsed) ? 0 : parsed,
    }));
  };

  const isValid = (value: number) => value >= 0 && value <= 100;
  const isFormValid =
    stage !== null &&
    isValid(form.quantitativeWeight) &&
    isValid(form.qualitativeWeight) &&
    isValid(form.competencyWeight);

  const handleSubmit = async () => {
    if (!stage) return;
    await onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>ステージウェイト編集</DialogTitle>
          <DialogDescription>
            {stage ? `${stage.name} の評価比率を設定します。各値は 0〜100 の範囲で入力してください。` : 'ステージを選択してください。'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <WeightInput
            id="quantitative-weight"
            label="定量 (Quantitative)"
            value={form.quantitativeWeight}
            onChange={(value) => handleInputChange('quantitativeWeight', value)}
            disabled={isSubmitting || !stage}
          />
          <WeightInput
            id="qualitative-weight"
            label="定性 (Qualitative)"
            value={form.qualitativeWeight}
            onChange={(value) => handleInputChange('qualitativeWeight', value)}
            disabled={isSubmitting || !stage}
          />
          <WeightInput
            id="competency-weight"
            label="コンピテンシー"
            value={form.competencyWeight}
            onChange={(value) => handleInputChange('competencyWeight', value)}
            disabled={isSubmitting || !stage}
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            キャンセル
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid || isSubmitting}
          >
            {isSubmitting ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface WeightInputProps {
  id: string;
  label: string;
  value: number;
  onChange: (value: string) => void;
  disabled?: boolean;
}

function WeightInput({ id, label, value, onChange, disabled }: WeightInputProps) {
  const displayValue = Number.isFinite(value) ? value : 0;

  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className="flex items-center justify-between">
        <span>{label}</span>
        <span className="text-xs text-muted-foreground">0〜100</span>
      </Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          min={0}
          max={100}
          step={1}
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
        <span className="text-muted-foreground text-sm">%</span>
      </div>
    </div>
  );
}
