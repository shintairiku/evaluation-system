'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { SupportDocument } from '@/api/types';
import DocumentCard from './DocumentCard';

interface CategorySectionProps {
  title: string;
  documents: SupportDocument[];
  isAdmin: boolean;
  onEdit?: (document: SupportDocument) => void;
  onDelete?: (document: SupportDocument) => void;
}

export default function CategorySection({
  title,
  documents,
  isAdmin,
  onEdit,
  onDelete,
}: CategorySectionProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `category:${title}`,
    data: { category: title },
  });

  if (documents.length === 0 && !isAdmin) return null;

  const sortableIds = documents.map((doc) => doc.id);

  return (
    <div
      ref={setNodeRef}
      className={`space-y-3 rounded-lg p-3 -m-3 transition-colors ${
        isOver ? 'bg-accent/50 ring-2 ring-primary/20' : ''
      }`}
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {title}
          </h2>
          <Badge variant="secondary" className="text-[11px] px-1.5 py-0">
            {documents.length}件
          </Badge>
        </div>
        <Separator />
      </div>
      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              isAdmin={isAdmin}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
          {documents.length === 0 && isAdmin && (
            <div className="col-span-full rounded-lg border-2 border-dashed border-muted-foreground/25 py-6 text-center">
              <p className="text-xs text-muted-foreground">
                ここにドラッグして移動
              </p>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}
