'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingButton } from '@/components/ui/loading-states';
import { Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import type { Competency, Stage, CompetencyDescription, UUID } from '@/api/types';
import { COMPETENCY_CONSTANTS, COMPETENCY_MESSAGES, type DescriptionLevel } from '../constants';

interface CompetencyModalProps {
  /** Competency data to edit/view */
  competency: Competency | null;
  /** Available stages for competency assignment */
  stages: Stage[];
  /** Whether the modal is open */
  isOpen: boolean;
  /** Whether the current user is admin */
  isAdmin: boolean;
  /** Callback when modal closes */
  onClose: () => void;
  /** Callback when competency is updated */
  onSave: (competencyId: UUID, data: { name: string; description?: CompetencyDescription; stageId: UUID }) => Promise<void>;
  /** Callback when competency is deleted */
  onDelete: (competencyId: UUID) => Promise<void>;
  /** Whether save/delete operation is loading */
  isLoading?: boolean;
}

/**
 * Modal for viewing and editing competency details
 * Admin users can edit, others can only view
 */
export default function CompetencyModal({
  competency,
  stages,
  isOpen,
  isAdmin,
  onClose,
  onSave,
  onDelete,
  isLoading = false,
}: CompetencyModalProps) {
  const [name, setName] = useState('');
  const [stageId, setStageId] = useState<UUID>('');
  const [descriptions, setDescriptions] = useState<Record<DescriptionLevel, string>>(
    COMPETENCY_CONSTANTS.DESCRIPTION_LEVELS.reduce((acc, level) => {
      acc[level] = '';
      return acc;
    }, {} as Record<DescriptionLevel, string>)
  );

  // Update form fields when competency changes
  useEffect(() => {
    if (competency) {
      setName(competency.name || '');
      setStageId(competency.stageId || '');

      // Initialize descriptions
      const newDescriptions = COMPETENCY_CONSTANTS.DESCRIPTION_LEVELS.reduce((acc, level) => {
        acc[level] = '';
        return acc;
      }, {} as Record<DescriptionLevel, string>);

      if (competency.description) {
        Object.entries(competency.description).forEach(([key, value]) => {
          if (COMPETENCY_CONSTANTS.DESCRIPTION_LEVELS.includes(key as DescriptionLevel)) {
            newDescriptions[key as DescriptionLevel] = value || '';
          }
        });
      }

      setDescriptions(newDescriptions);
    }
  }, [competency]);

  const handleSave = async () => {
    if (!competency || !isAdmin) return;

    // Filter out empty descriptions
    const filteredDescriptions: CompetencyDescription = {};
    Object.entries(descriptions).forEach(([key, value]) => {
      if (value.trim()) {
        filteredDescriptions[key] = value.trim();
      }
    });

    try {
      await onSave(competency.id, {
        name: name.trim(),
        description: Object.keys(filteredDescriptions).length > 0 ? filteredDescriptions : undefined,
        stageId,
      });
      onClose();
    } catch (error) {
      console.error('Failed to save competency:', error);
    }
  };

  const handleDelete = async () => {
    if (!competency || !isAdmin) return;

    // Simple window.confirm for now instead of AlertDialog
    const confirmed = window.confirm(COMPETENCY_MESSAGES.CONFIRM.DELETE(competency.name));

    if (!confirmed) return;

    try {
      await onDelete(competency.id);
      onClose();
    } catch (error) {
      console.error('Failed to delete competency:', error);
    }
  };

  const handleClose = () => {
    // Reset form when closing
    if (competency) {
      setName(competency.name || '');
      setStageId(competency.stageId || '');

      const newDescriptions = COMPETENCY_CONSTANTS.DESCRIPTION_LEVELS.reduce((acc, level) => {
        acc[level] = '';
        return acc;
      }, {} as Record<DescriptionLevel, string>);

      if (competency.description) {
        Object.entries(competency.description).forEach(([key, value]) => {
          if (COMPETENCY_CONSTANTS.DESCRIPTION_LEVELS.includes(key as DescriptionLevel)) {
            newDescriptions[key as DescriptionLevel] = value || '';
          }
        });
      }

      setDescriptions(newDescriptions);
    }
    onClose();
  };

  const isFormValid = name.trim().length >= COMPETENCY_CONSTANTS.VALIDATION.MIN_NAME_LENGTH && stageId;
  const selectedStage = stages.find(stage => stage.id === stageId);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className={`${COMPETENCY_CONSTANTS.MODAL.MAX_WIDTH} ${COMPETENCY_CONSTANTS.MODAL.MAX_HEIGHT} ${COMPETENCY_CONSTANTS.MODAL.OVERFLOW}`}>
          <DialogHeader>
            <DialogTitle>
              {isAdmin ? COMPETENCY_MESSAGES.MODAL.EDIT_TITLE : COMPETENCY_MESSAGES.MODAL.VIEW_TITLE}
            </DialogTitle>
            <DialogDescription>
              {isAdmin ? COMPETENCY_MESSAGES.MODAL.EDIT_DESCRIPTION : COMPETENCY_MESSAGES.MODAL.VIEW_DESCRIPTION}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="competency-name">
                {COMPETENCY_MESSAGES.LABELS.COMPETENCY_NAME} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="competency-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={COMPETENCY_MESSAGES.LABELS.PLACEHOLDER_NAME}
                disabled={isLoading || !isAdmin}
                maxLength={COMPETENCY_CONSTANTS.VALIDATION.MAX_NAME_LENGTH}
              />
              <div className="text-xs text-gray-500">
                {name.length}/{COMPETENCY_CONSTANTS.VALIDATION.MAX_NAME_LENGTH}文字
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="stage-select">
                {COMPETENCY_MESSAGES.LABELS.STAGE} <span className="text-red-500">*</span>
              </Label>
              <Select value={stageId} onValueChange={setStageId} disabled={isLoading || !isAdmin}>
                <SelectTrigger>
                  <SelectValue placeholder={COMPETENCY_MESSAGES.LABELS.PLACEHOLDER_STAGE} />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedStage?.description && (
                <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                  {selectedStage.description}
                </div>
              )}
            </div>

            <div className="grid gap-4">
              <Label>{COMPETENCY_MESSAGES.LABELS.IDEAL_BEHAVIORS}</Label>
              {Object.entries(descriptions).map(([level, description]) => (
                <div key={level} className="grid gap-2">
                  <Label htmlFor={`description-${level}`} className="text-sm">
                    {level}
                  </Label>
                  <Textarea
                    id={`description-${level}`}
                    value={description}
                    onChange={(e) => setDescriptions(prev => ({ ...prev, [level]: e.target.value }))}
                    placeholder={COMPETENCY_MESSAGES.LABELS.PLACEHOLDER_BEHAVIOR(level)}
                    disabled={isLoading || !isAdmin}
                    maxLength={COMPETENCY_CONSTANTS.VALIDATION.MAX_DESCRIPTION_LENGTH}
                    rows={2}
                  />
                  <div className="text-xs text-gray-500">
                    {description.length}/{COMPETENCY_CONSTANTS.VALIDATION.MAX_DESCRIPTION_LENGTH}文字
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="flex justify-between">
            {isAdmin && competency && (
              <LoadingButton
                type="button"
                variant="destructive"
                onClick={handleDelete}
                loading={isLoading}
                loadingText={COMPETENCY_MESSAGES.BUTTONS.DELETING}
                className="mr-auto"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {COMPETENCY_MESSAGES.BUTTONS.DELETE}
              </LoadingButton>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
              >
                {isAdmin ? COMPETENCY_MESSAGES.BUTTONS.CANCEL : COMPETENCY_MESSAGES.BUTTONS.CLOSE}
              </Button>
              {isAdmin && (
                <LoadingButton
                  type="button"
                  onClick={handleSave}
                  disabled={!isFormValid}
                  loading={isLoading}
                  loadingText={COMPETENCY_MESSAGES.BUTTONS.SAVING}
                >
                  {COMPETENCY_MESSAGES.BUTTONS.SAVE}
                </LoadingButton>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}