'use client';

import { useState, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ExternalLink, GripVertical, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { SupportDocument } from '@/api/types';

interface DocumentCardProps {
  document: SupportDocument;
  isAdmin: boolean;
  onEdit?: (document: SupportDocument) => void;
  onDelete?: (document: SupportDocument) => void;
}

export default function DocumentCard({ document, isAdmin, onEdit, onDelete }: DocumentCardProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: document.id,
    data: { document },
    disabled: !isAdmin || !isMounted,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`group hover:shadow-md transition-shadow ${isDragging ? 'opacity-50 shadow-lg z-10' : ''}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Drag handle — admin only */}
          {isAdmin && isMounted && (
            <button
              type="button"
              className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground mt-0.5"
              {...listeners}
              {...attributes}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}

          <a
            href={document.url ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-w-0"
          >
            <div className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
              <h3 className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                {document.title}
              </h3>
            </div>
            {document.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 ml-6">
                {document.description}
              </p>
            )}
          </a>

          {isAdmin && (
            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onEdit?.(document)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => onDelete?.(document)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
