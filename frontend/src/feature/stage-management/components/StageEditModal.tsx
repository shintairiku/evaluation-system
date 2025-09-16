'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import type { StageData } from '../types';
import { MODAL } from '../constants';

interface StageEditModalProps {
  /** Stage data to edit */
  stage: StageData | null;
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal closes */
  onClose: () => void;
  /** Callback when stage is updated */
  onSave: (stageId: string, title: string, description: string) => Promise<void>;
  /** Whether save operation is loading */
  isLoading?: boolean;
}

/**
 * Modal for editing stage title and description
 * Provides a centered dialog with form fields for stage editing
 */
export default function StageEditModal({
  stage,
  isOpen,
  onClose,
  onSave,
  isLoading = false,
}: StageEditModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Update form fields when stage changes
  useEffect(() => {
    if (stage) {
      setTitle(stage.name || '');
      setDescription(stage.description || '');
    }
  }, [stage]);

  const handleSave = async () => {
    if (!stage) return;

    try {
      await onSave(stage.id, title.trim(), description.trim());
      onClose();
    } catch (error) {
      // Error handling is done by parent component
      console.error('Failed to save stage:', error);
    }
  };

  const handleClose = () => {
    // Reset form when closing
    if (stage) {
      setTitle(stage.name || '');
      setDescription(stage.description || '');
    }
    onClose();
  };

  const isFormValid = title.trim().length >= MODAL.STAGE_EDIT.MIN_TITLE_LENGTH;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>ステージ編集</DialogTitle>
          <DialogDescription>
            ステージのタイトルと説明を編集できます。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="stage-title">
              タイトル <span className="text-red-500">*</span>
            </Label>
            <Input
              id="stage-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ステージのタイトルを入力"
              disabled={isLoading}
              maxLength={MODAL.STAGE_EDIT.MAX_TITLE_LENGTH}
            />
            <div className="text-xs text-gray-500">
              {title.length}/{MODAL.STAGE_EDIT.MAX_TITLE_LENGTH}文字
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="stage-description">説明</Label>
            <Textarea
              id="stage-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ステージの説明を入力（任意）"
              disabled={isLoading}
              maxLength={MODAL.STAGE_EDIT.MAX_DESCRIPTION_LENGTH}
              rows={3}
            />
            <div className="text-xs text-gray-500">
              {description.length}/{MODAL.STAGE_EDIT.MAX_DESCRIPTION_LENGTH}文字
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            キャンセル
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!isFormValid || isLoading}
          >
            {isLoading ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}