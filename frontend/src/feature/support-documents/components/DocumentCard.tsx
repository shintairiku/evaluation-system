'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ExternalLink, GripVertical, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { SupportDocument } from '@/api/types';

interface DocumentCardProps {
  document: SupportDocument;
  isAdmin: boolean;
  onEdit?: (document: SupportDocument) => void;
  onDelete?: (document: SupportDocument) => void;
}

function getDomain(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}


export default function DocumentCard({ document, isAdmin, onEdit, onDelete }: DocumentCardProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [faviconError, setFaviconError] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const domain = useMemo(() => getDomain(document.url), [document.url]);

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
      className={`group relative border-l-4 border-l-primary/60 hover:shadow-md hover:-translate-y-0.5 transition-all ${isDragging ? 'opacity-50 shadow-lg z-10' : ''}`}
    >
      <CardContent className="p-4">
        {/* Admin actions — absolute top-right */}
        {isAdmin && (
          <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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

        <div className="flex items-start gap-3">
          {/* Drag handle — admin only */}
          {isAdmin && isMounted && (
            <button
              type="button"
              className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground mt-1"
              {...listeners}
              {...attributes}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}

          {/* Favicon */}
          <div className="shrink-0 rounded-md bg-muted/50 p-1.5 mt-0.5">
            {domain && !faviconError ? (
              <img
                src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`}
                alt=""
                width={16}
                height={16}
                className="h-4 w-4"
                onError={() => setFaviconError(true)}
              />
            ) : (
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            )}
          </div>

          {/* Content */}
          <a
            href={document.url ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-w-0"
          >
            <h3 className="font-medium text-sm truncate group-hover:text-primary transition-colors pr-16">
              {document.title}
            </h3>
            {document.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {document.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              {domain && (
                <Badge variant="outline" className="text-[11px] font-normal px-1.5 py-0">
                  {domain}
                </Badge>
              )}
            </div>
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
