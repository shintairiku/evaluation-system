'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
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
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        {title}
      </h2>
      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
            <p className="text-xs text-muted-foreground py-4">
              ここにドラッグして移動
            </p>
          )}
        </div>
      </SortableContext>
    </div>
  );
}
