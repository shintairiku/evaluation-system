'use client';

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
  if (documents.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        {title}
      </h2>
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
      </div>
    </div>
  );
}
