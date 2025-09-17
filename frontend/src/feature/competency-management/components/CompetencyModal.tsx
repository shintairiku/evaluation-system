'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const [descriptions, setDescriptions] = useState<Record<string, string>>({
    '1': '',
    '2': '',
    '3': '',
    '4': '',
    '5': '',
  });

  // Update form fields when competency changes
  useEffect(() => {
    if (competency) {
      setName(competency.name || '');
      setStageId(competency.stageId || '');

      // Initialize descriptions
      const newDescriptions: Record<string, string> = {
        '1': '',
        '2': '',
        '3': '',
        '4': '',
        '5': '',
      };

      if (competency.description) {
        Object.entries(competency.description).forEach(([key, value]) => {
          if (key in newDescriptions) {
            newDescriptions[key] = value || '';
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
    const confirmed = window.confirm(`コンピテンシー「${competency.name}」を削除しますか？この操作は取り消せません。`);

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

      const newDescriptions: Record<string, string> = {
        '1': '',
        '2': '',
        '3': '',
        '4': '',
        '5': '',
      };

      if (competency.description) {
        Object.entries(competency.description).forEach(([key, value]) => {
          if (key in newDescriptions) {
            newDescriptions[key] = value || '';
          }
        });
      }

      setDescriptions(newDescriptions);
    }
    onClose();
  };

  const isFormValid = name.trim().length >= 1 && stageId;
  const selectedStage = stages.find(stage => stage.id === stageId);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isAdmin ? 'コンピテンシー編集' : 'コンピテンシー詳細'}
            </DialogTitle>
            <DialogDescription>
              {isAdmin
                ? 'コンピテンシーの詳細を編集できます。'
                : 'コンピテンシーの詳細を確認できます。'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="competency-name">
                コンピテンシー名 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="competency-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="コンピテンシー名を入力"
                disabled={isLoading || !isAdmin}
                maxLength={100}
              />
              <div className="text-xs text-gray-500">
                {name.length}/100文字
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="stage-select">
                ステージ <span className="text-red-500">*</span>
              </Label>
              <Select value={stageId} onValueChange={setStageId} disabled={isLoading || !isAdmin}>
                <SelectTrigger>
                  <SelectValue placeholder="ステージを選択" />
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
              <Label>理想的な行動（任意）</Label>
              {Object.entries(descriptions).map(([level, description]) => (
                <div key={level} className="grid gap-2">
                  <Label htmlFor={`description-${level}`} className="text-sm">
                    {level}
                  </Label>
                  <Textarea
                    id={`description-${level}`}
                    value={description}
                    onChange={(e) => setDescriptions(prev => ({ ...prev, [level]: e.target.value }))}
                    placeholder={`${level}の理想的な行動を入力（任意）`}
                    disabled={isLoading || !isAdmin}
                    maxLength={500}
                    rows={2}
                  />
                  <div className="text-xs text-gray-500">
                    {description.length}/500文字
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="flex justify-between">
            {isAdmin && competency && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isLoading}
                className="mr-auto"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                削除
              </Button>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
              >
                {isAdmin ? 'キャンセル' : '閉じる'}
              </Button>
              {isAdmin && (
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={!isFormValid || isLoading}
                >
                  {isLoading ? '保存中...' : '保存'}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}