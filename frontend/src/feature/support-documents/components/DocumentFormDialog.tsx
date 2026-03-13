'use client';

import { useState, useEffect } from 'react';
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
import type { SupportDocument, SupportDocumentCreate, SupportDocumentUpdate } from '@/api/types';

interface DocumentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document?: SupportDocument | null;
  existingCategories: string[];
  onSubmit: (data: SupportDocumentCreate | SupportDocumentUpdate) => Promise<void>;
}

export default function DocumentFormDialog({
  open,
  onOpenChange,
  document,
  existingCategories,
  onSubmit,
}: DocumentFormDialogProps) {
  const isEditing = !!document;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState('general');
  const [displayOrder, setDisplayOrder] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (document) {
      setTitle(document.title);
      setDescription(document.description ?? '');
      setUrl(document.url ?? '');
      setCategory(document.category);
      setDisplayOrder(document.displayOrder);
    } else {
      setTitle('');
      setDescription('');
      setUrl('');
      setCategory('general');
      setDisplayOrder(0);
    }
  }, [document, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (isEditing) {
        const data: SupportDocumentUpdate = {
          title,
          description: description || undefined,
          url: url || undefined,
          category,
          displayOrder,
        };
        await onSubmit(data);
      } else {
        const data: SupportDocumentCreate = {
          title,
          description: description || undefined,
          url,
          category,
          displayOrder,
        };
        await onSubmit(data);
      }
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'ドキュメントを編集' : '新しいドキュメントを追加'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">タイトル *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: コンピテンシー評価基準"
              required
              maxLength={255}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">URL *</Label>
            <Input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://docs.google.com/..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">説明</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="このドキュメントの説明（任意）"
              rows={2}
              maxLength={2000}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">カテゴリ</Label>
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="general"
                list="category-suggestions"
                maxLength={100}
              />
              <datalist id="category-suggestions">
                {existingCategories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayOrder">表示順</Label>
              <Input
                id="displayOrder"
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(Number(e.target.value))}
                min={0}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
            <Button type="submit" disabled={isSubmitting || !title || !url}>
              {isSubmitting ? '保存中...' : isEditing ? '更新' : '追加'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
