'use client';

import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Calendar, AlertCircle } from 'lucide-react';
import { PERIOD_TYPE_LABELS, type PeriodType, type EvaluationPeriodFormData } from '@/api/types/evaluation-period';
import { calculateEndDate, formatDateToISO, parseDateFromISO } from '@/lib/evaluation-period-utils';
import { validateEvaluationPeriodForm, validateBusinessRules, hasValidationErrors } from '@/lib/evaluation-period-validation';
import type { CreateEditPeriodModalProps } from '../types';

export default function CreateEditPeriodModal({
  isOpen,
  onClose,
  period,
  onSubmit,
  isSubmitting = false
}: CreateEditPeriodModalProps) {
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [hasManualEndDate, setHasManualEndDate] = useState(false);

  const isEditMode = !!period;
  const isActivePeriod = period?.status === 'active';
  const isCompletedPeriod = period?.status === 'completed';
  const canEditStartDate = !isActivePeriod && !isCompletedPeriod;
  const canEditOtherDates = !isCompletedPeriod;

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors }
  } = useForm<EvaluationPeriodFormData>({
    defaultValues: {
      name: '',
      period_type: '四半期',
      start_date: '',
      end_date: '',
      goal_submission_deadline: '',
      evaluation_deadline: '',
      description: ''
    }
  });

  const watchedValues = watch();

  // Reset form when modal opens/closes or period changes
  useEffect(() => {
    if (isOpen) {
      if (period) {
        // Edit mode - populate with existing data
        reset({
          name: period.name,
          period_type: period.period_type,
          start_date: period.start_date,
          end_date: period.end_date,
          goal_submission_deadline: period.goal_submission_deadline,
          evaluation_deadline: period.evaluation_deadline,
          description: ''
        });
        setHasManualEndDate(true);
      } else {
        // Create mode - reset to defaults
        reset({
          name: '',
          period_type: '四半期',
          start_date: '',
          end_date: '',
          goal_submission_deadline: '',
          evaluation_deadline: '',
          description: ''
        });
        setHasManualEndDate(false);
      }
      setValidationErrors({});
    }
  }, [isOpen, period, reset]);

  // Smart date calculation
  useEffect(() => {
    if (watchedValues.start_date && watchedValues.period_type && !hasManualEndDate) {
      try {
        const startDate = parseDateFromISO(watchedValues.start_date);
        const calculatedEndDate = calculateEndDate(startDate, watchedValues.period_type);
        const endDateString = formatDateToISO(calculatedEndDate);

        setValue('end_date', endDateString);
      } catch (error) {
        console.error('Error calculating end date:', error);
      }
    }
  }, [watchedValues.start_date, watchedValues.period_type, hasManualEndDate, setValue]);

  // Handle form submission
  const onFormSubmit = async (data: EvaluationPeriodFormData) => {
    // Validate form data
    const formErrors = validateEvaluationPeriodForm(data);
    const businessErrors = validateBusinessRules(data);
    const allErrors = { ...formErrors, ...businessErrors };

    if (hasValidationErrors(allErrors)) {
      setValidationErrors(allErrors);
      return;
    }

    setValidationErrors({});

    try {
      // Filter out unchanged fields to avoid backend validation errors
      let submitData = { ...data };

      if (isEditMode && period) {
        // Only send fields that have actually changed
        const fieldsToCheck: (keyof EvaluationPeriodFormData)[] = [
          'name', 'period_type', 'start_date', 'end_date',
          'goal_submission_deadline', 'evaluation_deadline', 'description'
        ];

        // Build update object with only changed fields
        submitData = {} as EvaluationPeriodFormData;

        for (const field of fieldsToCheck) {
          if (data[field] !== period[field as keyof typeof period]) {
            (submitData as any)[field] = data[field];
          }
        }

        // Additional protection: don't send restricted fields for active/completed periods
        if (isActivePeriod || isCompletedPeriod) {
          if ('start_date' in submitData && data.start_date === period.start_date) {
            delete (submitData as any).start_date;
          }
        }

        if (isCompletedPeriod) {
          if ('end_date' in submitData && data.end_date === period.end_date) {
            delete (submitData as any).end_date;
          }
          if ('goal_submission_deadline' in submitData && data.goal_submission_deadline === period.goal_submission_deadline) {
            delete (submitData as any).goal_submission_deadline;
          }
        }
      }

      await onSubmit(submitData);
      onClose();
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  // Handle end date manual change
  const handleEndDateChange = (value: string) => {
    setHasManualEndDate(true);
    setValue('end_date', value);
  };

  // Handle period type change
  const handlePeriodTypeChange = (value: PeriodType) => {
    setValue('period_type', value);
    setHasManualEndDate(false); // Reset to allow auto-calculation
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar size={20} />
            {isEditMode ? '評価期間を編集' : '新しい評価期間を作成'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
          {/* Period Name */}
          <div className="space-y-2">
            <Label htmlFor="name">期間名 *</Label>
            <Controller
              name="name"
              control={control}
              rules={{ required: '期間名は必須です' }}
              render={({ field }) => (
                <Input
                  {...field}
                  id="name"
                  placeholder="例: 2024年第1四半期評価"
                  className={validationErrors.name ? 'border-red-500' : ''}
                />
              )}
            />
            {(validationErrors.name || errors.name) && (
              <p className="text-sm text-red-500">
                {validationErrors.name || errors.name?.message}
              </p>
            )}
          </div>

          {/* Period Type */}
          <div className="space-y-2">
            <Label htmlFor="period_type">期間タイプ *</Label>
            <Controller
              name="period_type"
              control={control}
              rules={{ required: '期間タイプを選択してください' }}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(value: PeriodType) => {
                    field.onChange(value);
                    handlePeriodTypeChange(value);
                  }}
                >
                  <SelectTrigger className={validationErrors.period_type ? 'border-red-500' : ''}>
                    <SelectValue placeholder="期間タイプを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PERIOD_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {(validationErrors.period_type || errors.period_type) && (
              <p className="text-sm text-red-500">
                {validationErrors.period_type || errors.period_type?.message}
              </p>
            )}
          </div>

          {/* Date Fields Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Start Date */}
            <div className="space-y-2">
              <Label htmlFor="start_date">開始日 *</Label>
              <Controller
                name="start_date"
                control={control}
                rules={{ required: '開始日は必須です' }}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="start_date"
                    type="date"
                    disabled={!canEditStartDate}
                    className={validationErrors.start_date ? 'border-red-500' : ''}
                  />
                )}
              />
              {(validationErrors.start_date || errors.start_date) && (
                <p className="text-sm text-red-500">
                  {validationErrors.start_date || errors.start_date?.message}
                </p>
              )}
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label htmlFor="end_date">終了日 *</Label>
              <Controller
                name="end_date"
                control={control}
                rules={{ required: '終了日は必須です' }}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="end_date"
                    type="date"
                    disabled={!canEditOtherDates}
                    onChange={(e) => {
                      field.onChange(e);
                      handleEndDateChange(e.target.value);
                    }}
                    className={validationErrors.end_date ? 'border-red-500' : ''}
                  />
                )}
              />
              {(validationErrors.end_date || errors.end_date) && (
                <p className="text-sm text-red-500">
                  {validationErrors.end_date || errors.end_date?.message}
                </p>
              )}
              {watchedValues.period_type !== 'その他' && !hasManualEndDate && (
                <p className="text-xs text-gray-500">
                  ※ 期間タイプに基づいて自動計算されます
                </p>
              )}
            </div>

            {/* Goal Submission Deadline */}
            <div className="space-y-2">
              <Label htmlFor="goal_submission_deadline">目標提出期限 *</Label>
              <Controller
                name="goal_submission_deadline"
                control={control}
                rules={{ required: '目標提出期限は必須です' }}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="goal_submission_deadline"
                    type="date"
                    disabled={!canEditOtherDates}
                    className={validationErrors.goal_submission_deadline ? 'border-red-500' : ''}
                  />
                )}
              />
              {(validationErrors.goal_submission_deadline || errors.goal_submission_deadline) && (
                <p className="text-sm text-red-500">
                  {validationErrors.goal_submission_deadline || errors.goal_submission_deadline?.message}
                </p>
              )}
            </div>

            {/* Evaluation Deadline */}
            <div className="space-y-2">
              <Label htmlFor="evaluation_deadline">評価期限 *</Label>
              <Controller
                name="evaluation_deadline"
                control={control}
                rules={{ required: '評価期限は必須です' }}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="evaluation_deadline"
                    type="date"
                    className={validationErrors.evaluation_deadline ? 'border-red-500' : ''}
                  />
                )}
              />
              {(validationErrors.evaluation_deadline || errors.evaluation_deadline) && (
                <p className="text-sm text-red-500">
                  {validationErrors.evaluation_deadline || errors.evaluation_deadline?.message}
                </p>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">説明 (任意)</Label>
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <Textarea
                  {...field}
                  id="description"
                  placeholder="評価期間に関する補足説明を入力してください"
                  rows={3}
                  className={validationErrors.description ? 'border-red-500' : ''}
                />
              )}
            />
            {validationErrors.description && (
              <p className="text-sm text-red-500">{validationErrors.description}</p>
            )}
          </div>

          {/* General Error Message */}
          {Object.keys(validationErrors).length > 0 && (
            <Alert variant="destructive">
              <AlertCircle size={16} />
              <AlertDescription>
                入力内容に問題があります。エラーメッセージを確認して修正してください。
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              キャンセル
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditMode ? '更新' : '作成'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}