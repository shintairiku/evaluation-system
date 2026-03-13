'use client';

import { ExternalLink, Pencil, Trash2 } from 'lucide-react';
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
  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
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
