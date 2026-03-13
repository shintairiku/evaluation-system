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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  const [selectedCategory, setSelectedCategory] = useState('general');
  const [customCategory, setCustomCategory] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isCustomCategory = selectedCategory === '__new__';
  const category = isCustomCategory ? customCategory : selectedCategory;

  useEffect(() => {
    if (document) {
      setTitle(document.title);
      setDescription(document.description ?? '');
      setUrl(document.url ?? '');
      // If the document's category exists in the list, select it; otherwise treat as custom
      if (existingCategories.includes(document.category)) {
        setSelectedCategory(document.category);
        setCustomCategory('');
      } else {
        setSelectedCategory('__new__');
        setCustomCategory(document.category);
      }
    } else {
      setTitle('');
      setDescription('');
      setUrl('');
      setSelectedCategory(existingCategories[0] || 'general');
      setCustomCategory('');
    }
  }, [document, open, existingCategories]);

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
        };
        await onSubmit(data);
      } else {
        const data: SupportDocumentCreate = {
          title,
          description: description || undefined,
          url,
          category,
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

          <div className="space-y-2">
            <Label>カテゴリ</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="カテゴリを選択" />
              </SelectTrigger>
              <SelectContent>
                {existingCategories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
                <SelectItem value="__new__">+ 新しいカテゴリを作成</SelectItem>
              </SelectContent>
            </Select>
            {isCustomCategory && (
              <Input
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="新しいカテゴリ名を入力"
                maxLength={100}
                autoFocus
              />
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
            <Button type="submit" disabled={isSubmitting || !title || !url || (isCustomCategory && !customCategory)}>
              {isSubmitting ? '保存中...' : isEditing ? '更新' : '追加'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
